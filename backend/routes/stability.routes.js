const express = require('express');
const router = express.Router();
const stabilityController = require('../controllers/stablediffusion.controller');
const { logger } = require('../services/logger.service');

/**
 * 获取Stability API密钥
 * @route GET /api/stability/get-api-key
 * @description 安全地获取Stability API密钥
 * @access Public
 */
router.get('/get-api-key', (req, res) => {
  try {
    // 从环境变量中获取API密钥
    const apiKey = process.env.STABILITY_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;
    
    if (!apiKey) {
      logger.error('未找到Stability API密钥');
      return res.status(500).json({ error: '未找到API密钥' });
    }
    
    // 返回API密钥
    return res.json({ key: apiKey });
  } catch (error) {
    logger.error('获取API密钥时出错:', error);
    return res.status(500).json({ error: '服务器错误，无法获取API密钥' });
  }
});

/**
 * 使用v2beta API进行img2img处理
 * @route POST /api/stability/v2beta/img2img
 * @description 使用v2beta API将提供的图像转换为新图像
 * @access Public
 */
router.post('/v2beta/img2img', stabilityController.generateStableImg2Img);

/**
 * 检查v2beta处理任务状态
 * @route GET /api/stability/v2beta/status/:jobId
 * @description 检查v2beta任务状态
 * @access Public
 */
router.get('/v2beta/status/:jobId', stabilityController.checkGenerationStatus);

/**
 * 替换图像背景并重新打光
 * @route POST /api/stability/v2beta/replace-background
 * @description 替换图像背景并重新打光
 * @access Public
 */
router.post('/v2beta/replace-background', stabilityController.replaceBackgroundAndRelight);

/**
 * 测试API错误记录
 */
router.post('/test-error', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: '缺少prompt参数' });
    }
    
    // 记录请求信息
    logger.info('收到测试错误请求', { prompt });
    
    // 创建模拟错误
    const mockError = new Error('这是一个测试错误');
    mockError.code = 'TEST_ERROR';
    mockError.response = {
      status: 400,
      statusText: 'Bad Request',
      data: {
        id: 'test_error_id',
        name: 'test_error_name',
        message: '这是一个测试错误消息',
        error: '这是由stability API返回的测试错误'
      }
    };
    
    // 记录错误
    const errorInfo = stabilityController.logDetailedApiError(
      '测试错误端点', 
      'test-job-id', 
      mockError, 
      { promptLength: prompt.length }
    );
    
    // 返回错误信息
    return res.status(200).json({
      message: '已成功记录测试错误',
      error: errorInfo
    });
    
  } catch (error) {
    logger.error('测试错误端点本身出错', { error: error.message });
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

// 添加一个简单的测试端点
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Stability路由正常工作' });
});

module.exports = router; 