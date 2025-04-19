const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const STABILITY_API_KEY = process.env.STABILITY_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;
if (!STABILITY_API_KEY) {
  console.error('错误: 缺少API密钥。请在.env文件中设置STABILITY_API_KEY');
  process.exit(1);
}

// 检查命令行参数
if (process.argv.length < 4) {
  console.log('用法: node test-replace-background.js <图像文件路径> <背景描述提示词>');
  console.log('例如: node test-replace-background.js ../../uploads/test.jpg "cinematic lighting, studio background"');
  process.exit(1);
}

const imagePath = process.argv[2];
const backgroundPrompt = process.argv[3];
const outputFormat = process.argv[4] || 'png';

if (!fs.existsSync(imagePath)) {
  console.error(`错误: 文件不存在: ${imagePath}`);
  process.exit(1);
}

// 简化版 API 调用测试
async function testReplaceBackground() {
  try {
    console.log('开始测试背景替换和重新打光API...');
    console.log(`图像文件: ${imagePath}`);
    console.log(`背景描述: ${backgroundPrompt}`);
    console.log(`输出格式: ${outputFormat}`);
    
    // 创建FormData
    const formData = new FormData();
    formData.append('subject_image', fs.createReadStream(imagePath));
    formData.append('background_prompt', backgroundPrompt);
    formData.append('output_format', outputFormat);
    
    // 发送API请求
    console.log('正在发送API请求...');
    
    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${STABILITY_API_KEY}`,
          'Accept': 'application/json',
          ...formData.getHeaders()
        }
      }
    );
    
    console.log('API响应:', JSON.stringify(response.data, null, 2));
    
    // 获取任务ID
    const { id } = response.data;
    console.log('背景替换请求已提交，任务ID:', id);
    
    if (!id) {
      throw new Error('API响应中没有找到任务ID');
    }
    
    // 提供手动检查的说明
    console.log('\n要检查任务状态，请运行:');
    console.log(`node scripts/check-task-status.js ${id}`);
    
    // 保存任务ID到文件便于后续检查
    fs.writeFileSync('./last_task_id.txt', id);
    console.log('任务ID已保存到 last_task_id.txt 文件');
    
  } catch (error) {
    console.error('测试过程中出错:', error.message);
    if (error.response) {
      console.error('API响应错误:', {
        status: error.response.status,
        data: error.response.data
      });
    }
  }
}

// 运行测试
testReplaceBackground(); 