/**
 * 安全地获取Stability API密钥的API路由
 * 这样可以避免在前端代码中暴露API密钥
 */

import { NextResponse } from 'next/server';

// 默认密钥，如果环境变量未设置
const DEFAULT_API_KEY = 'sk-5eV9DDMJPgl1CMwjvz6MBpkMFrDDnCwbFHsgL8s4k7eILVMN';

/**
 * GET - 获取Stability API密钥
 */
export async function GET(request) {
  try {
    // 从环境变量中获取API密钥，如果未设置则使用默认值
    const apiKey = process.env.STABILITY_API_KEY || DEFAULT_API_KEY;
    
    if (!apiKey) {
      console.error('未找到Stability API密钥');
      return NextResponse.json(
        { error: '未找到API密钥' },
        { status: 500 }
      );
    }
    
    // 返回API密钥
    return NextResponse.json({ key: apiKey });
  } catch (error) {
    console.error('获取API密钥时出错:', error);
    return NextResponse.json(
      { error: '服务器错误，无法获取API密钥' },
      { status: 500 }
    );
  }
}

/**
 * 其他HTTP方法返回405 Method Not Allowed
 */
export async function POST() {
  return NextResponse.json(
    { error: '方法不允许' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: '方法不允许' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: '方法不允许' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: '方法不允许' },
    { status: 405 }
  );
} 