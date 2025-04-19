const fs = require('fs');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const STABILITY_API_KEY = process.env.STABILITY_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;
if (!STABILITY_API_KEY) {
  console.error('错误: 缺少API密钥。请在.env文件中设置STABILITY_API_KEY');
  process.exit(1);
}

// 获取任务ID
let taskId;
if (process.argv.length > 2) {
  // 从命令行参数获取
  taskId = process.argv[2];
} else {
  // 尝试从文件读取
  try {
    if (fs.existsSync('./last_task_id.txt')) {
      taskId = fs.readFileSync('./last_task_id.txt', 'utf8').trim();
    }
  } catch (error) {
    console.error('无法读取任务ID文件:', error.message);
  }
}

if (!taskId) {
  console.log('用法: node check-stability-status.js <任务ID>');
  console.log('例如: node check-stability-status.js 12345678-1234-1234-1234-123456789012');
  process.exit(1);
}

// 定义多个可能的端点
const possibleEndpoints = [
  `https://api.stability.ai/v2beta/generation/status/${taskId}`,
  `https://api.stability.ai/v2beta/generation/image-to-image/result/${taskId}`,
  `https://api.stability.ai/v2beta/stable-image/result/${taskId}`,
  `https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight/result/${taskId}`
];

// 检查所有可能的端点
async function checkAllEndpoints() {
  console.log(`正在尝试多个端点检查任务状态，ID: ${taskId}\n`);
  
  for (const endpoint of possibleEndpoints) {
    try {
      console.log(`尝试端点: ${endpoint}`);
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${STABILITY_API_KEY}`,
          'Accept': 'application/json'
        },
        validateStatus: function (status) {
          return status < 500; // 接受任何非服务器错误的状态码
        }
      });
      
      console.log(`状态码: ${response.status}`);
      
      if (response.status === 200) {
        console.log('✅ 成功! 响应数据:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // 检查是否有图像URL
        if (response.data.image_url) {
          console.log('\n找到图像URL!');
          console.log('图像URL:', response.data.image_url);
          
          // 下载图像
          const imageResponse = await axios.get(response.data.image_url, {
            responseType: 'arraybuffer'
          });
          
          // 保存图像
          const outputPath = `./result_${taskId}.png`;
          fs.writeFileSync(outputPath, Buffer.from(imageResponse.data));
          console.log(`图像已保存到: ${outputPath}`);
        }
        
        return; // 成功找到有效端点，退出循环
      } else if (response.status === 202) {
        console.log('🔄 任务仍在处理中... 请稍后再次检查。');
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
        return; // 成功找到有效端点，退出循环
      } else {
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
      }
    } catch (error) {
      console.log(`❌ 错误: ${error.message}`);
      if (error.response) {
        console.log(`状态码: ${error.response.status}`);
        console.log('响应数据:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    console.log('---'); // 分隔线
  }
  
  console.log('\n所有端点尝试完毕，未找到有效结果。');
  console.log('建议稍后再次运行此脚本检查任务状态:');
  console.log(`node check-stability-status.js ${taskId}`);
}

// 执行检查
checkAllEndpoints(); 