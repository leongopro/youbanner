const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const uploadController = require('../controllers/upload.controller');

// 配置Multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    const uniqueFilename = `${uuidv4()}${fileExt}`;
    cb(null, uniqueFilename);
  },
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedFileTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件格式。只允许上传图片文件(JPG, PNG, GIF, WEBP, SVG)'), false);
  }
};

// 配置上传中间件
const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * @route POST /api/upload/logo
 * @desc 上传Logo图片
 * @access Public
 */
router.post('/logo', upload.single('logo'), uploadController.uploadLogo);

/**
 * @route POST /api/upload/reference
 * @desc 上传参考图片
 * @access Public
 */
router.post('/reference', upload.single('reference'), uploadController.uploadReference);

module.exports = router; 