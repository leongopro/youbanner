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

/**
 * @route POST /api/stablediffusion/img2img
 * @desc 使用用户图像和提示词生成融合图像
 * @access Public
 */
router.post('/img2img', stableDiffusionController.generateImg2Img);

/**
 * @route POST /api/stablediffusion/inpaint
 * @desc 使用inpaint功能修复图像
 * @access Public
 */
router.post('/inpaint', stableDiffusionController.inpaintImage);

/**
 * @route POST /api/stablediffusion/search-replace
 * @desc 使用search-replace功能替换图像内容
 * @access Public
 */
router.post('/search-replace', stableDiffusionController.searchAndReplace);

/**
 * @route POST /api/stablediffusion/avatar-composition
 * @desc 使用头像合成功能将头像与背景合成
 * @access Public
 */
router.post('/avatar-composition', stableDiffusionController.avatarComposition);

module.exports = router; 