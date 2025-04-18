import { NextResponse } from 'next/server';

// 简单的测试API端点
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: '前端API路由工作正常',
    timestamp: new Date().toISOString()
  });
}

// 添加HEAD方法用于简单网络连接检查
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
} 