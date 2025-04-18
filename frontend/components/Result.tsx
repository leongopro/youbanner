"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import api, { getFullImageUrl, BackgroundStatusResponse, BannerStatusResponse } from '@/lib/api';

interface ResultProps {
  jobId: string;
  type: 'banner' | 'background';
}

export default function Result({ jobId, type }: ResultProps) {
  const [status, setStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkCount, setCheckCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('正在连接服务器...');
  const MAX_CHECKS = 60; // 最多检查60次，大约2分钟

  useEffect(() => {
    if (!jobId) {
      setError("未找到任务ID");
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    // 设置超时
    const timeoutId = setTimeout(() => {
      if (!signal.aborted) {
        setStatus('failed');
        setError('请求超时，服务器响应时间过长');
        controller.abort();
      }
    }, 120000); // 2分钟超时

    const checkStatus = async () => {
      try {
        // 更新检查次数
        setCheckCount(prev => {
          const newCount = prev + 1;
          // 如果超过最大检查次数，抛出超时错误
          if (newCount > MAX_CHECKS) {
            throw new Error('生成超时，请稍后重试');
          }
          return newCount;
        });

        setStatusMessage(`正在检查生成状态 (${checkCount}/${MAX_CHECKS})...`);

        if (type === 'background') {
          // 获取背景生成状态
          const response = await api.checkBackgroundStatus(jobId);
          
          if (response.error) {
            throw new Error(response.error);
          }
          
          const data = response.data as BackgroundStatusResponse;
          
          console.log('API返回数据:', data);
  
          if (!data) {
            throw new Error('未收到有效的API响应');
          }
  
          // 背景图API返回的响应格式
          if (data.status === 'completed' && data.result) {
            setStatus('completed');
            setImageUrl(data.result.imageUrl);
          } else if (data.status === 'processing') {
            // 仍在处理中
            setStatus('pending');
            setStatusMessage(`正在生成图像 (${checkCount}/${MAX_CHECKS})...`);
            // 每2秒检查一次状态
            setTimeout(checkStatus, 2000);
          } else if (data.status === 'failed') {
            setStatus('failed');
            setError(data.error || '生成失败');
          } else {
            // 继续等待完成
            setStatusMessage(`等待服务器响应 (${checkCount}/${MAX_CHECKS})...`);
            setTimeout(checkStatus, 2000);
          }
        } else {
          // 获取Banner生成状态
          const response = await api.checkBannerStatus(jobId);
          
          if (response.error) {
            throw new Error(response.error);
          }
          
          const data = response.data as BannerStatusResponse;
          
          console.log('API返回数据:', data);
  
          if (!data) {
            throw new Error('未收到有效的API响应');
          }
  
          // Banner API返回的响应格式
          if (data.status === 'completed') {
            setStatus('completed');
            setImageUrl(data.imageUrl || '');
          } else if (data.status === 'failed') {
            setStatus('failed');
            setError(data.error || '生成失败');
          } else {
            // 仍在处理中
            setStatusMessage(`正在生成Banner (${checkCount}/${MAX_CHECKS})...`);
            setTimeout(checkStatus, 2000);
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        console.error('获取状态错误:', err);
        setStatus('failed');
        
        // 提供更详细的错误信息
        let errorMessage = '请求失败，请稍后重试';
        
        if (err instanceof Error) {
          errorMessage = err.message;
          
          // 检查常见错误类型
          if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
            errorMessage = '请求超时，服务器响应时间过长';
          } else if (errorMessage.includes('network') || errorMessage.includes('网络')) {
            errorMessage = '网络连接错误，请检查您的网络连接';
          } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
            errorMessage = '任务未找到，可能已被清理或不存在';
          } else if (errorMessage.includes('500') || errorMessage.includes('Server Error')) {
            errorMessage = '服务器内部错误，请稍后重试';
          }
        }
        
        setError(errorMessage);
      }
    };

    checkStatus();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [jobId, type]);

  const handleDownload = () => {
    if (!imageUrl) return;
    
    const fullImageUrl = getFullImageUrl(imageUrl);
    
    // 为避免跨域问题，使用新窗口打开图片，用户可以右键保存
    window.open(fullImageUrl, '_blank');
  };

  const getTitle = () => {
    return type === 'background' ? 'AI生成的背景图片' : 'YouTube Banner';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <h2 className="text-2xl font-bold mb-4 text-center">您的{getTitle()}</h2>

      {status === 'pending' && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg">{statusMessage || '正在生成，请稍候...'}</p>
          <p className="text-sm text-gray-500 mt-2">生成时间可能需要30秒至2分钟</p>
        </div>
      )}

      {status === 'failed' && (
        <div className="text-center py-12">
          <div className="text-red-500 text-5xl mb-4">✗</div>
          <p className="text-lg text-red-600 mb-4">生成失败</p>
          <div className="mb-6 p-3 bg-red-50 rounded-md text-left">
            <p className="font-medium">错误信息：</p>
            <p>{error}</p>
            <div className="mt-3 text-sm">
              <p className="font-medium">可能的解决方法：</p>
              <ul className="list-disc pl-5 mt-1">
                <li>检查网络连接是否正常</li>
                <li>后端服务可能暂时不可用，请稍后重试</li>
                <li>如果问题持续存在，请尝试刷新页面或联系管理员</li>
              </ul>
            </div>
          </div>
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
            onClick={() => {
              // 重新加载当前jobId的状态
              setStatus('pending');
              setError(null);
              setCheckCount(0);
              setStatusMessage('重新连接服务器...');
            }}
          >
            重新尝试
          </button>
        </div>
      )}

      {status === 'completed' && imageUrl && (
        <div>
          <div className="relative w-full aspect-[16/9] mb-6 border border-gray-200 rounded-md overflow-hidden bg-gray-100">
            {/* 使用原生img元素替代Next.js的Image组件 */}
            <img 
              src={getFullImageUrl(imageUrl)} 
              alt={`生成的${getTitle()}`}
              className="w-full h-full object-contain"
            />
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">生成完成!</h3>
              <p className="text-sm text-gray-500">
                {type === 'background' ? '可用作各种项目的背景' : '推荐尺寸: 2560 x 1440 像素'}
              </p>
            </div>
            
            <button
              onClick={handleDownload}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载图片
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 