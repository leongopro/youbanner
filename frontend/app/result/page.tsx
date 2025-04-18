"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function ResultPage() {
  const searchParams = useSearchParams() || new URLSearchParams();
  const jobId = searchParams.get('jobId');
  const type = searchParams.get('type') || 'banner'; // 'banner' 或 'background'
  
  const [status, setStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 添加isMounted标志来防止在卸载后更新状态
  const isMounted = useRef(true);

  useEffect(() => {
    // 组件卸载时设置标志
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!jobId) {
      setError("未找到任务ID");
      return;
    }

    const checkStatus = async () => {
      try {
        console.log('检查状态:', jobId, type);
        let response;
        
        if (type === 'background') {
          response = await fetch(`/api/stablediffusion/status/${jobId}`);
        } else {
          response = await fetch(`/api/banner/${jobId}`);
        }

        // 检查组件是否仍然挂载
        if (!isMounted.current) return;

        // 检查响应状态
        if (!response.ok) {
          const errorText = await response.text();
          console.error('状态检查失败:', response.status, errorText);
          throw new Error(`状态检查失败: ${response.status} ${errorText}`);
        }

        // 尝试解析JSON
        let data;
        try {
          data = await response.json();
        } catch (parseError: any) {
          console.error('JSON解析错误:', parseError);
          throw new Error(`无法解析响应数据: ${parseError.message}`);
        }

        // 再次检查组件是否仍然挂载
        if (!isMounted.current) return;

        console.log('获取到的状态:', data);

        if (data) {
          if (data.status === 'completed') {
            setStatus('completed');
            if (data.result) {
              setImageUrl(data.result.imageUrl);
            } else {
              setImageUrl(data.imageUrl);
            }
          } else if (data.status === 'failed') {
            console.log('生成失败:', data.error);
            setStatus('failed');
            setError(data.error || '生成失败');
          } else {
            // 继续等待完成
            console.log(`任务仍在处理中 (${data.status})，2秒后重新检查...`);
            const timeoutId = setTimeout(checkStatus, 2000);
            
            // 清理函数，如果组件卸载则清除定时器
            return () => clearTimeout(timeoutId);
          }
        } else {
          throw new Error('响应数据为空');
        }
      } catch (err: any) {
        // 检查组件是否仍然挂载
        if (!isMounted.current) return;
        
        console.error('获取状态错误:', err);
        setStatus('failed');
        setError(`获取状态失败: ${err.message}`);
      }
    };

    // 添加超时处理，避免无限等待
    let checkCount = 0;
    const MAX_CHECKS = 60; // 最多检查60次，约2分钟

    const checkWithTimeout = async () => {
      checkCount++;
      if (checkCount > MAX_CHECKS) {
        // 检查组件是否仍然挂载
        if (!isMounted.current) return;
        
        console.log(`已检查${MAX_CHECKS}次，超时设置为失败状态`);
        setStatus('failed');
        setError('生成超时，请稍后重试');
        return;
      }
      
      await checkStatus();
    };

    checkWithTimeout();
    
    // 清理函数
    return () => {
      isMounted.current = false;
    };
  }, [jobId, type]);

  const handleDownload = () => {
    if (!imageUrl) return;
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = type === 'background' 
      ? `ai-background-${Date.now()}.png` 
      : `youtube-banner-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTitle = () => {
    // 返回类型对应的标题
    return type === 'background' ? 'AI生成的背景图片' : 'YouTube Banner';
  };

  const getReturnLink = () => {
    // 返回类型对应的页面路径
    return type === 'background' ? '/background' : '/create';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">您的{getTitle()}</h1>

        <div className="bg-white rounded-lg shadow-md p-6">
          {status === 'pending' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg">正在生成，请稍候...</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center py-12">
              <div className="text-red-500 text-5xl mb-4">✗</div>
              <p className="text-lg text-red-600 mb-4">生成失败</p>
              <p className="mb-6">{error}</p>
              <Link href={getReturnLink()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md">
                重新尝试
              </Link>
            </div>
          )}

          {status === 'completed' && imageUrl && (
            <div>
              <div className="relative w-full aspect-[16/9] mb-6 border border-gray-200 rounded-md overflow-hidden">
                <Image 
                  src={imageUrl} 
                  alt={`生成的${getTitle()}`}
                  fill 
                  style={{objectFit: 'contain'}}
                  priority
                />
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">您的{getTitle()}已准备就绪!</h3>
                  <p className="text-sm text-gray-500">
                    {type === 'background' ? '可用作各种项目的背景' : '推荐尺寸: 2560 x 1440 像素'}
                  </p>
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={handleDownload}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载图片
                  </button>
                  
                  <Link href={getReturnLink()} className="border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-md">
                    重新生成
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 