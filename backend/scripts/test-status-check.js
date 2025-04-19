#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

// 使用固定的API密钥
const STABILITY_API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN';

// 获取任务ID
let taskId = process.argv[2];

if (!taskId) {
  // 尝试从文件读取
  if (fs.existsSync(__dirname + '/last_task_id.txt')) {
    taskId = fs.readFileSync(__dirname + '/last_task_id.txt', 'utf8').trim();
    console.log(`使用保存的任务ID: ${taskId}`);
  } else {
    console.log('错误: 缺少任务ID');
    console.log('用法: node test-status-check.js <任务ID>');
    process.exit(1);
  }
}

// 定义要测试的端点
const endpoints = [
  `https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight/result/${taskId}`,
  `https://api.stability.ai/v2beta/stable-image/result/${taskId}`,
  `https://api.stability.ai/v2beta/generation/status/${taskId}`,
  `https://api.stability.ai/v2beta/generation/image-to-image/result/${taskId}`
];

// 尝试所有端点
async function checkStatus() {
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
        console.log('错误信息:', error.response.data);
      } else {
        console.log('错误:', error.message);
      }
    }
  }
  
  console.log('\n所有端点检查完毕。如果任务仍在处理中，请稍后再次运行此脚本检查状态。');
}

// 执行检查
checkStatus();
