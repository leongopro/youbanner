// 导入所需模块
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// 获取API密钥
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
if (!STABILITY_API_KEY) {
  console.error('错误: 缺少API密钥。请在.env文件中设置STABILITY_API_KEY');
  process.exit(1);
}

console.log(`使用API密钥: ${STABILITY_API_KEY.substring(0, 4)}...${STABILITY_API_KEY.substring(STABILITY_API_KEY.length - 4)}`);

// 直接按照示例代码格式
async function testAPI() {
  try {
    const imagePath = '../../uploads/avatar_removed_bg_1303627e-698a-49bf-82cf-85037cd2ff7c.png';
    
    // 检查文件是否存在
    if (!fs.existsSync(imagePath)) {
      console.error(`错误: 文件不存在: ${imagePath}`);
      process.exit(1);
    }
    
    // 创建FormData
    const formData = new FormData();
    formData.append('subject_image', fs.createReadStream(imagePath));
    formData.append('background_prompt', "cinematic lighting");
    formData.append('output_format', "webp");
    
    console.log('正在发送API请求...');
    
    const response = await axios.post(
      `https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight`,
      formData,
      {
        validateStatus: undefined,
        headers: { 
          Authorization: `Bearer ${STABILITY_API_KEY}`,
          Accept: 'application/json',
          ...formData.getHeaders()
        },
      },
    );
    
    console.log("状态码:", response.status);
    console.log("响应数据:", JSON.stringify(response.data, null, 2));
    console.log("Generation ID:", response.data.id);
    
    if (response.data.id) {
      fs.writeFileSync('./last_task_id.txt', response.data.id);
      console.log('任务ID已保存到 last_task_id.txt 文件');
    }
    
  } catch (error) {
    console.error('请求出错:', error.message);
    if (error.response) {
      console.error('API响应错误:');
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 执行测试
testAPI(); 