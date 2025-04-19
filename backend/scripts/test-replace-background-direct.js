const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
if (!STABILITY_API_KEY) {
  console.error('错误: 缺少API密钥。请在.env文件中设置STABILITY_API_KEY');
  process.exit(1);
}

console.log(`使用API密钥: ${STABILITY_API_KEY.substring(0, 4)}...${STABILITY_API_KEY.substring(STABILITY_API_KEY.length - 4)}`);

// 图像路径 - 直接在脚本中指定
const imagePath = '../uploads/avatar_removed_bg_1303627e-698a-49bf-82cf-85037cd2ff7c.png';
const backgroundPrompt = "modern studio lighting";
const outputFormat = "png";

if (!fs.existsSync(imagePath)) {
  console.error(`错误: 文件不存在: ${imagePath}`);
  process.exit(1);
}

// 定义要测试的方法
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
    
    // 打印请求信息
    console.log('请求信息:');
    console.log('- 端点: https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight');
    console.log('- 方法: POST');
    console.log('- 头部: Authorization, Content-Type (由FormData自动设置)');
    console.log('- 数据: subject_image (文件), background_prompt, output_format');
    
    // 发送API请求
    console.log('\n正在发送API请求...');
    
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
    
    console.log(`\n✅ 请求成功! 状态码: ${response.status}`);
    console.log('响应数据:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // 获取任务ID
    const { id } = response.data;
    if (!id) {
      throw new Error('API响应中没有找到任务ID');
    }
    
    console.log(`\n背景替换请求已提交，任务ID: ${id}`);
    console.log('请手动检查任务状态。后续测试会自动尝试获取结果。');
    
    // 保存任务ID到文件便于后续检查
    fs.writeFileSync('./last_task_id.txt', id);
    console.log('任务ID已保存到 last_task_id.txt 文件');
    
    // 等待10秒后开始检查状态
    console.log('\n等待10秒后开始检查任务状态...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 检查任务状态
    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 20;
    
    // 尝试的端点列表
    const endpoints = [
      `https://api.stability.ai/v2beta/generation/status/${id}`,
      `https://api.stability.ai/v2beta/generation/image-to-image/result/${id}`
    ];
    
    while (!isCompleted && attempts < maxAttempts) {
      attempts++;
      console.log(`\n检查任务状态 (尝试 ${attempts}/${maxAttempts})...`);
      
      // 尝试多个端点
      let statusFound = false;
      
      for (const endpoint of endpoints) {
        try {
          console.log(`尝试端点: ${endpoint}`);
          
          const statusResponse = await axios.get(endpoint, {
            headers: {
              'Authorization': `Bearer ${STABILITY_API_KEY}`,
              'Accept': 'application/json'
            },
            validateStatus: function (status) {
              return status < 500; // 接受非服务器错误的状态码
            }
          });
          
          console.log(`状态码: ${statusResponse.status}`);
          
          if (statusResponse.status === 200) {
            isCompleted = true;
            statusFound = true;
            console.log('任务已完成!');
            console.log('响应数据:');
            console.log(JSON.stringify(statusResponse.data, null, 2));
            
            // 检查是否有图像URL
            if (statusResponse.data.image_url) {
              console.log('\n找到图像URL!');
              console.log('图像URL:', statusResponse.data.image_url);
              
              // 下载图像
              const imageResponse = await axios.get(statusResponse.data.image_url, {
                responseType: 'arraybuffer'
              });
              
              // 保存图像
              const outputPath = `./bg_result_${id}.${outputFormat}`;
              fs.writeFileSync(outputPath, Buffer.from(imageResponse.data));
              console.log(`图像已保存到: ${outputPath}`);
            }
            
            break; // 找到结果，退出循环
          } else if (statusResponse.status === 202) {
            console.log('任务仍在处理中...');
            console.log('响应数据:');
            console.log(JSON.stringify(statusResponse.data, null, 2));
            statusFound = true;
            break; // 找到状态，退出循环
          } else {
            console.log('响应数据:');
            console.log(JSON.stringify(statusResponse.data, null, 2));
          }
        } catch (error) {
          console.log(`端点请求出错: ${error.message}`);
          if (error.response) {
            console.log(`状态码: ${error.response.status}`);
            try {
              console.log('响应数据:', JSON.stringify(error.response.data, null, 2));
            } catch (e) {
              console.log('响应数据无法解析为JSON');
            }
          }
        }
      }
      
      if (!statusFound) {
        console.log('所有端点都返回了错误，继续尝试...');
      }
      
      if (!isCompleted) {
        console.log('等待10秒后重试...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    if (!isCompleted) {
      console.log('\n⚠️ 达到最大尝试次数，任务仍未完成');
      console.log('请稍后手动运行检查脚本:');
      console.log(`node scripts/check-stability-status.js ${id}`);
    } else {
      console.log('\n✅ 测试完成！');
    }
  } catch (error) {
    console.error('\n❌ 测试过程中出错:', error.message);
    if (error.response) {
      console.error('API响应错误:');
      console.error(`状态码: ${error.response.status}`);
      try {
        console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
      } catch (e) {
        console.error('响应数据无法解析为JSON');
      }
    }
  }
}

// 运行测试
testReplaceBackground(); 