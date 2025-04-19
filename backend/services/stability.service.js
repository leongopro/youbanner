/**
 * Stability AI 服务
 * 封装与Stability API的交互
 */

const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// 导入日志服务
const { logger, logStabilityApiCall, logStabilityApiError } = require('./logger.service');

// 导入翻译工具
const translationUtils = require('../utils/translation');

// 配置常量
const API_HOST = process.env.API_HOST || 'https://api.stability.ai';
const STABILITY_API_KEY = process.env.STABILITY_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;
// 基于v1的端点
const STABILITY_API_URL = `${API_HOST}/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`;
const IMG2IMG_API_URL = `${API_HOST}/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image`;
const UPSCALE_API_URL = `${API_HOST}/v1/generation/esrgan-v1/image-to-image/upscale`;
// 基于v2beta的端点
const INPAINT_API_URL = `${API_HOST}/v2beta/stable-image/edit/inpaint`;
const STABLE_IMAGE_API_URL = `${API_HOST}/v2beta/stable-image/generate`;
const STABLE_IMAGE_EDIT_API_URL = `${API_HOST}/v2beta/stable-image/edit`;
const REMIX_API_URL = `${API_HOST}/v2beta/stable-image/remix`;
const STABLE_IMAGE_IMG2IMG_URL = `${API_HOST}/v2beta/stable-image/edit/inpaint`;

// 添加背景移除API端点
const REMOVE_BG_API_URL = `${API_HOST}/v2beta/stable-image/edit/remove-background`;

// 添加背景替换和重新打光API端点
const REPLACE_BG_API_URL = `${API_HOST}/v2beta/stable-image/edit/replace-background-and-relight`;

// API请求配置
const API_REQUEST_TIMEOUT = 300000; // 5分钟超时
const MAX_RETRIES = 5;  // 最大重试次数
const INITIAL_RETRY_DELAY = 3000;  // 初始重试延迟（毫秒）
const MAX_RETRY_DELAY = 60000;  // 最大重试延迟（毫秒）
const RETRY_FACTOR = 2;  // 重试延迟增长因子
const RETRY_JITTER = 0.2;  // 随机抖动因子

// 检查API密钥是否存在
if (!STABILITY_API_KEY) {
  logger.warn('未设置Stability API密钥', {
    message: '未设置STABILITY_API_KEY或STABLE_DIFFUSION_API_KEY环境变量，将无法使用Stability AI API'
  });
  console.warn('警告: 未设置STABILITY_API_KEY或STABLE_DIFFUSION_API_KEY环境变量，将无法使用Stability AI API');
} else {
  logger.info('Stability API配置成功', {
    apiUrl: STABILITY_API_URL,
    keyLength: STABILITY_API_KEY.length
  });
  console.log('Stability AI API密钥已配置');
}

// SDXL模型支持的尺寸
const SDXL_SUPPORTED_DIMENSIONS = [
  { width: 1024, height: 1024 }, // 正方形
  { width: 1152, height: 896 },  // 宽屏
  { width: 1216, height: 832 },  // 宽屏
  { width: 1344, height: 768 },  // 宽屏
  { width: 1536, height: 640 },  // 宽屏
  { width: 640, height: 1536 },  // 竖屏
  { width: 768, height: 1344 },  // 竖屏
  { width: 832, height: 1216 },  // 竖屏
  { width: 896, height: 1152 }   // 竖屏
];

/**
 * 使用指数退避算法发送API请求，并在请求失败时自动重试
 * @param {Object} options - 请求选项
 * @param {number} [maxRetries=5] - 最大重试次数
 * @param {number} [initialDelay=3000] - 初始延迟时间（毫秒）
 * @param {number} [maxDelay=60000] - 最大延迟时间（毫秒）
 * @param {number} [factor=2] - 延迟时间增长因子
 * @param {number} [jitter=0.2] - 抖动因子，增加随机性以避免同时重试
 * @returns {Promise<Object>} - 请求响应
 */
async function sendRequestWithRetry(options, maxRetries = 5, initialDelay = 3000, maxDelay = 60000, factor = 2, jitter = 0.2) {
  // 记录重试开始
  logger.info(`发送API请求到 ${options.url}，超时设置: ${options.timeout || '默认'}ms`);
  console.log(`发送API请求到 ${options.url}，超时设置: ${options.timeout || '默认'}ms`);

  // 跟踪请求开始时间
  const startTime = Date.now();

  let lastError = null;
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      // 如果不是第一次尝试，记录重试信息
      if (retries > 0) {
        logger.info(`第 ${retries} 次重试API请求...`, { url: options.url });
        console.log(`第 ${retries} 次重试API请求...`);
      }

      // 发送请求
      const response = await axios(options);

      // 计算请求耗时
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 记录成功信息
      logger.info(`API请求成功，状态码: ${response.status}，耗时: ${duration}ms`, {
        url: options.url,
        status: response.status,
        duration
      });

      // 返回成功响应
      return response;
    } catch (error) {
      lastError = error;
      retries++;

      // 检查是否是网络错误
      if (error.code) {
        logger.error(`网络错误: ${error.message}`, {
          url: options.url,
          code: error.code
        });
        console.error(`网络错误: ${error.message}`);
      } 
      // 检查是否是API响应错误
      else if (error.response) {
        const { status, data } = error.response;
        logger.error(`API响应错误 [${status}]: ${data.message || JSON.stringify(data)}`, {
          url: options.url,
          status,
          data
        });
        console.error(`API响应错误 [${status}]: ${data.message || JSON.stringify(data)}`);

        // 对于特定状态码，不再重试
        if (status === 401) { // 未授权
          logger.error('API密钥无效，停止重试', { url: options.url });
          console.error('API密钥无效，停止重试');
          break;
        } else if (status === 400) { // 错误请求
          // 检查是否是请求参数错误，如果是则停止重试
          if (data.name === 'invalid_parameters' || data.name === 'invalid_prompts') {
            logger.error('请求参数错误，停止重试', { 
              url: options.url,
              errorName: data.name,
              errorMessage: data.message
            });
            console.error(`请求参数错误 (${data.name})，停止重试: ${data.message}`);
            break;
          }
        } else if (status === 429) { // 请求过多
          // 遇到限流，增加延迟时间
          initialDelay = Math.min(initialDelay * 2, maxDelay);
          logger.warn('API请求频率限制，增加延迟时间', { 
            url: options.url, 
            newDelay: initialDelay 
          });
        }
      } else {
        // 其他未知错误
        logger.error(`请求错误: ${error.message}`, { url: options.url });
        console.error(`请求错误: ${error.message}`);
      }

      // 记录错误到专用错误日志
      logStabilityApiError(options.url, options, error);

      // 如果已达到最大重试次数，抛出错误
      if (retries > maxRetries) {
        logger.error(`达到最大重试次数 (${maxRetries})，放弃请求`, { url: options.url });
        console.error(`达到最大重试次数 (${maxRetries})，放弃请求`);
        break;
      }

      // 计算下一次重试的延迟时间（指数退避 + 随机抖动）
      const delay = Math.min(initialDelay * Math.pow(factor, retries - 1), maxDelay);
      const randomJitter = 1 - jitter + (Math.random() * jitter * 2); // 生成 [1-jitter, 1+jitter] 范围内的随机数
      const actualDelay = Math.floor(delay * randomJitter);

      logger.info(`将在 ${actualDelay}ms 后重试，剩余重试次数: ${maxRetries - retries + 1}`, { url: options.url });
      console.log(`将在 ${actualDelay}ms 后重试，剩余重试次数: ${maxRetries - retries + 1}`);

      // 等待延迟时间后继续下一次重试
      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
  }

  // 所有重试都失败了，抛出最后一个错误
  const errorSummary = {
    message: lastError.message,
    code: lastError.code,
    response: lastError.response ? {
      status: lastError.response.status,
      data: lastError.response.data
    } : undefined,
    retryAttempts: retries,
    totalDuration: Date.now() - startTime
  };

  // 记录重试失败
  logger.error(`所有重试尝试均失败，最终错误: ${lastError.message}`, errorSummary);
  
  // 根据错误类型构建更友好的错误消息
  let userFriendlyMessage = "API请求失败";
  if (lastError.response) {
    const { status, data } = lastError.response;
    if (status === 400) {
      userFriendlyMessage = `请求参数错误: ${data.message || "参数无效"}`;
    } else if (status === 401) {
      userFriendlyMessage = "API密钥无效或已过期";
    } else if (status === 429) {
      userFriendlyMessage = "API请求频率超限，请稍后再试";
    } else if (status >= 500) {
      userFriendlyMessage = "Stability AI服务器暂时不可用，请稍后再试";
    }
  } else if (lastError.code === 'ECONNABORTED') {
    userFriendlyMessage = "请求超时，可能是由于网络问题或图像过大";
  } else if (lastError.code === 'ECONNREFUSED' || lastError.code === 'ECONNRESET') {
    userFriendlyMessage = "网络连接错误，请检查您的网络连接";
  }

  // 加入重试次数信息
  if (retries > 0) {
    userFriendlyMessage += `（已尝试 ${retries} 次重试）`;
  }

  // 构造增强的错误对象
  const enhancedError = new Error(userFriendlyMessage);
  enhancedError.originalError = lastError;
  enhancedError.summary = errorSummary;
  throw enhancedError;
}

/**
 * 准备API请求配置
 * @param {Object} options - 用户提供的选项
 * @returns {Object} 准备好的请求配置
 */
function prepareRequestConfig(options) {
  return {
    ...options,
    timeout: API_REQUEST_TIMEOUT,
    maxContentLength: 50 * 1024 * 1024, // 50MB最大响应大小
    maxBodyLength: 50 * 1024 * 1024, // 50MB最大请求体大小
    // 添加httpsAgent配置防止SSL错误
    httpsAgent: new require('https').Agent({
      rejectUnauthorized: true, // 在生产环境中应设为true
      keepAlive: true,
      timeout: API_REQUEST_TIMEOUT
    })
  };
}

/**
 * 检查API密钥是否存在
 * @throws {Error} 如果API密钥未设置
 */
function checkApiKey() {
  if (!STABILITY_API_KEY) {
    const error = new Error('Stability API密钥未设置');
    logger.error('API请求失败: Stability API密钥未设置');
    throw error;
  }
}

/**
 * 调用Stability AI API生成图像
 * @param {Object} params - 生成参数
 * @param {string} params.prompt - 提示词
 * @param {string} [params.negativePrompt] - 负面提示词
 * @param {number} [params.width=1024] - 图像宽度
 * @param {number} [params.height=1024] - 图像高度
 * @param {number} [params.steps=30] - 采样步数
 * @param {number} [params.guidanceScale=7.5] - 提示词强度
 * @returns {Promise<Buffer>} 图像数据Buffer
 */
async function generateImage(params) {
  const { 
    prompt, 
    negativePrompt = '', 
    width = 1024, 
    height = 1024, 
    steps = 30, 
    guidanceScale = 7.5 
  } = params;

  logger.info('生成图像请求参数', {
    prompt: prompt ? (prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt) : null, 
    width, 
    height, 
    steps, 
    guidanceScale,
    hasNegativePrompt: !!negativePrompt
  });

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    const error = new Error('提示词不能为空');
    logger.error('生成图像参数验证失败', { error: error.message });
    throw error;
  }

  // 检查API密钥是否配置
  if (!STABILITY_API_KEY) {
    logger.warn('使用测试生成模式', { 
      reason: 'API密钥未配置',
      prompt: prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt
    });
    console.log('Stability API密钥未配置，使用测试生成模式');
    return generateTestImage(prompt, width, height);
  }

  try {
    logger.info('开始调用Stability API', { 
      apiUrl: STABILITY_API_URL,
      prompt: prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt,
      width, 
      height
    });
    console.log('调用Stability API生成图像', { prompt, width, height, steps, guidanceScale });

    // 准备API请求参数
    const apiParams = {
      text_prompts: [
        {
          text: prompt,
          weight: 1
        }
      ],
      cfg_scale: guidanceScale,
      height: ensureDimensionValid(height),
      width: ensureDimensionValid(width),
      steps: steps,
      samples: 1
    };

    // 添加负面提示词（如果有）
    if (negativePrompt && typeof negativePrompt === 'string' && negativePrompt.trim() !== '') {
      apiParams.text_prompts.push({
        text: negativePrompt,
        weight: -1
      });
      logger.debug('添加负面提示词', { 
        negativePrompt: negativePrompt.length > 50 ? negativePrompt.substring(0, 50) + '...' : negativePrompt 
      });
    }

    const startTime = Date.now();

    // 发送API请求 (使用新的带重试功能的请求函数)
    const response = await sendRequestWithRetry({
      method: 'post',
      url: STABILITY_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${STABILITY_API_KEY}`
      },
      data: apiParams
    });

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    logger.info('Stability API响应成功', { 
      responseTime: processingTime + 'ms',
      status: response.status,
      artifactsCount: response.data.artifacts ? response.data.artifacts.length : 0
    });

    // 检查是否有错误
    if (response.status !== 200) {
      const error = new Error(`API请求失败: ${response.statusText}`);
      logger.error('Stability API错误响应', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      console.error('Stability API错误:', response.data);
      throw error;
    }

    // 提取图像数据
    const generationData = response.data.artifacts[0];
    if (!generationData || !generationData.base64) {
      const error = new Error('API返回的数据格式无效');
      logger.error('Stability API数据错误', { 
        hasArtifacts: !!response.data.artifacts,
        artifactsLength: response.data.artifacts ? response.data.artifacts.length : 0,
        hasBase64: response.data.artifacts && response.data.artifacts[0] ? !!response.data.artifacts[0].base64 : false
      });
      throw error;
    }

    // 解码Base64数据
    const imageBuffer = Buffer.from(generationData.base64, 'base64');
    logger.info('图像生成完成', { 
      imageSize: imageBuffer.length,
      processingTime: processingTime + 'ms'
    });
    return imageBuffer;
  } catch (error) {
    logger.error('生成图像错误', { 
      message: error.message,
      stack: error.stack,
      prompt: params.prompt.length > 50 ? params.prompt.substring(0, 50) + '...' : params.prompt
    });
    console.error('生成图像错误:', error.message);
    if (error.response) {
      logger.error('API响应错误', { 
        status: error.response.status,
        data: JSON.stringify(error.response.data).substring(0, 500)
      });
      console.error('API响应:', error.response.data);
    }
    throw new Error(`图像生成失败: ${error.message}`);
  }
}

/**
 * 生成测试图像(当API密钥未配置时使用)
 * @param {string} prompt - 提示词
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {Promise<Buffer>} 图像数据Buffer
 */
async function generateTestImage(prompt, width, height) {
  console.log('生成测试图像', { prompt, width, height });
  
  // 确保宽高有效
  width = ensureDimensionValid(width);
  height = ensureDimensionValid(height);
  
  try {
    // 创建渐变背景
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
          测试图像: ${prompt}
        </text>
        <text x="50%" y="50%" dy="30" font-family="Arial" font-size="16" fill="white" text-anchor="middle">
          API密钥未配置，这是示例图像
        </text>
      </svg>
    `;

    // 使用sharp将SVG转换为PNG
    const imageBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    return imageBuffer;
  } catch (error) {
    console.error('生成测试图像错误:', error);
    throw new Error(`测试图像生成失败: ${error.message}`);
  }
}

/**
 * 确保尺寸符合Stability API要求
 * @param {number} dimension - 原始尺寸
 * @returns {number} - 有效的尺寸
 */
function ensureDimensionValid(dimension) {
  // SDXL接受的尺寸列表
  const validDimensions = [1024, 1152, 896, 1216, 832, 1344, 768, 1536, 640];
  
  if (validDimensions.includes(dimension)) {
    return dimension;
  }
  
  // 如果不在列表中，默认使用1024
  console.log(`尺寸 ${dimension} 不被SDXL支持，使用默认尺寸1024`);
  return 1024;
}

/**
 * 将图像调整为SDXL支持的最接近尺寸
 * @param {Buffer} imageBuffer - 图像数据
 * @returns {Promise<Buffer>} - 调整后的图像数据
 */
async function adjustToSDXLDimensions(imageBuffer) {
  // 获取图像元数据
  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;
  
  console.log(`原始图像尺寸: ${width}x${height}`);
  
  // 检查是否已经是支持的尺寸
  const isAlreadySupported = SDXL_SUPPORTED_DIMENSIONS.some(
    dim => dim.width === width && dim.height === height
  );
  
  if (isAlreadySupported) {
    console.log('图像尺寸已经符合SDXL要求，无需调整');
    return imageBuffer;
  }
  
  // 计算最合适的目标尺寸
  const aspectRatio = width / height;
  console.log(`原始图像宽高比: ${aspectRatio.toFixed(3)}`);
  
  // 找到最接近的支持尺寸
  let bestMatch = { width: 1024, height: 1024 }; // 默认为正方形
  let minDiff = Number.MAX_VALUE;
  
  SDXL_SUPPORTED_DIMENSIONS.forEach(dim => {
    const dimRatio = dim.width / dim.height;
    const ratioDiff = Math.abs(aspectRatio - dimRatio);
    
    if (ratioDiff < minDiff) {
      minDiff = ratioDiff;
      bestMatch = dim;
    }
  });
  
  console.log(`选择最接近的SDXL支持尺寸: ${bestMatch.width}x${bestMatch.height}`);
  
  // 调整图像尺寸
  const resizedImageBuffer = await sharp(imageBuffer)
    .resize({
      width: bestMatch.width,
      height: bestMatch.height,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 } // 透明背景
    })
    .png()
    .toBuffer();
  
  console.log(`已调整图像尺寸至 ${bestMatch.width}x${bestMatch.height}`);
  return resizedImageBuffer;
}

/**
 * 保存图像到文件
 * @param {Buffer} imageBuffer - 图像数据
 * @param {string} filename - 文件名
 * @returns {Promise<string>} 保存的文件路径
 */
async function saveImageToFile(imageBuffer, filename) {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  
  // 同步方法确保上传目录存在
  if (!fs.existsSync(uploadsDir)) {
    console.log(`上传目录不存在，同步创建: ${uploadsDir}`);
    fs.mkdirSync(uploadsDir, { recursive: true });
    // 设置目录权限
    fs.chmodSync(uploadsDir, 0o755);
    console.log(`上传目录创建成功: ${uploadsDir}`);
  }
  
  // 再次检查以确保目录确实存在
  if (!fs.existsSync(uploadsDir)) {
    throw new Error(`无法创建上传目录: ${uploadsDir}`);
  }
  
  const filePath = path.join(uploadsDir, filename);
  
  try {
    // 确保文件不存在，避免覆盖
    if (fs.existsSync(filePath)) {
      const timestamp = Date.now();
      const newFilename = `${timestamp}_${filename}`;
      const newFilePath = path.join(uploadsDir, newFilename);
      await fs.promises.writeFile(newFilePath, imageBuffer);
      logger.info(`图像已保存到: ${newFilePath}`);
      return `/uploads/${newFilename}`;
    } else {
      await fs.promises.writeFile(filePath, imageBuffer);
      logger.info(`图像已保存到: ${filePath}`);
      return `/uploads/${filename}`;
    }
  } catch (error) {
    logger.error('保存图像错误:', { 
      error: error.message, 
      filename, 
      path: filePath 
    });
    console.error('保存图像错误:', error);
    throw new Error(`保存图像失败: ${error.message}`);
  }
}

/**
 * 使用用户图像和提示词通过img2img生成融合图像
 * @param {Object} params - 参数
 * @param {string} params.prompt - 提示词
 * @param {Buffer|string} params.imageBuffer - 图像数据或路径
 * @param {string} [params.userImagePath] - 兼容旧代码：用户图像路径
 * @param {number} [params.imageStrength=0.35] - 图像强度(0-1之间，越小保留原图越多)
 * @param {number} [params.steps=30] - 采样步数
 * @param {number} [params.guidanceScale=7.5] - 提示词强度
 * @returns {Promise<Buffer>} 生成的图像Buffer
 */
async function generateImg2Img(params) {
  const { 
    prompt, 
    imageBuffer,
    userImagePath, 
    imageStrength = 0.35, 
    steps = 30, 
    guidanceScale = 7.5,
    negativePrompt = ''
  } = params;

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    throw new Error('提示词不能为空');
  }
  
  // 确保提示词是英文
  // 如果我们接收到中文提示词但翻译在controller层失败，这里会进行额外检查
  let finalPrompt = prompt;
  let finalNegativePrompt = negativePrompt;
  
  try {
    if (translationUtils && typeof translationUtils.containsChinese === 'function') {
      // 如果translationUtils可用，检查并翻译
      if (translationUtils.containsChinese(prompt)) {
        logger.warn('在Stability服务中检测到中文提示词，进行额外翻译', {
          originalPrompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
        });
        
        if (typeof translationUtils.translateToEnglish === 'function') {
          finalPrompt = await translationUtils.translateToEnglish(prompt);
          console.log(`在服务层翻译提示词: "${finalPrompt.substring(0, 50)}${finalPrompt.length > 50 ? '...' : ''}"`);
        } else {
          // 如果没有可用的翻译函数，使用简单替换
          logger.warn('翻译功能不可用，使用简单替换');
          finalPrompt = prompt.replace(/[\u4e00-\u9fa5]/g, '');
          finalPrompt = finalPrompt.trim() || 'image with professional editing';
        }
      }
      
      // 同样处理负面提示词
      if (negativePrompt && translationUtils.containsChinese(negativePrompt)) {
        if (typeof translationUtils.translateToEnglish === 'function') {
          finalNegativePrompt = await translationUtils.translateToEnglish(negativePrompt);
        } else {
          finalNegativePrompt = negativePrompt.replace(/[\u4e00-\u9fa5]/g, '');
          finalNegativePrompt = finalNegativePrompt.trim() || 'blurry, bad quality';
        }
      }
    } else {
      // 如果translationUtils不可用，使用简单的中文检测和替换
      const containsChinese = /[\u4e00-\u9fa5]/.test(prompt);
      if (containsChinese) {
        logger.warn('检测到中文字符但无法使用翻译服务', {
          originalPrompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
        });
        
        // 移除中文字符
        finalPrompt = prompt.replace(/[\u4e00-\u9fa5]/g, '');
        finalPrompt = finalPrompt.trim() || 'professional image editing';
        
        if (negativePrompt) {
          finalNegativePrompt = negativePrompt.replace(/[\u4e00-\u9fa5]/g, '');
          finalNegativePrompt = finalNegativePrompt.trim() || 'blurry, bad quality';
        }
      }
    }
  } catch (translateError) {
    logger.error('翻译过程中出错', { error: translateError.message });
    console.error('翻译过程中出错:', translateError);
    
    // 在翻译失败的情况下，使用简单替换
    finalPrompt = prompt.replace(/[\u4e00-\u9fa5]/g, '');
    finalPrompt = finalPrompt.trim() || 'professional image editing';
    
    if (negativePrompt) {
      finalNegativePrompt = negativePrompt.replace(/[\u4e00-\u9fa5]/g, '');
      finalNegativePrompt = finalNegativePrompt.trim() || 'blurry, bad quality';
    }
  }
  
  // 确保最终的提示词不为空
  if (!finalPrompt || finalPrompt.trim() === '') {
    finalPrompt = 'professional image with detailed texture';
  }
  
  logger.info('最终使用的提示词', {
    originalLength: prompt.length,
    translatedLength: finalPrompt.length,
    sample: finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : '')
  });
  console.log(`最终使用的提示词: "${finalPrompt.substring(0, 100)}${finalPrompt.length > 100 ? '...' : ''}"`);

  let inputImageBuffer;
  let originalSize = { width: 0, height: 0 };

  // 处理输入图像
  try {
    if (imageBuffer) {
      // 如果直接提供了图像buffer，直接使用
      inputImageBuffer = imageBuffer;
      console.log('使用提供的图像Buffer进行处理');
    } else if (userImagePath) {
      // 处理图像路径
      // 检查图像是否存在
      const absoluteImagePath = path.resolve(__dirname, '..', userImagePath.replace(/^\//, ''));
      if (!fs.existsSync(absoluteImagePath)) {
        throw new Error(`图像文件不存在: ${absoluteImagePath}`);
      }

      // 读取图像
      console.log(`从路径读取图像: ${absoluteImagePath}`);
      inputImageBuffer = fs.readFileSync(absoluteImagePath);
    } else {
      throw new Error('需要提供图像数据(imageBuffer)或图像路径(userImagePath)');
    }

    // 使用sharp验证图像是否有效
    const metadata = await sharp(inputImageBuffer).metadata();
    originalSize = { width: metadata.width, height: metadata.height };
    console.log('图像验证成功，格式:', metadata.format, '尺寸:', metadata.width, 'x', metadata.height);
    
    // 检查图片大小是否过大（文件体积）
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_DIMENSION = 2048; // 最大宽高维度
    
    if (inputImageBuffer.length > MAX_IMAGE_SIZE || 
        metadata.width > MAX_DIMENSION || 
        metadata.height > MAX_DIMENSION) {
      console.log('图像过大，进行压缩处理');
      
      // 计算新尺寸，保持纵横比
      let newWidth = metadata.width;
      let newHeight = metadata.height;
      
      if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
        const aspectRatio = metadata.width / metadata.height;
        
        if (metadata.width > metadata.height) {
          newWidth = MAX_DIMENSION;
          newHeight = Math.round(MAX_DIMENSION / aspectRatio);
        } else {
          newHeight = MAX_DIMENSION;
          newWidth = Math.round(MAX_DIMENSION * aspectRatio);
        }
        
        console.log(`调整图像尺寸至: ${newWidth}x${newHeight}`);
      }
      
      // 转换图像为更小的尺寸和更高的压缩率
      inputImageBuffer = await sharp(inputImageBuffer)
        .resize(newWidth, newHeight, { fit: 'inside' })
        .png({ quality: 85, compressionLevel: 9 })
        .toBuffer();
        
      console.log(`图像已压缩，新大小: ${(inputImageBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // 确保图像是png格式
    if (!['png', 'jpeg', 'jpg', 'webp'].includes(metadata.format)) {
      console.log('转换图像为PNG格式');
      inputImageBuffer = await sharp(inputImageBuffer).png().toBuffer();
    }
    
    // 调整图像为SDXL支持的尺寸
    console.log('调整图像为SDXL支持的尺寸...');
    inputImageBuffer = await adjustToSDXLDimensions(inputImageBuffer);
  } catch (error) {
    throw new Error(`处理输入图像失败: ${error.message}`);
  }

  // 检查API密钥是否配置
  if (!STABILITY_API_KEY) {
    console.log('Stability API密钥未配置，使用测试生成模式');
    return generateTestImgToImgFusion(finalPrompt, inputImageBuffer);
  }

  // 使用拆分请求控制重试
  let formData, apiResponse;
  
  try {
    // 第1步：准备FormData对象
    logger.info('准备API请求数据...');
    
    formData = new FormData();
    
    // 添加文本提示词
    formData.append('text_prompts[0][text]', finalPrompt);
    formData.append('text_prompts[0][weight]', '1');
    
    // 添加负面提示词（如果有）
    if (finalNegativePrompt && typeof finalNegativePrompt === 'string' && finalNegativePrompt.trim() !== '') {
      formData.append('text_prompts[1][text]', finalNegativePrompt);
      formData.append('text_prompts[1][weight]', '-1');
    }
    
    // 添加其他参数
    formData.append('image_strength', imageStrength.toString());
    formData.append('cfg_scale', guidanceScale.toString());
    formData.append('samples', '1');
    formData.append('steps', steps.toString());
    
    // 添加图像文件
    formData.append('init_image', inputImageBuffer, {
      filename: 'input_image.png',
      contentType: 'image/png'
    });

    // 第2步：发送API请求
    logger.info('调用Stability API的img2img功能...', { 
      prompt: finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : ''), 
      imageStrength, 
      steps, 
      guidanceScale,
      imageSize: `${(inputImageBuffer.length / 1024).toFixed(2)}KB`,
      originalSize: `${originalSize.width}x${originalSize.height}`
    });
    
    console.log('调用Stability API的img2img功能...', { 
      prompt: finalPrompt, 
      imageStrength, 
      steps, 
      guidanceScale,
      imageSize: `${(inputImageBuffer.length / 1024).toFixed(2)}KB` 
    });

    // 使用带重试功能的请求
    apiResponse = await sendRequestWithRetry({
      method: 'post',
      url: IMG2IMG_API_URL,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        ...formData.getHeaders()
      },
      data: formData,
      maxContentLength: Infinity, // 不限制响应大小
      maxBodyLength: Infinity // 不限制请求体大小
    });
    
    // 第3步：处理API响应
    logger.info('Stability API响应成功，处理结果...');
    
    // 检查是否有错误
    if (apiResponse.status !== 200) {
      console.error('Stability API错误:', apiResponse.data);
      throw new Error(`API请求失败: ${apiResponse.statusText || JSON.stringify(apiResponse.data)}`);
    }

    // 提取图像数据
    const generationData = apiResponse.data.artifacts[0];
    if (!generationData || !generationData.base64) {
      throw new Error('API返回的数据格式无效');
    }

    // 解码Base64数据
    const resultImageBuffer = Buffer.from(generationData.base64, 'base64');
    logger.info('图像生成成功', { size: `${(resultImageBuffer.length / 1024).toFixed(2)}KB` });
    return resultImageBuffer;
  } catch (error) {
    // 详细记录错误
    logger.error('img2img生成错误:', { 
      message: error.message,
      code: error.code || 'UNKNOWN',
      prompt: finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : ''),
      formDataCreated: !!formData,
      apiResponseReceived: !!apiResponse
    });
    
    console.error('img2img生成错误:', error.message);
    
    if (error.response) {
      logger.error('API响应错误:', {
        status: error.response.status,
        data: JSON.stringify(error.response.data).substring(0, 500)
      });
      console.error('API响应:', error.response.data);
    }
    
    // 如果是网络错误，提供更明确的错误消息
    if (error.code === 'ECONNRESET' || error.message.includes('socket hang up')) {
      throw new Error(`img2img生成失败: 网络连接中断，请稍后重试。详细错误: ${error.message}`);
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      throw new Error(`img2img生成失败: 请求超时，请检查网络连接或稍后重试。详细错误: ${error.message}`);
    }
    
    throw new Error(`img2img生成失败: ${error.message}`);
  }
}

/**
 * 生成测试img2img融合效果(当API密钥未配置时使用)
 * @param {string} prompt - 提示词
 * @param {Buffer} imageBuffer - 图像数据
 * @returns {Promise<Buffer>} 图像数据Buffer
 */
async function generateTestImgToImgFusion(prompt, imageBuffer) {
  console.log('生成测试img2img融合效果', { prompt, imageBuffer });
  
  try {
    // 读取用户图像
    const userImage = sharp(imageBuffer);
    const metadata = await userImage.metadata();
    
    // 创建一个渐变边框
    const width = metadata.width;
    const height = metadata.height;
    
    // 创建测试背景
    const backgroundSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4158D0" />
            <stop offset="50%" stop-color="#C850C0" />
            <stop offset="100%" stop-color="#FFCC70" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <text x="50%" y="90%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
          测试img2img融合: ${prompt}
        </text>
      </svg>
    `;
    
    const bgBuffer = await sharp(Buffer.from(backgroundSvg))
      .png()
      .toBuffer();
    
    // 创建蒙版 - 中心区域不透明，边缘透明
    const maskSize = 0.7; // 中心区域比例
    const coreSizeW = Math.floor(width * maskSize);
    const coreSizeH = Math.floor(height * maskSize);
    const leftMargin = Math.floor((width - coreSizeW) / 2);
    const topMargin = Math.floor((height - coreSizeH) / 2);
    
    const mask = await sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([
        {
          input: {
            create: {
              width: coreSizeW,
              height: coreSizeH,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
          },
          left: leftMargin,
          top: topMargin
        }
      ])
      .blur(30)
      .toBuffer();
    
    // 将用户图像与背景融合
    const fusedImage = await sharp(bgBuffer)
      .composite([
        {
          input: await userImage.toBuffer(),
          blend: 'over'
        },
        {
          input: mask,
          blend: 'multiply'
        }
      ])
      .toBuffer();
      
    return fusedImage;
  } catch (error) {
    console.error('生成测试img2img融合效果错误:', error);
    throw new Error(`测试img2img融合失败: ${error.message}`);
  }
}

/**
 * 生成文本转图像
 * @param {Object} params - 生成参数
 * @returns {Promise<Object>} - 生成结果
 */
async function generateTextToImage(params) {
  // 验证API密钥
  checkApiKey();

  const {
    prompt,
    negativePrompt,
    width = 1024,
    height = 1024,
    numberOfImages = 1,
    steps = 30,
    guidanceScale = 7.5,
    seed = 0
  } = params;

  // 构建API请求配置
  const requestConfig = prepareRequestConfig({
    method: 'post',
    url: STABILITY_API_URL,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${STABILITY_API_KEY}`
    },
    data: {
      text_prompts: [
        {
          text: prompt,
          weight: 1.0
        },
        ...(negativePrompt ? [{
          text: negativePrompt,
          weight: -1.0
        }] : [])
      ],
      cfg_scale: guidanceScale,
      height,
      width,
      samples: numberOfImages,
      steps,
      ...(seed !== 0 && { seed })
    }
  });

  // 发送API请求
  const response = await sendRequestWithRetry(
    requestConfig,
    MAX_RETRIES, 
    INITIAL_RETRY_DELAY, 
    MAX_RETRY_DELAY, 
    RETRY_FACTOR, 
    RETRY_JITTER
  );

  // 返回生成结果
  return response.data;
}

/**
 * 图像到图像转换
 * @param {Object} params - 转换参数
 * @returns {Promise<Object>} - 转换结果
 */
async function generateImageToImage(params) {
  // 验证API密钥 
  checkApiKey();

  // 提取参数
  const { 
    imageBuffer, 
    prompt, 
    negativePrompt,
    imageStrength = 0.35,
    steps = 50,
    guidanceScale = 7.5,
    seed = 0 
  } = params;

  // 创建FormData
  const formData = new FormData();
  formData.append('init_image', imageBuffer, {
    filename: 'image.png',
    contentType: 'image/png'
  });
  formData.append('init_image_mode', 'IMAGE_STRENGTH');
  formData.append('image_strength', imageStrength.toString());
  formData.append('steps', steps.toString());
  formData.append('seed', seed.toString());
  formData.append('cfg_scale', guidanceScale.toString());
  formData.append('samples', '1');
  
  formData.append('text_prompts[0][text]', prompt);
  formData.append('text_prompts[0][weight]', '1');

  if (negativePrompt) {
    formData.append('text_prompts[1][text]', negativePrompt);
    formData.append('text_prompts[1][weight]', '-1');
  }

  // 构建API请求配置
  const requestConfig = prepareRequestConfig({
    method: 'post',
    url: IMG2IMG_API_URL,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${STABILITY_API_KEY}`,
      ...formData.getHeaders()
    },
    data: formData
  });

  // 发送API请求
  const response = await sendRequestWithRetry(
    requestConfig,
    MAX_RETRIES, 
    INITIAL_RETRY_DELAY, 
    MAX_RETRY_DELAY, 
    RETRY_FACTOR, 
    RETRY_JITTER
  );

  // 返回转换结果
  return response.data;
}

/**
 * 图像修复（inpaint）功能
 * @param {Object} params - 修复参数
 * @param {Buffer|string} params.image - 原始图像数据或路径
 * @param {Buffer|string} params.mask - 蒙版图像数据或路径（白色区域为要修改的区域）
 * @param {string} params.prompt - 描述要添加的内容的提示词
 * @param {string} [params.negativePrompt] - 负面提示词
 * @param {string} [params.outputFormat='webp'] - 输出格式，支持'webp'、'png'、'jpg'
 * @returns {Promise<Buffer>} - 修复后的图像Buffer
 */
async function inpaintImage(params) {
  // 验证API密钥
  checkApiKey();

  const {
    image,
    mask,
    prompt,
    negativePrompt,
    outputFormat = 'webp'
  } = params;

  // 首先确保提示词是英文
  let finalPrompt = prompt;
  let finalNegativePrompt = negativePrompt;

  try {
    if (translationUtils && typeof translationUtils.containsChinese === 'function') {
      if (translationUtils.containsChinese(prompt)) {
        logger.info('正在翻译inpaint提示词', { 
          originalPrompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '') 
        });
        finalPrompt = await translationUtils.translateToEnglish(prompt);
      }

      if (negativePrompt && translationUtils.containsChinese(negativePrompt)) {
        finalNegativePrompt = await translationUtils.translateToEnglish(negativePrompt);
      }
    }
  } catch (translateError) {
    logger.error('翻译提示词出错', { error: translateError.message });
    // 继续使用原始提示词
  }

  // 处理图像和蒙版
  let imageBuffer, maskBuffer;

  try {
    // 处理图像
    if (Buffer.isBuffer(image)) {
      imageBuffer = image;
    } else if (typeof image === 'string') {
      // 判断是否是文件路径或URL
      if (image.startsWith('http')) {
        // 下载网络图像
        const response = await axios.get(image, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(response.data);
      } else {
        // 读取本地文件
        const imagePath = image.startsWith('/') ? image : path.join(__dirname, '..', image);
        imageBuffer = await fs.promises.readFile(imagePath);
      }
    } else {
      throw new Error('图像参数格式不正确');
    }

    // 处理蒙版
    if (Buffer.isBuffer(mask)) {
      maskBuffer = mask;
    } else if (typeof mask === 'string') {
      if (mask.startsWith('http')) {
        const response = await axios.get(mask, { responseType: 'arraybuffer' });
        maskBuffer = Buffer.from(response.data);
      } else {
        const maskPath = mask.startsWith('/') ? mask : path.join(__dirname, '..', mask);
        maskBuffer = await fs.promises.readFile(maskPath);
      }
    } else {
      throw new Error('蒙版参数格式不正确');
    }

    // 验证图像格式
    await sharp(imageBuffer).metadata();
    await sharp(maskBuffer).metadata();

  } catch (error) {
    logger.error('处理inpaint图像或蒙版出错', { error: error.message });
    throw new Error(`处理图像或蒙版失败: ${error.message}`);
  }

  logger.info('开始inpaint处理', { 
    prompt: finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : ''),
    imageSize: imageBuffer.length,
    maskSize: maskBuffer.length,
    outputFormat
  });

  try {
    // 创建FormData对象
    const formData = new FormData();
    formData.append('image', imageBuffer, {
      filename: 'image.png',
      contentType: 'image/png'
    });
    
    // 创建一个空的蒙版（全透明），使整个图像都可以被修改
    const metadata = await sharp(imageBuffer).metadata();
    const emptyMask = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 } // 白色蒙版（表示整个图像都要处理）
      }
    }).png().toBuffer();
    
    formData.append('mask', emptyMask, {
      filename: 'mask.png',
      contentType: 'image/png'
    });
    
    formData.append('prompt', finalPrompt);
    
    if (finalNegativePrompt) {
      formData.append('negative_prompt', finalNegativePrompt);
    }
    
    if (outputFormat) {
      formData.append('output_format', outputFormat);
    }

    // 准备请求配置
    const requestConfig = prepareRequestConfig({
      method: 'post',
      url: INPAINT_API_URL,
      headers: {
        'Accept': 'image/*',
        'Authorization': `Bearer ${STABILITY_API_KEY}`
      },
      data: formData,
      responseType: 'arraybuffer'
    });

    // 发送请求
    const response = await sendRequestWithRetry(
      requestConfig,
      MAX_RETRIES,
      INITIAL_RETRY_DELAY,
      MAX_RETRY_DELAY,
      RETRY_FACTOR,
      RETRY_JITTER
    );

    // 检查响应
    if (response.status !== 200) {
      // 这里需要特殊处理，因为response.data是二进制数据
      let errorMessage = 'API请求失败';
      try {
        if (response.data) {
          errorMessage = Buffer.from(response.data).toString();
        }
      } catch (err) {
        // 忽略解析错误
      }
      throw new Error(`Inpaint API错误 (${response.status}): ${errorMessage}`);
    }

    // 返回图像buffer
    logger.info('Inpaint处理成功', { 
      responseSize: response.data.length,
      contentType: response.headers['content-type']
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    logger.error('Inpaint处理失败', { 
      error: error.message,
      prompt: finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : '')
    });
    throw new Error(`Inpaint处理失败: ${error.message}`);
  }
}

/**
 * 使用v2beta API进行图像到图像转换（更新的版本）
 * @param {Object} params - 转换参数
 * @param {Buffer|string} params.image - 原始图像数据或路径
 * @param {string} params.prompt - 提示词
 * @param {string} [params.negativePrompt] - 负面提示词
 * @param {number} [params.styleStrength=0.35] - 样式强度 (0-1)
 * @param {string} [params.outputFormat='webp'] - 输出格式，支持'webp'、'png'、'jpg'
 * @param {string} [params.stylePreset] - 样式预设
 * @returns {Promise<Buffer>} - 转换后的图像Buffer
 */
async function stableImageToImage(params) {
  // 验证API密钥
  checkApiKey();

  const {
    image,
    prompt,
    negativePrompt,
    styleStrength = 0.35,
    outputFormat = 'webp',
    stylePreset,
    seed
  } = params;

  // 翻译提示词（如果需要）
  let finalPrompt = prompt;
  let finalNegativePrompt = negativePrompt;

  try {
    if (translationUtils && typeof translationUtils.containsChinese === 'function') {
      if (translationUtils.containsChinese(prompt)) {
        logger.info('正在翻译img2img提示词', { 
          originalPrompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '') 
        });
        finalPrompt = await translationUtils.translateToEnglish(prompt);
      }

      if (negativePrompt && translationUtils.containsChinese(negativePrompt)) {
        finalNegativePrompt = await translationUtils.translateToEnglish(negativePrompt);
      }
    }
  } catch (translateError) {
    logger.error('翻译提示词出错', { error: translateError.message });
    // 继续使用原始提示词
  }

  // 处理图像
  let imageBuffer, maskBuffer;

  try {
    if (Buffer.isBuffer(image)) {
      imageBuffer = image;
    } else if (typeof image === 'string') {
      if (image.startsWith('http')) {
        // 下载网络图像
        const response = await axios.get(image, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(response.data);
      } else {
        // 读取本地文件
        const imagePath = image.startsWith('/') ? image : path.join(__dirname, '..', image);
        imageBuffer = await fs.promises.readFile(imagePath);
      }
    } else {
      throw new Error('图像参数格式不正确');
    }

    // 验证图像
    const metadata = await sharp(imageBuffer).metadata();
    logger.info('图像验证成功', { 
      format: metadata.format, 
      width: metadata.width, 
      height: metadata.height 
    });

    // 如果图像太大，进行压缩
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      logger.info('图像过大，进行压缩');
      imageBuffer = await sharp(imageBuffer)
        .webp({ quality: 80 })
        .toBuffer();
    }
    
    // 创建一个空的蒙版（全白色，表示整个图像都要处理）
    maskBuffer = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();
    
  } catch (error) {
    logger.error('处理img2img图像出错', { error: error.message });
    throw new Error(`处理图像失败: ${error.message}`);
  }

  logger.info('开始v2beta img2img处理', { 
    prompt: finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : ''),
    imageSize: imageBuffer.length,
    styleStrength,
    outputFormat
  });

  try {
    // 创建FormData对象
    const formData = new FormData();
    
    // 添加必需参数
    formData.append('image', imageBuffer, {
      filename: 'image.png',
      contentType: 'image/png'
    });
    
    formData.append('prompt', finalPrompt);
    
    // 添加可选参数
    formData.append('mask', maskBuffer, {
      filename: 'mask.png',
      contentType: 'image/png'
    });
    
    if (finalNegativePrompt) {
      formData.append('negative_prompt', finalNegativePrompt);
    }
    
    if (styleStrength) {
      formData.append('strength', styleStrength.toString());
    }
    
    if (outputFormat) {
      formData.append('output_format', outputFormat);
    }
    
    if (stylePreset) {
      formData.append('style_preset', stylePreset);
    }
    
    if (seed) {
      formData.append('seed', seed.toString());
    }

    // 准备请求配置
    const requestConfig = prepareRequestConfig({
      method: 'post',
      url: INPAINT_API_URL, // 使用正确的inpaint端点
      headers: {
        'Accept': 'image/*',
        'Authorization': `Bearer ${STABILITY_API_KEY}`
      },
      data: formData,
      responseType: 'arraybuffer'
    });

    // 发送请求
    const response = await sendRequestWithRetry(
      requestConfig,
      MAX_RETRIES,
      INITIAL_RETRY_DELAY,
      MAX_RETRY_DELAY,
      RETRY_FACTOR,
      RETRY_JITTER
    );

    // 检查响应
    if (response.status !== 200) {
      // 处理二进制错误响应
      let errorMessage = 'API请求失败';
      try {
        if (response.data) {
          errorMessage = Buffer.from(response.data).toString();
        }
      } catch (err) {
        // 忽略解析错误
      }
      throw new Error(`v2beta img2img API错误 (${response.status}): ${errorMessage}`);
    }

    // 返回图像buffer
    logger.info('v2beta img2img处理成功', { 
      responseSize: response.data.length,
      contentType: response.headers['content-type']
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    logger.error('v2beta img2img处理失败', { 
      error: error.message,
      prompt: finalPrompt.substring(0, 100) + (finalPrompt.length > 100 ? '...' : '')
    });
    throw new Error(`v2beta img2img处理失败: ${error.message}`);
  }
}

/**
 * 使用Stability AI API移除图像背景
 * @param {Object} params - 参数对象
 * @param {Buffer|string} params.image - 图像缓冲区或文件路径
 * @param {string} params.outputFormat - 输出格式 (png, webp)
 * @param {boolean} params.saveToFile - 是否保存到文件
 * @param {string} params.outputPath - 输出文件路径 (如果saveToFile为true)
 * @returns {Promise<Buffer|string>} - 处理后的图像缓冲区或文件路径
 */
async function removeBackground(params) {
  // 验证API密钥
  checkApiKey();
  
  // 提取参数
  const { 
    image, 
    outputFormat = 'png', 
    saveToFile = false, 
    outputPath = null 
  } = params;
  
  // 准备FormData
  const formData = new FormData();
  
  // 处理图像输入
  if (typeof image === 'string') {
    // 如果是文件路径
    logger.info('从文件加载图像进行背景移除', { filePath: image });
    formData.append('image', fs.createReadStream(image));
  } else if (Buffer.isBuffer(image)) {
    // 如果是Buffer
    logger.info('使用Buffer数据进行背景移除', { bufferSize: image.length });
    formData.append('image', image, { filename: 'image.png' });
  } else {
    throw new Error('图像参数必须是文件路径或Buffer');
  }
  
  // 设置输出格式
  formData.append('output_format', outputFormat);
  
  // 记录API调用
  logStabilityApiCall('removeBackground', {
    outputFormat,
    saveToFile,
    imageType: typeof image === 'string' ? 'filePath' : 'buffer'
  });
  
  try {
    // 准备请求配置
    const config = {
      method: 'post',
      url: REMOVE_BG_API_URL,
      headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Accept': 'image/*',
        ...formData.getHeaders()
      },
      data: formData,
      responseType: 'arraybuffer'
    };
    
    // 发送请求
    logger.info('发送背景移除API请求');
    const response = await sendRequestWithRetry(config, MAX_RETRIES, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY);
    
    // 接收图像数据
    const imageBuffer = Buffer.from(response.data);
    
    // 如果需要保存到文件
    if (saveToFile) {
      const saveFilePath = outputPath || `./uploads/bg_removed_${Date.now()}.${outputFormat}`;
      await saveImageToFile(imageBuffer, saveFilePath);
      logger.info('背景移除结果已保存到文件', { path: saveFilePath });
      return saveFilePath;
    }
    
    // 返回图像缓冲区
    logger.info('背景移除成功', { bufferSize: imageBuffer.length });
    return imageBuffer;
  } catch (error) {
    logger.error('背景移除API请求失败', { error: error.message });
    throw new Error(`背景移除API请求失败: ${error.message}`);
  }
}

/**
 * 使用Stability AI API替换图像背景并重新打光
 * @param {Object} params - 参数对象
 * @param {Buffer|string} params.image - 图像缓冲区或文件路径
 * @param {string} params.backgroundPrompt - 背景描述提示词
 * @param {string} params.outputFormat - 输出格式 (png, webp)
 * @param {boolean} params.saveToFile - 是否保存到文件
 * @param {string} params.outputPath - 输出文件路径 (如果saveToFile为true)
 * @returns {Promise<Object>} - 包含生成ID和结果的对象
 */
async function replaceBackgroundAndRelight(params) {
  // 验证API密钥
  checkApiKey();
  
  // 提取参数
  const { 
    image, 
    backgroundPrompt,
    outputFormat = 'png', 
    saveToFile = false, 
    outputPath = null 
  } = params;
  
  if (!backgroundPrompt) {
    throw new Error('必须提供背景描述提示词');
  }
  
  // 准备FormData
  const formData = new FormData();
  
  // 处理图像输入
  if (typeof image === 'string') {
    // 如果是文件路径
    logger.info('从文件加载图像进行背景替换', { filePath: image });
    formData.append('subject_image', fs.createReadStream(image));
  } else if (Buffer.isBuffer(image)) {
    // 如果是Buffer
    logger.info('使用Buffer数据进行背景替换', { bufferSize: image.length });
    formData.append('subject_image', image, { filename: 'image.png' });
  } else {
    throw new Error('图像参数必须是文件路径或Buffer');
  }
  
  // 设置背景提示词
  formData.append('background_prompt', backgroundPrompt);
  
  // 设置输出格式
  formData.append('output_format', outputFormat);
  
  // 记录API调用
  logStabilityApiCall('replaceBackgroundAndRelight', {
    backgroundPrompt,
    outputFormat,
    saveToFile,
    imageType: typeof image === 'string' ? 'filePath' : 'buffer'
  });
  
  try {
    // 准备请求配置
    const config = {
      method: 'post',
      url: REPLACE_BG_API_URL,
      headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Accept': 'application/json',
        ...formData.getHeaders()
      },
      data: formData
    };
    
    // 发送请求
    logger.info('发送背景替换API请求');
    const response = await sendRequestWithRetry(config, MAX_RETRIES, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY);
    
    // 接收任务ID
    const { id } = response.data;
    logger.info('背景替换请求已提交', { id });
    
    if (!id) {
      throw new Error('API响应中没有找到任务ID');
    }
    
    // 这个API是异步的，返回任务ID
    return {
      id,
      saveToFile,
      outputPath,
      outputFormat
    };
  } catch (error) {
    logger.error('背景替换API请求失败', { error: error.message });
    throw new Error(`背景替换API请求失败: ${error.message}`);
  }
}

/**
 * 检查背景替换任务状态
 * @param {string} id - 任务ID
 * @returns {Promise<Object>} - 任务状态和结果
 */
async function checkReplaceBackgroundStatus(id) {
  // 验证API密钥
  checkApiKey();
  
  if (!id) {
    throw new Error('必须提供任务ID');
  }
  
  try {
    // 使用正确的端点顺序，添加更多可能的端点
    const endpoints = [
      `${API_HOST}/v2beta/generation/status/${id}`,
      `${API_HOST}/v2beta/generation/image-to-image/result/${id}`,
      `${API_HOST}/v2beta/stable-image/result/${id}`,
      `${API_HOST}/v2beta/stable-image/edit/replace-background-and-relight/result/${id}`
    ];
    
    let response = null;
    let endpointUsed = null;
    
    // 依次尝试不同的端点
    for (const endpoint of endpoints) {
      try {
        logger.info('尝试检查背景替换任务状态', { id, endpoint });
        // 准备请求配置
        const config = {
          method: 'get',
          url: endpoint,
          headers: {
            'Authorization': `Bearer ${STABILITY_API_KEY}`,
            'Accept': 'application/json'
          },
          validateStatus: function(status) {
            return status < 500; // 接受非服务器错误的状态码
          }
        };
        
        // 发送请求
        const endpointResponse = await sendRequestWithRetry(config, MAX_RETRIES, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY);
        
        // 如果请求成功，使用此响应
        if (endpointResponse.status === 200 || endpointResponse.status === 202) {
          response = endpointResponse;
          endpointUsed = endpoint;
          logger.info('成功使用端点获取状态', { endpoint, status: endpointResponse.status });
          
          // 如果是成功完成，立即返回
          if (endpointResponse.status === 200) {
            break;
          }
        }
      } catch (error) {
        logger.warn(`尝试端点 ${endpoint} 失败`, { error: error.message });
        // 继续尝试下一个端点
      }
    }
    
    // 如果所有端点都失败
    if (!response) {
      throw new Error('所有API端点都返回了错误');
    }
    
    logger.info('成功从端点获取状态', { endpointUsed, status: response.status });
    
    if (response.status === 202) {
      // 任务仍在处理中
      logger.info('背景替换任务仍在处理中', { id });
      return { 
        status: 'processing',
        id
      };
    }
    
    if (response.status !== 200) {
      throw new Error(`API返回错误状态码: ${response.status}`);
    }
    
    // 任务完成，获取结果
    const result = response.data;
    logger.info('背景替换任务完成', { id, responseData: JSON.stringify(result).substring(0, 200) });
    
    // 检查返回的图像URL
    if (!result.image_url && !result.artifacts?.[0]?.base64) {
      logger.error('API响应中没有找到图像URL或base64数据', { 
        hasImageUrl: !!result.image_url, 
        hasArtifacts: !!result.artifacts,
        artifactsLength: result.artifacts ? result.artifacts.length : 0
      });
      throw new Error('API响应中没有找到可用的图像数据');
    }
    
    let imageBuffer;
    let imageUrl;
    
    // 处理不同的响应格式
    if (result.image_url) {
      // 如果有image_url，直接使用
      imageUrl = result.image_url;
      // 下载生成的图像
      const imageResponse = await axios.get(result.image_url, {
        responseType: 'arraybuffer'
      });
      imageBuffer = Buffer.from(imageResponse.data);
    } else if (result.artifacts && result.artifacts.length > 0 && result.artifacts[0].base64) {
      // 如果有base64数据，解码
      imageBuffer = Buffer.from(result.artifacts[0].base64, 'base64');
      // 生成本地URL（这里需要保存文件）
      const filename = `bg_replaced_${id}_${Date.now()}.png`;
      const filePath = await saveImageToFile(imageBuffer, filename);
      imageUrl = filePath;
    }
    
    logger.info('已处理背景替换结果图像', { 
      id,
      size: imageBuffer ? `${(imageBuffer.length / 1024).toFixed(2)}KB` : 'unknown',
      imageUrl: imageUrl || 'none'
    });
    
    // 返回结果
    return {
      status: 'completed',
      id,
      imageBuffer,
      imageUrl
    };
  } catch (error) {
    logger.error('检查背景替换任务状态失败', { id, error: error.message });
    return {
      status: 'error',
      id,
      error: error.message
    };
  }
}

/**
 * 下载并保存背景替换结果图像
 * @param {Object} task - 任务信息对象
 * @param {Buffer} imageBuffer - 图像数据
 * @returns {Promise<string>} - 保存的文件路径
 */
async function saveBgReplaceResult(task, imageBuffer) {
  const { id, saveToFile, outputPath, outputFormat } = task;
  
  if (!saveToFile) {
    return null;
  }
  
  try {
    const filename = outputPath || `bg_replaced_${id}.${outputFormat || 'png'}`;
    const filePath = await saveImageToFile(imageBuffer, filename);
    logger.info('背景替换结果已保存到文件', { id, path: filePath });
    return filePath;
  } catch (error) {
    logger.error('保存背景替换结果失败', { id, error: error.message });
    throw new Error(`保存背景替换结果失败: ${error.message}`);
  }
}

module.exports = {
  generateImage,
  saveImageToFile,
  ensureDimensionValid,
  generateImg2Img,
  generateTestImgToImgFusion,
  adjustToSDXLDimensions,
  generateTextToImage,
  generateImageToImage,
  inpaintImage,
  stableImageToImage,
  removeBackground,
  replaceBackgroundAndRelight,
  checkReplaceBackgroundStatus,
  saveBgReplaceResult
}; 