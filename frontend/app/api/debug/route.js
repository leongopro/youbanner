import { NextResponse } from 'next/server';

// API调试端点
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'API调试端点工作正常',
    timestamp: new Date().toISOString(),
    environment: {
      node_env: process.env.NODE_ENV,
      api_url: process.env.NEXT_PUBLIC_API_URL
    }
  });
}

export async function POST(request) {
  try {
    // 尝试解析请求内容
    let reqBody = 'No body';
    try {
      if (request.body) {
        const clone = request.clone();
        const text = await clone.text();
        if (text) reqBody = text.substring(0, 200) + (text.length > 200 ? '...' : '');
      }
    } catch (err) {
      reqBody = `Error parsing body: ${err.message}`;
    }

    // 返回请求信息
    return NextResponse.json({
      status: 'ok',
      message: 'POST请求已收到',
      timestamp: new Date().toISOString(),
      requestInfo: {
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        body: reqBody
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: '处理请求时出错',
      message: error.message
    }, { status: 500 });
  }
} 