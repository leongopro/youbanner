"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface BannerFormProps {
  onGenerated?: (jobId: string, type: 'banner' | 'background') => void;
}

// 定义混合模式选项
const BLEND_MODES = [
  { value: 'over', label: '普通' },
  { value: 'overlay', label: '叠加' },
  { value: 'multiply', label: '正片叠底' },
  { value: 'screen', label: '滤色' },
  { value: 'soft', label: '柔光' },
  { value: 'hard', label: '强光' }
];

export default function BannerForm({ onGenerated }: BannerFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    channelName: '',
    slogan: '',
    style: 'gaming',
    color: '#ff0000',
    blendMode: 'overlay', // 默认混合模式
    imageOpacity: 0.8, // 默认不透明度
    useAI: true,
    useImg2Img: false, // 默认不使用StableDiffusion的img2img功能处理用户图片
    imageStrength: 0, // 保留图片原始内容的程度 (0表示保留100%的原图)
    promptForImage: '', // 用于图片处理的提示词
    backgroundPrompt: '', // 新增：用于背景生成的提示词
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [userImageFile, setUserImageFile] = useState<File | null>(null); // 用户上传的图片文件
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState(''); // 添加状态消息
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null); // 添加超时定时器
  
  // 添加一个ref来追踪组件是否已挂载
  const isMounted = useRef(true);
  
  // 当组件卸载时更新ref和清除定时器
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'range') {
      // 处理范围输入
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  const handleUserImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUserImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setStatusMessage('准备生成...');

    // 设置超时处理
    const timeout = setTimeout(() => {
      if (isMounted.current) {
        setError('请求超时，请检查网络连接后重试');
        setIsLoading(false);
      }
    }, 60000); // 60秒超时
    setTimeoutId(timeout);

    try {
      // 检查网络连接
      try {
        await fetch('/api/test', { method: 'HEAD' });
      } catch (networkError) {
        throw new Error('网络连接出错，请检查您的网络');
      }

      let logoUrl = null;
      let userImageUrl = null;
      
      // 如果有Logo文件，先上传Logo
      if (logoFile) {
        setStatusMessage('正在上传Logo...');
        const logoResponse = await api.uploadImage(logoFile);
        if (!isMounted.current) return; // 如果组件已卸载，不继续处理
        
        if (logoResponse.error) {
          throw new Error('Logo上传失败: ' + logoResponse.error);
        }
        logoUrl = logoResponse.data?.fileUrl;
      }
      
      // 如果有用户图片文件，上传用户图片
      if (userImageFile) {
        setStatusMessage('正在上传用户图片...');
        
        // 添加重试机制
        let imageResponse;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            setStatusMessage(`正在上传用户图片 ${retryCount > 0 ? `(第${retryCount+1}次尝试)` : ''}...`);
            imageResponse = await api.uploadImage(userImageFile);
            
            if (imageResponse.error) {
              throw new Error(imageResponse.error);
            }
            
            // 如果成功，跳出循环
            break;
          } catch (uploadError: any) {
            retryCount++;
            console.error(`上传用户图片失败 (尝试 ${retryCount}/${maxRetries}):`, uploadError);
            
            if (retryCount >= maxRetries) {
              throw new Error(`多次尝试上传图片后仍然失败: ${uploadError.message || '未知错误'}`);
            }
            
            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        if (!isMounted.current) return; // 如果组件已卸载，不继续处理
        
        if (imageResponse?.error) {
          throw new Error('图片上传失败: ' + imageResponse.error);
        }
        
        if (!imageResponse?.data?.fileUrl) {
          console.error('上传响应中没有找到fileUrl:', imageResponse);
          
          // 尝试从响应中提取URL（即使结构不是预期的）
          let extractedUrl = null;
          if (imageResponse?.data?.success && typeof imageResponse.data === 'object') {
            // 遍历所有属性寻找可能的URL
            for (const key in imageResponse.data) {
              const value = (imageResponse.data as Record<string, any>)[key];
              if (typeof value === 'string' && (
                  value.startsWith('/uploads/') || 
                  value.startsWith('/generated/') ||
                  value.startsWith('http')
                )) {
                console.log(`找到可能的URL字段 ${key}: ${value}`);
                extractedUrl = value;
                break;
              }
            }
          }
          
          if (extractedUrl) {
            console.log('使用提取的URL:', extractedUrl);
            userImageUrl = extractedUrl;
            setStatusMessage('成功提取图片URL');
          } else {
            throw new Error('上传服务器未返回有效的图片链接');
          }
        } else {
          console.log('正常接收到fileUrl:', imageResponse.data.fileUrl);
          userImageUrl = imageResponse.data.fileUrl;
          setStatusMessage('用户图片上传成功，URL: ' + userImageUrl.substring(0, 20) + '...');
        }
        
        // 如果启用了img2img功能，处理用户图片
        if (formData.useImg2Img && userImageUrl) {
          setStatusMessage('正在处理图片融合...');
          // 构建提示词
          const imgPrompt = formData.promptForImage || 
            `${formData.channelName} channel banner with ${formData.style} style, professional, high quality, seamless integration`;
          
          // 处理背景图像URL
          let backgroundImageUrl: string | undefined = undefined;
          
          // 如果需要使用生成的背景，先生成背景
          if (formData.useAI && formData.backgroundPrompt) {
            try {
              setStatusMessage('正在生成背景图像...');
              // 使用背景提示词生成背景图像
              const bgResponse = await api.generateBackground({
                prompt: `${formData.backgroundPrompt}, ${formData.style} style, high quality background`,
                width: 1920,
                height: 1080,
                steps: 30
              });
              
              if (bgResponse.error) {
                console.warn('背景生成失败:', bgResponse.error);
                setStatusMessage('背景生成失败，使用默认背景');
              } else if (bgResponse.data?.jobId) {
                // 等待背景生成完成
                let bgStatus = 'processing';
                let bgResult = null;
                let bgRetries = 0;
                const maxBgRetries = 20; // 最多等待20次，每次3秒
                
                while (bgStatus === 'processing' && bgRetries < maxBgRetries) {
                  bgRetries++;
                  setStatusMessage(`等待背景生成 (${bgRetries}/${maxBgRetries})...`);
                  await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
                  
                  const bgStatusResponse = await api.checkBackgroundStatus(bgResponse.data.jobId);
                  if (bgStatusResponse.error) {
                    console.warn('检查背景状态失败:', bgStatusResponse.error);
                    continue;
                  }
                  
                  bgStatus = bgStatusResponse.data?.status || 'processing';
                  bgResult = bgStatusResponse.data?.result;
                }
                
                // 如果背景生成成功，使用背景URL
                if (bgStatus === 'completed' && bgResult?.imageUrl) {
                  backgroundImageUrl = bgResult.imageUrl;
                  console.log('成功生成背景图像:', backgroundImageUrl);
                  setStatusMessage('背景生成成功，继续处理...');
                } else {
                  setStatusMessage('背景生成超时或失败，使用默认背景');
                }
              }
            } catch (bgError) {
              console.error('生成背景过程中出错:', bgError);
              setStatusMessage('背景生成出错，使用默认背景');
            }
          }
          
          // 调用img2img API
          setStatusMessage('正在调用图像处理服务...');
          const img2imgResponse = await api.generateImg2Img({
            prompt: imgPrompt,
            userImageUrl: userImageUrl,
            backgroundImageUrl: backgroundImageUrl,
            imageStrength: formData.imageStrength,
            steps: 40,
            guidanceScale: 8.5
          });
          
          if (!isMounted.current) return; // 如果组件已卸载，不继续处理
          
          if (img2imgResponse.error) {
            throw new Error('图片处理失败: ' + img2imgResponse.error);
          }
          
          // 获取img2img任务ID
          const img2imgJobId = img2imgResponse.data?.jobId;
          if (!img2imgJobId) {
            throw new Error('图片处理任务ID无效');
          }
          
          // 等待图片处理完成
          let imgStatus = 'processing';
          let imgResult = null;
          let retries = 0;
          const maxRetries = 30; // 最多等待30次，每次3秒
          
          while (imgStatus === 'processing' && retries < maxRetries) {
            retries++;
            setStatusMessage(`等待图像处理完成 (${retries}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
            
            if (!isMounted.current) return; // 如果组件已卸载，不继续处理
            
            const imgStatusResponse = await api.checkBackgroundStatus(img2imgJobId);
            if (!isMounted.current) return; // 如果组件已卸载，不继续处理
            
            if (imgStatusResponse.error) {
              console.warn('检查图片处理状态失败:', imgStatusResponse.error);
              continue;
            }
            
            imgStatus = imgStatusResponse.data?.status || 'processing';
            imgResult = imgStatusResponse.data?.result;
          }
          
          // 如果处理成功，使用处理后的图片URL
          if (imgStatus === 'completed' && imgResult?.imageUrl) {
            userImageUrl = imgResult.imageUrl;
            setStatusMessage('图像处理成功，继续生成Banner...');
          } else if (imgStatus === 'failed') {
            console.warn('图片处理失败，将使用原始图片');
            setStatusMessage('图像处理失败，使用原始图片继续...');
          } else {
            setStatusMessage('图像处理超时，使用原始图片继续...');
          }
        }
      }
      
      // 然后提交Banner生成请求
      setStatusMessage('正在生成Banner...');
      const bannerData = {
        channelName: formData.channelName,
        channelSlogan: formData.slogan,
        theme: formData.style,
        backgroundColor: formData.color,
        backgroundPrompt: formData.backgroundPrompt, // 添加背景提示词
        logoUrl: logoUrl,
        userImageUrl: userImageUrl,
        blendMode: formData.blendMode,
        imageOpacity: formData.imageOpacity,
        useAI: formData.useAI
      };

      // 清除超时定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }

      // 添加重试机制
      let response;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          // 使用API客户端发送请求
          response = await api.generateBanner(bannerData);
          break; // 如果成功，跳出循环
        } catch (retryError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(`尝试${maxRetries}次后仍然失败: ${retryError instanceof Error ? retryError.message : '未知错误'}`);
          }
          setStatusMessage(`请求失败，正在重试 (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
        }
      }
      
      if (!response) {
        throw new Error('无法连接到服务器，请检查网络');
      }
      
      if (!isMounted.current) return; // 如果组件已卸载，不继续处理
      
      if (response.error) {
        throw new Error(response.error);
      }

      const data = response.data;
      
      if (!data) {
        throw new Error('未收到有效的API响应');
      }

      // 获取jobId并确保是字符串类型
      let jobId = '';
      if (data.jobId) {
        jobId = data.jobId;
      } else if (data.id) {
        jobId = data.id;
      } else {
        throw new Error('生成任务ID无效');
      }

      setStatusMessage('Banner生成成功！正在跳转...');
      
      if (onGenerated) {
        onGenerated(jobId, 'banner');
        if (isMounted.current) { // 确保组件仍然挂载
          setFormData({
            channelName: '',
            slogan: '',
            style: 'gaming',
            color: '#ff0000',
            blendMode: 'overlay',
            imageOpacity: 0.8,
            useAI: true,
            useImg2Img: false,
            imageStrength: 0,
            promptForImage: '',
            backgroundPrompt: '', // 重置背景提示词
          });
          setLogoFile(null);
          setUserImageFile(null);
        }
      } else {
        // 否则跳转到结果页面
        router.push(`/result?jobId=${jobId}&type=banner`);
      }
    } catch (err) {
      // 清除超时定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }

      if (isMounted.current) { // 确保组件仍然挂载
        // 尝试提供更详细的错误消息
        let errorMessage = '提交请求失败';
        
        if (err instanceof Error) {
          errorMessage = err.message;
          
          // 检查是否为网络错误
          if (errorMessage.includes('network') || errorMessage.includes('Network') || 
              errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch')) {
            errorMessage = '网络连接错误：无法连接到服务器，请检查网络后重试';
          }
          
          // 检查是否为超时错误
          if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            errorMessage = '请求超时：服务器响应时间过长，请稍后重试';
          }
          
          // 检查是否为服务器错误
          if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
            errorMessage = '服务器错误：后端服务出现问题，请稍后重试';
          }
        }
        
        setError(errorMessage);
        setStatusMessage(''); // 清除状态消息
      }
    } finally {
      if (isMounted.current) { // 确保组件仍然挂载
        setIsLoading(false);
      }
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
          placeholder="输入您的YouTube频道名称"
          required
        />
        <p className="text-xs text-gray-500 mt-1">此名称将显示在Banner上</p>
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
          rows={2}
          placeholder="简短描述您的频道内容或标语"
        />
        <p className="text-xs text-gray-500 mt-1">将显示在频道名称下方，建议保持简短</p>
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
          onChange={handleLogoFileChange}
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">这里上传的是您频道的Logo图标，建议使用正方形PNG格式图片（带透明背景），将显示在Banner的突出位置</p>
        {logoFile && (
          <div className="mt-2 text-sm text-gray-700">
            已选择: {logoFile.name} ({Math.round(logoFile.size / 1024)} KB)
          </div>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="userImage" className="block text-sm font-medium mb-1">
          自定义图片 (将融入背景)
        </label>
        <input
          type="file"
          id="userImage"
          name="userImage"
          accept="image/*"
          onChange={handleUserImageFileChange}
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">这里上传的图片将作为Banner的一部分与AI生成的背景融合，推荐使用高质量、主题相关的图片</p>
        {userImageFile && (
          <div className="mt-2 text-sm text-gray-700">
            已选择: {userImageFile.name} ({Math.round(userImageFile.size / 1024)} KB)
          </div>
        )}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
          >
            <option value="gaming">游戏</option>
            <option value="vlog">Vlog</option>
            <option value="technology">科技</option>
            <option value="education">教育</option>
            <option value="art">艺术</option>
            <option value="music">音乐</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">选择最接近您频道主题的风格</p>
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
          <p className="text-xs text-gray-500 mt-1">选择与您频道风格匹配的颜色</p>
        </div>
      </div>

      {/* AI相关选项放在一起 */}
      <div className="my-6 p-4 bg-blue-50 rounded-md space-y-4">
        {/* 使用AI智能融合图像选项 */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="useImg2Img"
            name="useImg2Img"
            checked={formData.useImg2Img}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            disabled={!userImageFile}
          />
          <label htmlFor="useImg2Img" className="ml-2 block text-sm font-medium">
            使用AI智能融合图像
          </label>
        </div>
        <p className="text-xs text-gray-500 ml-6">
          {userImageFile 
            ? "启用此选项将使用StableDiffusion的img2img功能智能融合您的图片，让您的照片完美融入生成的背景中" 
            : "请先上传自定义图片，才能启用此选项"}
        </p>
        
        {userImageFile && formData.useImg2Img && (
          <>
            {/* 图像强度滑块 */}
            <div className="ml-6 mt-2">
              <label htmlFor="imageStrength" className="block text-sm font-medium mb-1">
                保留原图程度: {((1 - formData.imageStrength) * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                id="imageStrength"
                name="imageStrength"
                min="0"
                max="0.65"
                step="0.05"
                value={formData.imageStrength}
                onChange={handleChange}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                数值越高(向右)，图片变化越大；数值越低(向左)，保留原图细节越多，设为0时完全保留原图(100%)
              </p>
            </div>
            
            {/* 图像提示词 */}
            <div className="ml-6 mt-4">
              <label htmlFor="promptForImage" className="block text-sm font-medium mb-1">
                图像提示词 (可选)
              </label>
              <textarea
                id="promptForImage"
                name="promptForImage"
                value={formData.promptForImage}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
                rows={2}
                placeholder="描述您希望AI如何处理图片，例如：我的照片与美丽山水风景融合"
              />
              <p className="text-xs text-gray-500 mt-1">详细描述您希望的图像效果，如不填写将根据频道风格自动生成</p>
            </div>
          </>
        )}

        {/* 高级图像选项 - 直接显示，不使用下拉菜单 */}
        {userImageFile && (
          <div className="ml-6 mt-4 pt-4 border-t border-blue-200">
            <h3 className="text-sm font-medium mb-3">图像混合选项</h3>
            
            {/* 图像混合模式选择 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                图像混合模式
              </label>
              <select
                value={formData.blendMode}
                onChange={(e) => setFormData(prev => ({ ...prev, blendMode: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="normal">正常 - 直接叠加，保持原图效果</option>
                <option value="overlay">融合 - 增强对比度，与背景更好地融合</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">选择不同的混合模式可以创建不同的视觉效果</p>
            </div>

            {/* 不透明度滑块 */}
            <div className="mb-4">
              <label htmlFor="imageOpacity" className="block text-sm font-medium mb-1">
                图像不透明度: {formData.imageOpacity.toFixed(1)}
              </label>
              <input
                type="range"
                id="imageOpacity"
                name="imageOpacity"
                min="0.1"
                max="1.0"
                step="0.1"
                value={formData.imageOpacity}
                onChange={handleChange}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">调整上传图片的不透明度</p>
            </div>
          </div>
        )}

        {/* 使用AI生成背景图片选项 */}
        <div className="flex items-center mt-4 pt-4 border-t border-blue-200">
          <input
            type="checkbox"
            id="useAI"
            name="useAI"
            checked={formData.useAI}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <label htmlFor="useAI" className="ml-2 block text-sm font-medium">
            使用AI生成背景图片
          </label>
        </div>
        <p className="text-xs text-gray-500 ml-6">
          选择此选项将使用AI根据频道风格生成专业的背景图像（需要额外的处理时间）
        </p>
        
        {/* 当勾选"使用AI生成背景图片"时显示背景提示词输入框 */}
        {formData.useAI && (
          <div className="ml-6 mt-2">
            <label htmlFor="backgroundPrompt" className="block text-sm font-medium mb-1">
              背景提示词 (可选)
            </label>
            <textarea
              id="backgroundPrompt"
              name="backgroundPrompt"
              value={formData.backgroundPrompt}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
              rows={2}
              placeholder="描述您希望的背景效果，例如：科技感的抽象背景，带有蓝色和紫色的渐变"
            />
            <p className="text-xs text-gray-500 mt-1">
              输入详细的背景描述可以获得更符合您期望的效果，如不填写则根据频道风格自动生成
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          <div className="font-medium">错误：</div>
          <div>{error}</div>
          <div className="mt-2 text-sm">
            <ul className="list-disc pl-5">
              <li>检查网络连接是否正常</li>
              <li>后端服务可能暂时不可用，请稍后重试</li>
              <li>如果问题持续存在，请联系管理员</li>
            </ul>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{statusMessage || '生成中...'}</span>
          </div>
        ) : '生成Banner'}
      </button>
    </form>
  );
} 