const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const STABILITY_API_KEY = process.env.STABILITY_API_KEY || process.env.STABLE_DIFFUSION_API_KEY;

console.log('API密钥检查:');
if (!STABILITY_API_KEY) {
  console.log('❌ 未找到API密钥！请在.env文件中设置STABILITY_API_KEY或STABLE_DIFFUSION_API_KEY');
} else {
  // 只显示密钥的前4个和后4个字符，中间用星号替代
  const maskedKey = STABILITY_API_KEY.substring(0, 4) + 
                   '*'.repeat(STABILITY_API_KEY.length - 8) + 
                   STABILITY_API_KEY.substring(STABILITY_API_KEY.length - 4);
  console.log(`✅ 找到API密钥: ${maskedKey}`);
  console.log(`✅ 密钥长度: ${STABILITY_API_KEY.length}个字符`);
  
  // 检查密钥格式
  if (STABILITY_API_KEY.startsWith('sk-')) {
    console.log('✅ 密钥格式正确（以"sk-"开头）');
  } else {
    console.log('⚠️ 密钥格式可能不正确（应以"sk-"开头）');
  }
}

// 检查API请求是否可行
const axios = require('axios');

async function checkApiKeyValidity() {
  try {
    console.log('\n正在检查API密钥有效性...');
    const response = await axios.get('https://api.stability.ai/v1/user/account', {
      headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ API密钥有效！');
    console.log('账户信息:');
    console.log(`- 邮箱: ${response.data.email}`);
    console.log(`- ID: ${response.data.id}`);
    
    // 检查余额
    if (response.data.credits !== undefined) {
      console.log(`- 额度: ${response.data.credits}`);
    }
    
    return true;
  } catch (error) {
    console.log('❌ API密钥无效或请求失败!');
    if (error.response) {
      console.log(`状态码: ${error.response.status}`);
      console.log('错误信息:', error.response.data);
    } else {
      console.log('错误:', error.message);
    }
    return false;
  }
}

// 运行检查
checkApiKeyValidity(); 