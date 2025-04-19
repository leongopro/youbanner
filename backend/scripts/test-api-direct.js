#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// 使用固定的API密钥
const STABILITY_API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN';

// 测试函数
async function testApiKey() {
  try {
    console.log('测试API密钥有效性...');
    
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

// 测试替换背景API
async function testReplaceBackground() {
  try {
    console.log('\n开始测试背景替换API...');
    
    // 检查图像文件是否存在
    let testImagePath = path.join(__dirname, '..', '..', 'uploads', '123.png');
    if (!fs.existsSync(testImagePath)) {
      console.log(`警告: 测试图像不存在: ${testImagePath}`);
      console.log('将使用样例图像...');
      
      // 创建一个简单的测试图像
      const sampleImagePath = path.join(__dirname, '..', 'uploads', 'sample_image.jpg');
      if (!fs.existsSync(path.dirname(sampleImagePath))) {
        fs.mkdirSync(path.dirname(sampleImagePath), { recursive: true });
      }
      
      // 从网络下载样例图像
      console.log('正在下载样例图像...');
      const imageResponse = await axios.get(
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=250',
        { responseType: 'arraybuffer' }
      );
      fs.writeFileSync(sampleImagePath, Buffer.from(imageResponse.data));
      console.log(`样例图像已保存到: ${sampleImagePath}`);
      
      // 使用下载的图像
      testImagePath = sampleImagePath;
    }
    
    // 创建FormData
    console.log('准备API请求数据...');
    const formData = new FormData();
    formData.append('subject_image', fs.createReadStream(testImagePath));
    formData.append('background_prompt', 'modern studio lighting, professional portrait');
    formData.append('output_format', 'png');
    
    // 发送请求
    console.log('发送API请求...');
    console.log('请求端点: https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight');
    console.log('背景提示词: modern studio lighting, professional portrait');
    
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
      console.log(`\n任务ID: ${taskId}`);
      console.log('现在可以使用以下命令检查任务状态:');
      console.log(`node scripts/test-status-check.js ${taskId}`);
      
      // 保存任务ID到文件
      fs.writeFileSync(path.join(__dirname, 'last_task_id.txt'), taskId);
      console.log('任务ID已保存到 scripts/last_task_id.txt');
      
      // 尝试立即检查状态
      await checkTaskStatus(taskId);
    }
    
    return true;
  } catch (error) {
    console.log('❌ 背景替换API请求失败!');
    if (error.response) {
      console.log(`状态码: ${error.response.status}`);
      console.log('错误信息:', error.response.data);
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
  
  console.log('\n所有端点检查完毕。如果任务仍在处理中，请稍后再次检查。');
}

// 创建测试脚本
async function createStatusCheckScript() {
  const scriptPath = path.join(__dirname, 'test-status-check.js');
  const scriptContent = `#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

// 使用固定的API密钥
const STABILITY_API_KEY = '${STABILITY_API_KEY}';

// 获取任务ID
let taskId = process.argv[2];

if (!taskId) {
  // 尝试从文件读取
  if (fs.existsSync(__dirname + '/last_task_id.txt')) {
    taskId = fs.readFileSync(__dirname + '/last_task_id.txt', 'utf8').trim();
    console.log(\`使用保存的任务ID: \${taskId}\`);
  } else {
    console.log('错误: 缺少任务ID');
    console.log('用法: node test-status-check.js <任务ID>');
    process.exit(1);
  }
}

// 定义要测试的端点
const endpoints = [
  \`https://api.stability.ai/v2beta/stable-image/edit/replace-background-and-relight/result/\${taskId}\`,
  \`https://api.stability.ai/v2beta/stable-image/result/\${taskId}\`,
  \`https://api.stability.ai/v2beta/generation/status/\${taskId}\`,
  \`https://api.stability.ai/v2beta/generation/image-to-image/result/\${taskId}\`
];

// 尝试所有端点
async function checkStatus() {
  for (const endpoint of endpoints) {
    try {
      console.log(\`\\n尝试端点: \${endpoint}\`);
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': \`Bearer \${STABILITY_API_KEY}\`,
          'Accept': 'application/json'
        },
        validateStatus: function(status) {
          return status < 500; // 允许所有非服务器错误的状态码
        }
      });
      
      console.log(\`状态码: \${response.status}\`);
      
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
      console.log(\`尝试端点 \${endpoint} 失败:\`);
      if (error.response) {
        console.log(\`状态码: \${error.response.status}\`);
        console.log('错误信息:', error.response.data);
      } else {
        console.log('错误:', error.message);
      }
    }
  }
  
  console.log('\\n所有端点检查完毕。如果任务仍在处理中，请稍后再次运行此脚本检查状态。');
}

// 执行检查
checkStatus();
`;

  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755');
  console.log(`\n任务状态检查脚本已创建: ${scriptPath}`);
  console.log('您可以稍后运行此脚本检查任务状态');
}

// 主函数
async function main() {
  console.log('==================================================');
  console.log('         Stability AI API 直接测试工具');
  console.log('==================================================');
  console.log(`API密钥: ${STABILITY_API_KEY.substring(0, 4)}...${STABILITY_API_KEY.slice(-4)}`);
  
  // 测试API密钥
  const isKeyValid = await testApiKey();
  if (!isKeyValid) {
    console.log('API密钥无效，无法继续测试。');
    process.exit(1);
  }
  
  // 创建状态检查脚本
  await createStatusCheckScript();
  
  // 测试背景替换API
  await testReplaceBackground();
  
  console.log('\n测试完成!');
}

// 运行主函数
main().catch(error => {
  console.error('运行测试时出错:', error);
  process.exit(1);
}); 