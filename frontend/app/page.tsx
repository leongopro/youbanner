"use client";
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import BannerForm from '@/components/BannerForm';
import BackgroundForm from '@/components/BackgroundForm';

// 动态导入结果组件
const Result = dynamic(() => import('@/components/Result'), { ssr: false });

export default function Home() {
  const [activeTab, setActiveTab] = useState<'banner' | 'background'>('banner');
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultType, setResultType] = useState<'banner' | 'background'>('banner');

  // 处理生成结果的回调
  const handleGenerated = (newJobId: string, type: 'banner' | 'background') => {
    setJobId(newJobId);
    setResultType(type);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen p-4 gap-6">
      {/* 左侧面板 */}
      <div className="w-full md:w-1/2 flex flex-col mb-8 md:mb-0">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 md:mb-4">AutoYouBanner</h1>
        <p className="text-lg md:text-xl text-center mb-6 md:mb-8">YouTube Banner生成器</p>
        
        {/* 标签切换 */}
        <div className="flex mb-4 md:mb-6 border-b">
          <button 
            className={`px-3 md:px-4 py-2 text-base md:text-lg font-medium ${activeTab === 'banner' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('banner')}
          >
            Banner生成
          </button>
          <button 
            className={`px-3 md:px-4 py-2 text-base md:text-lg font-medium ${activeTab === 'background' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('background')}
          >
            AI背景生成
          </button>
        </div>
        
        {/* 表单内容 */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 flex-grow">
          {activeTab === 'banner' ? (
            <BannerForm onGenerated={handleGenerated} />
          ) : (
            <BackgroundForm onGenerated={handleGenerated} />
          )}
        </div>
        
        {/* 功能简介 - 在移动设备上隐藏 */}
        <div className="mt-4 md:mt-6 bg-white shadow-md rounded-lg p-4 md:p-5 hidden md:block">
          <h2 className="text-xl md:text-2xl mb-2 md:mb-4">功能特点</h2>
          <ul className="space-y-1 md:space-y-2 pl-5 list-disc">
            <li>全自动生成符合YouTube规范的Banner</li>
            <li>多种风格模板可选</li>
            <li>AI背景生成（Stable Diffusion）</li>
            <li>支持上传logo和自定义文本</li>
          </ul>
        </div>
      </div>
      
      {/* 右侧结果面板 */}
      <div className="w-full md:w-1/2">
        {jobId ? (
          <Result jobId={jobId} type={resultType} />
        ) : (
          <div className="h-full min-h-[300px] md:min-h-[400px] flex items-center justify-center bg-white rounded-lg shadow-md p-4 md:p-6">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 md:h-16 md:w-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-4 text-base md:text-lg text-gray-500">生成内容将显示在此处</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 