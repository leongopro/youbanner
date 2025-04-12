const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/**
 * 上传Logo图片
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '未上传文件' });
    }
    
    const originalPath = req.file.path;
    const filename = req.file.filename;
    const processedFilename = `processed_${filename}`;
    const processedPath = path.join(path.dirname(originalPath), processedFilename);
    
    // 使用sharp处理图片
    await sharp(originalPath)
      .resize(500, 500, { fit: 'inside' }) // 调整大小，保持比例
      .toFile(processedPath);
    
    // 删除原始文件
    fs.unlinkSync(originalPath);
    
    res.status(200).json({
      url: `/uploads/${processedFilename}`,
      message: 'Logo上传成功'
    });
    
  } catch (error) {
    console.error('上传Logo出错:', error);
    res.status(500).json({ message: '服务器错误，无法处理上传' });
  }
};

/**
 * 上传参考图片
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.uploadReference = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '未上传文件' });
    }
    
    const originalPath = req.file.path;
    const filename = req.file.filename;
    const processedFilename = `reference_${filename}`;
    const processedPath = path.join(path.dirname(originalPath), processedFilename);
    
    // 使用sharp处理图片
    await sharp(originalPath)
      .resize(1920, 1080, { fit: 'inside' }) // 调整大小，保持比例
      .toFile(processedPath);
    
    // 删除原始文件
    fs.unlinkSync(originalPath);
    
    res.status(200).json({
      url: `/uploads/${processedFilename}`,
      message: '参考图片上传成功'
    });
    
  } catch (error) {
    console.error('上传参考图片出错:', error);
    res.status(500).json({ message: '服务器错误，无法处理上传' });
  }
}; 