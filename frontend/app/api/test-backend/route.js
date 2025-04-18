import { NextResponse } from 'next/server';
import axios from 'axios';

// 测试后端连接的API端点
export async function GET() {
  try {
    console.log('测试后端连接');
    
    // 测试健康检查端点
    const response = await axios.get('http://localhost:5000/health');
    
    // 测试后端环境变量
    const envResponse = {
      healthy: response.data,
      api_key_available: process.env.STABLE_DIFFUSION_API_KEY ? 'Yes' : 'No',
      api_key_length: process.env.STABLE_DIFFUSION_API_KEY ? process.env.STABLE_DIFFUSION_API_KEY.length : 0,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(envResponse);
  } catch (error) {
    console.error('测试后端连接错误:', error);
    
    return NextResponse.json({
      error: '连接后端失败',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 