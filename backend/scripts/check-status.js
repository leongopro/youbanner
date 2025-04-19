#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 使用固定的API密钥
const STABILITY_API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN';

// 获取任务ID
let taskId = process.argv[2];

if (!taskId) {
  // 尝试从文件读取
  const lastTaskIdPath = path.join(__dirname, 'last_task_id.txt');
  if (fs.existsSync(lastTaskIdPath)) {
    taskId = fs.readFileSync(lastTaskIdPath, 'utf8').trim();
    console.log(`使用保存的任务ID: ${taskId}`);
  } else {
    console.log('错误: 缺少任务ID');
    console.log('用法: node check-status.js <任务ID>');
    process.exit(1);
  }
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

// 检查任务状态
async function checkTaskStatus(taskId) {
  console.log(`\n检查任务状态: ${taskId}`);
  
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
  
  console.log('\n所有端点检查完毕。如果任务仍在处理中，请稍后再次运行此脚本检查状态。');
}

// 运行检查
checkTaskStatus(taskId).catch(error => {
  console.error('检查任务状态时出错:', error);
}); 