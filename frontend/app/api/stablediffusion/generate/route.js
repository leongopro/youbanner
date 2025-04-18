import { NextResponse } from 'next/server';
import axios from 'axios';

// 生成图像的API路由
export async function POST(request) {
  try {
    const data = await request.json();
    console.log('收到生成请求:', {
      prompt: data.prompt?.substring(0, 50) + '...',
      dimensions: `${data.width}x${data.height}`,
      steps: data.steps,
      guidanceScale: data.guidanceScale
    });
    
    // 转发请求到后端
    console.log('发送请求到后端API: http://localhost:5000/api/stablediffusion/generate');
    const response = await axios.post('http://localhost:5000/api/stablediffusion/generate', data);
    
    console.log('后端响应:', response.data);
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('API路由错误:', error);
    // 更详细的错误信息
    const errorDetail = {
      message: error.message,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response'
    };
    
    return NextResponse.json(
      { 
        error: '生成图像时出错', 
        details: error.message,
        errorInfo: errorDetail
      },
      { status: 500 }
    );
  }
} 