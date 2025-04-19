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
  console.log('用法: node check-task-status.js <任务ID>');
  console.log('例如: node check-task-status.js 12345678-1234-1234-1234-123456789012');
  process.exit(1);
}

async function checkTaskStatus(id) {
  try {
    console.log(`正在检查任务状态，ID: ${id}`);
    
    // 查询任务状态 - 注意：修改为正确的API端点
    const statusResponse = await axios.get(
      `https://api.stability.ai/v2beta/generation/image-to-image/result/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${STABILITY_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );
    
    // 检查状态
    if (statusResponse.status === 202) {
      console.log('🔄 任务仍在处理中... 请稍后再次检查。');
      return false;
    } else if (statusResponse.status === 200) {
      console.log('✅ 任务已完成！');
      
      // 检查结果
      const result = statusResponse.data;
      if (!result.image_url) {
        throw new Error('API响应中没有找到图像URL');
      }
      
      console.log('结果图像URL:', result.image_url);
      
      // 下载生成的图像
      console.log('正在下载结果图像...');
      const imageResponse = await axios.get(result.image_url, {
        responseType: 'arraybuffer'
      });
      
      // 保存图像到本地
      const outputFormat = 'webp'; // 使用请求时指定的格式
      const outputPath = `./bg_replaced_${id}.${outputFormat}`;
      fs.writeFileSync(outputPath, Buffer.from(imageResponse.data));
      console.log(`图像已保存到: ${outputPath}`);
      
      return true;
    } else {
      throw new Error(`API返回错误状态码: ${statusResponse.status}`);
    }
  } catch (error) {
    console.error('检查任务状态出错:', error.message);
    if (error.response) {
      console.error('API响应错误:', {
        status: error.response.status,
        data: JSON.stringify(error.response.data)
      });
    }
    return false;
  }
}

// 执行状态检查
async function run() {
  const result = await checkTaskStatus(taskId);
  if (!result) {
    console.log('\n可以稍后再次运行此脚本来检查任务状态:');
    console.log(`node check-task-status.js ${taskId}`);
  }
}

run(); 