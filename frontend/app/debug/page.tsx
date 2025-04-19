'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  uploadImage, 
  removeBackground,
  type RemoveBackgroundParams,
  generateBackgroundImage,
  checkBackgroundStatus,
  type BackgroundStatusResponse
} from '@/lib/api';

// 补充BackgroundStatusResponse类型定义
type EnhancedBackgroundStatusResponse = BackgroundStatusResponse & {
  imageUrl?: string; // 可能存在的额外属性
  message?: string;  // 处理阶段消息
  progress?: string; // 进度信息
};

// 本地定义上传响应类型
interface UploadResponseData {
  success?: boolean;
  fileUrl?: string;
  imageUrl?: string; // 有些API返回imageUrl而不是fileUrl
}

// 在组件顶部添加一些自定义CSS（如果没有全局样式）
const customStyles = `
  .bg-checkered {
    background-image: 
      linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
      linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  }
  
  /* 自定义滚动条样式 */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
`;

export default function DebugPage() {
  // 移除背景相关状态
  const [removeBgImage, setRemoveBgImage] = useState<string | null>(null);
  const [removeBgResult, setRemoveBgResult] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState<boolean>(false);
  const [removeBgStatus, setRemoveBgStatus] = useState<string>('');
  const removeBgInputRef = useRef<HTMLInputElement>(null);
  const [outputFormat, setOutputFormat] = useState<string>('png');

  // AI背景生成相关状态
  const [aiBackgroundPrompt, setAiBackgroundPrompt] = useState<string>('');
  const [aiGeneratedBackground, setAiGeneratedBackground] = useState<string | null>(null);
  const [isGeneratingAiBackground, setIsGeneratingAiBackground] = useState<boolean>(false);
  const [aiBackgroundStatus, setAiBackgroundStatus] = useState<string>('');
  const [aiBackgroundJobId, setAiBackgroundJobId] = useState<string | null>(null);
  const [compositeResult, setCompositeResult] = useState<string | null>(null);
  
  // 添加是否移除背景的切换状态
  const [shouldRemoveBackground, setShouldRemoveBackground] = useState<boolean>(true);
  
  // 添加位置和大小调整相关状态
  const [logoPosition, setLogoPosition] = useState({ x: 50, y: 50 }); // 位置（百分比）
  const [logoSize, setLogoSize] = useState({ width: 200, height: 200 }); // 大小（像素）
  const [isDragging, setIsDragging] = useState(false);
  const [originalSize, setOriginalSize] = useState({ width: 200, height: 200 }); // 原始尺寸
  const [logoScale, setLogoScale] = useState(100); // 缩放比例（百分比）
  
  // 监控AI背景生成状态
  useEffect(() => {
    if (!aiBackgroundJobId || !isGeneratingAiBackground) return;
    
    const checkInterval = setInterval(async () => {
      try {
        const response = await checkBackgroundStatus(aiBackgroundJobId);
        
        if (response.error) {
          setAiBackgroundStatus(`检查状态错误: ${response.error}`);
          setIsGeneratingAiBackground(false);
          clearInterval(checkInterval);
          return;
        }
        
        // 检查是否完成
        if (response.data?.status === 'completed') {
          let resultUrl = null;
          
          if (response.data.result?.imageUrl) {
            resultUrl = response.data.result.imageUrl;
          } else if (typeof response.data.result === 'string') {
            resultUrl = response.data.result;
          } else if (response.data.hasOwnProperty('imageUrl')) {
            resultUrl = (response.data as any).imageUrl;
          }
          
          if (resultUrl) {
            setAiGeneratedBackground(resultUrl);
            setAiBackgroundStatus('背景生成完成');
          } else {
            setAiBackgroundStatus('背景生成完成但找不到图像URL');
          }
          
          setIsGeneratingAiBackground(false);
          clearInterval(checkInterval);
        } else if (response.data?.status === 'failed') {
          setAiBackgroundStatus(`处理失败: ${response.data.error || '未知错误'}`);
          setIsGeneratingAiBackground(false);
          clearInterval(checkInterval);
        } else {
          // 更新处理状态
          const enhancedData = response.data as EnhancedBackgroundStatusResponse;
          let statusMessage = enhancedData?.message || enhancedData?.status || '等待中';
          setAiBackgroundStatus(statusMessage);
        }
      } catch (error) {
        console.error('检查背景生成状态时出错:', error);
        setAiBackgroundStatus('检查状态时出错');
      }
    }, 2000);
    
    return () => clearInterval(checkInterval);
  }, [aiBackgroundJobId, isGeneratingAiBackground]);
  
  // 上传图片处理函数
  const handleRemoveBgUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    try {
      const file = event.target.files[0];
      
      // 上传图片
      const uploadResponse = await uploadImage(file);
      
      if (uploadResponse.error) {
        alert(`上传图片错误: ${uploadResponse.error}`);
          return;
        }
        
      // 处理响应中的图像URL
      if (uploadResponse.data) {
        const data = uploadResponse.data as UploadResponseData;
        if (data.imageUrl) {
          setRemoveBgImage(data.imageUrl);
        } else if (data.fileUrl) {
          setRemoveBgImage(data.fileUrl);
          } else {
          console.error('上传响应没有包含imageUrl或fileUrl:', uploadResponse);
          alert('上传成功但没有返回图像URL');
          }
        } else {
        alert('上传响应没有数据');
        }
      } catch (error) {
      console.error('上传图片时出错:', error);
      alert('上传图片时发生错误，请查看控制台了解详情');
    }
  };
  
  // 移除背景处理函数
  const startRemoveBackground = async () => {
    if (!removeBgImage) return;
    
    try {
      setIsRemovingBg(true);
      setRemoveBgStatus('正在移除背景...');
      
      // 调用移除背景API
      const params: RemoveBackgroundParams = {
        image: removeBgImage,
        outputFormat
      };
      
      const response = await removeBackground(params);
      
      if (response.error) {
        setRemoveBgStatus(`移除背景错误: ${response.error}`);
        setIsRemovingBg(false);
        return;
      }
      
      if (response.data && response.data.imageUrl) {
        setRemoveBgResult(response.data.imageUrl);
        setRemoveBgStatus('背景移除完成');
      } else {
        console.error('移除背景响应没有包含imageUrl:', response);
        setRemoveBgStatus('移除背景完成但没有返回图像URL');
      }
    } catch (error) {
      console.error('移除背景时出错:', error);
      setRemoveBgStatus('移除背景时发生错误');
    } finally {
      setIsRemovingBg(false);
    }
  };
  
  // 生成AI背景函数
  const generateAiBackground = async () => {
    if (!aiBackgroundPrompt) return;
    
    try {
      setIsGeneratingAiBackground(true);
      setAiBackgroundStatus('开始生成背景...');
      setAiGeneratedBackground(null);
      
      // 调用生成背景API
      const response = await generateBackgroundImage({
        prompt: aiBackgroundPrompt
      });
      
      if (response.error) {
        setAiBackgroundStatus(`生成背景错误: ${response.error}`);
        setIsGeneratingAiBackground(false);
        return;
      }
      
      // 处理响应中的任务ID
      if (response.data && (response.data.jobId || response.data.id)) {
        setAiBackgroundJobId(response.data.jobId || response.data.id || '');
        setAiBackgroundStatus('正在生成背景...');
    } else {
        console.error('生成背景响应没有包含jobId:', response);
        setAiBackgroundStatus('生成背景响应格式错误');
        setIsGeneratingAiBackground(false);
      }
    } catch (error) {
      console.error('生成背景时出错:', error);
      setAiBackgroundStatus('生成背景时发生错误');
      setIsGeneratingAiBackground(false);
    }
  };
  
  // 合成图像函数 - 将移除背景的图像与AI背景合成
  const compositeImage = () => {
    // 检查是否有必要的图像
    const foregroundImage = shouldRemoveBackground ? removeBgResult : removeBgImage;
    
    if (!foregroundImage || !aiGeneratedBackground) {
      alert('需要同时有前景图片和AI生成背景才能合成');
        return;
      }
    
    try {
      setAiBackgroundStatus('正在创建合成预览...');
      
      // 创建HTML预览
      const compositeHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>合成图像</title>
          <style>
            body, html {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            .container {
              position: relative;
              width: 100%;
              height: 100%;
            }
            .background {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              z-index: 1;
            }
            .foreground {
              position: absolute;
              top: ${logoPosition.y}%;
              left: ${logoPosition.x}%;
              transform: translate(-50%, -50%);
              width: ${logoSize.width}px;
              height: auto;
              z-index: 2;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <img class="background" src="${getFullImageUrl(aiGeneratedBackground)}" alt="背景" />
            <img class="foreground" src="${getFullImageUrl(foregroundImage)}" alt="前景" />
          </div>
        </body>
        </html>
      `;
      
      // 创建Blob并生成URL
      const blob = new Blob([compositeHtml], { type: 'text/html' });
      const compositeUrl = URL.createObjectURL(blob);
      
      setCompositeResult(compositeUrl);
      setAiBackgroundStatus('已创建合成预览');
    } catch (error) {
      console.error('合成图像错误:', error);
      setAiBackgroundStatus('合成图像时出错');
    }
  };
  
  // 辅助函数：获取完整URL
  const getFullImageUrl = (relativeUrl: string | null): string => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;
    
    return `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}${relativeUrl}`;
  };

  // 处理图像加载，获取原始尺寸
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setOriginalSize({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    // 初始化大小为原始尺寸的50%
    const newWidth = img.naturalWidth * 0.5;
    const newHeight = img.naturalHeight * 0.5;
    setLogoSize({ width: newWidth, height: newHeight });
    setLogoScale(50);
  };
  
  // 拖动处理函数
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
  };
  
  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    // 获取容器元素
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    // 计算鼠标位置相对于容器的百分比
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // 限制在容器内
    const boundedX = Math.min(Math.max(x, 0), 100);
    const boundedY = Math.min(Math.max(y, 0), 100);
    
    setLogoPosition({ x: boundedX, y: boundedY });
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
  };
  
  // 缩放处理函数
  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const scale = parseInt(e.target.value);
    setLogoScale(scale);
    
    // 根据缩放比例更新大小
    if (originalSize.width > 0 && originalSize.height > 0) {
      const newWidth = (originalSize.width * scale) / 100;
      const newHeight = (originalSize.height * scale) / 100;
      setLogoSize({ width: newWidth, height: newHeight });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* 添加自定义样式 */}
      <style jsx global>{customStyles}</style>
      
      <h1 className="text-3xl font-bold mb-6">背景处理调试页面</h1>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* 左侧控制区域 - 1/4宽度 */}
        <div className="w-full md:w-1/4 flex flex-col gap-6">
          {/* 第一部分：AI背景生成 */}
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">第1步：AI背景生成</h2>
            
            <div className="flex flex-col space-y-3">
              <div className="flex flex-col space-y-2">
                <label className="text-xs text-gray-600">输入背景描述（如：星空、海滩、森林等）：</label>
                <textarea
                  value={aiBackgroundPrompt}
                  onChange={(e) => setAiBackgroundPrompt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="输入详细的背景描述，越具体效果越好"
                  rows={3}
                ></textarea>
              </div>
              
            <button
                className="px-4 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 whitespace-nowrap"
                onClick={generateAiBackground}
                disabled={!aiBackgroundPrompt || isGeneratingAiBackground}
            >
                生成背景
            </button>
            
              {isGeneratingAiBackground && (
                <p className="text-purple-500 text-xs animate-pulse">{aiBackgroundStatus || '生成中...'}</p>
              )}
                </div>
              </div>
          
          {/* 第二部分：移除背景 */}
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">第2步：上传LOGO或头像</h2>
            
            <div className="flex flex-col space-y-3">
            <input
              type="file"
                ref={removeBgInputRef}
                onChange={handleRemoveBgUpload}
              className="hidden"
              accept="image/*"
            />
              
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                <button
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    onClick={() => removeBgInputRef.current?.click()}
                >
                    选择图片
                </button>
              </div>
            </div>
            
              {/* 添加背景移除切换选项 */}
              {removeBgImage && (
              <div className="mt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shouldRemoveBackground}
                  onChange={(e) => setShouldRemoveBackground(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-blue-600"
                />
                    <span className="text-xs text-gray-700">移除背景</span>
              </label>
            
            {shouldRemoveBackground && (
                    <div className="mt-2 ml-6">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs">输出格式:</span>
              <select
                          value={outputFormat}
                          onChange={(e) => setOutputFormat(e.target.value)}
                          className="border rounded px-2 py-1 text-xs"
                        >
                          <option value="png">PNG</option>
                          <option value="webp">WebP</option>
              </select>
            </div>
            
            <button
                        className="mt-2 px-4 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 w-full"
                        onClick={startRemoveBackground}
                        disabled={!removeBgImage || isRemovingBg}
                      >
                        移除背景
            </button>
            
                      {isRemovingBg && (
                        <p className="text-blue-500 text-xs animate-pulse mt-1">{removeBgStatus || '处理中...'}</p>
                      )}
            </div>
                  )}
              </div>
            )}
          </div>
        </div>
          
          {/* 第三部分：合成操作 - 移除，因为合成操作已经移到实时预览区域 */}
          {/* 原来的第三步合成部分可以移除，因为已经添加到了实时预览区域 */}
      </div>

        {/* 右侧结果展示区域 - 3/4宽度 */}
        <div className="w-full md:w-3/4 flex flex-col gap-6">
          {/* 固定高度的滚动区域，包含AI背景和原始图片 */}
          <div className="p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3 flex items-center">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs mr-2">预览</span>
              图片库
            </h2>
            <div className="h-[500px] overflow-y-auto pr-2 mb-2 custom-scrollbar">
              {/* AI生成背景结果 */}
              {aiGeneratedBackground && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2 text-gray-700">AI生成的背景</h3>
                  <div className="bg-checkered p-2 rounded">
                    <img 
                      src={getFullImageUrl(aiGeneratedBackground)} 
                      alt="AI生成的背景" 
                      className="w-full max-h-[350px] object-contain rounded"
                  />
                </div>
              </div>
            )}
              
              {/* 上传的LOGO或头像 */}
              {removeBgImage && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-2 text-gray-700">上传的LOGO或头像</h3>
                  <div className="bg-checkered p-2 rounded">
                    <img 
                      src={getFullImageUrl(removeBgImage)} 
                      alt="LOGO或头像" 
                      className="w-full max-h-[350px] object-contain rounded"
                      onLoad={handleImageLoad}
                  />
                </div>
              </div>
            )}
        </div>
      </div>

          {/* 实时预览和调整控制 */}
          {aiGeneratedBackground && (shouldRemoveBackground ? removeBgResult : removeBgImage) && (
            <div className="p-4 bg-white rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md text-xs mr-2">调整</span>
                图像位置和大小
              </h2>
              
              <div className="relative bg-checkered w-full h-[400px] overflow-hidden rounded-md border border-gray-200">
                {/* 背景图 */}
                <img 
                  src={getFullImageUrl(aiGeneratedBackground)} 
                  alt="背景" 
                  className="absolute top-0 left-0 w-full h-full object-cover"
                />
                
                {/* 可拖动的LOGO/头像 */}
                <div 
                  className="relative w-full h-full"
                  onMouseDown={handleDragStart}
                  onMouseMove={handleDragMove}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                >
                  {/* LOGO/头像 */}
                  <img 
                    src={getFullImageUrl(shouldRemoveBackground ? removeBgResult : removeBgImage)}
                    alt="可拖动的LOGO/头像"
                    style={{
                      position: 'absolute',
                      top: `${logoPosition.y}%`,
                      left: `${logoPosition.x}%`,
                      transform: 'translate(-50%, -50%)',
                      width: `${logoSize.width}px`,
                      height: 'auto',
                      cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                  />
                  
                  {/* 辅助线 - 显示移动指示 */}
                  <div 
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '0',
                      width: '100%',
                      height: '1px',
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      pointerEvents: 'none'
                    }}
                  ></div>
                  <div 
                    style={{
                      position: 'absolute',
                      top: '0',
                      left: '50%',
                      width: '1px',
                      height: '100%',
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      pointerEvents: 'none'
                    }}
                  ></div>
          </div>
      </div>

              {/* 调整大小控制 */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  调整大小: {logoScale}%
                </label>
          <input 
                  type="range"
                  min="10"
                  max="200"
                  step="5"
                  value={logoScale}
                  onChange={handleScaleChange}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">
                  向左滑动缩小，向右滑动放大（或直接拖动图像调整位置）
                </p>
        </div>
        
              {/* 合成按钮 */}
              <div className="mt-3">
          <button
                  className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 font-medium"
                  onClick={compositeImage}
                >
                  合成图像
          </button>
                <p className="text-xs text-gray-500 mt-1">
                  将按照上面设置的位置和大小合成图像
                </p>
        </div>
          </div>
        )}
        
          {/* 透明背景的LOGO/头像 - 可以考虑移除或保留 */}
          {removeBgResult && (
            <div className="p-4 bg-white rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs mr-2">结果</span>
                透明背景的LOGO/头像
              </h2>
              <div className="bg-checkered p-2 rounded">
                <img 
                  src={removeBgResult} 
                  alt="透明背景结果" 
                  className="w-full max-h-[350px] object-contain rounded"
            />
          </div>
              <div className="mt-2">
                <a 
                  href={removeBgResult} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 inline-flex items-center"
                >
                  下载结果
                </a>
                </div>
              </div>
            )}
            
          {/* 合成预览结果 - 单独显示 */}
          {compositeResult && (
            <div className="p-4 bg-white rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-3 flex items-center">
                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md text-xs mr-2">合成</span>
                最终效果
              </h2>
              <div className="border rounded-md p-2 bg-white">
                <iframe 
                  src={compositeResult} 
                  className="w-full h-[400px] border-none"
                  title="合成预览"
                ></iframe>
            </div>
              <div className="mt-2">
                <a
                  href={compositeResult}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 inline-block"
                >
                  在新窗口中打开
                </a>
              </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
} 