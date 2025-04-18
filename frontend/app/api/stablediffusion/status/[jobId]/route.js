import { NextResponse } from 'next/server';
import axios from 'axios';

// 检查生成状态的API路由
export async function GET(request, { params }) {
  try {
    const { jobId } = params;
    
    if (!jobId) {
      console.error('API路由错误: 缺少jobId参数');
      return NextResponse.json(
        { error: '缺少jobId参数' },
        { status: 400 }
      );
    }
    
    console.log(`正在检查生成状态，JobID: ${jobId}`);
    
    // 从后端获取状态
    const backendUrl = `http://localhost:5000/api/stablediffusion/status/${jobId}`;
    const response = await axios.get(backendUrl);
    
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('API状态检查错误:', error);
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
        error: '检查状态时出错', 
        details: error.message,
        errorInfo: errorDetail
      },
      { status: 500 }
    );
  }
} 