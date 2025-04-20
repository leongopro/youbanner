/**
 * Stable Diffusion控制器
 * 处理AI图像生成请求和任务管理
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const fsSync = require('fs'); // 同步方法
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const sharp = require('sharp');
const winston = require('winston');

// 定义根目录变量，用于路径解析
const rootDir = process.cwd();

// 引入稳定扩散服务
const stabilityService = require('../services/stability.service');
const translationUtils = require('../utils/translation');
const FormData = require('form-data');
const imageProcessingUtils = require('../utils/imageProcessing');

// 导入日志服务
const { logger, stabilityErrorLogger } = require('../services/logger.service');

// 存储生成任务的状态
const generationJobs = {};

// 设置任务数据保留时间(10分钟)
const JOB_TIMEOUT = 10 * 60 * 1000;

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
async function ensureDirectoryExists(dirPath) {
  try {
    if (!fsSync.existsSync(dirPath)) {
      fsSync.mkdirSync(dirPath, { recursive: true });
    }
    console.log(`确保目录存在: ${dirPath} ✓`);
  } catch (error) {
    console.error(`创建目录失败 ${dirPath}:`, error);
    throw error;
  }
}

// 在初始化时确保生成目录存在
const generatedDir = path.join(__dirname, '..', 'public', 'generated');
ensureDirectoryExists(generatedDir).catch(error => {
  console.error('初始化生成目录失败:', error);
});

/**
 * 生成背景图像
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 */
function generateImage(req, res) {
  try {
    const { 
      prompt, 
      negativePrompt,
      width = 1024, 
      height = 1024, 
      steps = 30, 
      guidanceScale = 7.5 
    } = req.body;

    // 记录开始生成请求
    logger.info('开始生成图像请求', {
      prompt: prompt ? (prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt) : null,
      width,
      height,
      steps,
      clientIp: req.ip,
      userAgent: req.headers['user-agent']
    });

    // 验证请求参数
    if (!prompt) {
      logger.warn('生成图像参数验证失败', { error: 'Missing prompt parameter' });
      return res.status(400).json({ error: 'Missing prompt parameter' });
    }

    // 创建一个唯一的作业ID
    const jobId = uuidv4();

    // 初始化作业状态
    generationJobs[jobId] = {
      status: 'processing',
      createdAt: new Date(),
      params: { prompt, negativePrompt, width, height, steps, guidanceScale }
    };

    logger.info('创建生成任务', { jobId, status: 'processing' });

    // 异步处理图像生成
    processImageGeneration(jobId).catch(error => {
      logger.error(`处理作业 ${jobId} 时出错:`, { 
        jobId, 
        error: error.message,
        stack: error.stack
      });
      
      console.error(`处理作业 ${jobId} 时出错:`, error);
      generationJobs[jobId] = {
        ...generationJobs[jobId],
        status: 'failed',
        error: error.message
      };
    });

    // 立即返回作业ID，让客户端稍后检查状态
    return res.status(202).json({
      jobId,
      status: 'processing'
    });
  } catch (error) {
    logger.error('生成图像请求处理错误', {
      error: error.message,
      stack: error.stack,
      clientIp: req.ip
    });
    
    console.error('生成图像请求错误:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

/**
 * 检查生成任务状态
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 */
function checkGenerationStatus(req, res) {
  const { jobId } = req.params;
  
  console.log('收到状态检查请求:', jobId);
  logger.info('收到状态检查请求', { jobId });

  // 检查作业是否存在
  if (!generationJobs[jobId]) {
    logger.warn('任务未找到', { jobId });
    return res.status(404).json({ 
      error: 'Job not found',
      message: '未找到该生成任务' 
    });
  }

  const job = generationJobs[jobId];
  console.log('任务状态:', job.status, '结果:', job.result);
  logger.info('返回任务状态', { jobId, status: job.status });

  // 返回作业状态
  return res.status(200).json({
    status: job.status,
    ...(job.result && { result: job.result }),
    ...(job.error && { error: job.error })
  });
}

/**
 * 处理图像生成过程
 * @param {string} jobId - 任务ID
 */
async function processImageGeneration(jobId) {
  const job = generationJobs[jobId];
  if (!job) throw new Error('任务不存在');

  try {
    logger.info('开始处理图像生成', { jobId, params: job.params });
    
    const { prompt, negativePrompt, width, height, steps, guidanceScale } = job.params;
    
    // 翻译提示词(如果是中文)
    let processedPrompt = prompt;
    let processedNegativePrompt = negativePrompt;

    if (translationUtils.containsChinese(prompt)) {
      logger.info(`检测到中文提示词，进行翻译`, { 
        jobId, 
        originalPrompt: prompt 
      });
      
      console.log(`检测到中文提示词，进行翻译: "${prompt}"`);
      processedPrompt = await translationUtils.translateToEnglish(prompt);
      
      logger.info(`翻译完成`, { 
        jobId, 
        originalPrompt: prompt,
        translatedPrompt: processedPrompt
      });
      
      console.log(`翻译结果: "${processedPrompt}"`);
    }

    if (negativePrompt && translationUtils.containsChinese(negativePrompt)) {
      processedNegativePrompt = await translationUtils.translateToEnglish(negativePrompt);
      
      logger.info(`负面提示词翻译完成`, {
        jobId,
        originalNegativePrompt: negativePrompt,
        translatedNegativePrompt: processedNegativePrompt
      });
    }

    // 调用Stability AI服务生成图像
    logger.info('调用Stability API服务', { 
      jobId, 
      prompt: processedPrompt.length > 100 ? processedPrompt.substring(0, 100) + '...' : processedPrompt
    });
    
    const imageBuffer = await stabilityService.generateImage({
      prompt: processedPrompt,
      negativePrompt: processedNegativePrompt,
      width,
      height,
      steps,
      guidanceScale
    });

    logger.info('图像生成成功，准备保存', { jobId, bufferSize: imageBuffer.length });

    // 生成文件名并保存图像
    const timestamp = Date.now();
    const filename = `bg-${timestamp}-${jobId.slice(0, 8)}.png`;
    const imageUrl = await stabilityService.saveImageToFile(imageBuffer, filename);

    logger.info('图像保存成功', { jobId, imageUrl, filename });

    // 更新任务状态为已完成
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      status: 'completed',
      result: {
        imageUrl,
        width: stabilityService.ensureDimensionValid(width),
        height: stabilityService.ensureDimensionValid(height)
      }
    };

    logger.info('图像生成任务完成', { 
      jobId, 
      status: 'completed', 
      result: {
        imageUrl,
        width: stabilityService.ensureDimensionValid(width),
        height: stabilityService.ensureDimensionValid(height)
      }
    });

    // 设置超时，清理旧任务数据
    setTimeout(() => {
      delete generationJobs[jobId];
      logger.debug('清理过期任务数据', { jobId });
    }, JOB_TIMEOUT);

  } catch (error) {
    logger.error('图像生成过程错误', {
      jobId,
      error: error.message,
      stack: error.stack
    });
    
    console.error('图像生成过程错误:', error);
    generationJobs[jobId].status = 'failed';
    generationJobs[jobId].error = error.message;

    // 即使失败也要在一段时间后清理任务数据
    setTimeout(() => {
      delete generationJobs[jobId];
      logger.debug('清理失败任务数据', { jobId });
    }, JOB_TIMEOUT);

    throw error;
  }
}

/**
 * 使用用户图像和提示词生成融合图像
 */
function generateImg2Img(req, res) {
  try {
    // 添加请求日志
    stabilityErrorLogger.info('接收到img2img请求', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      hasPrompt: !!req.body.prompt,
      hasUserImageUrl: !!req.body.userImageUrl
    });
    
    const { 
      prompt, 
      userImageUrl,
      backgroundImageUrl,
      negativePrompt = "text, watermark, logo, ugly, deformed, noisy, blurry, low contrast, bad quality, error, pixelated, jpeg artifacts, cut edges, artificial borders", 
      imageStrength = 0.15,
      steps = 60,
      guidanceScale = 8.5
    } = req.body;

    // 检查请求参数
    if (!prompt || !userImageUrl) {
      stabilityErrorLogger.warn('img2img请求缺少参数', {
        hasPrompt: !!prompt,
        hasUserImageUrl: !!userImageUrl
      });
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 记录关键参数
    stabilityErrorLogger.info('img2img处理关键参数', {
      promptLength: prompt.length,
      promptSample: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      imageStrength,
      steps,
      guidanceScale
    });

    // 生成唯一的任务ID
    const jobId = uuidv4();
    
    // 将任务信息存储到内存中
    generationJobs[jobId] = {
      status: 'processing',
      type: 'img2img',
      params: {
        prompt,
        userImageUrl,
        backgroundImageUrl,
        negativePrompt,
        imageStrength,
        steps,
        guidanceScale
      }
    };

    // 异步处理图像生成
    processImg2ImgGeneration(jobId).catch(error => {
      console.error('图像处理失败:', error);
      generationJobs[jobId].status = 'failed';
      generationJobs[jobId].error = error.message;
    });

    // 立即返回任务ID
    res.json({ 
      jobId,
      message: '开始处理图像融合，使用优化后的参数设置'
    });
  } catch (error) {
    // 记录错误
    stabilityErrorLogger.error('img2img请求处理错误', {
      error: error.message,
      stack: error.stack
    });
    console.error('处理img2img请求时出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

/**
 * 获取图像Buffer
 * @param {string} imageUrl - 图像URL
 * @returns {Promise<Buffer>} 图像Buffer
 */
async function fetchImageBuffer(imageUrl) {
  if (imageUrl.startsWith('http')) {
    // 如果是完整的URL，直接下载
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(imageResponse.data);
  } else {
    // 如果是相对路径，直接从本地文件系统读取
    const localPath = path.join(__dirname, '..', imageUrl.replace(/^\//, ''));
    if (!fsSync.existsSync(localPath)) {
      throw new Error(`本地图像不存在: ${localPath}`);
    }
    return fsSync.readFileSync(localPath);
  }
}

/**
 * 详细记录API错误
 * @param {string} operation - 操作名称
 * @param {string} jobId - 任务ID
 * @param {Error} error - 错误对象 
 * @param {Object} [additionalInfo] - 额外信息
 */
function logDetailedApiError(operation, jobId, error, additionalInfo = {}) {
  const errorInfo = {
    operation,
    jobId,
    errorMessage: error.message,
    errorName: error.name,
    errorCode: error.code || 'UNKNOWN',
    stack: error.stack,
    ...additionalInfo
  };
  
  // 如果错误来自API响应
  if (error.response) {
    errorInfo.statusCode = error.response.status;
    errorInfo.statusText = error.response.statusText;
    
    // 处理不同形式的响应数据
    if (error.response.data) {
      if (typeof error.response.data === 'string') {
        errorInfo.responseData = error.response.data.substring(0, 1000); // 限制长度
      } else {
        try {
          // 提取API错误ID和消息
          if (error.response.data.id) {
            errorInfo.apiErrorId = error.response.data.id;
          }
          if (error.response.data.name) {
            errorInfo.apiErrorName = error.response.data.name;
          }
          if (error.response.data.message) {
            errorInfo.apiErrorMessage = error.response.data.message;
          }
          
          errorInfo.responseData = JSON.stringify(error.response.data).substring(0, 1000);
        } catch (e) {
          errorInfo.responseData = '[无法序列化响应数据]';
        }
      }
    }
    
    // 特殊处理某些API错误
    if (error.response.status === 400) {
      if (error.response.data && error.response.data.name === 'invalid_language') {
        errorInfo.recommendedAction = '请确保所有提示词都使用英文';
        error.message = `API仅支持英文提示词: ${error.response.data.message}`;
      }
    } else if (error.response.status === 401) {
      errorInfo.recommendedAction = '请检查API密钥是否有效';
    } else if (error.response.status === 429) {
      errorInfo.recommendedAction = 'API请求频率受限，请降低请求速率';
    }
  }
  
  // 记录到专用错误日志
  stabilityErrorLogger.error(`API错误: ${operation} 失败`, errorInfo);
  
  // 同时记录到控制台
  console.error(`[${operation}] 错误:`, error.message);
  if (errorInfo.apiErrorMessage) {
    console.error(`API错误消息: ${errorInfo.apiErrorMessage}`);
  }
  if (errorInfo.recommendedAction) {
    console.error(`建议操作: ${errorInfo.recommendedAction}`);
  }
  
  return errorInfo;
}

/**
 * 处理img2img图像生成
 */
async function processImg2ImgGeneration(jobId) {
  const job = generationJobs[jobId];
  if (!job) throw new Error('任务不存在');

  try {
    logger.info('开始处理img2img生成', { jobId, params: job.params });
    
    const { 
      prompt, 
      userImageUrl, 
      backgroundImageUrl, 
      negativePrompt, 
      imageStrength, 
      steps, 
      guidanceScale 
    } = job.params;

    // 翻译提示词(如果是中文)
    let processedPrompt = prompt;
    let processedNegativePrompt = negativePrompt;

    if (translationUtils.containsChinese(prompt)) {
      logger.info(`检测到中文提示词，进行翻译`, { 
        jobId, 
        originalPrompt: prompt 
      });
      
      console.log(`检测到中文提示词，进行翻译: "${prompt}"`);
      processedPrompt = await translationUtils.translateToEnglish(prompt);
      
      logger.info(`翻译完成`, { 
        jobId, 
        originalPrompt: prompt,
        translatedPrompt: processedPrompt
      });
      
      console.log(`翻译结果: "${processedPrompt}"`);
    }

    if (negativePrompt && translationUtils.containsChinese(negativePrompt)) {
      logger.info(`检测到中文负面提示词，进行翻译`, {
        jobId,
        originalNegativePrompt: negativePrompt
      });
      
      processedNegativePrompt = await translationUtils.translateToEnglish(negativePrompt);
      
      logger.info(`负面提示词翻译完成`, {
        jobId,
        originalNegativePrompt: negativePrompt,
        translatedNegativePrompt: processedNegativePrompt
      });
      
      console.log(`负面提示词翻译结果: "${processedNegativePrompt}"`);
    }

    // 处理用户图片
    let userImageBuffer = await fetchImageBuffer(userImageUrl);
    let compositeBuffer = userImageBuffer; // 默认使用用户图像
    
    // 如果提供了背景图像URL，进行预合成处理
    if (backgroundImageUrl) {
      try {
        console.log('检测到背景图像URL，开始预合成处理...');
        const bgImageBuffer = await fetchImageBuffer(backgroundImageUrl);
        
        // 获取图像信息
        const userImgMetadata = await sharp(userImageBuffer).metadata();
        const bgImgMetadata = await sharp(bgImageBuffer).metadata();
        console.log(`用户图像尺寸: ${userImgMetadata.width}x${userImgMetadata.height}`);
        console.log(`背景图像尺寸: ${bgImgMetadata.width}x${bgImgMetadata.height}`);
        
        // 对用户图像进行羽化处理
        const featherRadius = Math.max(20, Math.min(60, Math.floor(Math.min(userImgMetadata.width, userImgMetadata.height) * 0.08)));
        console.log(`应用边缘羽化处理，羽化半径: ${featherRadius}px`);
        
        // 创建渐变蒙版 - 中心不透明，边缘渐变透明
        const maskWidth = userImgMetadata.width;
        const maskHeight = userImgMetadata.height;
        
        // 内部完全不透明区域的比例
        const coreSize = 0.65; // 中心65%区域保持完全不透明
        const coreWidth = Math.floor(maskWidth * coreSize);
        const coreHeight = Math.floor(maskHeight * coreSize);
        const leftMargin = Math.floor((maskWidth - coreWidth) / 2);
        const topMargin = Math.floor((maskHeight - coreHeight) / 2);
        
        // 创建一个径向渐变蒙版
        const maskSvg = `
          <svg width="${maskWidth}" height="${maskHeight}">
            <defs>
              <radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stop-color="white" stop-opacity="1" />
                <stop offset="65%" stop-color="white" stop-opacity="1" />
                <stop offset="100%" stop-color="black" stop-opacity="1" />
              </radialGradient>
            </defs>
            <rect width="${maskWidth}" height="${maskHeight}" fill="url(#grad)" />
          </svg>
        `;
        
        // 使用创建的SVG作为蒙版，并进行高斯模糊以创建渐变效果
        const mask = await sharp(Buffer.from(maskSvg))
          .blur(featherRadius)
          .toBuffer();
        
        // 应用蒙版到原始图像
        const featheredUserImage = await sharp(userImageBuffer)
          .ensureAlpha()
          .composite([{
            input: mask,
            blend: 'multiply'
          }])
          .toBuffer();
        
        console.log('成功应用增强的边缘羽化效果');
        
        // 调整背景图像大小以确保合适的尺寸
        let resizedBgImage = bgImageBuffer;
        if (bgImgMetadata.width < 1024 || bgImgMetadata.height < 1024) {
          console.log('背景图像尺寸较小，进行放大处理...');
          resizedBgImage = await sharp(bgImageBuffer)
            .resize(Math.max(1024, bgImgMetadata.width), Math.max(1024, bgImgMetadata.height), {
              fit: 'inside'
            })
            .toBuffer();
          
          // 更新背景元数据
          const newBgMetadata = await sharp(resizedBgImage).metadata();
          console.log(`调整后的背景图像尺寸: ${newBgMetadata.width}x${newBgMetadata.height}`);
        }
        
        // 计算用户图像在背景中的位置（居中）
        const resizedBgMetadata = await sharp(resizedBgImage).metadata();
        const left = Math.max(0, Math.floor((resizedBgMetadata.width - userImgMetadata.width) / 2));
        const top = Math.max(0, Math.floor((resizedBgMetadata.height - userImgMetadata.height) / 2));
        
        // 将羽化后的用户图像合成到背景上
        compositeBuffer = await sharp(resizedBgImage)
          .composite([{
            input: featheredUserImage,
            left,
            top,
            blend: 'over'
          }])
          .toBuffer();
        
        console.log('成功完成预合成处理，将合成图像发送给StableDiffusion处理');
      } catch (compositeError) {
        console.error('预合成处理失败:', compositeError);
        console.log('将继续使用原始用户图像');
        // 如果预合成失败，继续使用原始图像
        compositeBuffer = userImageBuffer;
      }
    } else if (imageStrength > 0) {
      // 如果没有背景图像，只对用户图像进行羽化处理
      try {
        // 获取图像信息
        const imageMetadata = await sharp(userImageBuffer).metadata();
        
        // 计算羽化半径 - 根据图像大小和imageStrength自动调整
        const featherRadius = Math.max(20, Math.min(50, Math.floor(Math.min(imageMetadata.width, imageMetadata.height) * 0.05)));
        console.log(`应用边缘羽化处理，羽化半径: ${featherRadius}px`);
        
        // 创建渐变蒙版 - 中心不透明，边缘渐变透明
        const maskWidth = imageMetadata.width;
        const maskHeight = imageMetadata.height;
        
        // 内部完全不透明区域的比例
        const coreSize = 0.7; // 中心70%区域保持完全不透明
        const coreWidth = Math.floor(maskWidth * coreSize);
        const coreHeight = Math.floor(maskHeight * coreSize);
        const leftMargin = Math.floor((maskWidth - coreWidth) / 2);
        const topMargin = Math.floor((maskHeight - coreHeight) / 2);
        
        // 创建一个黑色背景，中心区域为白色的蒙版
        const maskSvg = `
          <svg width="${maskWidth}" height="${maskHeight}">
            <rect width="${maskWidth}" height="${maskHeight}" fill="black"/>
            <rect x="${leftMargin}" y="${topMargin}" width="${coreWidth}" height="${coreHeight}" fill="white"/>
          </svg>
        `;
        
        // 使用创建的SVG作为蒙版，并进行高斯模糊以创建渐变效果
        const mask = await sharp(Buffer.from(maskSvg))
          .blur(featherRadius)
          .toBuffer();
        
        // 应用蒙版到原始图像
        compositeBuffer = await sharp(userImageBuffer)
          .ensureAlpha()
          .composite([{
            input: mask,
            blend: 'multiply'
          }])
          .toBuffer();
        
        console.log('成功应用边缘羽化效果');
      } catch (featherError) {
        console.error('边缘羽化处理失败:', featherError);
        // 如果羽化失败，继续使用原始图像
        compositeBuffer = userImageBuffer;
      }
    }

    // 在发送到Stability API之前，确保图像尺寸符合SDXL要求
    console.log('调整图像尺寸以符合SDXL要求...');
    compositeBuffer = await stabilityService.adjustToSDXLDimensions(compositeBuffer);
    console.log('图像尺寸调整完成，准备发送到Stability API');
    
    // 调用img2img服务时使用翻译后的提示词
    logger.info('准备调用Stability img2img API...', {
      jobId,
      translatedPrompt: processedPrompt.substring(0, 100) + (processedPrompt.length > 100 ? '...' : '')
    });
    
    // 调用img2img服务生成图像
    const resultBuffer = await stabilityService.generateImg2Img({
      prompt: processedPrompt, // 使用翻译后的提示词
      negativePrompt: processedNegativePrompt, // 使用翻译后的负面提示词
      imageBuffer: compositeBuffer,
      imageStrength,
      steps,
      guidanceScale
    });

    // 生成文件名并保存图像
    const timestamp = Date.now();
    const filename = `img2img_${timestamp}-${jobId.slice(0, 8)}.png`;
    const imageUrl = await stabilityService.saveImageToFile(resultBuffer, filename);

    // 更新任务状态为已完成
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      status: 'completed',
      result: {
        imageUrl,
        width: stabilityService.ensureDimensionValid(resultBuffer.length),
        height: stabilityService.ensureDimensionValid(resultBuffer.length)
      }
    };

    // 设置超时，清理旧任务数据
    setTimeout(() => {
      delete generationJobs[jobId];
    }, JOB_TIMEOUT);

  } catch (error) {
    // 使用新的错误记录函数
    const errorInfo = logDetailedApiError('img2img生成', jobId, error, {
      params: job.params ? {
        prompt: job.params.prompt ? (job.params.prompt.substring(0, 100) + (job.params.prompt.length > 100 ? '...' : '')) : null,
        hasUserImage: !!job.params.userImageUrl,
        hasBackgroundImage: !!job.params.backgroundImageUrl,
        imageStrength: job.params.imageStrength
      } : null
    });
    
    // 更新作业状态为失败，包含详细的错误信息
    generationJobs[jobId].status = 'failed';
    generationJobs[jobId].error = error.message;
    
    // 添加更详细的错误信息
    if (errorInfo.apiErrorName) {
      generationJobs[jobId].errorDetails = {
        name: errorInfo.apiErrorName,
        message: errorInfo.apiErrorMessage,
        id: errorInfo.apiErrorId,
        recommendedAction: errorInfo.recommendedAction
      };
    }

    // 即使失败也要在一段时间后清理任务数据
    setTimeout(() => {
      delete generationJobs[jobId];
      logger.debug('清理失败任务数据', { jobId });
    }, JOB_TIMEOUT);

    throw error;
  }
}

/**
 * 生成测试图像(当API密钥未配置时使用)
 * @param {string} prompt - 提示词
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @param {Buffer} [baseImage] - 基础图像(用于img2img)
 * @returns {Promise<Buffer>} 图像数据Buffer
 */
async function generateTestImage(prompt, width, height, baseImage = null) {
  console.log('生成测试图像', { prompt, width, height, hasBaseImage: !!baseImage });
  
  try {
    let imageBuffer;
    
    if (baseImage) {
      // 如果有基础图像(用于img2img测试)，在图像上添加文字标识
      const metadata = await sharp(baseImage).metadata();
      
      // 调整大小以确保正确显示
      width = metadata.width || width;
      height = metadata.height || height;
      
      // 创建一个半透明的覆盖层，添加测试信息
      const overlayText = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.3)" />
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
            Img2Img测试模式
          </text>
          <text x="50%" y="50%" dy="30" font-family="Arial" font-size="16" fill="white" text-anchor="middle">
            (API密钥未配置)
          </text>
          <text x="50%" y="50%" dy="60" font-family="Arial" font-size="14" fill="white" text-anchor="middle">
            提示词: ${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}
          </text>
        </svg>
      `;
      
      // 将覆盖层合成到原图上
      imageBuffer = await sharp(baseImage)
        .composite([{
          input: Buffer.from(overlayText),
          blend: 'over'
        }])
        .png()
        .toBuffer();
    } else {
      // 为纯文本生成创建渐变背景
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#8a2be2" />
              <stop offset="50%" stop-color="#4b0082" />
              <stop offset="100%" stop-color="#483d8b" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)" />
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
            测试图像: ${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}
          </text>
          <text x="50%" y="50%" dy="30" font-family="Arial" font-size="16" fill="white" text-anchor="middle">
            API密钥未配置，这是示例图像
          </text>
        </svg>
      `;
      
      // 使用sharp将SVG转换为PNG
      imageBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
    }

    return imageBuffer;
  } catch (error) {
    console.error('生成测试图像错误:', error);
    throw new Error(`测试图像生成失败: ${error.message}`);
  }
}

/**
 * 使用Inpaint功能进行图像编辑
 */
function inpaintImage(req, res) {
  try {
    const { 
      prompt, 
      imageUrl,
      maskUrl,
      negativePrompt = '', 
      guidanceScale = 7.5,
      steps = 40
    } = req.body;

    // 打印环境信息，帮助调试
    console.log('Inpaint环境变量检查:');
    console.log('- STABILITY_API_KEY 存在:', !!process.env.STABILITY_API_KEY);
    console.log('- STABLE_DIFFUSION_API_KEY 存在:', !!process.env.STABLE_DIFFUSION_API_KEY);

    if (!prompt || !imageUrl || !maskUrl) {
      return res.status(400).json({ error: '缺少必要参数: prompt, imageUrl, maskUrl' });
    }

    // 创建一个唯一的作业ID
    const jobId = uuidv4();

    // 初始化作业状态
    generationJobs[jobId] = {
      status: 'processing',
      type: 'inpaint',
      createdAt: new Date(),
      params: { prompt, imageUrl, maskUrl, negativePrompt, guidanceScale, steps }
    };

    // 异步处理图像生成
    processInpaintGeneration(jobId).catch(error => {
      console.error(`处理Inpaint作业 ${jobId} 时出错:`, error);
      generationJobs[jobId] = {
        ...generationJobs[jobId],
        status: 'failed',
        error: error.message
      };
    });

    // 立即返回作业ID，让客户端稍后检查状态
    return res.status(202).json({
      jobId,
      status: 'processing'
    });
  } catch (error) {
    console.error('Inpaint请求错误:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

/**
 * 处理Inpaint图像生成过程
 * @param {string} jobId - 任务ID
 */
async function processInpaintGeneration(jobId) {
  const job = generationJobs[jobId];
  if (!job) throw new Error('任务不存在');

  try {
    const { prompt, imageUrl, maskUrl, negativePrompt, guidanceScale, steps } = job.params;
    
    // 获取原始图像和蒙版图像
    const imageBuffer = await fetchImageBuffer(imageUrl);
    const maskBuffer = await fetchImageBuffer(maskUrl);
    
    console.log(`获取图像成功, 原图大小: ${imageBuffer.length}, 蒙版大小: ${maskBuffer.length}`);
    
    // 准备API请求参数
    const apiKey = process.env.STABILITY_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;
    
    if (!apiKey) {
      throw new Error('StabilityAI API密钥未配置');
    }
    
    // 使用v2beta版本的inpaint API
    const apiHost = 'https://api.stability.ai';
    const apiPath = '/v2beta/stable-image/edit/inpaint';
    
    console.log('使用API端点:', apiHost + apiPath);
    
    // 准备FormData内容
    const payload = {
      image: imageBuffer,
      mask: maskBuffer,
      prompt: prompt,
    };
    
    // 添加可选参数
    if (negativePrompt) {
      payload.negative_prompt = negativePrompt;
    }
    
    if (steps) {
      payload.steps = steps.toString();
    }
    
    if (guidanceScale) {
      payload.cfg_scale = guidanceScale.toString();
    }
    
    console.log('请求参数:', {
      prompt,
      negative_prompt: negativePrompt,
      steps,
      cfg_scale: guidanceScale
    });
    
    // 创建FormData
    const FormData = require('form-data');
    const form = new FormData();
    
    // 添加所有参数到FormData
    form.append('image', imageBuffer, { filename: 'image.png', contentType: 'image/png' });
    form.append('mask', maskBuffer, { filename: 'mask.png', contentType: 'image/png' });
    form.append('prompt', prompt);
    
    if (negativePrompt) {
      form.append('negative_prompt', negativePrompt);
    }
    
    if (steps) {
      form.append('steps', steps.toString());
    }
    
    if (guidanceScale) {
      form.append('cfg_scale', guidanceScale.toString());
    }
    
    try {
      // 发送请求
      console.log('发送inpaint API请求...');
      const response = await axios.post(
        apiHost + apiPath,
        form,
        {
          validateStatus: undefined,
          responseType: 'arraybuffer',
          headers: {
            ...form.getHeaders(),
            'Accept': 'image/*',
            'Authorization': `Bearer ${apiKey}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      console.log('收到inpaint API响应, 状态码:', response.status);
      
      // 检查响应状态
      if (response.status === 200) {
        // 成功获取图像数据
        const outputBuffer = Buffer.from(response.data);
        
        // 保存生成的图片
        const outputFileName = `inpaint_${jobId}.png`;
        const outputDir = path.join(__dirname, '..', 'public', 'generated');
        
        // 确保输出目录存在
        if (!fsSync.existsSync(outputDir)) {
          fsSync.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, outputFileName);
        await fs.writeFile(outputPath, outputBuffer);
        
        // 更新任务状态
        generationJobs[jobId].status = 'completed';
        generationJobs[jobId].result = {
          imageUrl: `/generated/${outputFileName}`
        };
        
        // 设置清理定时器
        setTimeout(() => {
          delete generationJobs[jobId];
        }, JOB_TIMEOUT);
      } else {
        // 处理错误响应
        const errorText = response.data.toString();
        console.error('API错误:', response.status, errorText);
        throw new Error(`API错误 (${response.status}): ${errorText}`);
      }
    } catch (apiError) {
      console.error('inpaint API请求失败:', apiError.message);
      if (apiError.response) {
        console.error('API错误状态码:', apiError.response.status);
        try {
          const errorText = apiError.response.data.toString();
          console.error('API错误详情:', errorText);
          throw new Error(`API请求失败 (${apiError.response.status}): ${errorText}`);
        } catch (parseError) {
          console.error('无法解析错误响应:', parseError);
          throw new Error(`API请求失败 (${apiError.response.status})`);
        }
      } else {
        throw new Error(`API请求失败: ${apiError.message}`);
      }
    }
  } catch (error) {
    console.error('处理inpaint生成时出错:', error);
    generationJobs[jobId].status = 'failed';
    generationJobs[jobId].error = error.message;
    throw error;
  }
}

/**
 * 使用Search and Replace功能修改图像
 */
function searchAndReplace(req, res) {
  try {
    const { 
      prompt,
      target_prompt, 
      imageUrl,
      negativePrompt = '', 
      guidanceScale = 7.5,
      steps = 40
    } = req.body;

    // 打印环境信息，帮助调试
    console.log('Search-Replace环境变量检查:');
    console.log('- STABILITY_API_KEY 存在:', !!process.env.STABILITY_API_KEY);
    console.log('- STABLE_DIFFUSION_API_KEY 存在:', !!process.env.STABLE_DIFFUSION_API_KEY);

    if (!prompt || !target_prompt || !imageUrl) {
      return res.status(400).json({ error: '缺少必要参数: prompt, target_prompt, imageUrl' });
    }

    // 创建一个唯一的作业ID
    const jobId = uuidv4();

    // 初始化作业状态
    generationJobs[jobId] = {
      status: 'processing',
      type: 'search-replace',
      createdAt: new Date(),
      params: { prompt, target_prompt, imageUrl, negativePrompt, guidanceScale, steps }
    };

    // 异步处理图像生成
    processSearchReplaceGeneration(jobId).catch(error => {
      console.error(`处理Search-Replace作业 ${jobId} 时出错:`, error);
      generationJobs[jobId] = {
        ...generationJobs[jobId],
        status: 'failed',
        error: error.message
      };
    });

    // 立即返回作业ID，让客户端稍后检查状态
    return res.status(202).json({
      jobId,
      status: 'processing'
    });
  } catch (error) {
    console.error('Search-Replace请求错误:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

/**
 * 处理Search and Replace图像生成过程
 * @param {string} jobId - 任务ID
 */
async function processSearchReplaceGeneration(jobId) {
  const job = generationJobs[jobId];
  if (!job) throw new Error('任务不存在');

  try {
    const { prompt, target_prompt, imageUrl, negativePrompt, guidanceScale, steps } = job.params;
    
    // 获取原始图像
    const imageBuffer = await fetchImageBuffer(imageUrl);
    
    console.log(`获取图像成功, 图像大小: ${imageBuffer.length}`);
    
    // 准备API请求参数
    const apiKey = process.env.STABILITY_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;
    
    if (!apiKey) {
      throw new Error('StabilityAI API密钥未配置');
    }
    
    // 使用v1版API
    const apiHost = 'https://api.stability.ai';
    const engineId = 'stable-diffusion-xl-1024-v1-0';
    
    // 确保图像格式正确
    let processedImageBuffer = imageBuffer;
    try {
      const imageInfo = await sharp(imageBuffer).metadata();
      
      console.log('原始图像信息:', {
        format: imageInfo.format,
        width: imageInfo.width,
        height: imageInfo.height
      });
      
      // 确保是PNG格式
      if (imageInfo.format !== 'png') {
        console.log('转换图像为PNG格式');
        processedImageBuffer = await sharp(imageBuffer)
          .png()
          .toBuffer();
      }
    } catch (imgError) {
      console.error('图像格式处理错误:', imgError);
    }
    
    // 创建FormData
    const FormData = require('form-data');
    const form = new FormData();
    
    // 添加图像数据
    form.append('init_image', processedImageBuffer, {
      filename: 'image.png',
      contentType: 'image/png'
    });
    
    // 添加文本提示词
    form.append('text_prompts[0][text]', target_prompt);
    form.append('text_prompts[0][weight]', '1.0');
    
    // 添加负面提示词
    if (negativePrompt) {
      form.append('text_prompts[1][text]', negativePrompt);
      form.append('text_prompts[1][weight]', '-1.0');
    }
    
    // 添加其他参数
    form.append('cfg_scale', guidanceScale.toString());
    form.append('samples', '1');
    form.append('steps', steps.toString());
    form.append('image_strength', '0.35'); // 控制原始图像的保留程度
    
    // 这里添加search_prompt，表示要搜索和替换的内容
    form.append('search_prompt', prompt);
    
    console.log('发送image-to-image API请求（带有search_prompt）...');
    console.log('请求端点:', `${apiHost}/v1/generation/${engineId}/image-to-image`);
    console.log('请求参数:', {
      search_prompt: prompt,
      target_prompt: target_prompt,
      negative_prompt: negativePrompt,
      cfg_scale: guidanceScale,
      steps: steps,
      image_strength: 0.35
    });
    
    try {
      // 由于v1 API可能不直接支持search-and-replace，我们尝试使用image-to-image API并添加search_prompt参数
      const response = await axios.post(
        `${apiHost}/v1/generation/${engineId}/image-to-image`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      console.log('收到API响应, 状态码:', response.status);
      console.log('响应头:', response.headers);
      console.log('响应数据结构:', Object.keys(response.data));
      
      // 处理响应
      if (response.data && response.data.artifacts && response.data.artifacts.length > 0) {
        const imageData = response.data.artifacts[0];
        const outputBuffer = Buffer.from(imageData.base64, 'base64');
        
        // 保存生成的图片
        const outputFileName = `search_replace_${jobId}.png`;
        const outputDir = path.join(__dirname, '..', 'public', 'generated');
        
        // 确保输出目录存在
        if (!fsSync.existsSync(outputDir)) {
          fsSync.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, outputFileName);
        await fs.writeFile(outputPath, outputBuffer);
        
        // 更新任务状态
        generationJobs[jobId].status = 'completed';
        generationJobs[jobId].result = {
          imageUrl: `/generated/${outputFileName}`
        };
        
        // 设置清理定时器
        setTimeout(() => {
          delete generationJobs[jobId];
        }, JOB_TIMEOUT);
      } else {
        throw new Error('API未返回有效的图像数据');
      }
    } catch (apiError) {
      console.error('API请求失败:', apiError.message);
      if (apiError.response) {
        console.error('API错误状态码:', apiError.response.status);
        console.error('API错误详情:', apiError.response.data);
        throw new Error(`API请求失败 (${apiError.response.status}): ${JSON.stringify(apiError.response.data)}`);
      } else {
        throw new Error(`API请求失败: ${apiError.message}`);
      }
    }
  } catch (error) {
    console.error('处理search-replace生成时出错:', error);
    generationJobs[jobId].status = 'failed';
    generationJobs[jobId].error = error.message;
    throw error;
  }
}

/**
 * 头像合成功能 - 将用户头像与背景图像合成
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
function avatarComposition(req, res) {
  try {
    const { prompt, avatarUrl, backgroundUrl, imageStrength, steps, guidanceScale, negativePrompt, position, x, y, cropShape, scale, removeBackground, enhancedRemoveBackground, threshold, tolerance } = req.body;

    // 添加额外字段来识别可能的问题
    console.log(`\n[头像合成-路径分析] =================================`);
    console.log(`[头像合成-路径分析] 原始头像路径: "${avatarUrl}"`);
    console.log(`[头像合成-路径分析] 原始背景路径: "${backgroundUrl}"`);
    
    // 检查是否是目录路径
    const rootDir = path.resolve(__dirname, '../..');
    const isDirectory = (pathStr) => {
      try {
        if (typeof pathStr !== 'string') return false;
        if (pathStr.startsWith('data:')) return false;
        
        // 尝试一些可能的路径解析方式
        const possiblePaths = [
          pathStr,
          path.join(rootDir, pathStr),
          path.isAbsolute(pathStr) ? pathStr : path.join(rootDir, pathStr)
        ];
        
        for (const p of possiblePaths) {
          if (fsSync.existsSync(p)) {
            const stats = fsSync.statSync(p);
            if (stats.isDirectory()) {
              console.log(`[头像合成-路径分析] 检测到目录路径: ${p}`);
              return { isDir: true, path: p };
            }
          }
        }
        
        return false;
      } catch (err) {
        console.error(`[头像合成-路径分析] 检查路径出错: ${err.message}`);
        return false;
      }
    };
    
    // 修改后的头像和背景URL
    let modifiedAvatarUrl = avatarUrl;
    let modifiedBackgroundUrl = backgroundUrl;
    
    // 检查并处理头像路径
    const avatarDirInfo = isDirectory(avatarUrl);
    if (avatarDirInfo) {
      console.log(`[头像合成-路径分析] 头像URL指向目录，将使用默认头像文件`);
      
      // 创建一个默认头像 - 使用预设的PNG头像而不是生成
      const defaultAvatarPath = path.join(avatarDirInfo.path, `default_avatar_${Date.now()}.png`);
      
      try {
        // 使用小的预设头像数据
        const defaultAvatarData = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 
          0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, 0x40,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x25, 0x0B, 0xE0, 0x89, 0x00, 0x00, 0x00,
          0x06, 0x62, 0x4B, 0x47, 0x44, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0xA0,
          0xBD, 0xA7, 0x93, 0x00, 0x00, 0x00, 0x09, 0x70, 0x48, 0x59, 0x73, 0x00,
          0x00, 0x0B, 0x13, 0x00, 0x00, 0x0B, 0x13, 0x01, 0x00, 0x9A, 0x9C, 0x18,
          0x00, 0x00, 0x00, 0x07, 0x74, 0x49, 0x4D, 0x45, 0x07, 0xE6, 0x04, 0x12,
          0x08, 0x27, 0x39, 0xA5, 0x41, 0x7E, 0xF9, 0x00, 0x00, 0x00, 0x1D, 0x69,
          0x54, 0x58, 0x74, 0x43, 0x6F, 0x6D, 0x6D, 0x65, 0x6E, 0x74, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x43, 0x72, 0x65, 0x61, 0x74, 0x65, 0x64, 0x20, 0x77,
          0x69, 0x74, 0x68, 0x20, 0x47, 0x49, 0x4D, 0x50, 0x64, 0x2E, 0x65, 0x07,
          0x00, 0x00, 0x00, 0x20, 0x49, 0x44, 0x41, 0x54, 0x78, 0xDA, 0xED, 0xC1,
          0x81, 0x00, 0x00, 0x00, 0x00, 0xC3, 0xA0, 0xF9, 0x53, 0xDF, 0xE0, 0x05,
          0x0C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x0B, 0x83,
          0xC9, 0xC3, 0xC6, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
          0x42, 0x60, 0x82
        ]);
        
        // 写入默认头像
        fsSync.writeFileSync(defaultAvatarPath, defaultAvatarData);
        console.log(`[头像合成-路径分析] 创建默认头像: ${defaultAvatarPath}`);
        
        // 更新头像URL
        modifiedAvatarUrl = defaultAvatarPath;
      } catch (err) {
        console.error(`[头像合成-路径分析] 创建默认头像失败: ${err.message}`);
      }
    }
    
    // 检查并处理背景路径
    const bgDirInfo = isDirectory(backgroundUrl);
    if (bgDirInfo) {
      console.log(`[头像合成-路径分析] 背景URL指向目录，将使用默认背景文件`);
      
      // 创建一个默认背景 - 使用预设的PNG背景而不是生成
      const defaultBgPath = path.join(bgDirInfo.path, `default_bg_${Date.now()}.png`);
      
      try {
        // 使用小的预设背景数据
        const defaultBgData = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 
          0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0xC8,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x1F, 0xD7, 0x25, 0xF8, 0x00, 0x00, 0x00,
          0x06, 0x62, 0x4B, 0x47, 0x44, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0xA0,
          0xBD, 0xA7, 0x93, 0x00, 0x00, 0x00, 0x09, 0x70, 0x48, 0x59, 0x73, 0x00,
          0x00, 0x0B, 0x13, 0x00, 0x00, 0x0B, 0x13, 0x01, 0x00, 0x9A, 0x9C, 0x18,
          0x00, 0x00, 0x00, 0x07, 0x74, 0x49, 0x4D, 0x45, 0x07, 0xE6, 0x04, 0x12,
          0x08, 0x27, 0x39, 0xA5, 0x41, 0x7E, 0xF9, 0x00, 0x00, 0x00, 0x1D, 0x69,
          0x54, 0x58, 0x74, 0x43, 0x6F, 0x6D, 0x6D, 0x65, 0x6E, 0x74, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x43, 0x72, 0x65, 0x61, 0x74, 0x65, 0x64, 0x20, 0x77,
          0x69, 0x74, 0x68, 0x20, 0x47, 0x49, 0x4D, 0x50, 0x64, 0x2E, 0x65, 0x07,
          0x00, 0x00, 0x00, 0x20, 0x49, 0x44, 0x41, 0x54, 0x78, 0xDA, 0xED, 0xC1,
          0x81, 0x00, 0x00, 0x00, 0x00, 0xC3, 0xA0, 0xF9, 0x53, 0xDF, 0xE0, 0x05,
          0x0C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x0B, 0x83,
          0xC9, 0xC3, 0xC6, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
          0x42, 0x60, 0x82
        ]);
        
        // 写入默认背景
        fsSync.writeFileSync(defaultBgPath, defaultBgData);
        console.log(`[头像合成-路径分析] 创建默认背景: ${defaultBgPath}`);
        
        // 更新背景URL
        modifiedBackgroundUrl = defaultBgPath;
      } catch (err) {
        console.error(`[头像合成-路径分析] 创建默认背景失败: ${err.message}`);
      }
    }
    
    console.log(`[头像合成-路径分析] 处理后的头像路径: "${avatarUrl}"`);
    console.log(`[头像合成-路径分析] 处理后的背景路径: "${backgroundUrl}"`);
    console.log(`[头像合成-路径分析] =================================\n`);

  // 验证必要参数
  if (!prompt || !avatarUrl || (!removeBackground && !backgroundUrl)) {
    return res.status(400).json({
      success: false,
      message: !removeBackground 
        ? '缺少必要参数，需要提供提示词、头像图片和背景图片' 
        : '缺少必要参数，需要提供提示词和头像图片',
      missingParams: {
        prompt: !prompt,
        avatarUrl: !avatarUrl,
        backgroundUrl: !removeBackground && !backgroundUrl
      }
    });
  }
    
    // 记录头像和背景的基本信息，帮助调试
    console.log(`[头像合成请求] 提示词(部分): ${prompt.substring(0, 20)}...`);
    console.log(`[头像合成请求] 头像URL类型: ${typeof avatarUrl}`);
    console.log(`[头像合成请求] 头像URL长度: ${avatarUrl.length}`);
    console.log(`[头像合成请求] 头像URL前20字符: ${avatarUrl.substring(0, 20)}...`);
    console.log(`[头像合成请求] 背景URL前20字符: ${backgroundUrl.substring(0, 20)}...`);

  // 生成唯一任务ID
  const jobId = uuidv4();
  console.log(`[头像合成] 创建新任务 ID: ${jobId}`);

    // 处理位置参数
    let finalPosition = position || 'center';
    if (x !== undefined && y !== undefined) {
      // 如果提供了x和y坐标，优先使用这些值
      finalPosition = `x:${x},y:${y}`;
    }
    
    console.log(`[头像合成] 使用位置参数: ${finalPosition}`);
    console.log(`[头像合成] 裁剪形状: ${cropShape || 'none'}`);
    console.log(`[头像合成] 缩放比例: ${scale || 1}`);
    console.log(`[头像合成] 移除背景: ${removeBackground ? '是' : '否'}`);
    if (removeBackground) {
      console.log(`[头像合成] 增强抠图: ${enhancedRemoveBackground ? '是' : '否'}`);
      console.log(`[头像合成] 抠图阈值/容差: ${enhancedRemoveBackground ? tolerance || 30 : threshold || 10}`);
    }

  // 初始化任务状态
  generationJobs[jobId] = {
    status: 'processing',
    prompt,
    message: '正在处理头像合成...',
    progress: '0%',
    startTime: new Date().toISOString(),
    result: null
  };

    // 如果头像或背景是Base64数据，先保存为文件
    let avatarFilePath = modifiedAvatarUrl;
    let backgroundFilePath = modifiedBackgroundUrl;
    
    // 创建promises数组来等待可能的文件保存操作
    const savePromises = [];
    
    // 处理头像
    if (typeof avatarFilePath === 'string' && avatarFilePath.startsWith('data:')) {
      const rootDir = path.resolve(__dirname, '../..');
      
      // 确保uploads目录存在
      const uploadsDir = path.join(rootDir, 'uploads');
      if (!fsSync.existsSync(uploadsDir)) {
        console.log(`[头像合成] 创建uploads目录`);
        fsSync.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // 解析并保存Base64图像
      const base64Data = avatarFilePath.split(',')[1];
      if (base64Data) {
        avatarFilePath = path.join(uploadsDir, `avatar_${jobId}.png`);
        console.log(`[头像合成] 计划保存头像到: ${avatarFilePath}`);
        const avatarBuffer = Buffer.from(base64Data, 'base64');
        const savePromise = fs.writeFile(avatarFilePath, avatarBuffer)
          .then(() => console.log(`[头像合成] 头像保存成功: ${avatarFilePath}`))
          .catch(err => {
            console.error(`[头像合成] 头像保存失败: ${err.message}`);
            throw err; // 继续传递错误
          });
        
        savePromises.push(savePromise);
      }
    } else {
      console.log(`[头像合成] 头像不是Base64数据，使用路径: ${avatarFilePath}`);
      
      // 确保URL是字符串
      if (typeof avatarFilePath !== 'string') {
        throw new Error('头像URL格式不正确');
      }
      
      // 如果是http开头的URL，需要下载
      if (avatarFilePath.startsWith('http')) {
        console.log(`[头像合成] 检测到远程URL，将下载头像`);
        const downloadPromise = (async () => {
          try {
            const axios = require('axios');
            const response = await axios.get(avatarFilePath, { responseType: 'arraybuffer' });
            
            // 保存到本地
            const uploadsDir = path.join(rootDir, 'uploads');
            if (!fsSync.existsSync(uploadsDir)) {
              fsSync.mkdirSync(uploadsDir, { recursive: true });
            }
            
            const localPath = path.join(uploadsDir, `avatar_${jobId}.png`);
            await fs.writeFile(localPath, Buffer.from(response.data));
            console.log(`[头像合成] 远程头像已下载到: ${localPath}`);
            
            // 更新路径
            avatarFilePath = localPath;
          } catch (err) {
            console.error(`[头像合成] 下载头像失败: ${err.message}`);
            throw err;
          }
        })();
        
        savePromises.push(downloadPromise);
      }
    }
    
    // 处理背景 - 类似逻辑
    if (typeof backgroundFilePath === 'string' && backgroundFilePath.startsWith('data:')) {
      const rootDir = path.resolve(__dirname, '../..');
      
      // 确保uploads目录存在
      const uploadsDir = path.join(rootDir, 'uploads');
      if (!fsSync.existsSync(uploadsDir)) {
        fsSync.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // 解析并保存Base64图像
      const base64Data = backgroundFilePath.split(',')[1];
      if (base64Data) {
        backgroundFilePath = path.join(uploadsDir, `bg_${jobId}.png`);
        console.log(`[头像合成] 计划保存背景到: ${backgroundFilePath}`);
        const backgroundBuffer = Buffer.from(base64Data, 'base64');
        const savePromise = fs.writeFile(backgroundFilePath, backgroundBuffer)
          .then(() => console.log(`[头像合成] 背景保存成功: ${backgroundFilePath}`))
          .catch(err => {
            console.error(`[头像合成] 背景保存失败: ${err.message}`);
            throw err;
          });
        
        savePromises.push(savePromise);
      }
    } else {
      console.log(`[头像合成] 背景不是Base64数据，使用路径: ${backgroundFilePath}`);
      
      // 确保URL是字符串
      if (typeof backgroundFilePath !== 'string') {
        throw new Error('背景URL格式不正确');
      }
      
      // 如果是http开头的URL，需要下载
      if (backgroundFilePath.startsWith('http')) {
        console.log(`[头像合成] 检测到远程URL，将下载背景`);
        const downloadPromise = (async () => {
          try {
            const axios = require('axios');
            const response = await axios.get(backgroundFilePath, { responseType: 'arraybuffer' });
            
            // 保存到本地
            const uploadsDir = path.join(rootDir, 'uploads');
            if (!fsSync.existsSync(uploadsDir)) {
              fsSync.mkdirSync(uploadsDir, { recursive: true });
            }
            
            const localPath = path.join(uploadsDir, `bg_${jobId}.png`);
            await fs.writeFile(localPath, Buffer.from(response.data));
            console.log(`[头像合成] 远程背景已下载到: ${localPath}`);
            
            // 更新路径
            backgroundFilePath = localPath;
          } catch (err) {
            console.error(`[头像合成] 下载背景失败: ${err.message}`);
            throw err;
          }
        })();
        
        savePromises.push(downloadPromise);
      }
    }
    
    // 立即返回作业ID
  res.status(200).json({
    success: true,
    jobId,
    message: '头像合成任务已创建，正在处理中'
  });

    // 等待所有文件保存完成后再处理头像合成
    Promise.all(savePromises)
      .then(() => {
  // 异步处理头像合成
        return processAvatarComposition(jobId, prompt, avatarFilePath, backgroundFilePath, {
    imageStrength: parseFloat(imageStrength) || 0.35,
    steps: parseInt(steps) || 30,
    guidanceScale: parseFloat(guidanceScale) || 7.5,
    negativePrompt: negativePrompt || '',
          position: finalPosition, // 使用处理后的位置参数
          scale: parseFloat(scale) || 1,
          cropShape: cropShape || 'none',
          removeBackground: removeBackground === true,
          enhancedRemoveBackground: enhancedRemoveBackground === true,
          threshold: parseInt(threshold) || 10,
          tolerance: parseInt(tolerance) || 30
        });
      })
      .catch(error => {
    console.error(`[头像合成] 任务 ${jobId} 失败:`, error);
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      status: 'failed',
      message: `处理失败: ${error.message}`,
      error: error.message,
      endTime: new Date().toISOString()
    };
      });
  } catch (error) {
    console.error(`[头像合成] 请求处理异常:`, error);
    return res.status(500).json({
      success: false,
      message: `处理请求时发生错误: ${error.message}`
    });
  }
}

/**
 * 处理头像合成过程
 * @param {string} jobId - 任务ID
 * @param {string} prompt - 提示词
 * @param {string} avatarUrl - 头像图片URL
 * @param {string} backgroundUrl - 背景图片URL
 * @param {Object} options - 其他选项
 */
const processAvatarComposition = async (jobId, prompt, avatarUrl, backgroundUrl, options = {}) => {
  try {
    console.log(`[processAvatarComposition] 开始处理 JobId: ${jobId}`);
    console.log(`[processAvatarComposition] 参数: `, {
      jobId, prompt, avatarUrl, backgroundUrl, options
    });
    
    // 初始化任务状态
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      message: "正在处理头像合成...",
      progress: 0,
      startedAt: new Date(),
      result: null
    };
    
    // 定义rootDir - 确保在normalizePath函数使用前定义
    const rootDir = process.cwd();
    console.log(`[processAvatarComposition] rootDir: ${rootDir}`);
    
    // 第1步：处理和规范化文件路径
    const normalizePath = (filePath) => {
      console.log(`[normalizePath] 开始处理文件路径: ${filePath}`);
      
      // 处理路径为空的情况
      if (!filePath) {
        console.log(`[normalizePath] 警告: 文件路径为空`);
        return null;
      }
      
      // 不处理http链接
      if (filePath.startsWith('http')) {
        console.log(`[normalizePath] 检测到HTTP路径，不作修改: ${filePath}`);
        return filePath;
      }
      
      // 在Windows上，判断是否为绝对路径需要特殊处理
      // 1. 如果以/开头但不是真正的绝对路径(如C:\)，则视为相对路径
      if (filePath.startsWith('/')) {
        console.log(`[normalizePath] 检测到以/开头的路径: ${filePath}`);
        // 移除开头的斜杠再构建绝对路径
        const relativePath = filePath.substring(1);
        const absolutePath = path.join(rootDir, relativePath);
        console.log(`[normalizePath] 将 ${filePath} 转换为 ${absolutePath}`);
        return absolutePath;
      }
      
      // 如果路径不是绝对路径，则转换为绝对路径
      if (!path.isAbsolute(filePath)) {
        const absolutePath = path.join(rootDir, filePath);
        console.log(`[normalizePath] 将相对路径 ${filePath} 转换为绝对路径: ${absolutePath}`);
        return absolutePath;
      }
      
      console.log(`[normalizePath] 路径已经是绝对路径，不需修改: ${filePath}`);
      return filePath;
    };
    
    // 转换路径为绝对路径
    const fullAvatarPath = normalizePath(avatarUrl);
    
    console.log(`[头像合成] 规范化后的路径:`);
    console.log(`- 头像: ${fullAvatarPath}`);
    
    // 检查是否需要移除背景 (仅抠图模式)
    if (options.removeBackground) {
      console.log('[头像合成] 检测到背景移除选项，将执行抠图处理');
      
      // 更新任务状态
      generationJobs[jobId] = {
        ...generationJobs[jobId],
        message: '正在处理头像背景移除...',
        progress: '25%'
      };
      
      // 加载头像图像
      if (!fsSync.existsSync(fullAvatarPath)) {
        console.log(`[头像合成] 警告: 指定路径不存在: ${fullAvatarPath}，尝试备选路径`);
        
        // 尝试备选路径
        const alternativePaths = [
          // 如果是以/开头，尝试移除前导斜杠的路径
          fullAvatarPath.startsWith('/') ? path.join(rootDir, fullAvatarPath.substring(1)) : null,
          // 尝试在uploads目录中查找
          path.join(rootDir, 'uploads', path.basename(fullAvatarPath))
        ].filter(Boolean);
        
        console.log(`[头像合成] 尝试备选路径:`, alternativePaths);
        
        let found = false;
        for (const altPath of alternativePaths) {
          if (fsSync.existsSync(altPath)) {
            console.log(`[头像合成] 在备选路径找到文件: ${altPath}`);
            fullAvatarPath = altPath;
            found = true;
            break;
          }
        }
        
        if (!found) {
          throw new Error(`头像文件不存在: ${fullAvatarPath}`);
        }
      }
      
      // 处理头像图片，移除背景
      let processedImagePath;
      
      try {
        // 使用StabilityAI API进行背景移除
        if (options.useStabilityApi) {
          console.log('[头像合成] 使用Stability AI API移除背景');
          
          // 获取stability服务实例
          const stabilityService = require('../services/stability.service');
          
          // 调用API进行背景移除
          processedImagePath = await stabilityService.removeBackground({
            image: fullAvatarPath,
            outputFormat: 'png',
            saveToFile: true,
            outputPath: `uploads/avatar_removed_bg_${jobId}.png`
          });
          
          console.log(`[头像合成] 使用API背景移除完成，保存到: ${processedImagePath}`);
        } 
        // 使用本地处理方法
        else {
          const imageProcessor = require('../utils/imageProcessing');
          
          if (options.enhancedRemoveBackground) {
            console.log('[头像合成] 使用增强模式移除背景');
            processedImagePath = await imageProcessor.enhancedRemoveBackground(
              fullAvatarPath, 
              `uploads/avatar_removed_bg_${jobId}.png`, 
              options.tolerance || 30
            );
          } else {
            console.log('[头像合成] 使用标准模式移除背景');
            processedImagePath = await imageProcessor.removeBackground(
              fullAvatarPath, 
              `uploads/avatar_removed_bg_${jobId}.png`, 
              options.threshold || 10
            );
          }
        }
        
        console.log(`[头像合成] 背景已移除，保存到: ${processedImagePath}`);
        
        // 更新任务状态
        generationJobs[jobId] = {
          ...generationJobs[jobId],
          message: '背景已移除',
          progress: '50%'
        };
        
        // 仅抠图模式，直接结束处理
        if (!backgroundUrl) {
          generationJobs[jobId] = {
            ...generationJobs[jobId],
            status: 'completed',
            message: '头像背景移除完成',
            progress: '100%',
            result: processedImagePath,
            endTime: new Date().toISOString()
          };
          
          // 设置超时，清理任务数据
          setTimeout(() => {
            delete generationJobs[jobId];
            logger.debug('清理完成的背景移除任务数据', { jobId });
          }, JOB_TIMEOUT);
          
          return processedImagePath;
        }
        
        // 如果有背景，则更新头像路径为处理后的路径，继续合成
        fullAvatarPath = processedImagePath;
      } catch (error) {
        console.error('[头像抠图处理错误]', error);
        throw new Error(`头像背景移除失败: ${error.message}`);
      }
    }
    
    // 如果不是仅抠图模式，则继续处理背景合成
    const fullBackgroundPath = normalizePath(backgroundUrl);
    console.log(`- 背景: ${fullBackgroundPath}`);

    // 第2步：合并头像和背景图片
    const mergedImageBuffer = await mergeAvatarWithBackground(fullAvatarPath, fullBackgroundPath, options.position);
    
    // 保存合并后的图片
    const mergedImageFilename = `merged_${Date.now()}.png`;
    const mergedImagePath = await stabilityService.saveImageToFile(mergedImageBuffer, mergedImageFilename);
    
    console.log(`[头像合成] 成功合并头像和背景，保存为: ${mergedImagePath}`);
    
    // 更新任务状态
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      message: '已合并头像和背景，正在应用AI样式...',
      progress: '75%',
      mergedImageUrl: mergedImagePath
    };

    // 第3步：使用img2img服务处理合并后的图像
    const params = {
      prompt,
      userImagePath: mergedImagePath,
      imageStrength: options.imageStrength,
      steps: options.steps,
      guidanceScale: options.guidanceScale,
      negativePrompt: options.negativePrompt
    };

    console.log(`[头像合成] 调用img2img服务处理合并图像，参数:`, params);
    const resultImageBuffer = await stabilityService.generateImg2Img(params);

    // 保存结果图像
    const resultFilename = `avatar_composition_${jobId}.png`;
    const resultImagePath = await stabilityService.saveImageToFile(resultImageBuffer, resultFilename);

    console.log(`[头像合成] 成功生成结果图像: ${resultImagePath}`);

    // 更新任务状态为完成
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      status: 'completed',
      message: '头像合成处理完成',
      result: resultImagePath,
      endTime: new Date().toISOString()
    };

    // 设置超时，清理任务数据
    setTimeout(() => {
      delete generationJobs[jobId];
      logger.debug('清理完成的img2img任务数据', { jobId });
    }, JOB_TIMEOUT);

    return resultImagePath;
  } catch (error) {
    // 记录详细错误信息，帮助诊断问题
    console.error('[头像合成错误详情]', {
      错误消息: error.message,
      错误堆栈: error.stack,
      头像URL: avatarUrl,
      背景URL: backgroundUrl,
      位置参数: options.position
    });
    
    // 使用新的错误记录函数
    logDetailedApiError('头像合成', jobId, error, {
      params: generationJobs[jobId]?.params ? {
        subject: generationJobs[jobId].params.subject,
        hasUserImage: !!generationJobs[jobId].params.userImageUrl,
        hasBackgroundImage: !!generationJobs[jobId].params.backgroundImageUrl
      } : null
    });
    
    logger.error('[头像合成] 任务失败', { 
      jobId, 
      error: error.message,
      stack: error.stack
    });
    
    console.error('[头像合成] 任务', jobId, '失败:', error.message);
    
    generationJobs[jobId].status = 'failed';
    generationJobs[jobId].error = `头像合成处理失败: ${error.message}`;

    // 清理任务数据
    setTimeout(() => {
      delete generationJobs[jobId];
    }, JOB_TIMEOUT);

    throw new Error(`头像合成处理失败: ${error.message}`);
  }
}

/**
 * 将头像与背景合并
 * @param {string} avatarPath - 头像图像文件路径
 * @param {string} backgroundPath - 背景图像文件路径
 * @param {string|Array} position - 头像位置
 * @returns {Promise<Buffer>} - 合并后的图像缓冲区
 */
async function mergeAvatarWithBackground(avatarPath, backgroundPath, position = 'center') {
  console.log(`[头像合并] 开始合并头像和背景图像`);
  console.log(`[头像合并] 头像路径: ${avatarPath}`);
  console.log(`[头像合并] 背景路径: ${backgroundPath}`);
  console.log(`[头像合并] 位置: ${position}`);
  
  try {
    // 创建默认图像的函数
    const createDefaultImage = async (filePath, fileType) => {
      console.log(`[创建默认图像] 为${fileType}创建默认图像: ${filePath}`);
      
      // 确保目录存在
      const dir = path.dirname(filePath);
      try {
        // 使用同步方法确保目录存在
        if (!fsSync.existsSync(dir)) {
          fsSync.mkdirSync(dir, { recursive: true });
          console.log(`[创建默认图像] 已创建目录: ${dir}`);
        } else {
          console.log(`[创建默认图像] 目录已存在: ${dir}`);
        }
      } catch (error) {
        console.error(`[创建默认图像] 创建目录失败: ${error.message}`);
        throw new Error(`无法创建默认图像目录: ${error.message}`);
      }
      
      // 创建一个简单的颜色图像
      const width = fileType === '头像' ? 300 : 800;
      const height = fileType === '头像' ? 300 : 600;
      const color = fileType === '头像' ? '#3498db' : '#ecf0f1';
      
      try {
        console.log(`[创建默认图像] 开始创建${width}x${height}的图像，颜色：${color}`);
        
        // 创建一个简单的PNG图像
        // 使用更简单的方法创建纯色图像
        const svgImage = Buffer.from(`
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="${color}"/>
        </svg>
        `);
        
        // 转换SVG为PNG
        await sharp(svgImage)
          .png()
          .toFile(filePath);
        
        console.log(`[创建默认图像] 成功创建默认${fileType}图像: ${filePath}`);
        return filePath;
      } catch (error) {
        console.error(`[创建默认图像] 创建图像失败: ${error.message}, 堆栈: ${error.stack}`);
        throw new Error(`创建默认${fileType}图像失败: ${error.message}`);
      }
    };
    
    // 验证文件是否存在和可读性，包含自动修复尝试
    const validateAndFixPath = async (filePath, fileType) => {
      console.log(`[合并验证] 开始验证${fileType}路径: ${filePath}`);
      console.log(`[合并验证] 路径类型: ${typeof filePath}`);
      
      // 检查文件路径是否为空或非字符串
      if (!filePath || typeof filePath !== 'string') {
        console.error(`[合并验证] ${fileType}路径无效: `, filePath);
        throw new Error(`${fileType}路径无效`);
      }
      
      // 处理Base64图像数据
      if (filePath.startsWith('data:')) {
        console.log(`[合并验证] 检测到${fileType}是Base64数据，转换为文件`);
        try {
          const base64Data = filePath.split(',')[1];
          if (!base64Data) {
            throw new Error(`无效的Base64图像数据`);
          }
          
          const tempDir = path.join(process.cwd(), 'uploads');
          // 确保目录存在
          if (!fsSync.existsSync(tempDir)) {
            fsSync.mkdirSync(tempDir, { recursive: true });
          }
          
          const tempFilePath = path.join(tempDir, `temp_${fileType}_${Date.now()}.png`);
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          fsSync.writeFileSync(tempFilePath, imageBuffer);
          console.log(`[合并验证] 已保存${fileType}到临时文件: ${tempFilePath}`);
          
          return tempFilePath;
    } catch (err) {
          console.error(`[合并验证] 保存Base64图像失败: ${err.message}`);
          throw new Error(`保存${fileType}Base64数据失败: ${err.message}`);
        }
      }
      
      // 确保路径是绝对路径
      let absolutePath = filePath;
      if (!path.isAbsolute(filePath)) {
        absolutePath = path.join(process.cwd(), filePath);
        console.log(`[合并验证] 将相对路径转换为绝对路径: ${absolutePath}`);
      }
      
      // 检查文件是否存在
      let fileExists = false;
      try {
        const stats = fsSync.statSync(absolutePath);
        fileExists = stats.isFile();
        console.log(`[合并验证] 检查文件路径 ${absolutePath} 存在: ${fileExists}`);
      } catch (error) {
        console.log(`[合并验证] 文件不存在: ${absolutePath}，错误: ${error.message}`);
        
        // 尝试查找备选路径
        const alternativePaths = [
          // 使用相对于根目录的路径
          path.join(process.cwd(), filePath),
          // 如果是以/开头，移除开头的/并使用相对路径
          filePath.startsWith('/') ? path.join(process.cwd(), filePath.substring(1)) : null,
          // 特别处理uploads目录
          filePath.includes('/uploads/') || filePath.includes('\\uploads\\') ? 
            path.join(process.cwd(), 'uploads', path.basename(filePath)) : null,
          // 如果路径直接包含文件名，尝试在uploads目录中查找
          path.join(process.cwd(), 'uploads', path.basename(filePath))
        ].filter(Boolean); // 过滤掉null值
        
        console.log(`[合并验证] 尝试备选路径: `, alternativePaths);
        
        // 尝试每个备选路径
        for (const altPath of alternativePaths) {
          try {
            const altStats = fsSync.statSync(altPath);
            if (altStats.isFile()) {
              console.log(`[合并验证] 找到有效的备选路径: ${altPath}`);
              absolutePath = altPath;
              fileExists = true;
              break;
            }
          } catch {
            // 忽略错误，继续尝试下一个路径
          }
        }
      }
      
      // 如果无法找到文件，创建默认图像
      if (!fileExists) {
        console.log(`[合并验证] 无法找到${fileType}文件，将创建默认图像`);
        try {
          const defaultImagePath = path.join(process.cwd(), 'uploads', `default_${fileType}_${Date.now()}.png`);
          console.log(`[合并验证] 尝试创建默认图像: ${defaultImagePath}`);
          
          // 确保uploads目录存在
          const uploadsDir = path.join(process.cwd(), 'uploads');
          if (!fsSync.existsSync(uploadsDir)) {
            fsSync.mkdirSync(uploadsDir, { recursive: true });
            console.log(`[合并验证] 创建上传目录: ${uploadsDir}`);
          }
          
          await createDefaultImage(defaultImagePath, fileType);
          console.log(`[合并验证] 已创建默认${fileType}图像: ${defaultImagePath}`);
          return defaultImagePath;
        } catch (error) {
          console.error(`[合并验证] 创建默认图像失败: ${error.message}`, error);
          throw new Error(`创建默认${fileType}图像失败: ${error.message}`);
        }
      }
      
      // 确保文件可读
      try {
        fsSync.accessSync(absolutePath, fsSync.constants.R_OK);
        console.log(`[合并验证] 文件可读: ${absolutePath}`);
        return absolutePath;
      } catch (error) {
        console.error(`[合并验证] 文件不可读: ${absolutePath}，错误: ${error.message}`);
        throw new Error(`${fileType}文件不可读: ${absolutePath}`);
      }
    };
    
    // 验证并尝试修复文件路径
    const fixedAvatarPath = await validateAndFixPath(avatarPath, '头像');
    const fixedBackgroundPath = await validateAndFixPath(backgroundPath, '背景');
    
    // 输出最终使用的路径
    console.log(`[合并图像] 最终路径: 头像=${fixedAvatarPath}, 背景=${fixedBackgroundPath}`);
    
    // 再次检查文件是否存在和是否是目录
    for (const [pathType, pathValue] of [['头像', fixedAvatarPath], ['背景', fixedBackgroundPath]]) {
      if (!fsSync.existsSync(pathValue)) {
        throw new Error(`${pathType}文件不存在: ${pathValue}`);
      }
      
      const stats = fsSync.statSync(pathValue);
      if (stats.isDirectory()) {
        throw new Error(`${pathType}路径指向目录而不是文件: ${pathValue}`);
      }
    }
    
    // 读取文件以确认可以访问
    try {
      const avatarBuffer = await fs.promises.readFile(fixedAvatarPath);
      const bgBuffer = await fs.promises.readFile(fixedBackgroundPath);
      
      console.log(`[合并图像] 成功读取头像文件: ${avatarBuffer.length} 字节`);
      console.log(`[合并图像] 成功读取背景文件: ${bgBuffer.length} 字节`);
    } catch (readError) {
      console.error(`[合并图像] 读取文件失败: ${readError.message}`);
      throw new Error(`读取图像文件失败: ${readError.message}`);
    }
    
    // 使用增强的自然头像合成函数
    const imageProcessor = require('../utils/imageProcessing');
    
    console.log(`[合并图像] 使用位置: ${JSON.stringify(position)}`);
    
    try {
    const result = await imageProcessor.naturalAvatarComposite(
        fixedAvatarPath,
        fixedBackgroundPath,
      {
        position: position,        // 使用传入的位置参数
        size: 0.35,                // 头像大小为背景的35%
        featherOptions: {
          featherRadius: 30,
          coreSize: 0.85,
          gradientSteps: 5
        },
        matchBackground: true,     // 自动匹配背景亮度
        blendMode: 'over',
        opacity: 1.0
      }
    );
    
      console.log(`[合并图像] 合成成功，图像大小: ${result.length} 字节`);
    return result;
    } catch (compositeError) {
      console.error(`[合并图像] 高级合成失败:`, compositeError);
      
      // 尝试更简单的合成方法作为备选
      console.log(`[合并图像] 尝试使用备选合成方法...`);
      
      try {
        // 直接使用Sharp进行简单合成
        const sharp = require('sharp');
        
        // 获取图像信息
        const avatarInfo = await sharp(fixedAvatarPath).metadata();
        const bgInfo = await sharp(fixedBackgroundPath).metadata();
        
        console.log(`[合并图像] 头像尺寸: ${avatarInfo.width}x${avatarInfo.height}`);
        console.log(`[合并图像] 背景尺寸: ${bgInfo.width}x${bgInfo.height}`);
        
        // 计算居中位置
        const top = Math.floor((bgInfo.height - avatarInfo.height) / 2);
        const left = Math.floor((bgInfo.width - avatarInfo.width) / 2);
        
        // 简单合成
        const result = await sharp(fixedBackgroundPath)
          .composite([
            {
              input: fixedAvatarPath,
              top: top > 0 ? top : 0,
              left: left > 0 ? left : 0,
            }
          ])
          .png()
          .toBuffer();
        
        console.log(`[合并图像] 备选合成成功，图像大小: ${result.length} 字节`);
        return result;
      } catch (fallbackError) {
        console.error(`[合并图像] 备选合成也失败:`, fallbackError);
        
        // 创建一个简单的错误提示图像
        try {
          const svg = `
            <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#f0f0f0" />
              <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#ff0000" text-anchor="middle">
                头像合成失败，请重试
              </text>
              <text x="50%" y="58%" font-family="Arial" font-size="16" fill="#666666" text-anchor="middle">
                错误: ${compositeError.message}
              </text>
            </svg>
          `;
          
          const sharp = require('sharp');
          const errorImage = await sharp(Buffer.from(svg))
            .png()
            .toBuffer();
          
          console.log(`[合并图像] 创建了错误提示图像: ${errorImage.length} 字节`);
          return errorImage;
        } catch (svgError) {
          // 如果连错误图像都创建失败，只能抛出异常
          console.error(`[合并图像] 创建错误图像失败:`, svgError);
          throw new Error(`图像合成完全失败: ${compositeError.message}`);
        }
      }
    }
  } catch (error) {
    console.error('[合并图像] 严重错误:', error);
    // 如果是头像或背景文件问题，提供更明确的错误信息
    if (error.message.includes('头像文件') || error.message.includes('背景文件')) {
    throw error;
    } else {
      // 其他错误使用更通用的消息
      throw new Error(`合并头像与背景失败: ${error.message}`);
    }
  }
}

/**
 * 使用v2beta API处理img2img请求
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 */
function generateStableImg2Img(req, res) {
  try {
    const { prompt, negativePrompt, userImageUrl, styleStrength, outputFormat } = req.body;

    // 验证请求参数
    if (!prompt) {
      return res.status(400).json({ error: '缺少prompt参数' });
    }

    if (!userImageUrl) {
      return res.status(400).json({ error: '缺少userImageUrl参数' });
    }

    // 创建一个唯一的作业ID
    const jobId = uuidv4();

    // 记录请求
    logger.info('收到v2beta img2img请求', {
      jobId,
      promptLength: prompt.length,
      hasNegativePrompt: !!negativePrompt,
      styleStrength,
      outputFormat
    });

    // 初始化作业状态
    generationJobs[jobId] = {
      status: 'processing',
      createdAt: new Date(),
      params: { prompt, negativePrompt, userImageUrl, styleStrength, outputFormat }
    };

    // 异步处理请求
    processStableImg2ImgGeneration(jobId).catch(error => {
      logger.error('v2beta img2img处理错误:', error);
      generationJobs[jobId].status = 'failed';
      generationJobs[jobId].error = error.message;
    });

    // 立即返回jobId
    res.status(202).json({
      jobId,
      status: 'processing',
      message: '请求已接受，正在处理中'
    });
      
  } catch (error) {
    // 记录错误
    stabilityErrorLogger.error('v2beta img2img请求处理错误', {
      error: error.message,
      stack: error.stack
    });
    console.error('处理v2beta img2img请求时出错:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}

/**
 * 处理v2beta img2img生成过程
 * @param {string} jobId - 任务ID
 */
async function processStableImg2ImgGeneration(jobId) {
  const job = generationJobs[jobId];
  if (!job) throw new Error('任务不存在');

  try {
    logger.info('开始处理v2beta img2img生成', { jobId, params: job.params });
    
    const { prompt, negativePrompt, userImageUrl, styleStrength = 0.35, outputFormat = 'webp' } = job.params;
    
    // 将base64图像转换为Buffer
    let imageBuffer;
    if (userImageUrl.startsWith('data:')) {
      const base64Data = userImageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // 假设是图像URL，下载图像
      imageBuffer = await downloadImage(userImageUrl);
    }
    
    // 翻译提示词(如果是中文)
    let processedPrompt = prompt;
    let processedNegativePrompt = negativePrompt;

    if (translationUtils.containsChinese(prompt)) {
      logger.info(`检测到中文提示词，进行翻译`, { 
        jobId, 
        originalPrompt: prompt 
      });
      
      processedPrompt = await translationUtils.translateToEnglish(prompt);
      
      logger.info(`翻译完成`, { 
        jobId, 
        originalPrompt: prompt,
        translatedPrompt: processedPrompt
      });
    }

    if (negativePrompt && translationUtils.containsChinese(negativePrompt)) {
      processedNegativePrompt = await translationUtils.translateToEnglish(negativePrompt);
      
      logger.info(`负面提示词翻译完成`, {
        jobId,
        originalNegativePrompt: negativePrompt,
        translatedNegativePrompt: processedNegativePrompt
      });
    }
    
    // 调用v2beta API进行处理
    const resultBuffer = await stabilityService.stableImageToImage({
      image: imageBuffer,
      prompt: processedPrompt,
      negativePrompt: processedNegativePrompt,
      styleStrength: styleStrength,
      outputFormat: outputFormat
    });
    
    logger.info('v2beta img2img处理完成，保存结果', { 
      jobId, 
      resultSize: resultBuffer.length
    });

    // 生成文件名并保存图像
    const timestamp = Date.now();
    const filename = `v2img2img-${timestamp}-${jobId.slice(0, 8)}.${outputFormat}`;
    const publicDir = path.join(__dirname, '..', 'public', 'generated');
    const filePath = path.join(publicDir, filename);
    
    // 确保目录存在
    if (!fsSync.existsSync(publicDir)) {
      await fs.mkdir(publicDir, { recursive: true });
    }
    
    await fs.writeFile(filePath, resultBuffer);
    // 使用绝对URL而不是相对URL
    const imageUrl = `/generated/${filename}`;
    
    console.log(`图像已保存到: ${filePath}`);
    console.log(`图像URL: ${imageUrl}`);
    
    // 检查文件是否成功写入
    if (fsSync.existsSync(filePath)) {
      const stats = fsSync.statSync(filePath);
      console.log(`图像文件验证：文件大小 ${stats.size} 字节，创建时间：${stats.ctime}`);
    } else {
      console.error(`警告：文件可能未成功写入: ${filePath}`);
    }
    
    logger.info('处理结果保存完成', { jobId, imageUrl, filePath });

    // 更新任务状态为已完成
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      status: 'completed',
      result: imageUrl  // 直接返回图像URL字符串，而不是对象
    };

    // 设置超时，清理任务数据
    setTimeout(() => {
      delete generationJobs[jobId];
      logger.debug('清理完成的img2img任务数据', { jobId });
    }, JOB_TIMEOUT);

  } catch (error) {
    logger.error('[v2beta img2img生成] 错误:', error.message);
    console.error('v2beta img2img生成失败:', error);
    
    // 更新任务状态为失败
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * 下载图像工具函数
 * @param {string} imageUrl - 图像URL
 * @returns {Promise<Buffer>} - 图像数据Buffer
 */
async function downloadImage(imageUrl) {
  try {
    // 检查是否是数据URL
    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('无效的数据URL格式');
      }
      return Buffer.from(base64Data, 'base64');
    }
    
    // 检查是否是本地相对路径
    if (imageUrl.startsWith('/')) {
      const localPath = path.join(__dirname, '..', imageUrl);
      if (!fsSync.existsSync(localPath)) {
        throw new Error(`本地图像不存在: ${localPath}`);
      }
      return fsSync.readFileSync(localPath);
    }
    
    // 下载网络图像
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000  // 30秒超时
    });
    
    if (response.status !== 200) {
      throw new Error(`下载图像失败: HTTP ${response.status}`);
    }
    
    return Buffer.from(response.data);
  } catch (error) {
    logger.error('下载图像失败', { error: error.message, url: imageUrl });
    throw new Error(`下载图像失败: ${error.message}`);
  }
}

/**
 * 替换图像背景并重新打光
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
function replaceBackgroundAndRelight(req, res) {
  try {
    const { image, backgroundPrompt, outputFormat } = req.body;
    
    // 验证必要参数
    if (!image || !backgroundPrompt) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：需要提供图像和背景描述提示词'
      });
    }
    
    // 生成唯一任务ID
    const jobId = uuidv4();
    console.log(`[背景替换] 创建新任务 ID: ${jobId}`);
    
    // 初始化任务状态
    generationJobs[jobId] = {
      status: 'processing',
      message: '正在提交背景替换和重新打光请求...',
      progress: '0%',
      startTime: new Date().toISOString(),
      result: null
    };
    
    // 立即返回作业ID
    res.status(200).json({
      success: true,
      jobId,
      message: '背景替换任务已创建，正在处理中'
    });
    
    // 异步处理背景替换
    processReplaceBackground(jobId, image, backgroundPrompt, outputFormat).catch(error => {
      console.error(`[背景替换] 处理错误: ${error.message}`);
      generationJobs[jobId] = {
        ...generationJobs[jobId],
        status: 'failed',
        error: error.message,
        endTime: new Date().toISOString()
      };
    });
  } catch (error) {
    console.error(`[背景替换] 控制器错误: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `处理请求时出错: ${error.message}`
    });
  }
}

/**
 * 处理背景替换和重新打光
 * @param {string} jobId - 任务ID
 * @param {string} image - 图像（Base64或URL）
 * @param {string} backgroundPrompt - 背景描述提示词
 * @param {string} outputFormat - 输出格式
 * @returns {Promise<void>}
 */
async function processReplaceBackground(jobId, image, backgroundPrompt, outputFormat = 'png') {
  try {
    // 更新任务状态
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      message: '正在处理图像和提交API请求...',
      progress: '10%'
    };
    
    // 处理图像输入
    let imageInput;
    
    if (typeof image === 'string') {
      if (image.startsWith('data:')) {
        // 处理Base64图像
        const base64Data = image.split(',')[1];
        if (!base64Data) {
          throw new Error('无效的Base64图像数据');
        }
        
        // 保存到临时文件
        const rootDir = path.resolve(__dirname, '../..');
        const uploadsDir = path.join(rootDir, 'uploads');
        if (!fsSync.existsSync(uploadsDir)) {
          fsSync.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const imagePath = path.join(uploadsDir, `subject_${jobId}.png`);
        const imageBuffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(imagePath, imageBuffer);
        
        imageInput = imagePath;
      } else {
        // 处理图像URL
        const rootDir = path.resolve(__dirname, '../..');
        imageInput = path.isAbsolute(image) ? image : path.join(rootDir, image.replace(/^\//, ''));
      }
    } else {
      throw new Error('无效的图像输入类型');
    }
    
    // 引入stability服务
    const stabilityService = require('../services/stability.service');
    
    // 更新任务状态
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      message: '正在提交背景替换请求到Stability API...',
      progress: '25%'
    };
    
    // 调用服务
    const result = await stabilityService.replaceBackgroundAndRelight({
      image: imageInput,
      backgroundPrompt,
      outputFormat,
      saveToFile: true,
      outputPath: `uploads/bg_replaced_${jobId}.${outputFormat}`
    });
    
    // 更新任务状态
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      message: '背景替换请求已提交，等待API处理...',
      progress: '35%',
      replaceBackgroundTaskId: result.id  // 保存API返回的任务ID，用于后续查询
    };
    
    // 等待处理完成
    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 60;  // 最多等待60次检查（约2分钟）
    
    while (!isCompleted && attempts < maxAttempts) {
      attempts++;
      
      // 更新任务状态
      generationJobs[jobId] = {
        ...generationJobs[jobId],
        message: `正在等待背景替换处理完成(尝试${attempts}/${maxAttempts})...`,
        progress: `${35 + Math.min(60, attempts)}%`
      };
      
      // 检查任务状态
      const statusResult = await stabilityService.checkReplaceBackgroundStatus(result.id);
      
      if (statusResult.status === 'completed') {
        isCompleted = true;
        
        // 保存结果
        generationJobs[jobId] = {
          ...generationJobs[jobId],
          message: '背景替换已完成，正在保存结果...',
          progress: '95%'
        };
        
        // 保存图像
        const outputPath = await stabilityService.saveBgReplaceResult(result, statusResult.imageBuffer);
        
        // 更新任务状态为完成
        generationJobs[jobId] = {
          ...generationJobs[jobId],
          status: 'completed',
          message: '背景替换和重新打光处理完成',
          progress: '100%',
          result: outputPath ? `/uploads/${path.basename(outputPath)}` : null,
          endTime: new Date().toISOString()
        };
        
        return;
      } else if (statusResult.status === 'error') {
        throw new Error(`API处理错误: ${statusResult.error}`);
      }
      
      // 等待3秒后再次检查
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // 如果达到最大尝试次数仍未完成，标记为超时
    if (!isCompleted) {
      throw new Error('处理超时，请稍后查看结果或重试');
    }
  } catch (error) {
    console.error(`[背景替换处理] 错误: ${error.message}`);
    
    // 更新任务状态为失败
    generationJobs[jobId] = {
      ...generationJobs[jobId],
      status: 'failed',
      message: `背景替换处理失败: ${error.message}`,
      error: error.message,
      endTime: new Date().toISOString()
    };
    
    throw error;
  }
}

/**
 * 使用Stability AI v2beta的Core Generate API生成图像
 * @param {Express.Request} req 
 * @param {Express.Response} res 
 */
async function generateStableImageCore(req, res) {
  // 从请求体中获取参数
  const { 
    prompt, 
    negativePrompt, 
    width = 1024, 
    height = 1024, 
    steps = 50,
    cfg_scale = 7,
    output_format = "webp" 
  } = req.body;

  // 检查必填参数
  if (!prompt) {
    logger.error('缺少必要参数prompt');
    return res.status(400).json({ error: '缺少必要参数prompt' });
  }

  // 创建任务ID
  const jobId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  // 记录请求参数
  logger.info('开始生成图像任务', { 
    jobId, 
    prompt, 
    width, 
    height, 
    steps,
    promptLength: prompt.length
  });

  try {
    // 获取API密钥
    const apiKey = process.env.STABILITY_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;
    
    if (!apiKey) {
      logger.error('未找到Stability API密钥', { jobId });
      return res.status(500).json({ error: '服务器配置错误：未设置API密钥' });
    }

    // 构建请求参数
    const payload = {
      prompt,
      width: parseInt(width),
      height: parseInt(height),
      steps: parseInt(steps),
      cfg_scale: parseFloat(cfg_scale),
      output_format
    };

    // 如果有负面提示词，添加到请求参数
    if (negativePrompt) {
      payload.negative_prompt = negativePrompt;
    }

    // 记录任务开始
    logger.debug('准备调用Stability API', { 
      jobId, 
      payload: JSON.stringify(payload) 
    });

    // 使用axios.postForm发送请求
    const formData = new FormData();
    for (const key in payload) {
      formData.append(key, payload[key]);
    }

    const response = await axios.postForm(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      formData,
      {
        validateStatus: undefined,
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'image/*'
        },
        timeout: 120000 // 2分钟超时
      }
    );

    // 检查响应状态
    if (response.status === 200) {
      logger.info('图像生成成功', { jobId });

      // 确保输出目录存在
      const outputDir = path.join(__dirname, '../public/generated');
      await ensureDirectoryExists(outputDir);

      // 生成文件名
      const fileName = `${jobId}.${output_format}`;
      const filePath = path.join(outputDir, fileName);
      
      // 将响应数据保存为图像文件
      await fs.promises.writeFile(filePath, Buffer.from(response.data));
      
      // 返回图像URL
      const imageUrl = `/generated/${fileName}`;
      
      // 返回成功结果
      return res.status(200).json({
        success: true,
        imageUrl,
        message: '图像生成成功'
      });
    } else {
      // 处理错误响应
      let errorMessage = '图像生成失败';
      
      try {
        // 尝试从响应数据中解析错误信息
        const errorText = Buffer.from(response.data).toString();
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || `请求失败(${response.status})`;
      } catch (parseError) {
        errorMessage = `请求失败(${response.status}): ${Buffer.from(response.data).toString().substring(0, 100)}`;
      }
      
      logger.error('图像生成API请求失败', { 
        jobId, 
        status: response.status, 
        error: errorMessage 
      });
      
      return res.status(500).json({ 
        error: errorMessage
      });
    }
  } catch (error) {
    // 记录详细错误信息
    logger.error('图像生成过程出错', { 
      jobId, 
      error: error.message, 
      stack: error.stack 
    });
    
    return res.status(500).json({ 
      error: '服务器处理请求时出错: ' + error.message 
    });
  }
}

/**
 * 异步处理Stability AI的图像生成请求
 * @param {string} jobId 任务ID
 * @param {string} apiKey Stability API密钥
 * @param {object} requestData 请求数据
 */
async function processStabilityGenerateApiAsync(jobId, apiKey, requestData) {
  try {
    logger.debug('开始调用Stability API', { jobId });
    
    // 发起API请求
    const response = await axios({
      method: 'post',
      url: 'https://api.stability.ai/v2beta/stable-image/generate/core',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data: requestData,
      timeout: 120000 // 2分钟超时
    });

    logger.info('API请求成功，正在处理响应', { jobId });
    
    if (response.data && response.data.artifacts && response.data.artifacts.length > 0) {
      // 处理生成的图像
      const results = await processGeneratedImages(jobId, response.data.artifacts);
      
      // 更新任务状态
      updateTaskStatus(jobId, 'completed', {
        result: results,
        endTime: new Date()
      });
      
      logger.info('图像生成任务完成', { jobId, imageCount: results.length });
    } else {
      logger.warn('API返回数据格式不符合预期', { 
        jobId, 
        responseDataKeys: Object.keys(response.data || {}) 
      });
      
      updateTaskStatus(jobId, 'failed', {
        error: '服务器返回的数据格式不符合预期',
        endTime: new Date()
      });
    }
  } catch (error) {
    // 记录详细的API错误
    logDetailedApiError('图像生成', jobId, error, { requestData });
    
    // 更新任务状态为失败
    updateTaskStatus(jobId, 'failed', {
      error: getApiErrorMessage(error),
      endTime: new Date()
    });
  }
}

/**
 * 处理生成的图像
 * @param {string} jobId 任务ID
 * @param {Array} artifacts 生成的图像数据
 * @returns {Array} 保存后的图像URL列表
 */
async function processGeneratedImages(jobId, artifacts) {
  const results = [];
  
  try {
    // 确保输出目录存在
    const outputDir = path.join(__dirname, '../public/generated');
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    // 处理每个生成的图像
    for (let i = 0; i < artifacts.length; i++) {
      const artifact = artifacts[i];
      
      // 将base64转换为图像并保存
      const imageBuffer = Buffer.from(artifact.base64, 'base64');
      const fileName = `${jobId}_${i}.png`;
      const filePath = path.join(outputDir, fileName);
      
      await fs.promises.writeFile(filePath, imageBuffer);
      
      // 添加到结果列表
      results.push({
        imageUrl: `/generated/${fileName}`,
        seed: artifact.seed,
        width: artifact.width,
        height: artifact.height,
        finishReason: artifact.finishReason
      });
    }
    
    logger.info(`已保存${results.length}个生成的图像`, { jobId });
    return results;
  } catch (error) {
    logger.error('保存生成的图像时出错', { 
      jobId, 
      error: error.message 
    });
    throw error;
  }
}

// 确保所有控制器方法被正确导出
module.exports = {
  generateImage,
  checkGenerationStatus,
  generateImg2Img,
  inpaintImage,
  searchAndReplace,
  avatarComposition,
  logDetailedApiError,
  generateStableImg2Img,
  processStableImg2ImgGeneration,
  replaceBackgroundAndRelight,
  processReplaceBackground,
  generateStableImageCore,
  processStabilityGenerateApiAsync,
  processGeneratedImages
}; 