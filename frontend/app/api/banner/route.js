import { NextResponse } from 'next/server';
import axios from 'axios';

// 生成Banner的API路由
export async function POST(request) {
  try {
    const data = await request.json();
    
    // 转发请求到后端
    const response = await axios.post('http://localhost:5000/api/banner', data);
    
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('API路由错误:', error);
    return NextResponse.json(
      { error: '生成Banner时出错', details: error.message },
      { status: 500 }
    );
  }
} 