import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 处理POST请求，将base64图像数据保存为文件
export async function POST(request: Request) {
  try {
    // 解析请求体
    const { base64Data, filename } = await request.json();
    
    if (!base64Data) {
      return NextResponse.json(
        { error: "未提供base64图像数据" },
        { status: 400 }
      );
    }
    
    // 从base64数据创建Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // 确保uploads目录存在
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // 生成文件名
    const finalFilename = filename || `image_${Date.now()}.png`;
    const filePath = path.join(uploadsDir, finalFilename);
    
    // 写入文件
    fs.writeFileSync(filePath, imageBuffer);
    
    console.log(`图像已保存到: ${filePath}`);
    
    // 返回文件URL
    return NextResponse.json({
      imageUrl: `/uploads/${finalFilename}`
    });
  } catch (error) {
    console.error('保存base64图像错误:', error);
    return NextResponse.json(
      { error: "保存图像失败" },
      { status: 500 }
    );
  }
} 