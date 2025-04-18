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
 * @param {Object} options - 抠图选项
 * @returns {Promise<Buffer>} - 处理后的图像（背景透明）
 */
async function removeBackground(imageInput, options = {}) {
  const {
    threshold = 10,         // 阈值，用于区分前景和背景
    featherEdges = true,    // 是否羽化边缘
    featherRadius = 5,      // 羽化半径
    includeAlpha = true     // 输出是否包含透明通道
  } = options;
  
  try {
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
    
    // 步骤1: 创建边缘检测遮罩
    console.log('[抠图] 生成边缘检测遮罩...');
    const edgeMask = await sharp(imageBuffer)
      .greyscale()
      .threshold(threshold)
      .toBuffer();
    
    // 步骤2: 羽化边缘（如果启用）
    let processedMask = edgeMask;
    if (featherEdges) {
      console.log('[抠图] 羽化遮罩边缘...');
      processedMask = await sharp(edgeMask)
        .blur(featherRadius)
        .toBuffer();
    }
    
    // 步骤3: 应用遮罩到原始图像
    console.log('[抠图] 应用遮罩到原始图像...');
    let result = await sharp(imageBuffer)
      .ensureAlpha()
      .composite([
        {
          input: processedMask,
          blend: 'in'
        }
      ]);
    
    // 步骤4: 根据需要处理透明通道
    if (includeAlpha) {
      console.log('[抠图] 保留透明通道...');
      result = result.png();
    } else {
      console.log('[抠图] 用白色填充背景...');
      result = result.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg();
    }
    
    // 输出结果
    const outputBuffer = await result.toBuffer();
    console.log(`[抠图] 处理完成，输出图像大小: ${outputBuffer.length} 字节`);
    return outputBuffer;
  } catch (error) {
    console.error('[抠图] 处理出错:', error);
    throw new Error(`抠图处理失败: ${error.message}`);
  }
}

/**
 * 更高级的抠图 - 使用阈值和颜色相似度来移除背景
 * @param {Buffer|string} imageInput - 输入图像（Buffer或文件路径）
 * @param {Object} options - 抠图选项
 * @returns {Promise<Buffer>} - 处理后的图像（背景透明）
 */
async function enhancedRemoveBackground(imageInput, options = {}) {
  const {
    tolerance = 30,         // 颜色容差（0-255）
    featherEdges = true,    // 是否羽化边缘
    featherRadius = 3,      // 羽化半径
    edgeSoftness = 0.5,     // 边缘柔和度（0-1）
    backgroundColor = null, // 已知的背景颜色 {r, g, b} 或 null
    detectionRegion = {     // 检测背景颜色的区域
      x: 5, y: 5, width: 10, height: 10
    }
  } = options;
  
  try {
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
    
    // 如果没有指定背景颜色，尝试从图像角落检测
    if (!bgColor) {
      console.log('[高级抠图] 自动检测背景颜色...');
      // 提取图像角落的小区域作为RAW数据
      const regionX = Math.min(Math.max(detectionRegion.x, 0), width - 1);
      const regionY = Math.min(Math.max(detectionRegion.y, 0), height - 1);
      const regionWidth = Math.min(detectionRegion.width, width - regionX);
      const regionHeight = Math.min(detectionRegion.height, height - regionY);
      
      const rawData = await image
        .extract({ left: regionX, top: regionY, width: regionWidth, height: regionHeight })
        .raw()
        .toBuffer();
      
      // 计算区域内的平均颜色
      let sumR = 0, sumG = 0, sumB = 0;
      const pixelCount = regionWidth * regionHeight;
      for (let i = 0; i < pixelCount; i++) {
        sumR += rawData[i * channels];
        sumG += rawData[i * channels + 1];
        sumB += rawData[i * channels + 2];
      }
      
      bgColor = {
        r: Math.round(sumR / pixelCount),
        g: Math.round(sumG / pixelCount),
        b: Math.round(sumB / pixelCount)
      };
      
      console.log(`[高级抠图] 检测到背景颜色: R=${bgColor.r}, G=${bgColor.g}, B=${bgColor.b}`);
    }
    
    // 创建SVG遮罩，实现更细腻的透明度过渡
    const chroma = (color) => Math.sqrt(color.r*color.r + color.g*color.g + color.b*color.b);
    const bgChroma = chroma(bgColor);
    
    const svgWidth = width;
    const svgHeight = height;
    
    console.log('[高级抠图] 生成自定义透明度遮罩...');
    
    // 创建自定义遮罩函数
    // 这里使用预编译的SVG可能更高效，但受限于复杂度，我们直接使用sharp的基本能力
    
    // 我们使用更简单的方法：先转换为图像，然后使用颜色移除
    console.log('[高级抠图] 应用颜色相似度移除...');
    
    // 创建带Alpha通道的图像
    const processedImage = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // 手动处理每个像素
    const { data, info } = processedImage;
    const { width: imgWidth, height: imgHeight, channels: imgChannels } = info;
    
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
        
        // 计算与背景颜色的差异
        const diffR = Math.abs(pixelR - bgColor.r);
        const diffG = Math.abs(pixelG - bgColor.g);
        const diffB = Math.abs(pixelB - bgColor.b);
        
        const diff = Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);
        
        // 基于颜色差异计算透明度
        let alpha = 255;
        if (diff <= tolerance) {
          // 完全透明
          alpha = 0;
        } else if (diff <= tolerance * 2) {
          // 部分透明（渐变过渡）
          alpha = Math.round(255 * (diff - tolerance) / tolerance);
        }
        
        // 设置透明度通道
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
    
    // 羽化边缘（如果启用）
    if (featherEdges) {
      console.log('[高级抠图] 羽化边缘...');
      result.blur(featherRadius);
    }
    
    // 输出为PNG（保留透明度）
    const outputBuffer = await result.png().toBuffer();
    
    console.log(`[高级抠图] 处理完成，输出图像大小: ${outputBuffer.length} 字节`);
    return outputBuffer;
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