import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request) {
  try {
    const data = await request.json();
    
    // 转发请求到后端
    const response = await axios.post(
      'http://localhost:5000/api/stablediffusion/img2img',
      data,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('img2img API错误:', error);
    
    // 如果是后端返回的错误，保持相同的状态码
    if (error.response) {
      return NextResponse.json(
        { error: error.response.data.message || '处理请求时出错' },
        { status: error.response.status }
      );
    }
    
    // 其他错误统一返回500
    return NextResponse.json(
      { error: '服务器内部错误', details: error.message },
      { status: 500 }
    );
  }
} 