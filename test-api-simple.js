#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// 使用固定的API密钥
const STABILITY_API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN';
const IMAGE_PATH = path.resolve(__dirname, '..', '..', 'uploads', '123.png');

async function testApi() {
  console.log('开始测试 Stability AI API...');
  console.log(`使用图片: ${IMAGE_PATH}`);
  console.log(`API密钥: ${STABILITY_API_KEY.substring(0, 4)}...${STABILITY_API_KEY.slice(-4)}`);
  
  // 检查图片是否存在
  if (!fs.existsSync(IMAGE_PATH)) {
    console.log(`错误: 图片不存在: ${IMAGE_PATH}`);
    return;
  }
  
  const stats = fs.statSync(IMAGE_PATH);
  console.log(`图片大小: ${(stats.size / 1024).toFixed(2)} KB`);
  
  // 创建FormData
  const formData = new FormData();
  formData.append('subject_image', fs.createReadStream(IMAGE_PATH));
  formData.append('background_prompt', 'modern studio lighting, professional portrait, white background');
  formData.append('output_format', 'png');
  
  try {
    // 直接使用 API V1
    console.log('尝试使用用户账户API验证密钥...');
    const accountResponse = await axios.get('https://api.stability.ai/v1/user/account', {
      headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('用户账户API响应:', accountResponse.status);
    console.log('账户信息:', accountResponse.data);
    
    // 尝试V1 Engines
    console.log('\n尝试获取可用引擎列表...');
    const enginesResponse = await axios.get('https://api.stability.ai/v1/engines/list', {
      headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('引擎列表API响应:', enginesResponse.status);
    console.log('可用引擎:', enginesResponse.data);
    
    // 发送替换背景请求
    console.log('\n发送背景替换请求...');
    console.log('端点: https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight');
    
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
    
    console.log('背景替换API响应:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.id) {
      const taskId = response.data.id;
      console.log(`\n任务ID: ${taskId}`);
      
      // 保存任务ID到文件
      fs.writeFileSync(path.join(__dirname, 'last_task_id.txt'), taskId);
      console.log('任务ID已保存到文件');
    }
  } catch (error) {
    console.log('API请求失败:');
    if (error.response) {
      console.log(`状态码: ${error.response.status}`);
      console.log('错误信息:', error.response.data);
    } else {
      console.log('错误:', error.message);
    }
  }
}

// 运行测试
testApi().catch(error => {
  console.error('运行测试时出错:', error);
}); 