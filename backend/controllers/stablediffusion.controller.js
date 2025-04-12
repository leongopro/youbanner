const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// 存储生成任务的状态
const generationJobs = {};

/**
 * 使用StableDiffusion API生成图片
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.generateImage = async (req, res) => {
  try {
    const { prompt, negativePrompt, width, height, steps, guidanceScale } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ message: '提示词不能为空' });
    }
    
    // 生成唯一任务ID
    const jobId = uuidv4();
    
    // 设置初始任务状态
    generationJobs[jobId] = {
      status: 'pending',
      progress: 0,
      result: null,
      error: null
    };
    
    // 返回任务ID
    res.status(202).json({ 
      jobId,
      message: '图片生成请求已接收，正在处理中' 
    });
    
    // 异步处理图像生成
    processImageGeneration(jobId, prompt, negativePrompt, width, height, steps, guidanceScale);
    
  } catch (error) {
    console.error('生成图片出错:', error);
    res.status(500).json({ message: '服务器错误，无法生成图片' });
  }
};

/**
 * 检查生成任务状态
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
exports.checkGenerationStatus = (req, res) => {
  const { jobId } = req.params;
  
  if (!generationJobs[jobId]) {
    return res.status(404).json({ message: '未找到该任务' });
  }
  
  return res.status(200).json(generationJobs[jobId]);
};

/**
 * 处理图像生成过程
 * @param {string} jobId 任务ID
 * @param {string} prompt 提示词
 * @param {string} negativePrompt 负面提示词
 * @param {number} width 图片宽度
 * @param {number} height 图片高度
 * @param {number} steps 采样步数
 * @param {number} guidanceScale 引导比例
 */
async function processImageGeneration(jobId, prompt, negativePrompt = '', width = 512, height = 512, steps = 30, guidanceScale = 7.5) {
  try {
    // 模拟调用StableDiffusion API
    // 实际实现中，这里应该替换为对实际StableDiffusion API的调用
    
    // 更新任务状态为处理中
    generationJobs[jobId].status = 'processing';
    
    // 模拟处理时间和进度更新
    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      generationJobs[jobId].progress = i * 10;
    }
    
    // 模拟图片生成完成
    const imageName = `sd_${jobId}.png`;
    const imagePath = `/uploads/stablediffusion/${imageName}`;
    
    // 确保目录存在
    const dirPath = path.join(__dirname, '..', 'public', 'uploads', 'stablediffusion');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // 在实际实现中，这里会保存从API返回的图片
    // 为了演示，这里只是更新状态
    
    generationJobs[jobId].status = 'completed';
    generationJobs[jobId].progress = 100;
    generationJobs[jobId].result = {
      imageUrl: imagePath,
      prompt,
      width,
      height,
      steps,
      guidanceScale
    };
    
    // 清理旧任务数据（可选）
    setTimeout(() => {
      delete generationJobs[jobId];
    }, 3600000); // 1小时后删除
    
  } catch (error) {
    console.error('图片生成过程出错:', error);
    generationJobs[jobId].status = 'failed';
    generationJobs[jobId].error = error.message;
  }
} 