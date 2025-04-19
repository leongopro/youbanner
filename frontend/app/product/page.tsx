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

// 自定义CSS
const customStyles = `
  .bg-checkered {
    background-image: 
      linear-gradient(45deg, #242645 25%, transparent 25%),
      linear-gradient(-45deg, #242645 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #242645 75%),
      linear-gradient(-45deg, transparent 75%, #242645 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  }
  
  /* 自定义滚动条样式 */
  .custom-scrollbar::-webkit-scrollbar {
    width: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #1e203a;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #4868e1;
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #6282ff;
  }
  
  .smart-input {
    background-color: rgba(38, 40, 78, 0.8);
    border: 1px solid #3d3f66;
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    transition: all 0.3s ease;
  }
  
  .smart-input:focus {
    border-color: #4868e1;
    outline: none;
    box-shadow: 0 0 0 1px rgba(72, 104, 225, 0.2);
  }
  
  .smart-button {
    background-color: #4868e1;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 500;
    transition: all 0.3s ease;
    font-size: 0.95rem;
  }
  
  .smart-button:hover {
    background-color: #5a77e6;
    transform: translateY(-1px);
    box-shadow: 0 2px 5px rgba(72, 104, 225, 0.3);
  }
  
  .smart-card {
    background-color: rgba(30, 32, 58, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    transition: all 0.3s ease;
    border: 1px solid rgba(72, 104, 225, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .smart-card:hover {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
  }
  
  .smart-range {
    -webkit-appearance: none;
    height: 2px;
    background: #3d3f66;
  }
  
  .smart-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: #4868e1;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 0 10px rgba(72, 104, 225, 0.5);
  }
  
  .smart-range::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 0 15px rgba(72, 104, 225, 0.8);
  }
  
  .glow-effect {
    position: relative;
  }
  
  .glow-effect::before {
    content: '';
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 40px;
    background: radial-gradient(ellipse at center, rgba(72, 104, 225, 0.2) 0%, rgba(72, 104, 225, 0) 70%);
    border-radius: 100%;
    pointer-events: none;
  }
  
  .glow-circle {
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: #4868e1;
    filter: blur(8px);
    opacity: 0.4;
  }
  
  .glow-circle.top-left {
    top: 10%;
    left: 5%;
  }
  
  .glow-circle.top-right {
    top: 25%;
    right: 8%;
  }
  
  .glow-circle.bottom-left {
    bottom: 15%;
    left: 12%;
  }
  
  .smart-tab {
    background-color: rgba(38, 40, 78, 0.5);
    color: #8e91c0;
    border-radius: 10px;
    padding: 8px 16px;
    transition: all 0.3s ease;
  }
  
  .smart-tab.active {
    background-color: #4868e1;
    color: white;
  }
`;

export default function ProductPage() {
  // 移除背景相关状态
  const [removeBgImage, setRemoveBgImage] = useState<string | null>(null);
  const [removeBgResult, setRemoveBgResult] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState<boolean>(false);
  const [removeBgStatus, setRemoveBgStatus] = useState<string>('');
  const removeBgInputRef = useRef<HTMLInputElement>(null);
  const [outputFormat, setOutputFormat] = useState<string>('png');
  const [selectedFileName, setSelectedFileName] = useState<string>(''); // 添加文件名状态

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
  const [isResizing, setIsResizing] = useState(false); // 添加调整大小状态
  const [resizeDirection, setResizeDirection] = useState(''); // 调整方向: tl, tr, bl, br, t, r, b, l
  const [aspectRatio, setAspectRatio] = useState(1); // 宽高比
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true); // 是否保持宽高比
  
  // 添加文字相关状态
  const [textContent, setTextContent] = useState(''); // 文字内容
  const [textColor, setTextColor] = useState('#ffffff'); // 文字颜色
  const [textSize, setTextSize] = useState(24); // 文字大小
  const [textPosition, setTextPosition] = useState({ x: 50, y: 85 }); // 文字位置（百分比）
  const [textBgColor, setTextBgColor] = useState('rgba(0,0,0,0.5)'); // 文字背景色
  const [showTextBg, setShowTextBg] = useState(true); // 是否显示文字背景
  const [textPadding, setTextPadding] = useState(8); // 文字内边距
  const [isEditingText, setIsEditingText] = useState(false); // 是否在编辑文字位置
  const [fontWeight, setFontWeight] = useState('normal'); // 字体粗细
  const [fontFamily, setFontFamily] = useState('Arial'); // 字体类型
  
  // 调试日志 - 监控条件变量变化
  useEffect(() => {
    console.log('状态变化:', {
      aiGeneratedBackground: !!aiGeneratedBackground,
      removeBgImage: !!removeBgImage,
      removeBgResult: !!removeBgResult,
      shouldRemoveBackground,
      条件满足: !!(aiGeneratedBackground && (shouldRemoveBackground ? removeBgResult : removeBgImage))
    });
  }, [aiGeneratedBackground, removeBgImage, removeBgResult, shouldRemoveBackground]);
  
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
      setSelectedFileName(file.name); // 保存选择的文件名
      
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
          console.log('图片上传成功，设置removeBgImage:', data.imageUrl);
        } else if (data.fileUrl) {
          setRemoveBgImage(data.fileUrl);
          console.log('图片上传成功，设置removeBgImage:', data.fileUrl);
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
      
      console.log('调用移除背景API，参数:', params);
      
      const response = await removeBackground(params);
      
      if (response.error) {
        setRemoveBgStatus(`移除背景错误: ${response.error}`);
        setIsRemovingBg(false);
        return;
      }
      
      if (response.data && response.data.imageUrl) {
        setRemoveBgResult(response.data.imageUrl);
        console.log('背景移除成功，结果URL:', response.data.imageUrl);
        setRemoveBgStatus('背景移除完成');
        
        // 背景移除成功后重置为100%缩放
        if (originalSize.width > 0 && originalSize.height > 0) {
          const newWidth = originalSize.width;
          const newHeight = originalSize.height;
          setLogoSize({ width: newWidth, height: newHeight });
          setLogoScale(100);
          console.log('背景移除后重置缩放为100%');
        }
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
      console.log('调用生成背景API，提示词:', aiBackgroundPrompt);
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
        const jobId = response.data.jobId || response.data.id || '';
        setAiBackgroundJobId(jobId);
        console.log('生成背景任务已创建，任务ID:', jobId);
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
  
  // 处理图像加载，获取原始尺寸
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    setOriginalSize({
      width,
      height
    });
    // 初始化大小为原始尺寸的100%
    const newWidth = width;
    const newHeight = height;
    setLogoSize({ width: newWidth, height: newHeight });
    setLogoScale(100);
    setAspectRatio(width / height);
    console.log('图像加载完成，原始尺寸:', { width, height, 宽高比: width / height });
  };
  
  // 拖动处理函数
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
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
  
  // 添加调整大小处理函数
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>, direction: string) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发拖拽
    setIsResizing(true);
    setResizeDirection(direction);
    console.log('开始调整大小:', direction);
  };
  
  const handleResizeMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isResizing) return;
    e.stopPropagation(); // 阻止事件冒泡
    
    // 获取容器元素
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    // 计算鼠标位置
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 计算当前图像中心位置
    const centerX = (logoPosition.x / 100) * rect.width;
    const centerY = (logoPosition.y / 100) * rect.height;
    
    // 根据调整方向计算新的宽度和高度
    let newWidth = logoSize.width;
    let newHeight = logoSize.height;
    
    // 计算鼠标与中心的距离
    const deltaX = Math.abs(mouseX - centerX) * 2;
    const deltaY = Math.abs(mouseY - centerY) * 2;
    
    // 根据方向进行调整
    switch (resizeDirection) {
      // 角落调整
      case 'tl': // 左上角
      case 'tr': // 右上角
      case 'bl': // 左下角
      case 'br': // 右下角
        // 根据鼠标位置计算新尺寸
        newWidth = deltaX;
        newHeight = maintainAspectRatio ? deltaX / aspectRatio : deltaY;
        break;
      
      // 边缘调整
      case 't': // 上边
      case 'b': // 下边
        newHeight = deltaY;
        newWidth = maintainAspectRatio ? deltaY * aspectRatio : newWidth;
        break;
      
      case 'l': // 左边
      case 'r': // 右边
        newWidth = deltaX;
        newHeight = maintainAspectRatio ? deltaX / aspectRatio : newHeight;
        break;
    }
    
    // 确保最小尺寸
    newWidth = Math.max(newWidth, 20);
    newHeight = Math.max(newHeight, 20);
    
    // 更新大小和比例
    setLogoSize({ width: newWidth, height: newHeight });
    
    // 计算新的缩放比例
    const scalePercentage = (newWidth / originalSize.width) * 100;
    setLogoScale(Math.round(scalePercentage));
    
    console.log('调整大小中:', { 
      方向: resizeDirection, 
      新宽度: newWidth, 
      新高度: newHeight, 
      新缩放比例: scalePercentage 
    });
  };
  
  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeDirection('');
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
      console.log('缩放调整:', { 比例: scale, 新宽度: newWidth, 新高度: newHeight });
    }
  };
  
  // 添加缩放增减函数
  const adjustScale = (amount: number) => {
    const newScale = Math.min(Math.max(logoScale + amount, 10), 400); // 限制缩放范围在10%-400%
    setLogoScale(newScale);
    
    if (originalSize.width > 0 && originalSize.height > 0) {
      const newWidth = (originalSize.width * newScale) / 100;
      const newHeight = (originalSize.height * newScale) / 100;
      setLogoSize({ width: newWidth, height: newHeight });
      console.log('精细缩放调整:', { 比例: newScale, 新宽度: newWidth, 新高度: newHeight });
    }
  };
  
  // 处理文字拖动
  const handleTextDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsEditingText(true);
  };
  
  const handleTextDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditingText) return;
    e.stopPropagation();
    
    // 获取容器元素
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    // 计算鼠标位置相对于容器的百分比
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // 限制在容器内
    const boundedX = Math.min(Math.max(x, 0), 100);
    const boundedY = Math.min(Math.max(y, 0), 100);
    
    setTextPosition({ x: boundedX, y: boundedY });
  };
  
  const handleTextDragEnd = () => {
    setIsEditingText(false);
  };
  
  // 切换文字粗细
  const toggleFontWeight = () => {
    setFontWeight(fontWeight === 'normal' ? 'bold' : 'normal');
  };
  
  // 合成图像函数
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
              font-family: Arial, sans-serif;
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
            .text-overlay {
              position: absolute;
              top: ${textPosition.y}%;
              left: ${textPosition.x}%;
              transform: translate(-50%, -50%);
              color: ${textColor};
              font-size: ${textSize}px;
              font-weight: ${fontWeight};
              font-family: ${fontFamily}, sans-serif;
              text-align: center;
              z-index: 3;
              ${showTextBg ? `background-color: ${textBgColor};` : ''}
              padding: ${showTextBg ? textPadding + 'px' : '0'};
              border-radius: 4px;
              max-width: 80%;
              word-wrap: break-word;
              white-space: pre-wrap;
              line-height: 1.4;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <img class="background" src="${getFullImageUrl(aiGeneratedBackground)}" alt="背景" />
            <img class="foreground" src="${getFullImageUrl(foregroundImage)}" alt="前景" />
            ${textContent ? `<div class="text-overlay">${textContent}</div>` : ''}
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
    if (relativeUrl.startsWith('blob:')) return relativeUrl;
    if (relativeUrl.startsWith('data:')) return relativeUrl;
    
    // 输出日志以便调试
    console.log('处理相对URL:', relativeUrl);
    const fullUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}${relativeUrl}`;
    console.log('生成完整URL:', fullUrl);
    return fullUrl;
  };
  
  // 辅助函数：将十六进制颜色转换为RGB
  const hexToRgb = (hex: string): {r: number, g: number, b: number} | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  return (
    <div className="bg-[#1a1b36] text-white min-h-screen relative overflow-hidden">
      {/* 添加自定义样式 */}
      <style jsx global>{customStyles}</style>
      
      {/* 背景装饰元素 */}
      <div className="glow-circle top-left"></div>
      <div className="glow-circle top-right"></div>
      <div className="glow-circle bottom-left"></div>
      <div className="absolute top-[20%] right-[15%] w-32 h-32 rounded-full bg-[#4868e1] opacity-5 blur-3xl"></div>
      <div className="absolute bottom-[10%] left-[20%] w-64 h-64 rounded-full bg-[#4868e1] opacity-5 blur-3xl"></div>
      
      {/* 极简风格头部 */}
      <section className="w-full flex flex-col justify-center items-center px-6 py-20">
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-center">
          AI背景合成
        </h1>
        <p className="mt-4 text-[#8e91c0] max-w-xl text-center">
          简洁而不简单的图像合成工具
        </p>
      </section>
      
      <div className="max-w-screen-xl mx-auto px-4 pb-24 space-y-12">
        <div className="flex flex-col md:flex-row gap-8">
          {/* 左侧控制区域 */}
          <div className="w-full md:w-1/5 space-y-4">
            {/* 第一部分：AI背景生成 */}
            <div className="smart-card p-4 space-y-3 glow-effect">
              <h2 className="text-lg font-medium">第1步：AI背景生成</h2>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-[#8e91c0]">输入背景描述：</label>
                  <textarea
                    value={aiBackgroundPrompt}
                    onChange={(e) => setAiBackgroundPrompt(e.target.value)}
                    className="smart-input w-full h-20 text-sm py-2 px-3"
                    placeholder="输入详细的背景描述，越具体效果越好"
                    rows={2}
                  ></textarea>
                </div>
                
                <button
                  className="smart-button w-[80%] mx-auto block py-1 px-1.5 text-[15px]"
                  onClick={generateAiBackground}
                  disabled={!aiBackgroundPrompt || isGeneratingAiBackground}
                >
                  {isGeneratingAiBackground ? '生成中...' : '生成背景'}
                </button>
                
                {isGeneratingAiBackground && (
                  <p className="text-xs animate-pulse text-[#4868e1]">{aiBackgroundStatus || '生成中...'}</p>
                )}
              </div>
            </div>
            
            {/* 第二部分：上传LOGO或头像 */}
            <div className="smart-card p-4 space-y-3">
              <h2 className="text-lg font-medium">第2步：上传LOGO或头像</h2>
              
              <div className="space-y-3">
                <input
                  type="file"
                  ref={removeBgInputRef}
                  onChange={handleRemoveBgUpload}
                  className="hidden"
                  accept="image/*"
                />
                
                <div className="space-y-2">
                  <button 
                    className="smart-button w-[80%] mx-auto block py-1 px-1.5 text-[15px]"
                    onClick={() => removeBgInputRef.current?.click()}
                  >
                    选择图片
                  </button>
                </div>
                
                {/* 背景移除切换选项 */}
                {removeBgImage && (
                  <div className="mt-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shouldRemoveBackground}
                        onChange={(e) => setShouldRemoveBackground(e.target.checked)}
                        className="form-checkbox h-3 w-3 rounded-full bg-[#1a1b36] border-[#3d3f66] text-[#4868e1]"
                      />
                      <span className="text-xs">移除背景</span>
                      
                      <span className="text-xs font-medium text-[#4868e1]">文件名：</span>
                      
                      {/* 显示文件名 */}
                      {selectedFileName && (
                        <span className="text-[10px] text-[#8e91c0] truncate max-w-[70px]">
                          {selectedFileName}
                        </span>
                      )}
                    </label>
                    
                    {shouldRemoveBackground && (
                      <div className="mt-2">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs text-[#8e91c0]">输出格式:</span>
                          <select
                            value={outputFormat}
                            onChange={(e) => setOutputFormat(e.target.value)}
                            className="smart-input text-xs py-1 px-2"
                          >
                            <option value="png">PNG</option>
                            <option value="webp">WebP</option>
                          </select>
                        </div>
                        
                        <button 
                          className="smart-button w-[80%] mx-auto block py-1 px-1.5 text-[15px]"
                          onClick={startRemoveBackground}
                          disabled={!removeBgImage || isRemovingBg}
                        >
                          {isRemovingBg ? '处理中...' : '生成头像或logo'}
                        </button>
                        
                        {isRemovingBg && (
                          <p className="text-xs animate-pulse text-[#4868e1] mt-1">{removeBgStatus || '处理中...'}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* 第三部分：添加文字 */}
            <div className="smart-card p-4 space-y-3">
              <h2 className="text-lg font-medium">第3步：添加文字</h2>
              
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-[#8e91c0]">输入文字内容：</label>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="smart-input w-full text-sm py-2 px-3"
                    placeholder="在此输入显示的文字内容"
                    rows={1}
                  ></textarea>
                </div>
                
                {/* 文字样式选项 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-[#8e91c0]">文字颜色:</label>
                    <input 
                      type="color" 
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-5 h-5 rounded-full overflow-hidden border-0 cursor-pointer bg-transparent"
                    />
                  </div>
                  
                  {/* 添加字体选择 */}
                  <div className="space-y-1">
                    <label className="text-xs text-[#8e91c0]">字体选择:</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="smart-input text-xs w-full py-1 px-2"
                    >
                      <option value="Arial">Arial</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Impact">Impact</option>
                      <option value="Comic Sans MS">Comic Sans MS</option>
                      <option value="宋体">宋体</option>
                      <option value="黑体">黑体</option>
                      <option value="微软雅黑">微软雅黑</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-[#8e91c0]">文字大小: {textSize}px</label>
                    <input
                      type="range"
                      min="12"
                      max="72"
                      step="1"
                      value={textSize}
                      onChange={(e) => setTextSize(parseInt(e.target.value))}
                      className="smart-range w-full"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-[#8e91c0]">文字粗细:</label>
                    <button
                      onClick={toggleFontWeight}
                      className={`px-1 py-0.5 rounded-sm text-[15px] transition ${
                        fontWeight === 'bold' 
                          ? 'bg-[#4868e1] text-white' 
                          : 'bg-[#26284e] text-white'
                      }`}
                    >
                      加粗
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTextBg}
                        onChange={(e) => setShowTextBg(e.target.checked)}
                        className="form-checkbox h-3 w-3 rounded-full bg-[#1a1b36] border-[#3d3f66] text-[#4868e1]"
                      />
                      <span className="text-xs">显示文字背景</span>
                    </label>
                    
                    {showTextBg && (
                      <div className="flex items-center ml-1">
                        <input 
                          type="color" 
                          value={textBgColor.startsWith('rgba') ? '#000000' : textBgColor}
                          onChange={(e) => {
                            // 保持透明度
                            const rgb = hexToRgb(e.target.value);
                            if (rgb) {
                              setTextBgColor(`rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`);
                            }
                          }}
                          className="w-5 h-5 rounded-full overflow-hidden border-0 cursor-pointer bg-transparent"
                        />
                      </div>
                    )}
                  </div>
                  
                  {showTextBg && (
                    <div className="space-y-1">
                      <label className="text-xs text-[#8e91c0]">内边距: {textPadding}px</label>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        step="1"
                        value={textPadding}
                        onChange={(e) => setTextPadding(parseInt(e.target.value))}
                        className="smart-range w-full"
                        disabled={!showTextBg}
                      />
                    </div>
                  )}
                </div>
                
                <p className="text-[10px] text-[#8e91c0] italic text-right mt-1">
                  在预览区域可以拖动文字调整位置
                </p>
              </div>
            </div>
          </div>
          
          {/* 右侧预览和结果区域 */}
          <div className="w-full md:w-4/5 space-y-6">
            {/* 初始预览提示 - 当没有渲染好的结果时显示 */}
            {(!aiGeneratedBackground || !(shouldRemoveBackground ? removeBgResult : removeBgImage) || isGeneratingAiBackground || isRemovingBg) && !compositeResult && (
              <div className="smart-card h-[500px] flex items-center justify-center">
                <div className="text-center p-8 max-w-md">
                  <div className="w-20 h-20 bg-[#26284e] rounded-full flex items-center justify-center mx-auto mb-6 relative">
                    <div className="absolute inset-0 rounded-full bg-[#4868e1] opacity-20 blur-md"></div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#4868e1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-medium mb-2">预览区域</h3>
                  
                  {/* 显示处理状态 */}
                  {(isGeneratingAiBackground || isRemovingBg) ? (
                    <div className="mb-6">
                      <p className="text-[#4868e1] animate-pulse mb-2">
                        {isGeneratingAiBackground ? aiBackgroundStatus || '正在生成背景...' : removeBgStatus || '正在处理图片...'}
                      </p>
                      <div className="w-full h-1.5 bg-[#26284e] rounded-full overflow-hidden">
                        <div className="h-full bg-[#4868e1] animate-pulse rounded-full" style={{width: '100%', animationDuration: '1.5s'}}></div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[#8e91c0] mb-8">完成左侧的步骤后，您的作品将在此处显示</p>
                  )}
                  
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center text-sm">
                      <span className={`w-7 h-7 ${isGeneratingAiBackground ? 'bg-[#5a77e6] animate-pulse' : 'bg-[#4868e1]'} text-white rounded-full flex items-center justify-center mr-4 text-xs`}>1</span>
                      <span>生成AI背景</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className={`w-7 h-7 ${isRemovingBg ? 'bg-[#5a77e6] animate-pulse' : 'bg-[#4868e1]'} text-white rounded-full flex items-center justify-center mr-4 text-xs`}>2</span>
                      <span>上传LOGO或头像</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="w-7 h-7 bg-[#4868e1] text-white rounded-full flex items-center justify-center mr-4 text-xs">3</span>
                      <span>添加文字（可选）</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 实时预览和调整控制 - 只有在两个图像都加载完成且没有处理中状态时才显示 */}
            {aiGeneratedBackground && (shouldRemoveBackground ? removeBgResult : removeBgImage) && !isGeneratingAiBackground && !isRemovingBg && (
              <div className="smart-card overflow-hidden">
                <div className="p-6 space-y-6">
                  <h2 className="text-xl font-medium">实时预览和调整</h2>
                  
                  <div className="relative bg-checkered w-full h-[500px] overflow-hidden rounded-xl">
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
                      onMouseMove={(e) => {
                        if (isDragging) {
                          handleDragMove(e);
                        } else if (isResizing) {
                          handleResizeMove(e);
                        } else if (isEditingText) {
                          handleTextDragMove(e);
                        }
                      }}
                      onMouseUp={() => {
                        handleDragEnd();
                        handleResizeEnd();
                        handleTextDragEnd();
                      }}
                      onMouseLeave={() => {
                        handleDragEnd();
                        handleResizeEnd();
                        handleTextDragEnd();
                      }}
                    >
                      {/* LOGO/头像 */}
                      <div
                        style={{
                          position: 'absolute',
                          top: `${logoPosition.y}%`,
                          left: `${logoPosition.x}%`,
                          transform: 'translate(-50%, -50%)',
                          width: `${logoSize.width}px`,
                          height: 'auto',
                          zIndex: 10
                        }}
                      >
                        <img 
                          src={getFullImageUrl(shouldRemoveBackground ? removeBgResult : removeBgImage)}
                          alt="可拖动的LOGO/头像"
                          style={{
                            width: '100%',
                            height: 'auto',
                            cursor: isDragging ? 'grabbing' : 'grab',
                            transition: isDragging || isResizing ? 'none' : 'width 0.1s ease-out, height 0.1s ease-out'
                          }}
                          onLoad={(e) => console.log('预览区域头像图片加载')}
                          onError={(e) => console.error('预览区域头像图片加载失败', e)}
                        />
                        
                        {/* 调整框 */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            border: '1px solid rgba(72, 104, 225, 0.7)',
                            pointerEvents: 'none',
                            boxSizing: 'border-box',
                            boxShadow: '0 0 0 1px rgba(72, 104, 225, 0.2)'
                          }}
                        ></div>
                        
                        {/* 四个角的调整点 */}
                        {/* 左上角 */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            left: '-6px',
                            width: '12px',
                            height: '12px',
                            backgroundColor: '#26284e',
                            border: '1px solid #4868e1',
                            borderRadius: '50%',
                            cursor: 'nwse-resize',
                            zIndex: 11,
                            boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                          }}
                          onMouseDown={(e) => handleResizeStart(e, 'tl')}
                        ></div>
                        
                        {/* 右上角 */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            width: '12px',
                            height: '12px',
                            backgroundColor: '#26284e',
                            border: '1px solid #4868e1',
                            borderRadius: '50%',
                            cursor: 'nesw-resize',
                            zIndex: 11,
                            boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                          }}
                          onMouseDown={(e) => handleResizeStart(e, 'tr')}
                        ></div>
                        
                        {/* 左下角 */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '-6px',
                            left: '-6px',
                            width: '12px',
                            height: '12px',
                            backgroundColor: '#26284e',
                            border: '1px solid #4868e1',
                            borderRadius: '50%',
                            cursor: 'nesw-resize',
                            zIndex: 11,
                            boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                          }}
                          onMouseDown={(e) => handleResizeStart(e, 'bl')}
                        ></div>
                        
                        {/* 右下角 */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '-6px',
                            right: '-6px',
                            width: '12px',
                            height: '12px',
                            backgroundColor: '#26284e',
                            border: '1px solid #4868e1',
                            borderRadius: '50%',
                            cursor: 'nwse-resize',
                            zIndex: 11,
                            boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                          }}
                          onMouseDown={(e) => handleResizeStart(e, 'br')}
                        ></div>
                      </div>
                      
                      {/* 可拖动的文字 */}
                      {textContent && (
                        <div
                          style={{
                            position: 'absolute',
                            top: `${textPosition.y}%`,
                            left: `${textPosition.x}%`,
                            transform: 'translate(-50%, -50%)',
                            color: textColor,
                            fontSize: `${textSize}px`,
                            fontWeight: fontWeight,
                            fontFamily: `${fontFamily}, sans-serif`,
                            textAlign: 'center',
                            zIndex: 20,
                            backgroundColor: showTextBg ? textBgColor : 'transparent',
                            padding: showTextBg ? `${textPadding}px` : '0',
                            borderRadius: '8px',
                            maxWidth: '80%',
                            cursor: isEditingText ? 'grabbing' : 'grab',
                            border: isEditingText ? '1px dashed rgba(72, 104, 225, 0.8)' : 'none',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.4,
                            textShadow: isEditingText ? '0 0 5px rgba(72, 104, 225, 0.5)' : 'none'
                          }}
                          onMouseDown={handleTextDragStart}
                          onMouseUp={handleTextDragEnd}
                        >
                          {textContent}
                        </div>
                      )}
                      
                      {/* 添加提示信息 */}
                      <div 
                        className="absolute top-2 right-2 bg-[#1a1b36] bg-opacity-90 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-none"
                        style={{ opacity: isDragging ? 1 : 0, transition: 'opacity 0.2s', boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)' }}
                      >
                        拖动中: ({Math.round(logoPosition.x)}%, {Math.round(logoPosition.y)}%)
                      </div>
                    </div>
                  </div>
                  
                  {/* 调整大小控制 */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="block font-medium">
                        缩放比例: <span className="text-[#4868e1]">{logoScale}%</span>
                      </label>
                    </div>
                    
                    {/* 保持宽高比选项 */}
                    <div>
                      <label className="flex items-center space-x-2 text-sm cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={maintainAspectRatio} 
                          onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                          className="form-checkbox h-4 w-4 rounded-full bg-[#1a1b36] border-[#3d3f66] text-[#4868e1]"
                        />
                        <span>保持宽高比例 ({aspectRatio.toFixed(2)})</span>
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <button 
                        className="p-1 bg-[#26284e] text-white rounded-sm hover:bg-[#323565] transition"
                        onClick={() => adjustScale(-10)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      
                      <input
                        type="range"
                        min="10"
                        max="400"
                        step="5"
                        value={logoScale}
                        onChange={handleScaleChange}
                        className="smart-range w-full"
                      />
                      
                      <button 
                        className="p-1 bg-[#26284e] text-white rounded-sm hover:bg-[#323565] transition"
                        onClick={() => adjustScale(10)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* 合成按钮 */}
                  <div>
                    <button 
                      className="smart-button w-auto mx-auto block py-0.5 px-10 text-[15px] relative overflow-hidden group"
                      onClick={compositeImage}
                    >
                      <span className="relative z-10">合成图像</span>
                      <div className="absolute inset-0 bg-[#5a77e6] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                    </button>
                    <p className="text-xs text-[#8e91c0] mt-2 text-center">
                      将按照设置合成最终图像
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 合成预览结果 */}
            {compositeResult && (
              <div className="smart-card">
                <div className="p-6 space-y-6">
                  <h2 className="text-xl font-medium flex items-center">
                    <span className="bg-[#203045] text-[#4acfff] px-2 py-1 rounded-full text-xs mr-2">完成</span>
                    合成结果
                  </h2>
                  <div className="rounded-xl overflow-hidden bg-[#1e203a]">
                    <iframe 
                      src={compositeResult} 
                      className="w-full h-[500px] border-none"
                      title="合成预览"
                    ></iframe>
                  </div>
                  <div className="flex space-x-3">
                    <a
                      href={compositeResult}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1 px-1.5 text-[15px] bg-[#26284e] text-white text-center rounded-sm hover:bg-[#323565] transition"
                    >
                      在新窗口中打开
                    </a>
                    <a
                      href={compositeResult}
                      download="ai-composed-image.html"
                      className="smart-button flex-1 py-1 text-[15px]"
                    >
                      下载合成结果
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <footer className="border-t border-[#26284e] mt-12 py-8 text-center text-sm text-[#8e91c0]">
        <div className="max-w-md mx-auto">
          <p>© 2023 AI背景合成工具</p>
        </div>
      </footer>
    </div>
  );
} 