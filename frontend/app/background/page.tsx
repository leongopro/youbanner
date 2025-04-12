"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BackgroundGenerator() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    prompt: '',
    negativePrompt: '',
    width: 1280,
    height: 720,
    steps: 30,
    guidanceScale: 7.5
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'width' || name === 'height' || name === 'steps' || name === 'guidanceScale' 
        ? parseFloat(value) 
        : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/stablediffusion/generate', {
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
            placeholder="描述你想要生成的图片，例如：美丽的山脉日落风景，高清照片，4K"
            required
          />
          <p className="text-xs text-gray-500 mt-1">详细的描述有助于生成更好的结果</p>
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
            placeholder="描述你不希望在图片中出现的元素，例如：模糊，低质量，变形"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="width" className="block text-sm font-medium mb-1">
              宽度
            </label>
            <input
              type="number"
              id="width"
              name="width"
              value={formData.width}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="512"
              max="1280"
              step="64"
            />
          </div>

          <div>
            <label htmlFor="height" className="block text-sm font-medium mb-1">
              高度
            </label>
            <input
              type="number"
              id="height"
              name="height"
              value={formData.height}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="512"
              max="1280"
              step="64"
            />
          </div>
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