"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import logger from '@/lib/logger';

// 提示词模板
const PROMPT_TEMPLATES = [
  {
    name: '风景',
    prompt: 'Beautiful natural landscape, lakes and mountains, 4K high-definition photo, fine details, natural lighting',
    negativePrompt: 'blurry, distorted, low resolution, unnatural lighting'
  },
  {
    name: '科技',
    prompt: 'Futuristic technology background, neon lights, cyberpunk style, high-tech elements, 4K ultra HD',
    negativePrompt: 'old, vintage, blurry, low quality'
  },
  {
    name: '抽象',
    prompt: 'Abstract art background, fluid colors, modern art style, vivid colors, high-definition details',
    negativePrompt: 'concrete objects, people, text, low resolution'
  },
  {
    name: '游戏',
    prompt: 'Epic fantasy game scene background, detailed rich world, high-definition game art',
    negativePrompt: 'low poly, pixelated, UI elements, text'
  }
];

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

interface BackgroundFormProps {
  onGenerated?: (jobId: string, type: 'banner' | 'background') => void;
}

export default function BackgroundForm({ onGenerated }: BackgroundFormProps) {
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const handleTemplateSelect = (template: typeof PROMPT_TEMPLATES[0]) => {
    setFormData(prev => ({
      ...prev,
      prompt: template.prompt,
      negativePrompt: template.negativePrompt
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    logger.info('表单提交', '用户提交了背景生成表单', {
      prompt: formData.prompt,
      negativePrompt: formData.negativePrompt,
      width: formData.width,
      height: formData.height,
      steps: formData.steps,
      guidanceScale: formData.guidanceScale
    });

    try {
      // 使用API客户端发送请求
      const response = await api.generateBackground(formData);
      
      if (response.error) {
        throw new Error(response.error);
      }

      const data = response.data;
      
      if (!data) {
        throw new Error('未收到有效的API响应');
      }

      // 如果有回调，则调用回调函数
      if (onGenerated) {
        onGenerated(data.jobId, 'background');
      } else {
        // 否则跳转到结果页面
        router.push(`/result?jobId=${data.jobId}&type=background`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      prompt: e.target.value
    }));
    logger.debug('输入更改', '用户更改了提示词', { newLength: e.target.value.length });
  };

  const handleDimensionsChange = (newWidth: number, newHeight: number) => {
    setFormData(prev => ({
      ...prev,
      width: newWidth,
      height: newHeight
    }));
    logger.debug('设置更改', '用户更改了图像尺寸', { width: newWidth, height: newHeight });
  };

  const handleClear = () => {
    logger.info('操作', '用户清除了表单');
    setFormData({
      prompt: '',
      negativePrompt: '',
      width: 1024,
      height: 1024,
      steps: 30,
      guidanceScale: 7.5
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-5">
        <label htmlFor="prompt" className="block text-sm font-medium mb-1">
          提示词 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="prompt"
          name="prompt"
          value={formData.prompt}
          onChange={handlePromptChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
          rows={3}
          placeholder="输入英文提示词，如：Beautiful mountain landscape with sunrise, 4K photo, detailed, professional"
          required
        />
        <p className="text-xs text-gray-500 mt-1">请使用英文描述，API只支持英语提示词</p>
        <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
          <p className="font-medium mb-1">提示词建议:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>使用详细的描述：<span className="italic">detailed fantasy landscape with mountains, lake, sunset, high quality</span></li>
            <li>添加风格描述：<span className="italic">cinematic, photorealistic, 8K, professional photography</span></li>
            <li>包含光线描述：<span className="italic">soft lighting, golden hour, dramatic shadows</span></li>
          </ul>
        </div>
      </div>

      {/* 提示词模板 */}
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">快速模板:</p>
        <div className="flex flex-wrap gap-2">
          {PROMPT_TEMPLATES.map(template => (
            <button
              key={template.name}
              type="button"
              onClick={() => handleTemplateSelect(template)}
              className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition"
            >
              {template.name}
            </button>
          ))}
        </div>
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
          rows={2}
          placeholder="输入不想要的元素，如：blurry, low quality, distorted, deformed, text, watermark, signature"
        />
        <p className="text-xs text-gray-500 mt-1">描述您不希望在图片中出现的元素，同样使用英文</p>
      </div>

      {/* 高级选项切换 */}
      <div className="mb-4">
        <button 
          type="button" 
          className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-4 w-4 mr-1 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          高级选项
        </button>
      </div>

      {showAdvanced && (
        <>
          <div className="mb-6">
            <label htmlFor="dimensions" className="block text-sm font-medium mb-1">
              图片尺寸
            </label>
            <select
              id="dimensions"
              name="dimensions"
              value={`${formData.width}x${formData.height}`}
              onChange={(e) => {
                const [width, height] = e.target.value.split('x').map(Number);
                handleDimensionsChange(width, height);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
                min="1"
                max="20"
                step="0.5"
              />
              <p className="text-xs text-gray-500 mt-1">数值越高，AI越会尝试严格遵循你的提示词</p>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? '生成中...' : '生成背景图片'}
      </button>
    </form>
  );
} 