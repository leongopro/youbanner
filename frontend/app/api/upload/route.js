import { NextResponse } from 'next/server';
import axios from 'axios';
import { Readable } from 'stream';
import FormData from 'form-data';

export async function POST(request) {
  try {
    console.log('开始处理文件上传请求');
    // 获取二进制上传数据
    const formData = await request.formData().catch(error => {
      console.error('解析表单数据失败:', error);
      throw new Error('解析上传文件失败: ' + error.message);
    });
    
    const file = formData.get('image');
    
    if (!file) {
      console.error('未接收到文件');
      return NextResponse.json(
        { error: '未接收到文件' },
        { status: 400 }
      );
    }
    
    console.log(`接收到文件: ${file.name}, 大小: ${Math.round(file.size / 1024)}KB, 类型: ${file.type}`);
    
    try {
      // 将File对象转换为Buffer
      const buffer = Buffer.from(await file.arrayBuffer());
      console.log(`文件已转换为Buffer, 大小: ${buffer.length} 字节`);
      
      // 创建FormData来发送给后端
      const backendFormData = new FormData();
      
      // 添加文件数据，创建一个readable stream
      const fileStream = new Readable();
      fileStream.push(buffer);
      fileStream.push(null);
      
      backendFormData.append('image', fileStream, {
        filename: file.name,
        contentType: file.type,
        knownLength: buffer.length
      });
      
      console.log('准备发送文件到后端');
      
      // 设置超时时间和取消控制器
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        console.error('上传请求超时');
      }, 30000); // 30秒超时
      
      // 发送到后端API
      const response = await axios.post(
        'http://localhost:5000/api/upload',
        backendFormData,
        {
          headers: {
            ...backendFormData.getHeaders(),
          },
          signal: controller.signal,
          timeout: 30000, // 30秒超时
          maxContentLength: 20 * 1024 * 1024, // 设置最大内容长度 20MB
          maxBodyLength: 20 * 1024 * 1024 // 设置最大请求体长度 20MB
        }
      );
      
      clearTimeout(timeout);
      
      console.log('文件上传成功, 后端响应:', response.data);
      // 返回后端的响应
      return NextResponse.json(response.data);
    } catch (processingError) {
      console.error('处理文件时出错:', processingError);
      throw new Error('处理文件时出错: ' + processingError.message);
    }
  } catch (error) {
    console.error('文件上传错误:', error);
    
    // 提供更详细的错误信息
    let errorMsg = '文件上传失败';
    let errorDetails = error.message || '未知错误';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMsg = '无法连接到后端服务';
      errorDetails = '请确保后端服务正在运行';
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMsg = '上传请求超时';
      errorDetails = '文件可能太大或网络连接不稳定';
    } else if (error.response) {
      statusCode = error.response.status;
      errorMsg = `后端返回错误 (${error.response.status})`;
      errorDetails = error.response.data?.message || error.message;
    }
    
    return NextResponse.json(
      { 
        error: errorMsg, 
        details: errorDetails,
        code: error.code,
        name: error.name
      },
      { status: statusCode }
    );
  }
} 