const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/**
 * 通用文件上传
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.uploadGeneral = async (req, res) => {
  try {
    console.log('通用文件上传请求开始处理');
    
    if (!req.file) {
      console.error('通用文件上传错误: 未接收到文件');
      return res.status(400).json({ message: '未上传文件' });
    }
    
    console.log(`接收到文件: ${req.file.originalname}, 保存为: ${req.file.filename}, 大小: ${req.file.size}字节, 类型: ${req.file.mimetype}`);
    
    const originalPath = req.file.path;
    const filename = req.file.filename;
    const processedFilename = `general_${filename}`;
    const processedPath = path.join(path.dirname(originalPath), processedFilename);
    
    console.log(`开始处理图片: ${originalPath} -> ${processedPath}`);
    
    try {
      // 使用sharp处理图片
      await sharp(originalPath)
        .resize(1920, 1080, { fit: 'inside' }) // 调整大小，保持比例
        .toFile(processedPath);
      
      console.log('图片处理完成');
      
      // 删除原始文件
      fs.unlinkSync(originalPath);
      console.log('原始文件已删除');
      
      const fileUrl = `/uploads/${processedFilename}`;
      console.log(`文件上传成功, URL: ${fileUrl}`);
      
      // 确保响应格式正确且明确
      const response = {
        success: true,
        fileUrl: fileUrl,
        message: '文件上传成功',
        // 添加额外数据，方便调试
        timestamp: new Date().toISOString(),
        originalName: req.file.originalname,
        size: req.file.size
      };
      
      console.log('发送响应:', response);
      res.status(200).json(response);
    } catch (processingError) {
      console.error('图片处理错误:', processingError);
      res.status(500).json({ message: '图片处理失败: ' + processingError.message });
    }
  } catch (error) {
    console.error('通用文件上传出错:', error);
    res.status(500).json({ 
      message: '服务器错误，无法处理上传',
      error: error.message 
    });
  }
};

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
      success: true,
      fileUrl: `/uploads/${processedFilename}`,
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
      success: true,
      fileUrl: `/uploads/${processedFilename}`,
      message: '参考图片上传成功'
    });
    
  } catch (error) {
    console.error('上传参考图片出错:', error);
    res.status(500).json({ message: '服务器错误，无法处理上传' });
  }
};

/**
 * 上传用户自定义图片
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '未上传文件' });
    }
    
    const originalPath = req.file.path;
    const filename = req.file.filename;
    const processedFilename = `image_${filename}`;
    const processedPath = path.join(path.dirname(originalPath), processedFilename);
    
    // 只调整图像大小，不做羽化处理
    await sharp(originalPath)
      .resize(1920, 1080, { 
        fit: 'inside',
        withoutEnlargement: true // 防止小图被放大
      })
      .toFile(processedPath);
    
    // 删除原始文件
    fs.unlinkSync(originalPath);
    
    res.status(200).json({
      success: true,
      fileUrl: `/uploads/${processedFilename}`,
      message: '图片上传成功'
    });
    
  } catch (error) {
    console.error('上传自定义图片出错:', error);
    res.status(500).json({ message: '服务器错误，无法处理上传' });
  }
}; 