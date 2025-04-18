'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  uploadImage, 
  generateImg2Img, 
  checkBackgroundStatus, 
  getFullImageUrl, 
  avatarComposition, 
  generateBackgroundImage, 
  type BackgroundStatusResponse 
} from '@/lib/api';

// 补充BackgroundStatusResponse类型定义
type EnhancedBackgroundStatusResponse = BackgroundStatusResponse & {
  imageUrl?: string; // 可能存在的额外属性
};

export default function DebugPage() {
  // 头像合成相关状态
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [avatarCompositeResult, setAvatarCompositeResult] = useState<string | null>(null);
  const [avatarPrompt, setAvatarPrompt] = useState<string>('完美融合的头像，自然的光影效果，高质量细节');
  const [preserveDetail, setPreserveDetail] = useState<number>(65); // 保留细节百分比：0-100
  const [avatarPosition, setAvatarPosition] = useState<string>('center'); // 头像位置：center, top, bottom, left, right, top-left, top-right, bottom-left, bottom-right
  const [isAvatarProcessing, setIsAvatarProcessing] = useState<boolean>(false);
  const [avatarJobId, setAvatarJobId] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string>('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  
  // 添加背景生成相关状态
  const [backgroundPrompt, setBackgroundPrompt] = useState<string>('');
  const [isGeneratingBackground, setIsGeneratingBackground] = useState<boolean>(false);
  const [backgroundJobId, setBackgroundJobId] = useState<string | null>(null);
  const [backgroundStatus, setBackgroundStatus] = useState<string>('');
  const [backgroundMode, setBackgroundMode] = useState<'upload' | 'generate'>('upload');

  // 添加抠图相关状态
  const [shouldRemoveBackground, setShouldRemoveBackground] = useState<boolean>(false);
  const [enhancedRemoveBackground, setEnhancedRemoveBackground] = useState<boolean>(false);
  const [removeBackgroundThreshold, setRemoveBackgroundThreshold] = useState<number>(10);
  const [removeBackgroundTolerance, setRemoveBackgroundTolerance] = useState<number>(30);

  // 添加头像缩放相关状态
  const [avatarScale, setAvatarScale] = useState<number>(100); // 头像尺寸比例：10% - 100%
  const [cropShape, setCropShape] = useState<string>('circle'); // 裁剪形状：circle, square, rectangle, none

  // 监控头像合成处理状态
  useEffect(() => {
    if (!avatarJobId || !isAvatarProcessing) return;
    
    const checkInterval = setInterval(async () => {
      try {
        console.log('检查任务状态:', avatarJobId);
        const response = await checkBackgroundStatus(avatarJobId);
        console.log('状态检查响应:', response);
        
        if (response.error) {
          setAvatarStatus(`检查状态错误: ${response.error}`);
          setIsAvatarProcessing(false);
          clearInterval(checkInterval);
          return;
        }
        
        // 检查是否完成
        if (response.data?.status === 'completed') {
          console.log('任务已完成，结果:', response.data);
          
          // 处理不同的结果格式
          let resultUrl = null;
          
          if (response.data.result?.imageUrl) {
            // 对象格式: { imageUrl: string }
            resultUrl = response.data.result.imageUrl;
            console.log('使用结果对象中的imageUrl:', resultUrl);
          } else if (typeof response.data.result === 'string') {
            // 字符串格式: 直接是URL
            resultUrl = response.data.result;
            console.log('使用字符串格式的结果:', resultUrl);
          } else if (response.data.hasOwnProperty('imageUrl')) {
            // 备选格式: 直接在顶层有imageUrl (可能不在类型定义中)
            resultUrl = (response.data as any).imageUrl;
            console.log('使用顶层imageUrl:', resultUrl);
          }
          
          if (resultUrl) {
            setAvatarCompositeResult(resultUrl);
            setAvatarStatus('处理完成');
            setIsAvatarProcessing(false);
            clearInterval(checkInterval);
          } else {
            console.error('找不到有效的图像URL:', response.data);
            setAvatarStatus('处理完成但找不到图像URL');
            setIsAvatarProcessing(false);
            clearInterval(checkInterval);
          }
        } else if (response.data?.status === 'failed') {
          setAvatarStatus(`处理失败: ${response.data.error || '未知错误'}`);
          setIsAvatarProcessing(false);
          clearInterval(checkInterval);
        } else {
          setAvatarStatus(`处理中... (${response.data?.status || '等待'})`);
        }
      } catch (error) {
        console.error('检查状态错误:', error);
        setAvatarStatus('检查状态时出错');
      }
    }, 2000); // 每2秒检查一次
    
    return () => clearInterval(checkInterval);
  }, [avatarJobId, isAvatarProcessing]);

  // 监控背景生成状态
  useEffect(() => {
    if (!backgroundJobId || !isGeneratingBackground) return;
    
    const checkInterval = setInterval(async () => {
      try {
        console.log('检查背景生成状态:', backgroundJobId);
        const response = await checkBackgroundStatus(backgroundJobId);
        console.log('背景生成状态:', response);
        
        if (response.error) {
          setBackgroundStatus(`检查状态错误: ${response.error}`);
          setIsGeneratingBackground(false);
          clearInterval(checkInterval);
          return;
        }
        
        if (response.data?.status === 'completed') {
          console.log('背景生成完成，结果:', response.data);
          
          // 处理不同的结果格式
          let resultUrl = null;
          
          if (response.data.result?.imageUrl) {
            resultUrl = response.data.result.imageUrl;
            console.log('使用结果对象中的imageUrl:', resultUrl);
          } else if (typeof response.data.result === 'string') {
            resultUrl = response.data.result;
            console.log('使用字符串格式的结果:', resultUrl);
          } else if ((response.data as EnhancedBackgroundStatusResponse).imageUrl) {
            resultUrl = (response.data as EnhancedBackgroundStatusResponse).imageUrl;
            console.log('使用顶层imageUrl:', resultUrl);
          }
          
          if (resultUrl) {
            setBackgroundImageUrl(resultUrl);
            setBackgroundStatus('背景生成完成');
            setIsGeneratingBackground(false);
            clearInterval(checkInterval);
          } else {
            console.error('找不到有效的背景图像URL:', response.data);
            setBackgroundStatus('背景生成完成但找不到图像URL');
            setIsGeneratingBackground(false);
            clearInterval(checkInterval);
          }
        } else if (response.data?.status === 'failed') {
          setBackgroundStatus(`生成失败: ${response.data.error || '未知错误'}`);
          setIsGeneratingBackground(false);
          clearInterval(checkInterval);
        } else {
          setBackgroundStatus(`生成中... (${response.data?.status || '等待'})`);
        }
      } catch (error) {
        console.error('检查背景状态错误:', error);
        setBackgroundStatus('检查状态时出错');
      }
    }, 2000); // 每2秒检查一次
    
    return () => clearInterval(checkInterval);
  }, [backgroundJobId, isGeneratingBackground]);

  // 处理头像上传
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setAvatarImageUrl(null);
    setAvatarCompositeResult(null);
    setAvatarStatus('上传头像中...');
    
    try {
      console.log('开始上传头像图片:', file.name, '大小:', Math.round(file.size / 1024), 'KB');
      console.log('上传到URL:', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/upload`);
      
      const response = await uploadImage(file);
      
      console.log('上传响应:', response);
      
      if (response.error) {
        console.error('上传错误详情:', response.error);
        setAvatarStatus(`上传失败: ${response.error}`);
        return;
      }
      
      if (!response.data?.fileUrl) {
        console.error('上传成功但没有返回图片URL');
        setAvatarStatus('上传成功但没有返回图片URL');
        return;
      }
      
      console.log('上传成功, 图片URL:', response.data.fileUrl);
      setAvatarImageUrl(response.data.fileUrl);
      setAvatarStatus('头像上传成功');
    } catch (error: any) {
      console.error('上传失败详情:', error);
      setAvatarStatus(`上传失败: ${error.message || '未知错误'}`);
    }
  };

  // 处理背景图片上传
  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setBackgroundImageUrl(null);
    setAvatarStatus('上传背景图片中...');
    
    try {
      const response = await uploadImage(file);
      
      if (response.error) {
        setAvatarStatus(`上传失败: ${response.error}`);
        return;
      }
      
      if (!response.data?.fileUrl) {
        setAvatarStatus('上传成功但没有返回图片URL');
        return;
      }
      
      setBackgroundImageUrl(response.data.fileUrl);
      setAvatarStatus('背景图片上传成功');
    } catch (error: any) {
      console.error('上传失败:', error);
      setAvatarStatus(`上传失败: ${error.message || '未知错误'}`);
    }
  };

  // 添加背景生成函数
  const generateBackground = async () => {
    if (!backgroundPrompt) {
      setBackgroundStatus('请输入背景提示词');
      return;
    }
    
    setBackgroundImageUrl(null);
    setIsGeneratingBackground(true);
    setBackgroundStatus('正在生成背景...');
    
    try {
      // 调用生成背景API
      const response = await generateBackgroundImage({
        prompt: backgroundPrompt,
        width: 1024,
        height: 1024
      });
      
      if (response.error) {
        setBackgroundStatus(`生成请求失败: ${response.error}`);
        setIsGeneratingBackground(false);
        return;
      }
      
      if (!response.data?.jobId) {
        setBackgroundStatus('未返回有效的任务ID');
        setIsGeneratingBackground(false);
        return;
      }
      
      setBackgroundJobId(response.data.jobId);
      setBackgroundStatus(`背景生成开始，任务ID: ${response.data.jobId}`);
    } catch (error: any) {
      console.error('生成请求失败:', error);
      setBackgroundStatus(`生成请求错误: ${error.message || '未知错误'}`);
      setIsGeneratingBackground(false);
    }
  };

  // 开始头像合成处理
  const startAvatarComposite = async () => {
    if (!avatarImageUrl) {
      setAvatarStatus('请先上传头像');
      return;
    }
    
    if (!backgroundImageUrl) {
      setAvatarStatus('请上传或生成背景图片');
      return;
    }
    
    setAvatarCompositeResult(null);
    setIsAvatarProcessing(true);
    setAvatarStatus('开始处理头像合成...');
    
    try {
      // 将保留细节百分比转换为imageStrength值
      // preserveDetail: 0(不保留) -> 100(完全保留)
      // imageStrength: 0.8(几乎不保留) -> 0(完全保留)
      const imageStrength = 0.8 - (preserveDetail / 100) * 0.8;

      // 使用专门的头像合成API
      const response = await avatarComposition({
        prompt: avatarPrompt,
        avatarUrl: avatarImageUrl,
        backgroundUrl: backgroundImageUrl,
        imageStrength: imageStrength, // 转换后的值
        steps: 40, // 增加步数以获得更好的质量
        guidanceScale: 7.5,
        position: avatarPosition, // 添加头像位置参数
        scale: avatarScale / 100, // 添加头像缩放参数
        cropShape: cropShape, // 添加裁剪形状参数
        removeBackground: shouldRemoveBackground, // 是否移除背景
        enhancedRemoveBackground: shouldRemoveBackground && enhancedRemoveBackground, // 是否使用增强抠图
        threshold: removeBackgroundThreshold, // 抠图阈值
        tolerance: removeBackgroundTolerance // 颜色容差
      });
      
      if (response.error) {
        setAvatarStatus(`处理请求失败: ${response.error}`);
        setIsAvatarProcessing(false);
        return;
      }
      
      if (!response.data?.jobId) {
        setAvatarStatus('未返回有效的任务ID');
        setIsAvatarProcessing(false);
        return;
      }
      
      setAvatarJobId(response.data.jobId);
      setAvatarStatus(`处理开始，任务ID: ${response.data.jobId}`);
    } catch (error: any) {
      console.error('处理请求失败:', error);
      setAvatarStatus(`处理请求错误: ${error.message || '未知错误'}`);
      setIsAvatarProcessing(false);
    }
  };
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">头像合成调试页面</h1>
      
      {/* 头像合成测试部分 */}
      <div className="mb-8 p-6 bg-green-50 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">头像合成测试</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-2">第1步: 上传头像</h3>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarUpload}
              className="hidden"
              accept="image/*"
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mb-4"
            >
              选择头像图片
            </button>
            
            {avatarImageUrl && (
              <div className="mt-2">
                <p className="text-sm text-green-600 mb-2">头像上传成功</p>
                <div className="relative w-full aspect-square border border-gray-200 rounded-md overflow-hidden bg-gray-100">
                  <img 
                    src={getFullImageUrl(avatarImageUrl)} 
                    alt="头像"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
            
            <h3 className="font-medium mb-2 mt-4">第2步: 上传背景图片（可选）</h3>
            <input
              type="file"
              ref={backgroundInputRef}
              onChange={handleBackgroundUpload}
              className="hidden"
              accept="image/*"
            />
            <button
              onClick={() => backgroundInputRef.current?.click()}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 mb-4"
            >
              选择背景图片
            </button>
            
            <div className="mt-4">
              <h3 className="font-medium mb-2">或者通过提示词生成背景</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={backgroundPrompt}
                  onChange={(e) => setBackgroundPrompt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
                  placeholder="输入背景描述，例如：星空、海滩、森林等"
                  disabled={isGeneratingBackground}
                />
                <button
                  onClick={generateBackground}
                  disabled={!backgroundPrompt || isGeneratingBackground}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  生成背景
                </button>
              </div>
              {isGeneratingBackground && (
                <p className="text-sm text-blue-600 mt-2 animate-pulse">{backgroundStatus}</p>
              )}
            </div>
            
            {backgroundImageUrl && (
              <div className="mt-2">
                <p className="text-sm text-green-600 mb-2">
                  {backgroundMode === 'upload' ? '背景图片上传成功' : '背景图片生成成功'}
                </p>
                <div className="relative w-full aspect-video border border-gray-200 rounded-md overflow-hidden bg-gray-100">
                  <img 
                    src={getFullImageUrl(backgroundImageUrl)} 
                    alt="背景图片"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="font-medium mb-2">第3步: 设置合成参数</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">合成提示词:</label>
              <textarea
                value={avatarPrompt}
                onChange={(e) => setAvatarPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
                placeholder="描述你想要的合成效果"
                rows={2}
              />
              <p className="text-xs text-gray-500 mt-1">
                提示词用于指导AI如何处理头像与背景的融合效果。例如："自然融合的头像，柔和的光影，完美的边缘过渡"
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                修改程度: {preserveDetail}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={preserveDetail}
                onChange={(e) => setPreserveDetail(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                值越高，修改原始头像的细节越多；值越低，AI的创造性处理越低
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                头像位置:
              </label>
              <select
                value={avatarPosition}
                onChange={(e) => setAvatarPosition(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
              >
                <option value="center">居中</option>
                <option value="top">顶部居中</option>
                <option value="bottom">底部居中</option>
                <option value="left">左侧居中</option>
                <option value="right">右侧居中</option>
                <option value="top-left">左上角</option>
                <option value="top-right">右上角</option>
                <option value="bottom-left">左下角</option>
                <option value="bottom-right">右下角</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                选择头像在背景中的位置
              </p>
            </div>
            
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={shouldRemoveBackground}
                  onChange={(e) => setShouldRemoveBackground(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium">移除头像背景</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                尝试自动移除头像的背景（适用于简单背景）
              </p>
            </div>
            
            {shouldRemoveBackground && (
              <>
                <div className="mb-4 ml-5">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={enhancedRemoveBackground}
                      onChange={(e) => setEnhancedRemoveBackground(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">增强模式</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    对复杂背景使用更高级的抠图算法
                  </p>
                </div>
                
                <div className="mb-4 ml-5">
                  <label className="block text-sm font-medium mb-1">
                    {enhancedRemoveBackground ? '颜色容差' : '边缘阈值'}: {enhancedRemoveBackground ? removeBackgroundTolerance : removeBackgroundThreshold}
                  </label>
                  <input
                    type="range"
                    min={enhancedRemoveBackground ? 5 : 1}
                    max={enhancedRemoveBackground ? 50 : 20}
                    step={1}
                    value={enhancedRemoveBackground ? removeBackgroundTolerance : removeBackgroundThreshold}
                    onChange={(e) => enhancedRemoveBackground 
                      ? setRemoveBackgroundTolerance(parseInt(e.target.value))
                      : setRemoveBackgroundThreshold(parseInt(e.target.value))
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    {enhancedRemoveBackground 
                      ? '值越高，能包含越多相似颜色；值越低，抠图越精确'
                      : '值越高，保留的边缘越多；值越低，边缘越锐利'}
                  </p>
                </div>
              </>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                头像尺寸比例: {avatarScale}%
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={avatarScale}
                onChange={(e) => setAvatarScale(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                调整头像在背景中的尺寸比例
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                裁剪形状:
              </label>
              <select
                value={cropShape}
                onChange={(e) => setCropShape(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black"
              >
                <option value="circle">圆形</option>
                <option value="square">方形</option>
                <option value="rectangle">矩形</option>
                <option value="none">不裁剪</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                选择头像的裁剪形状
              </p>
            </div>
            
            <button
              onClick={startAvatarComposite}
              disabled={!avatarImageUrl || isAvatarProcessing}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              开始合成处理
            </button>
            
            <div className="mt-4">
              <p className="font-medium">处理状态: <span className={isAvatarProcessing ? "text-blue-600 animate-pulse" : ""}>{avatarStatus}</span></p>
            </div>
            
            {avatarCompositeResult && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">合成结果:</h3>
                <div className="relative w-full aspect-square border border-gray-200 rounded-md overflow-hidden bg-gray-100">
                  <img 
                    src={getFullImageUrl(avatarCompositeResult)} 
                    alt="合成结果"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="mt-2 text-center">
                  <a 
                    href={getFullImageUrl(avatarCompositeResult)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    在新窗口中查看/下载
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 