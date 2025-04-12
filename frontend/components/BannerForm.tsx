"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface BannerFormProps {
  onGenerated?: (jobId: string, type: 'banner' | 'background') => void;
}

export default function BannerForm({ onGenerated }: BannerFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    channelName: '',
    slogan: '',
    style: 'gaming',
    color: '#ff0000',
  });
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('channelName', formData.channelName);
      formDataToSend.append('slogan', formData.slogan);
      formDataToSend.append('style', formData.style);
      formDataToSend.append('color', formData.color);
      
      if (file) {
        formDataToSend.append('logo', file);
      }

      const response = await fetch('http://localhost:5000/api/banner/generate', {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '生成失败');
      }

      // 如果有回调，则调用回调函数
      if (onGenerated) {
        onGenerated(data.jobId, 'banner');
        // 重置表单
        setFormData({
          channelName: '',
          slogan: '',
          style: 'gaming',
          color: '#ff0000',
        });
        setFile(null);
      } else {
        // 否则跳转到结果页面
        router.push(`/result?jobId=${data.jobId}&type=banner`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <label htmlFor="channelName" className="block text-sm font-medium mb-1">
          频道名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="channelName"
          name="channelName"
          value={formData.channelName}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="slogan" className="block text-sm font-medium mb-1">
          频道口号/描述
        </label>
        <textarea
          id="slogan"
          name="slogan"
          value={formData.slogan}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={2}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="logo" className="block text-sm font-medium mb-1">
          频道Logo
        </label>
        <input
          type="file"
          id="logo"
          name="logo"
          accept="image/*"
          onChange={handleFileChange}
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">推荐使用正方形PNG透明背景图片</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="style" className="block text-sm font-medium mb-1">
            Banner风格
          </label>
          <select
            id="style"
            name="style"
            value={formData.style}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="gaming">游戏</option>
            <option value="vlog">Vlog</option>
            <option value="technology">科技</option>
            <option value="education">教育</option>
            <option value="art">艺术</option>
            <option value="music">音乐</option>
          </select>
        </div>

        <div>
          <label htmlFor="color" className="block text-sm font-medium mb-1">
            主题颜色
          </label>
          <input
            type="color"
            id="color"
            name="color"
            value={formData.color}
            onChange={handleChange}
            className="w-full h-10"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? '生成中...' : '生成Banner'}
      </button>
    </form>
  );
} 