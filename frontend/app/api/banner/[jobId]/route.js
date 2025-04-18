import { NextResponse } from 'next/server';
import axios from 'axios';

// 检查Banner生成状态的API路由
export async function GET(request, { params }) {
  try {
    const { jobId } = params;
    
    if (!jobId) {
      return NextResponse.json(
        { error: '缺少jobId参数' },
        { status: 400 }
      );
    }
    
    console.log(`正在检查Banner状态，JobID: ${jobId}`);
    
    // 从后端获取状态 - 使用正确的端口5000
    const response = await axios.get(`http://localhost:5000/api/banner/${jobId}`);
    
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('API状态检查错误:', error);
    return NextResponse.json(
      { error: '检查状态时出错', details: error.message },
      { status: 500 }
    );
  }
} 