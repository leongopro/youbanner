const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/banner.controller');

/**
 * @route POST /api/banners
 * @desc 生成YouTube Banner
 * @access Public
 */
router.post('/', bannerController.generateBanner);

/**
 * @route GET /api/banners/:id
 * @desc 获取指定ID的Banner
 * @access Public
 */
router.get('/:id', bannerController.getBannerById);

/**
 * @route DELETE /api/banners/:id
 * @desc 删除指定ID的Banner
 * @access Public
 */
router.delete('/:id', bannerController.deleteBanner);

module.exports = router; 