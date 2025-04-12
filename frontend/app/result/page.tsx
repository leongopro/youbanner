"use client";

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!jobId) {
      setError("未找到任务ID");
      return;
    }

    const checkStatus = async () => {
      try {
        // 根据类型选择不同的API端点
        const endpoint = type === 'background' 
          ? `http://localhost:5000/api/stablediffusion/status/${jobId}`
          : `http://localhost:5000/api/banner/status/${jobId}`;
          
        const response = await fetch(endpoint);
        const data = await response.json();

        if (response.ok) {
          if (data.status === 'completed') {
            setStatus('completed');
            // 处理不同类型的响应格式
            if (type === 'background' && data.result) {
              setImageUrl(data.result.imageUrl);
            } else {
              setImageUrl(data.imageUrl);
            }
          } else if (data.status === 'failed') {
            setStatus('failed');
            setError(data.error || '生成失败');
          } else {
            // 继续等待完成
            setTimeout(checkStatus, 2000);
          }
        } else {
          setStatus('failed');
          setError(data.message || '获取状态失败');
        }
      } catch (err) {
        setStatus('failed');
        setError('请求失败，请稍后重试');
      }
    };

    checkStatus();
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
    return type === 'background' ? 'AI生成的背景图片' : 'YouTube Banner';
  };

  const getReturnLink = () => {
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