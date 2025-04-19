#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 设置环境变量
process.env.STABILITY_API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN';

// 然后导入服务
const stabilityService = require('../services/stability.service');

async function main() {
  try {
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
        console.log('用法: node check-with-service.js <任务ID>');
        process.exit(1);
      }
    }
    
    console.log(`使用stabilityService检查任务状态: ${taskId}`);
    
    // 使用服务检查任务状态
    const statusResult = await stabilityService.checkReplaceBackgroundStatus(taskId);
    
    console.log('任务状态:', statusResult.status);
    
    if (statusResult.status === 'completed') {
      console.log('✅ 任务已完成!');
      
      // 如果有图像缓冲区，保存结果
      if (statusResult.imageBuffer) {
        console.log('已获取图像数据，正在保存...');
        
        // 创建一个假任务对象用于保存结果
        const task = {
          id: taskId,
          saveToFile: true,
          outputPath: `../uploads/results/result_${taskId}.png`,
          outputFormat: 'png'
        };
        
        const filePath = await stabilityService.saveBgReplaceResult(task, statusResult.imageBuffer);
        console.log(`结果已保存到: ${filePath}`);
      }
      
      // 如果有图像URL，显示URL
      if (statusResult.imageUrl) {
        console.log(`图像URL: ${statusResult.imageUrl}`);
      }
    } else if (statusResult.status === 'processing') {
      console.log('ℹ️ 任务仍在处理中...');
    } else if (statusResult.status === 'error') {
      console.log('❌ 任务处理出错:', statusResult.error);
    }
  } catch (error) {
    console.error('检查任务状态时出错:', error);
  }
}

main(); 