const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 保存Banner数据的简易内存存储
// 实际项目中应该使用数据库
const banners = {};

/**
 * 生成YouTube频道Banner
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.generateBanner = async (req, res) => {
  try {
    const { 
      channelName, 
      channelSlogan, 
      theme, 
      layout, 
      logoUrl, 
      backgroundColor,
      backgroundImageUrl
    } = req.body;
    
    if (!channelName) {
      return res.status(400).json({ message: '频道名称不能为空' });
    }
    
    // 生成唯一ID
    const bannerId = uuidv4();
    
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
    
    if (backgroundImageUrl && fs.existsSync(path.join(__dirname, '..', backgroundImageUrl.replace(/^\//, '')))) {
      // 如果有背景图，使用背景图
      banner = sharp(path.join(__dirname, '..', backgroundImageUrl.replace(/^\//, '')))
        .resize(2560, 1440); // YouTube Banner 尺寸
    } else {
      // 否则创建纯色背景
      const bgColor = backgroundColor || { r: 33, g: 37, b: 41, alpha: 1 };
      banner = sharp({
        create: {
          width: 2560,
          height: 1440,
          channels: 4,
          background: bgColor
        }
      });
    }
    
    // 如果有Logo，叠加Logo
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
      
      banner = banner.composite([
        {
          input: logoBuffer,
          left: logoPosition.left,
          top: logoPosition.top
        }
      ]);
    }
    
    // 叠加文字 - 使用SVG文本作为替代Canvas方案
    let textSvg = `
      <svg width="2560" height="1440">
        <style>
          .title { fill: white; font-size: 80px; font-weight: bold; font-family: Arial, sans-serif; }
          .slogan { fill: rgba(255,255,255,0.8); font-size: 40px; font-family: Arial, sans-serif; }
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
    
    // 合成最终图像
    banner = banner.composite([
      {
        input: Buffer.from(textSvg),
        top: 0,
        left: 0
      }
    ]);
    
    // 保存Banner
    await banner.toFile(outputPath);
    
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
      imageUrl: publicUrl
    };
    
    // 返回创建的Banner数据
    res.status(201).json({ 
      id: bannerId,
      imageUrl: publicUrl,
      message: 'Banner创建成功' 
    });
    
  } catch (error) {
    console.error('生成Banner出错:', error);
    res.status(500).json({ message: '服务器错误，无法生成Banner' });
  }
};

/**
 * 获取指定ID的Banner
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.getBannerById = (req, res) => {
  const { id } = req.params;
  
  if (!banners[id]) {
    return res.status(404).json({ message: '未找到该Banner' });
  }
  
  return res.status(200).json(banners[id]);
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