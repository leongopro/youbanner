"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 添加支持的尺寸组合
const SUPPORTED_DIMENSIONS = [
  { width: 1024, height: 1024, label: '1024x1024 (正方形)' },
  { width: 1152, height: 896, label: '1152x896 (横向)' },
  { width: 1216, height: 832, label: '1216x832 (横向)' },
  { width: 1344, height: 768, label: '1344x768 (横向)' },
  { width: 1536, height: 640, label: '1536x640 (横向宽幅)' },
  { width: 640, height: 1536, label: '640x1536 (纵向)' },
  { width: 768, height: 1344, label: '768x1344 (纵向)' },
  { width: 832, height: 1216, label: '832x1216 (纵向)' },
  { width: 896, height: 1152, label: '896x1152 (纵向)' }
];

export default function BackgroundGenerator() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    prompt: '',
    negativePrompt: '',
    width: 1024,
    height: 1024,
    steps: 30,
    guidanceScale: 7.5
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // 处理尺寸选择
    if (name === 'dimensions') {
      const [width, height] = value.split('x').map(Number);
      setFormData(prev => ({ ...prev, width, height }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        [name]: name === 'steps' || name === 'guidanceScale' 
          ? parseFloat(value) 
          : value 
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/stablediffusion/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '生成请求失败');
      }

      // 重定向到结果页面
      router.push(`/result?jobId=${data.jobId}&type=background`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI背景生成器</h1>
        <p className="text-gray-600 mt-2">
          使用Stable Diffusion AI技术生成高质量的背景图像
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <label htmlFor="prompt" className="block text-sm font-medium mb-1">
            提示词 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="prompt"
            name="prompt"
            value={formData.prompt}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={3}
            placeholder="Describe what you want to generate, e.g.: Beautiful mountain sunset landscape, high quality photo, 4K"
            required
          />
          <p className="text-xs text-gray-500 mt-1">请使用英文描述，API只支持英语提示词</p>
        </div>

        <div className="mb-4">
          <label htmlFor="negativePrompt" className="block text-sm font-medium mb-1">
            负面提示词
          </label>
          <textarea
            id="negativePrompt"
            name="negativePrompt"
            value={formData.negativePrompt}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={2}
            placeholder="Words to avoid in the image, e.g.: blurry, low quality, distorted"
          />
          <p className="text-xs text-gray-500 mt-1">请使用英文描述，API只支持英语提示词</p>
        </div>

        <div className="mb-6">
          <label htmlFor="dimensions" className="block text-sm font-medium mb-1">
            图片尺寸
          </label>
          <select
            id="dimensions"
            name="dimensions"
            value={`${formData.width}x${formData.height}`}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {SUPPORTED_DIMENSIONS.map(dim => (
              <option key={`${dim.width}x${dim.height}`} value={`${dim.width}x${dim.height}`}>
                {dim.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Stable Diffusion XL只支持特定的尺寸组合
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="steps" className="block text-sm font-medium mb-1">
              采样步数
            </label>
            <input
              type="number"
              id="steps"
              name="steps"
              value={formData.steps}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="20"
              max="50"
              step="1"
            />
            <p className="text-xs text-gray-500 mt-1">更高的步数通常会产生更好的结果，但需要更长的生成时间</p>
          </div>

          <div>
            <label htmlFor="guidanceScale" className="block text-sm font-medium mb-1">
              提示词强度
            </label>
            <input
              type="number"
              id="guidanceScale"
              name="guidanceScale"
              value={formData.guidanceScale}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="1"
              max="20"
              step="0.5"
            />
            <p className="text-xs text-gray-500 mt-1">数值越高，AI越会尝试严格遵循你的提示词</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-between">
          <Link href="/" className="text-blue-600 hover:underline flex items-center">
            返回首页
          </Link>
          
          <button
            type="submit"
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '生成中...' : '生成背景图片'}
          </button>
        </div>
      </form>
    </div>
  );
} 