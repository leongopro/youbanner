#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// 使用固定的API密钥
const STABILITY_API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN';

async function testReplaceBackground() {
  try {
    console.log('开始测试背景替换API...');
    
    // 检查图像文件是否存在
    const testImagePath = path.resolve(__dirname, '..', '..', 'uploads', '123.png');
    console.log(`检查图像文件: ${testImagePath}`);
    
    if (!fs.existsSync(testImagePath)) {
      console.log(`错误: 测试图像不存在: ${testImagePath}`);
      return false;
    } else {
      console.log(`✅ 测试图像已找到: ${testImagePath}`);
      const stats = fs.statSync(testImagePath);
      console.log(`文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    }
    
    // 创建FormData
    console.log('准备API请求数据...');
    const formData = new FormData();
    formData.append('subject_image', fs.createReadStream(testImagePath));
    formData.append('background_prompt', 'modern studio lighting, professional portrait, white background');
    formData.append('output_format', 'png');
    
    // 发送请求
    console.log('发送API请求...');
    console.log('请求端点: https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight');
    console.log('背景提示词: modern studio lighting, professional portrait, white background');
    
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
    
    console.log('✅ API请求成功!');
    console.log('响应状态码:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
    // 检查任务ID
    if (response.data && response.data.id) {
      const taskId = response.data.id;
      console.log(`任务ID: ${taskId}`);
      
      // 保存任务ID到文件
      fs.writeFileSync(path.join(__dirname, 'last_task_id.txt'), taskId);
      console.log('任务ID已保存到 scripts/last_task_id.txt');
      
      // 尝试立即检查状态
      await checkTaskStatus(taskId);
    }
    
    return true;
  } catch (error) {
    console.log('❌ 背景替换API请求失败!');
    console.log('错误详情:');
    if (error.response) {
      console.log(`状态码: ${error.response.status}`);
      console.log('错误信息:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('错误:', error.message);
    }
    return false;
  }
}

// 检查任务状态
async function checkTaskStatus(taskId) {
  console.log(`\n立即检查任务状态: ${taskId}`);
  
  // 定义要测试的端点
  const endpoints = [
    `https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight/result/${taskId}`,
    `https://api.stability.ai/v2beta/stable-image/result/${taskId}`,
    `https://api.stability.ai/v2beta/generation/status/${taskId}`,
    `https://api.stability.ai/v2beta/generation/image-to-image/result/${taskId}`
  ];
  
  // 尝试所有端点
  for (const endpoint of endpoints) {
    try {
      console.log(`\n尝试端点: ${endpoint}`);
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${STABILITY_API_KEY}`,
          'Accept': 'application/json'
        },
        validateStatus: function(status) {
          return status < 500; // 允许所有非服务器错误的状态码
        }
      });
      
      console.log(`状态码: ${response.status}`);
      
      if (response.status === 200) {
        console.log('✅ 任务已完成!');
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
        
        // 如果有图像URL，尝试下载
        if (response.data.image_url) {
          console.log(`图像URL: ${response.data.image_url}`);
          await downloadResultImage(response.data.image_url, taskId);
        }
        
        // 如果有base64数据，保存为图像
        if (response.data.artifacts && response.data.artifacts.length > 0 && response.data.artifacts[0].base64) {
          await saveBase64Image(response.data.artifacts[0].base64, taskId);
        }
        
        return;
      } else if (response.status === 202) {
        console.log('ℹ️ 任务仍在处理中...');
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
        return;
      } else {
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
      }
    } catch (error) {
      console.log(`尝试端点 ${endpoint} 失败:`);
      if (error.response) {
        console.log(`状态码: ${error.response.status}`);
        console.log('错误信息:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('错误:', error.message);
      }
    }
  }
  
  console.log('\n所有端点检查完毕。如果任务仍在处理中，请稍后再次检查。');
}

// 下载结果图像
async function downloadResultImage(imageUrl, taskId) {
  try {
    console.log(`正在下载结果图像...`);
    
    // 创建输出目录
    const outputDir = path.resolve(__dirname, '..', '..', 'uploads', 'results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 下载图像
    const outputPath = path.join(outputDir, `result_${taskId}.png`);
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(outputPath, Buffer.from(response.data));
    
    console.log(`✅ 结果图像已保存到: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.log('❌ 下载结果图像失败!');
    console.log('错误:', error.message);
  }
}

// 保存base64图像
async function saveBase64Image(base64Data, taskId) {
  try {
    console.log(`正在保存base64图像数据...`);
    
    // 创建输出目录
    const outputDir = path.resolve(__dirname, '..', '..', 'uploads', 'results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 保存图像
    const outputPath = path.join(outputDir, `result_${taskId}.png`);
    fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
    
    console.log(`✅ 结果图像已保存到: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.log('❌ 保存base64图像失败!');
    console.log('错误:', error.message);
  }
}

// 主函数
async function main() {
  console.log('==================================================');
  console.log('         Stability AI API 背景替换测试');
  console.log('==================================================');
  console.log(`API密钥: ${STABILITY_API_KEY.substring(0, 4)}...${STABILITY_API_KEY.slice(-4)}`);
  
  // 测试背景替换API
  await testReplaceBackground();
  
  console.log('\n测试完成!');
}

// 运行主函数
main().catch(error => {
  console.error('运行测试时出错:', error);
}); 