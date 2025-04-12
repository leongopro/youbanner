const express = require('express');
const router = express.Router();
const stableDiffusionController = require('../controllers/stablediffusion.controller');

/**
 * @route POST /api/stablediffusion/generate
 * @desc 使用StableDiffusion生成背景图片
 * @access Public
 */
router.post('/generate', stableDiffusionController.generateImage);

/**
 * @route GET /api/stablediffusion/status/:jobId
 * @desc 检查生成任务状态
 * @access Public
 */
router.get('/status/:jobId', stableDiffusionController.checkGenerationStatus);

module.exports = router; 