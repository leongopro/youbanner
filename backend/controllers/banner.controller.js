const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const axios = require('axios');

// 保存Banner数据的简易内存存储
// 实际项目中应该使用数据库
const banners = {};
// 存储生成任务的状态
const bannerJobs = {};

// 从stablediffusion.controller.js复制的函数
function containsChinese(text) {
  if (!text) return false;
  return /[\u4e00-\u9fa5]/.test(text);
}

const promptTranslations = {
  '游戏': 'gaming',
  'Vlog': 'vlog',
  '科技': 'technology',
  '教育': 'education',
  '艺术': 'art',
  '音乐': 'music',
  '频道': 'channel',
  '横幅': 'banner',
  '背景': 'background',
  '高清': 'high definition',
  '专业': 'professional'
};

function translateChineseToEnglish(text) {
  if (!text) return '';
  if (!containsChinese(text)) return text;
  
  let result = text;
  Object.keys(promptTranslations).forEach(key => {
    result = result.replace(new RegExp(key, 'g'), promptTranslations[key]);
  });
  
  result = result.replace(/[\u4e00-\u9fa5]/g, ' ');
  result = result.replace(/\s+/g, ' ').trim();
  
  return result || 'professional banner background';
}

/**
 * 生成YouTube频道Banner
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.generateBanner = async (req, res) => {
  try {
    console.log('接收到的Banner生成请求:', req.body);
    
    const { 
      channelName, 
      channelSlogan = '', 
      theme = 'default', 
      layout = 'center', 
      logoUrl = null, 
      backgroundColor = '#333333',
      backgroundImageUrl = null,
      userImageUrl = null, // 新增：用户上传的图片URL
      blendMode = 'overlay', // 新增：混合模式（overlay, multiply, screen等）
      imageOpacity = 0.8, // 新增：图片不透明度
      useAI = true, // 控制是否使用AI生成背景
      backgroundPrompt = '' // 新增：用户自定义的背景提示词
    } = req.body;
    
    if (!channelName) {
      return res.status(400).json({ message: '频道名称不能为空' });
    }
    
    // 生成唯一ID
    const bannerId = uuidv4();
    
    // 设置初始任务状态
    bannerJobs[bannerId] = {
      status: 'pending',
      progress: 0,
      result: null,
      error: null
    };
    
    // 返回任务ID
    res.status(202).json({ 
      jobId: bannerId,
      message: 'Banner生成请求已接收，正在处理中' 
    });
    
    // 异步处理Banner生成
    processBannerGeneration(
      bannerId, 
      channelName, 
      channelSlogan, 
      theme, 
      layout, 
      logoUrl, 
      backgroundColor, 
      backgroundImageUrl, 
      userImageUrl, 
      blendMode, 
      imageOpacity, 
      useAI,
      backgroundPrompt
    );
    
  } catch (error) {
    console.error('生成Banner出错:', error);
    res.status(500).json({ message: '服务器错误，无法生成Banner' });
  }
};

/**
 * 处理Banner生成过程
 */
async function processBannerGeneration(
  bannerId, 
  channelName, 
  channelSlogan, 
  theme, 
  layout, 
  logoUrl, 
  backgroundColor, 
  backgroundImageUrl, 
  userImageUrl, 
  blendMode, 
  imageOpacity, 
  useAI,
  backgroundPrompt
) {
  try {
    // 更新任务状态为处理中
    bannerJobs[bannerId].status = 'processing';
    bannerJobs[bannerId].progress = 10;
    
    // 确保存储目录存在
    const outputDir = path.join(__dirname, '../uploads/banners');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 生成Banner图片文件名
    const fileName = `banner_${bannerId}.png`;
    const outputPath = path.join(outputDir, fileName);
    const publicUrl = `/uploads/banners/${fileName}`;
    
    // 创建一个默认的画布 - 只使用Sharp
    let banner;
    let aiBackgroundGenerated = false;
    let aiBackgroundBuffer = null;
    
    // 如果需要使用AI生成背景
    if (useAI && !backgroundImageUrl) {
      try {
        bannerJobs[bannerId].progress = 20;
        
        // 根据主题生成适合的提示词
        let prompt;
        let negativePrompt = "text, watermark, low quality, blurry";
        
        // 如果用户提供了自定义背景提示词，优先使用
        if (backgroundPrompt && backgroundPrompt.trim() !== '') {
          prompt = `Professional YouTube banner background: ${backgroundPrompt}. High quality, 2560x1440`;
          console.log('使用用户自定义背景提示词:', backgroundPrompt);
        } 
        // 否则根据主题自动生成提示词
        else if (userImageUrl) {
          switch(theme) {
            case 'gaming':
              prompt = `Professional YouTube banner background for a gaming channel, abstract, vibrant colors, suitable for image compositing. Focused design with space for overlay elements. High quality, modern gaming aesthetic, 2560x1440`;
              break;
            case 'vlog':
              prompt = `Clean and minimal YouTube banner background for a vlog channel. Soft gradients, lifestyle aesthetic, designed for photo overlay compositing. Modern design, 2560x1440`;
              break;
            case 'technology':
              prompt = `Futuristic tech background for a YouTube channel. Digital elements, abstract circuits, blue tones, modern tech aesthetic. Designed to integrate uploaded tech imagery, 2560x1440`;
              break;
            case 'education':
              prompt = `Professional educational YouTube banner background. Clean design with subtle patterns, knowledge theme, perfect for compositing with educational imagery, 2560x1440`;
              break;
            case 'art':
              prompt = `Artistic background for a YouTube art channel. Creative abstract design that complements art overlays. Modern artistic style with blending capabilities, 2560x1440`;
              break;
            case 'music':
              prompt = `Dynamic music-themed YouTube banner background. Sound waves, abstract musical elements, designed for image compositing. Modern audio visualization style, 2560x1440`;
              break;
            default:
              prompt = `Professional abstract YouTube banner background. Clean modern design with subtle elements, designed for compositing with user imagery, professional look, 2560x1440`;
          }
        } else {
          switch(theme) {
            case 'gaming':
              prompt = `Professional YouTube banner background for a gaming channel named "${channelName}". High quality, vibrant colors, gaming elements, abstract gaming background, modern design, 2560x1440`;
              break;
            case 'vlog':
              prompt = `Professional YouTube banner background for a vlog channel named "${channelName}". Clean, lifestyle aesthetic, modern design, soft colors, 2560x1440`;
              break;
            case 'technology':
              prompt = `Professional YouTube banner background for a technology channel named "${channelName}". Futuristic, digital elements, blue tones, modern tech aesthetic, 2560x1440`;
              break;
            case 'education':
              prompt = `Professional YouTube banner background for an educational channel named "${channelName}". Clean, professional, subtle education elements, knowledge theme, 2560x1440`;
              break;
            case 'art':
              prompt = `Professional YouTube banner background for an art channel named "${channelName}". Creative, colorful, artistic elements, paint splatter, modern art style, 2560x1440`;
              break;
            case 'music':
              prompt = `Professional YouTube banner background for a music channel named "${channelName}". Sound waves, musical elements, dynamic design, audio visualization, 2560x1440`;
              break;
            default:
              prompt = `Professional YouTube banner background for a channel named "${channelName}". Clean, modern design, subtle elements, professional look, 2560x1440`;
          }
        }
        
        // 检查并翻译提示词（如果有中文）
        if (containsChinese(prompt)) {
          prompt = translateChineseToEnglish(prompt);
        }
        
        bannerJobs[bannerId].progress = 30;
        
        // 获取API密钥
        let apiKey = process.env.STABLE_DIFFUSION_API_KEY;
        // 如果环境变量中的API密钥无效，则使用硬编码的密钥
        if (!apiKey || apiKey === 'your_api_key_here' || apiKey === 'sk-xxxxxxxxxxxxxxxxxxxxxxxx') {
          apiKey = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN';
        }
        
        const apiUrl = process.env.STABLE_DIFFUSION_API_URL || 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image';
        
        // 检查是否启用测试模式
        const useTestMode = process.env.USE_TEST_MODE === 'true' || false;
        
        if (useTestMode) {
          console.log('使用测试模式生成Banner背景');
          // 在测试模式下生成测试图像
          const imageBuffer = await generateTestImage(channelName, theme, 1536, 640);
          aiBackgroundBuffer = imageBuffer;
          
          // 保存测试图像
          const aiBackgroundFilename = `ai_bg_${bannerId}.png`;
          const aiBackgroundPath = path.join(outputDir, aiBackgroundFilename);
          await fs.promises.writeFile(aiBackgroundPath, imageBuffer);
          
          // 将测试图像设置为banner背景
          banner = sharp(imageBuffer)
            .resize(2560, 1440, { fit: 'fill' });
          
          aiBackgroundGenerated = true;
          bannerJobs[bannerId].progress = 65;
        } else {
          // 正常模式，调用Stability AI API
          try {
            // 调整尺寸为SDXL支持的尺寸
            const supportedDimensions = [
              { width: 1024, height: 1024 },
              { width: 1152, height: 896 },
              { width: 1216, height: 832 },
              { width: 1344, height: 768 },
              { width: 1536, height: 640 }
            ];
            
            // 选择最宽的横向尺寸
            const selectedDim = supportedDimensions[4]; // 1536x640
            
            console.log('正在为Banner生成AI背景图...');
            console.log('使用提示词:', prompt);
            
            bannerJobs[bannerId].progress = 40;
            
            // 调用Stability AI API
            const response = await axios({
              method: 'post',
              url: apiUrl,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              data: {
                text_prompts: [
                  {
                    text: prompt,
                    weight: 1.0
                  },
                  {
                    text: negativePrompt,
                    weight: -1.0
                  }
                ],
                cfg_scale: 7.5,
                width: selectedDim.width,
                height: selectedDim.height,
                steps: 30,
                samples: 1
              }
            });
            
            bannerJobs[bannerId].progress = 60;
            
            // 解析API响应
            if (response.data.artifacts && response.data.artifacts.length > 0) {
              const base64Image = response.data.artifacts[0].base64;
              const imageBuffer = Buffer.from(base64Image, 'base64');
              aiBackgroundBuffer = imageBuffer; // 保存AI背景buffer用于后续融合
              
              // 保存AI生成的背景图
              const aiBackgroundFilename = `ai_bg_${bannerId}.png`;
              const aiBackgroundPath = path.join(outputDir, aiBackgroundFilename);
              await fs.promises.writeFile(aiBackgroundPath, imageBuffer);
              
              // 将AI生成的背景拉伸为banner尺寸
              banner = sharp(imageBuffer)
                .resize(2560, 1440, { fit: 'fill' });
              
              aiBackgroundGenerated = true;
              bannerJobs[bannerId].progress = 65;
            }
          } catch (apiError) {
            // 检查是否是余额不足错误
            if (apiError.response && apiError.response.data && 
                (apiError.response.data.name === 'insufficient_balance' || 
                 apiError.response.status === 429)) {
              console.warn('Stability AI API错误(可能是余额不足)，降级到测试模式');
              bannerJobs[bannerId].warning = 'AI服务暂时不可用，已使用测试模式生成背景';
              
              // 生成测试图像作为回退
              const imageBuffer = await generateTestImage(channelName, theme, 1536, 640);
              aiBackgroundBuffer = imageBuffer;
              
              // 保存测试图像
              const aiBackgroundFilename = `test_bg_${bannerId}.png`;
              const aiBackgroundPath = path.join(outputDir, aiBackgroundFilename);
              await fs.promises.writeFile(aiBackgroundPath, imageBuffer);
              
              // 将测试图像设置为banner背景
              banner = sharp(imageBuffer)
                .resize(2560, 1440, { fit: 'fill' });
              
              aiBackgroundGenerated = true;
              bannerJobs[bannerId].progress = 65;
            } else {
              // 其他API错误
              throw apiError;
            }
          }
        }
      } catch (aiError) {
        console.error('AI背景生成失败:', aiError);
        
        // 检查是否是余额不足错误
        if (aiError.response && aiError.response.data && aiError.response.data.name === 'insufficient_balance') {
          console.warn('Stability AI余额不足，使用默认背景');
          bannerJobs[bannerId].warning = 'AI服务余额不足，已使用默认背景';
        } else {
          console.error('其他API错误:', aiError.message);
        }
        
        // 如果AI生成失败，回退到普通背景
        aiBackgroundGenerated = false;
      }
    }
    
    // 如果AI背景生成失败或没有启用AI，使用其他方式
    if (!aiBackgroundGenerated) {
      if (backgroundImageUrl && fs.existsSync(path.join(__dirname, '..', backgroundImageUrl.replace(/^\//, '')))) {
        // 如果有背景图，使用背景图
        try {
          const backgroundPath = path.join(__dirname, '..', backgroundImageUrl.replace(/^\//, ''));
          aiBackgroundBuffer = await fs.promises.readFile(backgroundPath); // 将上传的背景图保存为buffer用于后续融合
          banner = sharp(backgroundPath)
            .resize(2560, 1440); // YouTube Banner 尺寸
        } catch (bgError) {
          console.error('读取背景图失败:', bgError);
          // 如果背景图读取失败，使用纯色背景
          createDefaultBackground();
        }
      } else {
        // 否则创建纯色背景
        createDefaultBackground();
      }
      bannerJobs[bannerId].progress = 70;
    }
    
    // 创建默认纯色背景的辅助函数
    async function createDefaultBackground() {
      let bgColor;
      
      // 处理不同格式的颜色值
      if (typeof backgroundColor === 'string' && backgroundColor.startsWith('#')) {
        // 将16进制颜色转换为RGB对象
        const hex = backgroundColor.substring(1);
        bgColor = {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16),
          alpha: 1
        };
      } else if (typeof backgroundColor === 'object') {
        bgColor = backgroundColor;
      } else {
        // 默认颜色
        bgColor = { r: 33, g: 37, b: 41, alpha: 1 };
      }
      
      banner = sharp({
        create: {
          width: 2560,
          height: 1440,
          channels: 4,
          background: bgColor
        }
      });

      // 生成纯色背景的buffer用于后续融合
      try {
        aiBackgroundBuffer = await banner.toBuffer();
      } catch (bufferError) {
        console.error('创建背景缓冲区失败:', bufferError);
        // 创建一个基本的黑色背景作为最后的回退选项
        aiBackgroundBuffer = Buffer.from(new Uint8Array(2560 * 1440 * 4).fill(0));
        banner = sharp({
          create: {
            width: 2560,
            height: 1440,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 }
          }
        });
      }
    }
    
    bannerJobs[bannerId].progress = 80;
    
    // 创建一个数组来存储所有要合成的元素，稍后按照顺序合成
    const compositeElements = [];
    
    // 如果有Logo，先准备Logo元素
    if (logoUrl && fs.existsSync(path.join(__dirname, '..', logoUrl.replace(/^\//, '')))) {
      const logoPath = path.join(__dirname, '..', logoUrl.replace(/^\//, ''));
      const logoBuffer = await sharp(logoPath)
        .resize(400, 400, { fit: 'inside' })
        .toBuffer();
      
      // 根据layout决定Logo位置
      let logoPosition;
      if (layout === 'left') {
        logoPosition = { left: 200, top: 520 };
      } else if (layout === 'right') {
        logoPosition = { left: 1960, top: 520 };
      } else {
        // 默认居中
        logoPosition = { left: 1080, top: 520 };
      }
      
      // 添加Logo到合成元素列表
      compositeElements.push({
        input: logoBuffer,
        left: logoPosition.left,
        top: logoPosition.top
      });
    }
    
    // 准备文字SVG - 使用SVG文本作为替代Canvas方案
    let textSvg = `
      <svg width="2560" height="1440">
        <style>
          .title { fill: white; font-size: 80px; font-weight: bold; font-family: Arial, sans-serif; text-shadow: 2px 2px 8px rgba(0,0,0,0.8); }
          .slogan { fill: rgba(255,255,255,0.9); font-size: 40px; font-family: Arial, sans-serif; text-shadow: 2px 2px 5px rgba(0,0,0,0.8); }
        </style>
    `;
    
    // 根据layout决定文字位置
    let textX;
    if (layout === 'left') {
      textX = 650;
    } else if (layout === 'right') {
      textX = 400;
    } else {
      // 默认居中
      textX = 1280;
    }
    
    textSvg += `<text x="${textX}" y="600" text-anchor="middle" class="title">${channelName}</text>`;
    
    if (channelSlogan) {
      textSvg += `<text x="${textX}" y="680" text-anchor="middle" class="slogan">${channelSlogan}</text>`;
    }
    
    textSvg += `</svg>`;
    
    // 添加文字到合成元素列表
    compositeElements.push({
      input: Buffer.from(textSvg),
      top: 0,
      left: 0
    });
    
    // 如果有用户上传的图片，与背景融合
    if (userImageUrl) {
      bannerJobs[bannerId].progress = 75;
      
      try {
        // 获取用户图像文件路径
        const userImagePath = path.join(__dirname, '..', userImageUrl.replace(/^\//, ''));
        const userImageExists = fs.existsSync(userImagePath);
        
        if (userImageExists) {
          console.log('找到用户上传的图像...');
          
          // 读取用户图像
          const userImageBuffer = await fs.promises.readFile(userImagePath);
          
          // 读取用户图像元数据
          const userImgMetadata = await sharp(userImageBuffer).metadata();
          console.log(`用户图像尺寸: ${userImgMetadata.width}x${userImgMetadata.height}`);
          
          // 处理用户图像（只调整大小，不做羽化处理）
          let processedUserImage = await sharp(userImageBuffer)
            .resize(Math.min(1800, userImgMetadata.width), Math.min(1000, userImgMetadata.height), {
              fit: 'inside',
              withoutEnlargement: true
            })
            .toBuffer();
          
          // 获取处理后的图像尺寸
          const processedMetadata = await sharp(processedUserImage).metadata();
          
          // 计算居中位置
          const left = Math.round((2560 - processedMetadata.width) / 2);
          const top = Math.round((1440 - processedMetadata.height) / 2);
          
          // 直接使用用户图像，不使用img2img处理
          // 将用户图像添加到合成元素列表，这样会显示在最上层
          compositeElements.push({
            input: processedUserImage,
            left: left,
            top: top,
            blend: 'over', // 使用'over'混合模式，这是Sharp库支持的模式，相当于普通叠加
            opacity: 1.0 // 设置为100%不透明度
          });
          
          console.log(`成功处理用户图像并添加到合成列表，保持原图不变`);
        } else {
          console.warn(`用户图像不存在: ${userImagePath}`);
        }
      } catch (err) {
        console.error(`处理用户图像时出错: ${err.message}`);
      }
    }
    
    // 按照顺序合成所有元素
    banner = banner.composite(compositeElements);
    
    // 在保存之前检查banner对象是否有效
    try {
      // 试着获取banner的元数据，这会验证它是否是有效的图像对象
      await banner.metadata();
    } catch (bannerError) {
      console.error('Banner对象无效，创建应急方案:', bannerError);
      
      // 如果banner对象无效，创建一个简单的测试图像作为应急方案
      const emergencyImage = await generateTestImage(
        channelName || 'Channel Name', 
        theme || 'default', 
        2560, 
        1440
      );
      
      banner = sharp(emergencyImage);
      bannerJobs[bannerId].warning = '原始图像生成失败，已使用备用方案';
    }
    
    // 保存Banner
    try {
      await banner.toFile(outputPath);
    } catch (saveError) {
      console.error('保存Banner文件失败:', saveError);
      
      // 如果保存失败，创建一个更简单的图像
      const simpleEmergencyImage = Buffer.from(
        `<svg width="2560" height="1440" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#333"/>
          <text x="50%" y="50%" font-family="Arial" font-size="80" 
                fill="white" text-anchor="middle">
            ${channelName || 'Banner Generation Failed'}
          </text>
          <text x="50%" y="50%" dy="100" font-family="Arial" font-size="40" 
                fill="white" text-anchor="middle">
            Error: ${saveError.message}
          </text>
        </svg>`
      );
      
      await sharp(simpleEmergencyImage)
        .png()
        .toFile(outputPath);
    }
    
    // 保存Banner数据
    banners[bannerId] = {
      id: bannerId,
      channelName,
      channelSlogan,
      theme,
      layout,
      logoUrl,
      backgroundColor,
      backgroundImageUrl,
      createdAt: new Date(),
      imageUrl: publicUrl,
      aiGenerated: aiBackgroundGenerated
    };
    
    // 更新任务完成状态
    bannerJobs[bannerId].status = 'completed';
    bannerJobs[bannerId].progress = 100;
    bannerJobs[bannerId].result = {
      id: bannerId,
      imageUrl: publicUrl
    };
    
    // 清理旧任务数据（可选）
    setTimeout(() => {
      delete bannerJobs[bannerId];
    }, 3600000); // 1小时后删除
    
  } catch (error) {
    console.error('Banner生成过程出错:', error);
    bannerJobs[bannerId].status = 'failed';
    bannerJobs[bannerId].error = error.message;
  }
}

/**
 * 检查Banner生成任务状态或获取完成的Banner
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.checkBannerStatus = (req, res) => {
  const { id } = req.params;
  const jobId = id; // 为了兼容性，使用相同的变量名
  
  // 先检查是否为生成任务
  if (bannerJobs[jobId]) {
    // 如果任务完成，添加banner信息
    if (bannerJobs[jobId].status === 'completed' && bannerJobs[jobId].result) {
      bannerJobs[jobId].id = jobId;
      bannerJobs[jobId].imageUrl = bannerJobs[jobId].result.imageUrl;
    }
    
    return res.status(200).json(bannerJobs[jobId]);
  }
  
  // 如果不是生成任务，检查是否为已完成的Banner
  if (banners[id]) {
    return res.status(200).json(banners[id]);
  }
  
  // 既不是生成任务也不是完成的Banner
  return res.status(404).json({ message: '未找到该任务或Banner' });
};

/**
 * 删除指定ID的Banner
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.deleteBanner = (req, res) => {
  const { id } = req.params;
  
  if (!banners[id]) {
    return res.status(404).json({ message: '未找到该Banner' });
  }
  
  // 删除Banner图片文件
  const imagePath = path.join(__dirname, '../uploads/banners', `banner_${id}.png`);
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
  
  // 删除Banner数据
  delete banners[id];
  
  return res.status(200).json({ message: 'Banner删除成功' });
};

/**
 * 在测试模式下生成简单的图像
 * @param {string} channelName - 频道名称
 * @param {string} theme - 主题
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {string} [errorMessage] - 可选的错误信息
 * @returns {Promise<Buffer>} - 图像缓冲区
 */
async function generateTestImage(channelName, theme, width, height, errorMessage) {
  console.log('生成测试背景图像', { channelName, theme, width, height });
  
  try {
    // 根据主题选择颜色
    let colors;
    switch(theme) {
      case 'gaming':
        colors = ['#8a2be2', '#4b0082', '#483d8b']; // 紫色，深蓝色
        break;
      case 'vlog':
        colors = ['#87ceeb', '#add8e6', '#b0e0e6']; // 浅蓝色，天蓝色
        break;
      case 'technology':
        colors = ['#00bfff', '#1e90ff', '#0000cd']; // 蓝色系
        break;
      case 'education':
        colors = ['#ffa500', '#ff8c00', '#ff7f50']; // 橙色系
        break;
      case 'art':
        colors = ['#ff1493', '#ff69b4', '#ffb6c1']; // 粉色系
        break;
      case 'music':
        colors = ['#32cd32', '#00fa9a', '#00ff7f']; // 绿色系
        break;
      default:
        colors = ['#4682b4', '#5f9ea0', '#6495ed']; // 蓝灰色系
    }
    
    // 创建渐变背景的SVG
    let errorText = '';
    if (errorMessage) {
      errorText = `
        <text x="50%" y="50%" dy="80" font-family="Arial" font-size="16" fill="white" text-anchor="middle">
          错误: ${errorMessage}
        </text>
      `;
    }
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${colors[0]}" />
            <stop offset="50%" stop-color="${colors[1]}" />
            <stop offset="100%" stop-color="${colors[2]}" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <text x="50%" y="50%" font-family="Arial" font-size="32" fill="white" text-anchor="middle">
          ${channelName} - ${theme.toUpperCase()} Channel
        </text>
        <text x="50%" y="50%" dy="40" font-family="Arial" font-size="16" fill="white" text-anchor="middle">
          测试Banner (AI服务暂不可用)
        </text>
        ${errorText}
      </svg>
    `;
    
    // 使用sharp将SVG转换为PNG
    const imageBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
    
    return imageBuffer;
  } catch (error) {
    console.error('生成测试图像错误:', error);
    
    // 极简回退 - 创建一个纯色背景
    try {
      return await sharp({
        create: {
          width: width || 1024,
          height: height || 1024,
          channels: 4,
          background: { r: 48, g: 48, b: 48, alpha: 1 }
        }
      })
      .png()
      .toBuffer();
    } catch (fallbackError) {
      // 最后的回退选项 - 返回一个静态的1x1像素
      console.error('创建回退图像失败:', fallbackError);
      return Buffer.from([0, 0, 0, 255]); // 一个黑色像素，RGBA格式
    }
  }
}

/**
 * 处理图像边缘羽化和融合，中心保持完全不透明，四周与背景无缝融合
 * @param {Buffer} imageBuffer 图像buffer
 * @param {number} featherRadius 羽化半径
 * @returns {Promise<Buffer>} 处理后的图像buffer
 */
async function featherImageEdges(imageBuffer, featherRadius = 20) {
  try {
    // 获取图像信息
    const { width, height } = await sharp(imageBuffer).metadata();
    
    // 中心区域保持完全不透明的比例
    const coreSize = 0.95; // 中心95%区域保持完全不透明
    const coreWidth = Math.floor(width * coreSize);
    const coreHeight = Math.floor(height * coreSize);
    const leftMargin = Math.floor((width - coreWidth) / 2);
    const topMargin = Math.floor((height - coreHeight) / 2);
    
    // 创建两层蒙版：
    // 1. 先创建一个从中心到边缘渐变的蒙版
    const gradientMask = await sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 } // 完全透明的背景
      }
    })
      .composite([
        {
          // 中心区域为白色不透明
          input: {
            create: {
              width: coreWidth,
              height: coreHeight,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 } // 完全不透明
            }
          },
          left: leftMargin,
          top: topMargin
        }
      ])
      .blur(featherRadius) // 较大的模糊半径，创建更平滑的过渡
      .toBuffer();
    
    // 2. 创建一个完全不透明的中心区域蒙版，确保中心区域100%不透明
    const innerCoreSize = 0.65; // 稍小于外部的中心区域，确保边缘平滑过渡
    const innerCoreWidth = Math.floor(width * innerCoreSize);
    const innerCoreHeight = Math.floor(height * innerCoreSize);
    const innerLeftMargin = Math.floor((width - innerCoreWidth) / 2);
    const innerTopMargin = Math.floor((height - innerCoreHeight) / 2);
    
    // 将中心完全不透明的蒙版与渐变蒙版合并
    const finalMask = await sharp(gradientMask)
      .composite([
        {
          // 内部中心区域完全不透明
          input: {
            create: {
              width: innerCoreWidth,
              height: innerCoreHeight,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 } // 完全不透明
            }
          },
          left: innerLeftMargin,
          top: innerTopMargin
        }
      ])
      .toBuffer();
    
    // 将最终蒙版应用到原始图像
    const featheredBuffer = await sharp(imageBuffer)
      .ensureAlpha()
      .composite([
        {
          input: finalMask,
          blend: 'multiply' // 将蒙版与图像相乘，保留中心区域不变，边缘羽化
        }
      ])
      .toBuffer();
    
    return featheredBuffer;
  } catch (error) {
    console.error('羽化图像边缘时出错:', error);
    return imageBuffer; // 如果失败，返回原始图像
  }
}

/**
 * 将用户图像与背景融合
 * @param {Buffer} backgroundBuffer 背景图像buffer
 * @param {Buffer} userImageBuffer 用户图像buffer
 * @param {Object} options 融合选项
 * @returns {Promise<Buffer>} 融合后的图像buffer
 */
async function blendImageWithBackground(backgroundBuffer, userImageBuffer, options = {}) {
  const {
    opacity = 0.8,            // 用户图像不透明度
    blendMode = 'overlay',    // 默认混合模式
    feather = true,           // 是否羽化
    featherRadius = 20,       // 羽化半径
    position = 'center'       // 位置
  } = options;
  
  try {
    // 获取背景图像尺寸
    const bgMetadata = await sharp(backgroundBuffer).metadata();
    
    // 处理用户图像（调整大小、羽化边缘）
    let processedUserImage = sharp(userImageBuffer)
      .resize(Math.round(bgMetadata.width * 0.8), Math.round(bgMetadata.height * 0.8), {
        fit: 'inside',
        withoutEnlargement: true
      });
    
    // 如果启用羽化，对用户图像应用羽化处理
    if (feather) {
      const resizedBuffer = await processedUserImage.toBuffer();
      const featheredBuffer = await featherImageEdges(resizedBuffer, featherRadius);
      processedUserImage = sharp(featheredBuffer);
    }
    
    // 转换为PNG格式，保留透明度
    const userImagePng = await processedUserImage
      .ensureAlpha()
      .png()
      .toBuffer();
    
    // 计算位置（居中）
    const userImgMetadata = await sharp(userImagePng).metadata();
    const left = Math.round((bgMetadata.width - userImgMetadata.width) / 2);
    const top = Math.round((bgMetadata.height - userImgMetadata.height) / 2);
    
    // 创建合成图像
    const composite = await sharp(backgroundBuffer)
      .composite([
        {
          input: userImagePng,
          blend: blendMode,
          opacity: opacity,
          left: left,
          top: top
        }
      ])
      .toBuffer();
      
    return composite;
  } catch (error) {
    console.error('融合图像时出错:', error);
    return backgroundBuffer; // 如果失败，返回原始背景
  }
} 