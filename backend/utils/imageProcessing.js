/**
 * 图像处理工具模块
 * 提供图像处理功能
 */

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

/**
 * 调整图像大小
 * @param {Buffer} imageBuffer - 图像缓冲区
 * @param {number} width - 目标宽度
 * @param {number} height - 目标高度
 * @returns {Promise<Buffer>} - 调整大小后的图像缓冲区
 */
async function resizeImage(imageBuffer, width, height) {
  try {
    return await sharp(imageBuffer)
      .resize(width, height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
  } catch (error) {
    console.error('调整图像大小失败:', error);
    throw error;
  }
}

/**
 * 将图像转换为特定格式
 * @param {Buffer} imageBuffer - 图像缓冲区
 * @param {string} format - 目标格式 (png, jpeg, webp等)
 * @returns {Promise<Buffer>} - 转换后的图像缓冲区
 */
async function convertImageFormat(imageBuffer, format = 'png') {
  try {
    return await sharp(imageBuffer)
      .toFormat(format)
      .toBuffer();
  } catch (error) {
    console.error('转换图像格式失败:', error);
    throw error;
  }
}

/**
 * 合并前景图像和背景图像
 * @param {string} foregroundPath - 前景图像路径
 * @param {string} backgroundPath - 背景图像路径
 * @param {Object} options - 配置选项
 * @returns {Promise<Buffer>} - 合并后的图像缓冲区
 */
async function compositeImages(foregroundPath, backgroundPath, options = {}) {
  const {
    left = 0,
    top = 0,
    width,
    height,
  } = options;

  try {
    // 读取背景图像
    const backgroundBuffer = await fs.readFile(backgroundPath);
    let background = sharp(backgroundBuffer);
    
    // 获取背景图像信息
    const backgroundInfo = await background.metadata();
    
    // 读取前景图像
    const foregroundBuffer = await fs.readFile(foregroundPath);
    let foreground = sharp(foregroundBuffer);
    
    // 如果提供了宽度和高度，则调整前景图像大小
    if (width && height) {
      foreground = foreground.resize(width, height);
    }
    
    // 合成图像
    const result = await background.composite([
      {
        input: await foreground.toBuffer(),
        left,
        top,
      }
    ]).toBuffer();
    
    return result;
  } catch (error) {
    console.error('合成图像失败:', error);
    throw error;
  }
}

/**
 * 增强的图像羽化处理 - 使用多层次渐变遮罩实现自然过渡
 * @param {Buffer} imageBuffer - 图像缓冲区
 * @param {Object} options - 羽化选项
 * @returns {Promise<Buffer>} - 处理后的图像缓冲区
 */
async function enhancedFeathering(imageBuffer, options = {}) {
  const {
    featherRadius = 20,
    coreOpacity = 1.0,
    edgeOpacity = 0.0,
    coreSize = 0.85,
    gradientSteps = 3
  } = options;
  
  try {
    // 获取图像信息
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    // 计算核心区域大小
    const coreWidth = Math.floor(width * coreSize);
    const coreHeight = Math.floor(height * coreSize);
    const leftMargin = Math.floor((width - coreWidth) / 2);
    const topMargin = Math.floor((height - coreHeight) / 2);
    
    // 创建多层渐变遮罩
    const maskLayers = [];
    
    // 添加核心完全不透明层
    maskLayers.push({
      input: {
        create: {
          width: coreWidth,
          height: coreHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: Math.round(coreOpacity * 255) }
        }
      },
      left: leftMargin,
      top: topMargin
    });
    
    // 创建从核心到边缘的多层次渐变
    for (let i = 1; i <= gradientSteps; i++) {
      const stepOpacity = coreOpacity - ((coreOpacity - edgeOpacity) * (i / gradientSteps));
      const stepSize = coreSize + ((1 - coreSize) * (i / gradientSteps));
      
      const stepWidth = Math.floor(width * stepSize);
      const stepHeight = Math.floor(height * stepSize);
      const stepLeft = Math.floor((width - stepWidth) / 2);
      const stepTop = Math.floor((height - stepHeight) / 2);
      
      maskLayers.push({
        input: {
          create: {
            width: stepWidth,
            height: stepHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: Math.round(stepOpacity * 255) }
          }
        },
        left: stepLeft,
        top: stepTop,
        blend: 'multiply'
      });
    }
    
    // 创建初始透明蒙版
    const baseMask = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      }
    })
    .composite(maskLayers)
    .blur(featherRadius)
    .toBuffer();
    
    // 应用蒙版到原始图像
    return await sharp(imageBuffer)
      .ensureAlpha()
      .composite([
        {
          input: baseMask,
          blend: 'in'
        }
      ])
      .toBuffer();
  } catch (error) {
    console.error('增强羽化处理失败:', error);
    return imageBuffer;
  }
}

/**
 * 分析图像边缘，优化透明区域与不透明区域的过渡
 * @param {Buffer} imageBuffer - 图像缓冲区
 * @returns {Promise<Object>} - 边缘分析结果
 */
async function analyzeImageEdges(imageBuffer) {
  try {
    // 提取图像的alpha通道
    const { info, data } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { width, height, channels } = info;
    const alphaOffset = channels - 1;
    
    // 分析透明度分布
    let transparentPixels = 0;
    let semiTransparentPixels = 0;
    let opaquePixels = 0;
    
    for (let i = 0; i < width * height; i++) {
      const alpha = data[i * channels + alphaOffset];
      if (alpha === 0) transparentPixels++;
      else if (alpha === 255) opaquePixels++;
      else semiTransparentPixels++;
    }
    
    return {
      width,
      height,
      transparentPixels,
      semiTransparentPixels,
      opaquePixels,
      transparentRatio: transparentPixels / (width * height),
      opaqueRatio: opaquePixels / (width * height),
      semiTransparentRatio: semiTransparentPixels / (width * height)
    };
  } catch (error) {
    console.error('分析图像边缘失败:', error);
    return null;
  }
}

/**
 * 智能调整图像亮度以匹配背景
 * @param {Buffer} foregroundBuffer - 前景图像缓冲区
 * @param {Buffer} backgroundBuffer - 背景图像缓冲区
 * @param {Object} options - 调整选项
 * @returns {Promise<Buffer>} - 调整后的前景图像
 */
async function matchLuminance(foregroundBuffer, backgroundBuffer, options = {}) {
  const {
    adjustmentStrength = 0.5,  // 调整强度 (0-1)
    regionSize = 0.3           // 分析区域大小 (相对于前景图像尺寸的比例)
  } = options;
  
  try {
    // 获取前景和背景图像信息
    const fgInfo = await sharp(foregroundBuffer).metadata();
    const bgInfo = await sharp(backgroundBuffer).metadata();
    
    // 提取前景图像的统计信息
    const fgStats = await sharp(foregroundBuffer)
      .stats();
    
    // 计算放置位置（居中）
    const left = Math.max(0, Math.floor((bgInfo.width - fgInfo.width) / 2));
    const top = Math.max(0, Math.floor((bgInfo.height - fgInfo.height) / 2));
    
    // 计算背景对应区域的范围
    const regionWidth = Math.round(fgInfo.width * regionSize);
    const regionHeight = Math.round(fgInfo.height * regionSize);
    const regionLeft = Math.max(0, left + Math.floor((fgInfo.width - regionWidth) / 2));
    const regionTop = Math.max(0, top + Math.floor((fgInfo.height - regionHeight) / 2));
    
    // 提取背景对应区域的统计信息
    const bgStats = await sharp(backgroundBuffer)
      .extract({
        left: regionLeft,
        top: regionTop,
        width: Math.min(regionWidth, bgInfo.width - regionLeft),
        height: Math.min(regionHeight, bgInfo.height - regionTop)
      })
      .stats();
    
    // 计算亮度差异（使用平均值作为简化的亮度指标）
    const fgBrightness = (fgStats.channels[0].mean + fgStats.channels[1].mean + fgStats.channels[2].mean) / 3;
    const bgBrightness = (bgStats.channels[0].mean + bgStats.channels[1].mean + bgStats.channels[2].mean) / 3;
    
    // 计算亮度调整因子
    const brightnessDiff = bgBrightness - fgBrightness;
    const adjustment = brightnessDiff * adjustmentStrength;
    
    // 应用亮度调整
    let processedFg = sharp(foregroundBuffer);
    
    if (Math.abs(adjustment) > 5) {  // 只有当调整幅度较大时才应用
      processedFg = processedFg.modulate({
        brightness: 1 + (adjustment / 100)  // 转换为sharp的亮度调整格式
      });
    }
    
    return await processedFg.toBuffer();
  } catch (error) {
    console.error('匹配亮度失败:', error);
    return foregroundBuffer;  // 发生错误时返回原始图像
  }
}

/**
 * 高级头像合成 - 实现自然融合的头像与背景
 * @param {Buffer|string} avatarInput - 头像图像（Buffer或文件路径）
 * @param {Buffer|string} backgroundInput - 背景图像（Buffer或文件路径）
 * @param {Object} options - 合成选项
 * @returns {Promise<Buffer>} - 合成后的图像
 */
async function naturalAvatarComposite(avatarInput, backgroundInput, options = {}) {
  const {
    position = 'center',        // 位置: center, top, bottom, left, right, top-left, top-right, bottom-left, bottom-right 或者 [x, y] 或 "x:100,y:200" 或 "x:10%,y:25%"
    size = 0.3,                 // 相对于背景的大小比例
    featherOptions = {          // 羽化选项
      featherRadius: 25,        // 羽化半径
      coreSize: 0.85,           // 中心保留区域大小
      gradientSteps: 4          // 渐变层次
    },
    matchBackground = true,     // 是否匹配背景亮度
    blendMode = 'over',         // 混合模式
    opacity = 1.0               // 不透明度
  } = options;
  
  try {
    // 加载图像 - 添加增强的错误处理
    let avatarBuffer, backgroundBuffer;
    
    // 安全地读取文件
    const safeReadFile = async (input, fileType) => {
      if (typeof input !== 'string') {
        console.log(`[图像处理] ${fileType}输入为Buffer数据，长度: ${input.length} 字节`);
        return input;
      }
      
      try {
        console.log(`[图像处理] 正在读取${fileType}文件: ${input}`);
        const buffer = await fs.readFile(input);
        console.log(`[图像处理] 成功读取${fileType}文件，大小: ${buffer.length} 字节`);
        return buffer;
      } catch (err) {
        console.error(`[图像处理] 读取${fileType}文件失败: ${err.message}`);
        throw new Error(`读取${fileType}文件失败: ${err.message} (路径: ${input})`);
      }
    };
    
    // 读取头像和背景图片
    avatarBuffer = await safeReadFile(avatarInput, '头像');
    backgroundBuffer = await safeReadFile(backgroundInput, '背景');
    
    // 验证图像数据有效性
    try {
      // 尝试处理图像元数据，验证是否为有效图像
      const bgInfo = await sharp(backgroundBuffer).metadata();
      const { width: bgWidth, height: bgHeight } = bgInfo;
      console.log(`[图像处理] 背景图像尺寸: ${bgWidth}x${bgHeight}, 格式: ${bgInfo.format}`);
      
      // 调整头像大小
      const targetWidth = Math.round(bgWidth * size);
      console.log(`[图像处理] 调整头像大小为 ${targetWidth} 像素宽`);
      
      const resizedAvatar = await resizeImage(avatarBuffer, targetWidth, null);
      const avatarInfo = await sharp(resizedAvatar).metadata();
      console.log(`[图像处理] 头像调整后尺寸: ${avatarInfo.width}x${avatarInfo.height}`);
      
      // 如果启用了背景匹配，调整头像亮度以匹配背景
      let processedAvatar = resizedAvatar;
      if (matchBackground) {
        console.log('[图像处理] 匹配头像亮度与背景...');
        processedAvatar = await matchLuminance(resizedAvatar, backgroundBuffer, {
          adjustmentStrength: 0.7
        });
      }
      
      // 应用增强羽化效果
      console.log('[图像处理] 应用羽化效果...');
      const featheredAvatar = await enhancedFeathering(processedAvatar, featherOptions);
      
      // 计算位置
      let avatarX, avatarY;
      
      // 处理自定义坐标格式
      if (typeof position === 'string' && (position.includes('x:') || position.includes('y:'))) {
        // 解析类似 "x:100,y:200" 或 "x:10%,y:25%" 的格式
        const xMatch = position.match(/x:([0-9]+%?)/);
        const yMatch = position.match(/y:([0-9]+%?)/);
        
        let xPos = xMatch ? xMatch[1] : '50%';
        let yPos = yMatch ? yMatch[1] : '50%';
        
        // 处理百分比
        if (xPos.endsWith('%')) {
          const percent = parseInt(xPos.replace('%', '')) / 100;
          avatarX = Math.round((bgWidth - avatarInfo.width) * percent);
        } else {
          avatarX = parseInt(xPos);
        }
        
        if (yPos.endsWith('%')) {
          const percent = parseInt(yPos.replace('%', '')) / 100;
          avatarY = Math.round((bgHeight - avatarInfo.height) * percent);
        } else {
          avatarY = parseInt(yPos);
        }
        
        console.log(`[图像处理] 使用自定义坐标: x=${avatarX}, y=${avatarY} (从 ${position})`);
      } else if (Array.isArray(position) && position.length === 2) {
        // 处理数组格式坐标 [x, y]
        // 支持百分比表示法，如 ["10%", "20%"]
        if (typeof position[0] === 'string' && position[0].endsWith('%')) {
          const percent = parseInt(position[0]) / 100;
          avatarX = Math.round((bgWidth - avatarInfo.width) * percent);
        } else {
          avatarX = parseInt(position[0]);
        }
        
        if (typeof position[1] === 'string' && position[1].endsWith('%')) {
          const percent = parseInt(position[1]) / 100;
          avatarY = Math.round((bgHeight - avatarInfo.height) * percent);
        } else {
          avatarY = parseInt(position[1]);
        }
      } else {
        // 计算边缘填充，为了防止图像被切断
        const padding = Math.round(bgWidth * 0.05); // 5%的边缘填充
        
        // 基于预设位置计算
        switch (position) {
          case 'top':
            avatarX = Math.round((bgWidth - avatarInfo.width) / 2);
            avatarY = padding;
            break;
          case 'bottom':
            avatarX = Math.round((bgWidth - avatarInfo.width) / 2);
            avatarY = bgHeight - avatarInfo.height - padding;
            break;
          case 'left':
            avatarX = padding;
            avatarY = Math.round((bgHeight - avatarInfo.height) / 2);
            break;
          case 'right':
            avatarX = bgWidth - avatarInfo.width - padding;
            avatarY = Math.round((bgHeight - avatarInfo.height) / 2);
            break;
          case 'top-left':
            avatarX = padding;
            avatarY = padding;
            break;
          case 'top-right':
            avatarX = bgWidth - avatarInfo.width - padding;
            avatarY = padding;
            break;
          case 'bottom-left':
            avatarX = padding;
            avatarY = bgHeight - avatarInfo.height - padding;
            break;
          case 'bottom-right':
            avatarX = bgWidth - avatarInfo.width - padding;
            avatarY = bgHeight - avatarInfo.height - padding;
            break;
          case 'center':
          default:
            avatarX = Math.round((bgWidth - avatarInfo.width) / 2);
            avatarY = Math.round((bgHeight - avatarInfo.height) * 0.45);  // 略微偏上以获得更自然的视觉效果
            break;
        }
      }
      
      // 确保坐标在有效范围内
      avatarX = Math.max(0, Math.min(bgWidth - avatarInfo.width, avatarX));
      avatarY = Math.max(0, Math.min(bgHeight - avatarInfo.height, avatarY));
      
      console.log(`[图像处理] 位置: ${JSON.stringify(position)}, 最终坐标: x=${avatarX}, y=${avatarY}`);
      
      // 合成最终图像
      console.log('[图像处理] 执行图像合成...');
      const result = await sharp(backgroundBuffer)
        .composite([
          {
            input: featheredAvatar,
            top: avatarY,
            left: avatarX,
            blend: blendMode,
            opacity: opacity
          }
        ])
        .toBuffer();
      
      console.log(`[图像处理] 合成完成，输出图像大小: ${result.length} 字节`);
      return result;
    } catch (processingError) {
      console.error('[图像处理] 处理过程出错:', processingError);
      
      // 尝试最基本的合成作为备选方案
      console.log('[图像处理] 尝试使用基本合成作为备选...');
      return await sharp(backgroundBuffer)
        .composite([{
          input: avatarBuffer,
          gravity: 'center'
        }])
        .toBuffer();
    }
  } catch (error) {
    console.error('[图像处理] 头像合成失败:', error);
    throw error;
  }
}

/**
 * 抠图 - 移除图像背景
 * @param {Buffer|string} imageInput - 输入图像（Buffer或文件路径）
 * @param {string} outputPath - 输出图像路径（如果null，则返回Buffer）
 * @param {number} threshold - 阈值，用于区分前景和背景
 * @param {Object} options - 其他抠图选项
 * @returns {Promise<string|Buffer>} - 处理后的图像路径或Buffer
 */
async function removeBackground(imageInput, outputPath = null, threshold = 10, options = {}) {
  const {
    featherEdges = true,    // 是否羽化边缘
    featherRadius = 5,      // 羽化半径
    includeAlpha = true,    // 输出是否包含透明通道
    preserveDetails = true, // 保留细节
    blurBackground = true,  // 是否先模糊背景以减少噪点
    preserveColor = true    // 保留原始颜色信息
  } = options;
  
  try {
    console.log(`[抠图] 开始处理图像${outputPath ? `，输出到: ${outputPath}` : ''}`);
    console.log(`[抠图] 使用阈值: ${threshold}`);
    
    // 加载图像
    let imageBuffer;
    if (typeof imageInput === 'string') {
      console.log(`[抠图] 从文件加载图像: ${imageInput}`);
      imageBuffer = await fs.readFile(imageInput);
    } else {
      console.log(`[抠图] 使用提供的Buffer数据，大小: ${imageInput.length} 字节`);
      imageBuffer = imageInput;
    }
    
    // 获取图像信息
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`[抠图] 图像尺寸: ${metadata.width}x${metadata.height}, 格式: ${metadata.format}`);
    
    // 保存原始彩色图像，用于最终合成
    const originalImage = sharp(imageBuffer);
    
    // 步骤1: 创建预处理图像，增强前景与背景对比度
    let preprocessedImage = sharp(imageBuffer);
    
    if (blurBackground) {
      console.log('[抠图] 先执行轻微模糊以减少噪点...');
      preprocessedImage = preprocessedImage.blur(0.5);
    }
    
    // 步骤2: 创建边缘检测遮罩 - 只用于黑白处理生成遮罩
    console.log('[抠图] 生成边缘检测遮罩...');
    
    const edgeMask = await preprocessedImage
      .greyscale()
      .normalize() // 归一化有助于增强对比度
      .sharpen(1.5) // 增强锐化以突出边缘
      .threshold(threshold)
      .toBuffer();
    
    // 如果启用了细节保留，创建额外的边缘检测层
    let detailMask = null;
    if (preserveDetails) {
      console.log('[抠图] 生成细节保留层...');
      try {
        detailMask = await sharp(imageBuffer)
          .greyscale()
          .sharpen(2, 2, 2) // 增强细节
          .normalize()
          .threshold(threshold * 1.2) // 较高的阈值只保留显著细节
          .blur(0.5) // 轻微模糊减少噪点
          .toBuffer();
      } catch (err) {
        console.warn(`[抠图] 创建细节层失败: ${err.message}`);
        detailMask = null;
      }
    }
    
    // 步骤3: 羽化边缘（如果启用）
    let processedMask = edgeMask;
    if (featherEdges) {
      console.log('[抠图] 羽化遮罩边缘...');
      processedMask = await sharp(edgeMask)
        .blur(featherRadius)
        .toBuffer();
    }
    
    // 如果有细节遮罩，将其与主遮罩合并
    if (detailMask) {
      console.log('[抠图] 合并主遮罩和细节遮罩...');
      processedMask = await sharp(processedMask)
        .composite([
          {
            input: detailMask,
            blend: 'over' // 覆盖模式
          }
        ])
        .toBuffer();
    }
    
    // 反转遮罩：现在白色区域是要保留的前景，黑色是背景
    processedMask = await sharp(processedMask)
      .negate() // 反转颜色
      .toBuffer();
    
    // 步骤4: 应用遮罩到原始彩色图像
    console.log('[抠图] 应用遮罩到原始彩色图像...');
    
    let result = await originalImage
      .ensureAlpha()
      .composite([
        {
          input: processedMask,
          blend: 'dest-in' // 使用遮罩的alpha通道
        }
      ]);
    
    // 进一步增强透明度对比度
    try {
      result = result.composite([
        {
          input: Buffer.from(
            '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><feComponentTransfer><feFuncA type="gamma" amplitude="1.3" exponent="1.5" offset="0"/></feComponentTransfer></svg>'
          ),
          blend: 'over'
        }
      ]);
    } catch (svgError) {
      console.warn(`[抠图] SVG后处理失败，跳过此步骤: ${svgError.message}`);
      // 继续处理，不要因为SVG处理失败而中断整个流程
    }
    
    // 确保使用PNG格式以保留透明度
    result = result.png();
    
    // 输出结果
    if (outputPath) {
      console.log(`[抠图] 输出到文件: ${outputPath}`);
      // 确保输出目录存在
      const outputDir = path.dirname(outputPath);
      try {
        // 用同步方法检查目录是否存在
        const fs = require('fs');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
      } catch (err) {
        console.error(`[抠图] 创建输出目录失败: ${err.message}`);
      }
      
      await result.toFile(outputPath);
      console.log(`[抠图] 处理完成，已保存到: ${outputPath}`);
      return outputPath;
    } else {
      // 输出为PNG（保留透明度）
      const outputBuffer = await result.toBuffer();
      console.log(`[抠图] 处理完成，输出图像大小: ${outputBuffer.length} 字节`);
      return outputBuffer;
    }
  } catch (error) {
    console.error('[抠图] 处理出错:', error);
    throw new Error(`抠图处理失败: ${error.message}`);
  }
}

/**
 * 更高级的抠图 - 使用阈值和颜色相似度来移除背景
 * @param {Buffer|string} imageInput - 输入图像（Buffer或文件路径）
 * @param {string} outputPath - 输出图像路径（如果null，则返回Buffer）
 * @param {number} tolerance - 颜色容差（0-255）
 * @param {Object} options - 抠图选项
 * @returns {Promise<string|Buffer>} - 处理后的图像路径或Buffer
 */
async function enhancedRemoveBackground(imageInput, outputPath = null, tolerance = 30, options = {}) {
  const {
    featherEdges = true,    // 是否羽化边缘
    featherRadius = 3,      // 羽化半径
    edgeSoftness = 0.5,     // 边缘柔和度（0-1）
    backgroundColor = null, // 已知的背景颜色 {r, g, b} 或 null
    detectionRegion = {     // 检测背景颜色的区域
      x: 5, y: 5, width: 10, height: 10
    },
    sampleMultipleRegions = true, // 是否从多个区域采样背景颜色
    edgePreservation = true,      // 保留边缘细节
    humanOptimized = true,        // 人像优化模式
    preserveColor = true          // 保留原始颜色
  } = options;
  
  try {
    console.log(`[高级抠图] 开始处理图像${outputPath ? `，输出到: ${outputPath}` : ''}`);
    console.log(`[高级抠图] 使用颜色容差: ${tolerance}`);
    
    // 加载图像
    let imageBuffer;
    if (typeof imageInput === 'string') {
      console.log(`[高级抠图] 从文件加载图像: ${imageInput}`);
      imageBuffer = await fs.readFile(imageInput);
    } else {
      console.log(`[高级抠图] 使用提供的Buffer数据，大小: ${imageInput.length} 字节`);
      imageBuffer = imageInput;
    }
    
    // 获取图像信息
    let image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const { width, height, channels } = metadata;
    console.log(`[高级抠图] 图像尺寸: ${width}x${height}, 通道数: ${channels}, 格式: ${metadata.format}`);
    
    // 准备提取背景颜色
    let bgColor = backgroundColor;
    
    // 如果没有指定背景颜色，尝试从图像边缘检测
    if (!bgColor) {
      console.log('[高级抠图] 自动检测背景颜色...');
      
      let bgColors = [];
      
      // 从多个区域采样背景颜色 - 专注于图像边缘
      if (sampleMultipleRegions) {
        // 增加边缘采样点，更适合人像抠图
        const sampleSize = 15; // 减小采样区域大小，更集中于边缘
        const edgeOffset = 5; // 距离边缘的偏移
        
        // 只在图像的边缘区域进行采样，避开可能的前景区域
        const regions = [
          // 四个角落
          {x: edgeOffset, y: edgeOffset, width: sampleSize, height: sampleSize},
          {x: width - sampleSize - edgeOffset, y: edgeOffset, width: sampleSize, height: sampleSize},
          {x: edgeOffset, y: height - sampleSize - edgeOffset, width: sampleSize, height: sampleSize},
          {x: width - sampleSize - edgeOffset, y: height - sampleSize - edgeOffset, width: sampleSize, height: sampleSize},
          
          // 上边缘
          {x: Math.floor(width/6), y: edgeOffset, width: sampleSize, height: sampleSize},
          {x: Math.floor(width/3), y: edgeOffset, width: sampleSize, height: sampleSize},
          {x: Math.floor(width/2), y: edgeOffset, width: sampleSize, height: sampleSize},
          {x: Math.floor(2*width/3), y: edgeOffset, width: sampleSize, height: sampleSize},
          {x: Math.floor(5*width/6), y: edgeOffset, width: sampleSize, height: sampleSize},
          
          // 下边缘
          {x: Math.floor(width/6), y: height - sampleSize - edgeOffset, width: sampleSize, height: sampleSize},
          {x: Math.floor(width/3), y: height - sampleSize - edgeOffset, width: sampleSize, height: sampleSize},
          {x: Math.floor(width/2), y: height - sampleSize - edgeOffset, width: sampleSize, height: sampleSize},
          {x: Math.floor(2*width/3), y: height - sampleSize - edgeOffset, width: sampleSize, height: sampleSize},
          {x: Math.floor(5*width/6), y: height - sampleSize - edgeOffset, width: sampleSize, height: sampleSize},
          
          // 左边缘
          {x: edgeOffset, y: Math.floor(height/6), width: sampleSize, height: sampleSize},
          {x: edgeOffset, y: Math.floor(height/3), width: sampleSize, height: sampleSize},
          {x: edgeOffset, y: Math.floor(height/2), width: sampleSize, height: sampleSize},
          {x: edgeOffset, y: Math.floor(2*height/3), width: sampleSize, height: sampleSize},
          {x: edgeOffset, y: Math.floor(5*height/6), width: sampleSize, height: sampleSize},
          
          // 右边缘
          {x: width - sampleSize - edgeOffset, y: Math.floor(height/6), width: sampleSize, height: sampleSize},
          {x: width - sampleSize - edgeOffset, y: Math.floor(height/3), width: sampleSize, height: sampleSize},
          {x: width - sampleSize - edgeOffset, y: Math.floor(height/2), width: sampleSize, height: sampleSize},
          {x: width - sampleSize - edgeOffset, y: Math.floor(2*height/3), width: sampleSize, height: sampleSize},
          {x: width - sampleSize - edgeOffset, y: Math.floor(5*height/6), width: sampleSize, height: sampleSize}
        ];
        
        // 从每个区域提取颜色并计算标准差，识别颜色一致性
        let colorStdDevs = [];
        
        // 从每个区域提取颜色
        for (const region of regions) {
          try {
            const regionX = Math.min(Math.max(region.x, 0), width - 1);
            const regionY = Math.min(Math.max(region.y, 0), height - 1);
            const regionWidth = Math.min(region.width, width - regionX);
            const regionHeight = Math.min(region.height, height - regionY);
            
            if (regionWidth <= 0 || regionHeight <= 0) continue;
            
            const rawData = await image
              .extract({ left: regionX, top: regionY, width: regionWidth, height: regionHeight })
              .raw()
              .toBuffer();
            
            // 计算区域内的平均颜色
            let sumR = 0, sumG = 0, sumB = 0;
            const pixelCount = regionWidth * regionHeight;
            
            // 同时计算区域内颜色的方差 - 方差小表示颜色一致性高，更可能是纯色背景
            let pixelValues = new Array(pixelCount);
            for (let i = 0; i < pixelCount; i++) {
              const r = rawData[i * channels];
              const g = rawData[i * channels + 1];
              const b = rawData[i * channels + 2];
              sumR += r;
              sumG += g;
              sumB += b;
              pixelValues[i] = {r, g, b};
            }
            
            const avgColor = {
              r: Math.round(sumR / pixelCount),
              g: Math.round(sumG / pixelCount),
              b: Math.round(sumB / pixelCount)
            };
            
            // 计算颜色方差
            let varianceSum = 0;
            for (let i = 0; i < pixelCount; i++) {
              const r = pixelValues[i].r;
              const g = pixelValues[i].g;
              const b = pixelValues[i].b;
              
              // 计算当前像素与平均值的差异
              const diffR = r - avgColor.r;
              const diffG = g - avgColor.g;
              const diffB = b - avgColor.b;
              
              // 加权方差计算 (相同的人眼感知权重)
              const pixelVariance = 0.299 * diffR * diffR + 0.587 * diffG * diffG + 0.114 * diffB * diffB;
              varianceSum += pixelVariance;
            }
            
            const colorVariance = varianceSum / pixelCount;
            
            bgColors.push({
              color: avgColor,
              variance: colorVariance
            });
            
            console.log(`[区域分析] 位置: (${regionX},${regionY}), 颜色: RGB(${avgColor.r},${avgColor.g},${avgColor.b}), 方差: ${colorVariance.toFixed(2)}`);
          } catch (err) {
            console.warn(`[高级抠图] 处理区域出错，跳过: ${err.message}`);
          }
        }
        
        // 筛选最可能的背景颜色组
        if (bgColors.length > 0) {
          // 首先，按照方差排序 - 方差小的区域颜色更一致，更可能是背景
          bgColors.sort((a, b) => a.variance - b.variance);
          
          // 取前30%的低方差样本 (至少3个)
          const minSamples = Math.max(3, Math.floor(bgColors.length * 0.3));
          const stableSamples = bgColors.slice(0, minSamples);
          
          // 对低方差样本再进行颜色分组
          const similarityThreshold = 20;
          const colorGroups = [];
          
          for (const sample of stableSamples) {
            let foundGroup = false;
            
            // 检查这个颜色是否与现有组相似
            for (const group of colorGroups) {
              const groupColor = group.avgColor;
              const colorObj = sample.color;
              const diff = Math.sqrt(
                Math.pow(colorObj.r - groupColor.r, 2) +
                Math.pow(colorObj.g - groupColor.g, 2) +
                Math.pow(colorObj.b - groupColor.b, 2)
              );
              
              if (diff < similarityThreshold) {
                // 添加到组，权重基于方差的倒数（方差越小权重越大）
                const weight = 1 / (1 + sample.variance);
                group.totalWeight += weight;
                
                // 更新组平均颜色（加权平均）
                group.avgColor = {
                  r: Math.round((groupColor.r * group.weightedCount + colorObj.r * weight) / (group.weightedCount + weight)),
                  g: Math.round((groupColor.g * group.weightedCount + colorObj.g * weight) / (group.weightedCount + weight)),
                  b: Math.round((groupColor.b * group.weightedCount + colorObj.b * weight) / (group.weightedCount + weight))
                };
                
                group.weightedCount += weight;
                group.count++;
                group.samples.push(sample);
                foundGroup = true;
                break;
              }
            }
            
            // 如果没有找到匹配的组，创建新组
            if (!foundGroup) {
              const weight = 1 / (1 + sample.variance);
              colorGroups.push({
                samples: [sample],
                avgColor: sample.color,
                count: 1,
                totalWeight: weight,
                weightedCount: weight,
                avgVariance: sample.variance
              });
            }
          }
          
          // 选择加权最大的颜色组
          let maxGroup = null;
          let maxWeight = 0;
          
          for (const group of colorGroups) {
            if (group.totalWeight > maxWeight) {
              maxWeight = group.totalWeight;
              maxGroup = group;
            }
          }
          
          if (maxGroup) {
            bgColor = maxGroup.avgColor;
            console.log(`[高级抠图] 选择背景色组: 样本数=${maxGroup.count}, 加权值=${maxGroup.totalWeight.toFixed(2)}, 颜色=RGB(${bgColor.r},${bgColor.g},${bgColor.b})`);
          } else if (bgColors.length > 0) {
            // 备选方案：使用方差最小的样本
            bgColor = bgColors[0].color;
            console.log(`[高级抠图] 使用备选背景色: RGB(${bgColor.r},${bgColor.g},${bgColor.b}), 方差=${bgColors[0].variance.toFixed(2)}`);
          }
        }
      }
      
      console.log(`[高级抠图] 最终检测到的背景颜色: R=${bgColor.r}, G=${bgColor.g}, B=${bgColor.b}`);
    }
    
    // 预处理：对图像进行轻微模糊以减少噪点
    imageBuffer = await sharp(imageBuffer)
      .blur(0.4)
      .toBuffer();
    
    // 人像优化：创建边缘和细节检测遮罩
    let edgeMask = null;
    let detailMask = null;
    
    if (humanOptimized) {
      console.log('[高级抠图] 正在创建人像优化边缘和细节检测...');
      
      try {
        // 创建边缘检测遮罩
        edgeMask = await sharp(imageBuffer)
          .greyscale()
          .normalize()
          .sharpen(1.5, 1.0, 1.5) // 增强锐化
          .blur(0.3)
          .threshold(20)
          .negate() // 反转以确保边缘是白色
          .toBuffer();
          
        // 创建细节保留遮罩
        detailMask = await sharp(imageBuffer)
          .greyscale()
          .normalize()
          .sharpen(2.0, 1.0, 1.0)
          .threshold(40)
          .blur(0.5)
          .toBuffer();
      } catch (err) {
        console.warn(`[高级抠图] 创建边缘/细节遮罩失败: ${err.message}`);
      }
    }
    
    // 保存原始彩色图像以保留颜色
    const originalBuffer = imageBuffer;
    
    // 创建带Alpha通道的图像
    const processedImage = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // 准备原始像素数据
    const { data, info } = processedImage;
    const { width: imgWidth, height: imgHeight, channels: imgChannels } = info;
    
    // 加载边缘和细节遮罩数据
    let edgeData = null;
    let detailData = null;
    
    if (edgeMask) {
      edgeData = await sharp(edgeMask)
        .resize(imgWidth, imgHeight)
        .raw()
        .toBuffer();
    }
    
    if (detailMask) {
      detailData = await sharp(detailMask)
        .resize(imgWidth, imgHeight)
        .raw()
        .toBuffer();
    }
    
    // 新建一个带透明通道的缓冲区
    const outputData = Buffer.alloc(data.length);
    
    // 复制原始数据
    data.copy(outputData);
    
    // 根据背景颜色的相似度调整透明度
    for (let y = 0; y < imgHeight; y++) {
      for (let x = 0; x < imgWidth; x++) {
        const i = (y * imgWidth + x) * imgChannels;
        
        const pixelR = data[i];
        const pixelG = data[i + 1];
        const pixelB = data[i + 2];
        
        // 计算与背景颜色的差异 (使用加权欧几里得距离，模拟人眼感知)
        const diffR = Math.abs(pixelR - bgColor.r);
        const diffG = Math.abs(pixelG - bgColor.g);
        const diffB = Math.abs(pixelB - bgColor.b);
        
        // 人眼对绿色更敏感，对蓝色最不敏感
        const diff = Math.sqrt(0.299 * diffR * diffR + 0.587 * diffG * diffG + 0.114 * diffB * diffB);
        
        // 更严格的二值化方法
        let alpha = 0; // 默认完全透明
        
        if (diff > tolerance * 0.9) {
          // 明显不是背景的部分 - 完全不透明
          alpha = 255;
        } else if (diff > tolerance * 0.5) {
          // 过渡区域 - 线性映射
          alpha = Math.round(255 * (diff - tolerance * 0.5) / (tolerance * 0.4));
        }
        
        // 使用中心区域检测增强人物识别
        const centerX = imgWidth / 2;
        const centerY = imgHeight / 2;
        const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        const centerRegionRadius = Math.min(imgWidth, imgHeight) / 2.5;
        
        // 中心区域的像素更倾向于保留
        if (distanceFromCenter < centerRegionRadius && diff > tolerance * 0.2) {
          alpha = Math.max(alpha, Math.round(255 * (1 - distanceFromCenter / centerRegionRadius) * 0.5));
        }
        
        // 边缘和细节检测增强
        if (edgeData && detailData) {
          const pixelPos = y * imgWidth + x;
          const edgeValue = edgeData[pixelPos];
          const detailValue = detailData[pixelPos];
          
          // 如果是边缘或有细节，更倾向于保留
          if (edgeValue > 50) {
            alpha = Math.max(alpha, 200);
          } else if (detailValue > 50) {
            alpha = Math.max(alpha, 150);
          }
        }
        
        // 保留原始颜色
        outputData[i] = data[i];
        outputData[i + 1] = data[i + 1];
        outputData[i + 2] = data[i + 2];
        
        // 设置Alpha通道
        outputData[i + 3] = alpha;
      }
    }
    
    // 转换回图像
    const result = await sharp(outputData, {
      raw: {
        width: imgWidth,
        height: imgHeight,
        channels: imgChannels
      }
    });
    
    // 应用最终处理
    let finalImage = result;
    
    // 边缘羽化以使过渡更自然
    finalImage = finalImage.blur(1.2);
    
    // 修改透明度对比度，使透明部分更透明，不透明部分更不透明
    try {
      finalImage = finalImage.composite([
        {
          input: Buffer.from(
            '<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><feComponentTransfer><feFuncA type="gamma" amplitude="1.3" exponent="1.5" offset="0"/></feComponentTransfer></svg>'
          ),
          blend: 'over'
        }
      ]);
    } catch (svgError) {
      console.warn(`[高级抠图] SVG后处理失败，跳过此步骤: ${svgError.message}`);
      // 继续处理，不要因为SVG处理失败而中断整个流程
    }
    
    // 确保使用PNG格式以保留透明度
    finalImage = finalImage.png();
    
    // 输出结果
    if (outputPath) {
      console.log(`[高级抠图] 输出到文件: ${outputPath}`);
      // 确保输出目录存在
      const outputDir = path.dirname(outputPath);
      try {
        // 用同步方法检查目录是否存在
        const fs = require('fs');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
      } catch (err) {
        console.error(`[高级抠图] 创建输出目录失败: ${err.message}`);
      }
      
      await finalImage.toFile(outputPath);
      console.log(`[高级抠图] 处理完成，已保存到: ${outputPath}`);
      return outputPath;
    } else {
      // 输出为PNG（保留透明度）
      const outputBuffer = await finalImage.toBuffer();
      console.log(`[高级抠图] 处理完成，输出图像大小: ${outputBuffer.length} 字节`);
      return outputBuffer;
    }
  } catch (error) {
    console.error('[高级抠图] 处理出错:', error);
    throw new Error(`高级抠图处理失败: ${error.message}`);
  }
}

// 导出所有函数
module.exports = {
  resizeImage,
  convertImageFormat,
  compositeImages,
  enhancedFeathering,
  analyzeImageEdges,
  matchLuminance,
  naturalAvatarComposite,
  removeBackground,
  enhancedRemoveBackground
}; 