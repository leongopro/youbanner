'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  uploadImage, 
  removeBackground,
  type RemoveBackgroundParams,
  generateBackgroundImage,
  checkBackgroundStatus,
  type BackgroundStatusResponse,
  generateStableImageDirect
} from '@/lib/api';
import { useRouter } from 'next/navigation';

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
  
  /* 禁用选择和文本高亮 */
  .no-select {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
  
  /* 防止调整大小时出现蓝色高亮 */
  *::selection {
    background-color: transparent;
  }
  
  .resize-handle::selection {
    background-color: transparent !important;
  }
  
  /* 添加呼吸灯动画 */
  @keyframes breatheAnimation {
    0%, 100% {
      opacity: 0.6;
      box-shadow: 0 0 5px rgba(72, 104, 225, 0.3);
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 15px rgba(72, 104, 225, 0.8);
    }
  }
  
  @keyframes pulseAnimation {
    0%, 100% {
      background-color: #4868e1;
      box-shadow: 0 0 5px rgba(72, 104, 225, 0.3);
    }
    50% {
      background-color: #5a77e6;
      box-shadow: 0 0 15px rgba(72, 104, 225, 0.8);
    }
  }
  
  .hover-pulse:hover {
    animation: pulseAnimation 3s infinite ease-in-out;
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
  const router = useRouter();
  
  // 移除背景相关状态
  const [removeBgImage, setRemoveBgImage] = useState<string | null>(null);
  const [removeBgResult, setRemoveBgResult] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState<boolean>(false);
  const [removeBgStatus, setRemoveBgStatus] = useState<string>('');
  const removeBgInputRef = useRef<HTMLInputElement>(null);
  const [outputFormat, setOutputFormat] = useState<string>('png');
  const [selectedFileName, setSelectedFileName] = useState<string>(''); // 添加文件名状态

  // AI背景生成相关状态
  const [aiBackgroundPrompt, setAiBackgroundPrompt] = useState('简约科技YouTube频道背景，深蓝色到紫色渐变，几何图形点缀，高品质4K分辨率，清晰的设计');
  const [negativePrompt, setNegativePrompt] = useState(''); // 添加否定提示词状态
  const [aiGeneratedBackground, setAiGeneratedBackground] = useState<string | null>(null);
  const [aiBackgroundStatus, setAiBackgroundStatus] = useState('');
  const [isGeneratingAiBackground, setIsGeneratingAiBackground] = useState(false);
  const [compositeResult, setCompositeResult] = useState<string | null>(null);
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false); // 添加图片加载状态
  
  // 添加是否移除背景的切换状态
  const [shouldRemoveBackground, setShouldRemoveBackground] = useState<boolean>(false); // 修改默认值为false
  
  // 添加位置和大小调整相关状态
  const [logoPosition, setLogoPosition] = useState({ x: 50, y: 75 }); // 位置（百分比）
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
  const [isResizingText, setIsResizingText] = useState(false); // 是否正在调整文字大小
  const [textResizeDirection, setTextResizeDirection] = useState(''); // 文字调整方向
  const [startTextSize, setStartTextSize] = useState(24); // 开始调整时的文字大小
  const [startTextPosition, setStartTextPosition] = useState({x: 0, y: 0}); // 开始调整时的鼠标位置
  const [textRotation, setTextRotation] = useState(0); // 文字旋转角度
  const [isRotatingText, setIsRotatingText] = useState(false); // 是否正在旋转文字
  const [startRotation, setStartRotation] = useState(0); // 开始旋转时的角度
  const [startRotationMousePos, setStartRotationMousePos] = useState({x: 0, y: 0}); // 开始旋转时的鼠标位置
  
  // 添加Logo旋转相关状态
  const [logoRotation, setLogoRotation] = useState(0); // Logo旋转角度
  const [isRotatingLogo, setIsRotatingLogo] = useState(false); // 是否正在旋转Logo
  const [startLogoRotation, setStartLogoRotation] = useState(0); // 开始旋转Logo时的角度
  const [startLogoRotationMousePos, setStartLogoRotationMousePos] = useState({x: 0, y: 0}); // 开始旋转Logo时的鼠标位置
  
  // 添加Logo大小调整相关状态
  const [isResizingLogo, setIsResizingLogo] = useState(false); // 是否正在调整Logo大小
  const [logoResizeDirection, setLogoResizeDirection] = useState(''); // Logo调整方向
  const [startLogoSize, setStartLogoSize] = useState({width: 150, height: 150}); // 开始调整时的Logo大小，使用数字类型
  const [startLogoResizePos, setStartLogoResizePos] = useState({x: 0, y: 0}); // 开始调整时的鼠标位置
  
  // 添加风格预设状态
  const [stylePreset, setStylePreset] = useState('');
  
  // style preset选项列表
  const stylePresets = [
    { value: 'photographic', label: '真实照片风格' },
    { value: 'digital-art', label: '数字艺术' },
    { value: 'anime', label: '动漫风格' },
    { value: 'cinematic', label: '电影效果' },
    { value: 'comic-book', label: '漫画风格' },
    { value: 'fantasy-art', label: '幻想艺术' },
    { value: 'neon-punk', label: '霓虹朋克' },
    { value: '3d-model', label: '3D模型' },
    { value: 'analog-film', label: '胶片风格' },
    { value: 'isometric', label: '等距视图' },
    { value: 'line-art', label: '线条艺术' },
    { value: 'low-poly', label: '低多边形' },
    { value: 'modeling-compound', label: '粘土风格' },
    { value: 'origami', label: '折纸风格' },
    { value: 'pixel-art', label: '像素艺术' },
    { value: 'tile-texture', label: '瓷砖纹理' }
  ];
  
  // 添加种子值状态
  const [seedValue, setSeedValue] = useState<number>(0);
  const [showSeedOption, setShowSeedOption] = useState<boolean>(false);
  
  // 修改状态监控，合并所有useEffect为一个
  useEffect(() => {
    console.log('状态变化:', {
      aiGeneratedBackground: !!aiGeneratedBackground,
      removeBgImage: !!removeBgImage,
      removeBgResult: !!removeBgResult,
      shouldRemoveBackground,
      isGeneratingAiBackground,
      isRemovingBg,
      条件: {
        showInitialPreview: shouldShowInitialPreview(),
        showBackgroundPreview: shouldShowBackgroundPreview(),
        showFullPreview: shouldShowFullPreview()
      }
    });
  }, [
    aiGeneratedBackground, 
    removeBgImage, 
    removeBgResult, 
    shouldRemoveBackground,
    isGeneratingAiBackground,
    isRemovingBg
  ]);
  
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
          // 不再重置位置到中央
        } else if (data.fileUrl) {
          setRemoveBgImage(data.fileUrl);
          console.log('图片上传成功，设置removeBgImage:', data.fileUrl);
          // 不再重置位置到中央
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
      setRemoveBgStatus('');
      
      // 调用移除背景API
      const params: RemoveBackgroundParams = {
        image: removeBgImage,
        outputFormat
      };
      
      console.log('调用移除背景API，参数:', params);
      
      const response = await removeBackground(params);
      
      if (response.error) {
        setRemoveBgStatus(`头像处理错误: ${response.error}`);
        setIsRemovingBg(false);
        return;
      }
      
      if (response.data && response.data.imageUrl) {
        setRemoveBgResult(response.data.imageUrl);
        console.log('背景移除成功，结果URL:', response.data.imageUrl);
        setRemoveBgStatus('');
        
        // 设置固定的默认大小
        // 保存原始尺寸信息用于缩放
        if (originalSize.width === 0 || originalSize.height === 0) {
          // 如果没有原始尺寸信息，创建一个临时Image对象获取
          const img = new Image();
          img.onload = () => {
            setOriginalSize({
              width: img.width,
              height: img.height
            });
            
            // 计算为原始尺寸的25%
            const targetWidth = img.width * 0.25;
            const targetHeight = img.height * 0.25;
            
            setLogoSize({ width: targetWidth, height: targetHeight });
            setLogoScale(25); // 设置为25%缩放比例
            
            // 不再设置固定的左上角位置
          };
          img.src = response.data.imageUrl;
        } else {
          // 计算为原始尺寸的25%
          const targetWidth = originalSize.width * 0.25;
          const targetHeight = originalSize.height * 0.25;
          
          setLogoSize({ width: targetWidth, height: targetHeight });
          setLogoScale(25); // 设置为25%缩放比例
          
          // 不再设置固定的左上角位置
        }
      } else {
        console.error('移除背景响应没有包含imageUrl:', response);
        setRemoveBgStatus('头像处理完成但没有返回图像URL');
      }
    } catch (error) {
      console.error('移除背景时出错:', error);
      setRemoveBgStatus('头像处理时发生错误');
    } finally {
      setIsRemovingBg(false);
    }
  };
  
  // 辅助函数：调试并提取API响应中的图像URL
  const debugResponseUrl = (data: any): string | null => {
    console.log('=== 调试后端API响应中的图像路径 ===');
    
    // 如果data本身就是字符串，可能是URL或Base64
    if (typeof data === 'string') {
      console.log('响应数据是字符串:', data.substring(0, 100) + '...');
      
      // 检查是否是Base64图像
      if (data.startsWith('data:image/')) {
        console.log('找到Base64编码图像');
        return data;
      }
      
      // 检查是否是URL
      if (data.startsWith('http') || data.startsWith('/')) {
        console.log('找到直接URL:', data);
        return data;
      }
      
      // 可能是其他格式的字符串，尝试处理
      try {
        const parsedData = JSON.parse(data);
        return debugResponseUrl(parsedData);
      } catch (e) {
        // 不是JSON字符串，继续其他检查
      }
    }
    
    // 如果响应为空或无效，跳过
    if (!data || typeof data !== 'object') {
      console.log('响应数据为空或非对象');
      return null;
    }
    
    // 检查是否直接返回了base64图像数据
    if (data.base64 || data.base64_image) {
      const base64Data = data.base64 || data.base64_image;
      console.log('找到base64图像数据');
      
      // 确保有正确的前缀
      const prefix = 'data:image/png;base64,';
      const imageData = base64Data.startsWith(prefix) ? base64Data : prefix + base64Data;
      return imageData;
    }
    
    // 检查result.imageUrl
    if (data?.result?.imageUrl) {
      console.log('找到data.result.imageUrl路径:', data.result.imageUrl);
      return data.result.imageUrl;
    }
    
    // 检查artifacts数组 (Stable Diffusion API通常使用这种格式)
    if (data.artifacts && Array.isArray(data.artifacts) && data.artifacts.length > 0) {
      // 通常，第一个artifact包含生成的图像
      const artifact = data.artifacts[0];
      
      if (artifact.base64) {
        console.log('找到artifact中的base64数据');
        return 'data:image/png;base64,' + artifact.base64;
      }
      
      if (artifact.image) {
        console.log('找到artifact中的image数据');
        return 'data:image/png;base64,' + artifact.image;
      }
      
      if (artifact.url) {
        console.log('找到artifact中的url:', artifact.url);
        return artifact.url;
      }
    }
    
    // 检查直接的imageUrl
    if ('imageUrl' in data) {
      console.log('找到data.imageUrl路径:', data.imageUrl);
      return data.imageUrl;
    }
    
    // 检查data.image字段 (有些API使用这种格式)
    if (data.image) {
      if (typeof data.image === 'string') {
        console.log('找到data.image字符串:', data.image.substring(0, 30) + '...');
        
        // 可能是base64或URL
        if (data.image.startsWith('data:') || data.image.startsWith('http') || data.image.startsWith('/')) {
          return data.image;
        } else {
          // 假设是未添加前缀的base64
          return 'data:image/png;base64,' + data.image;
        }
      } else if (typeof data.image === 'object' && data.image !== null) {
        console.log('data.image是对象:', data.image);
        
        // 检查常见的嵌套结构
        if (data.image.url) {
          console.log('找到data.image.url:', data.image.url);
          return data.image.url;
        }
        
        if (data.image.src) {
          console.log('找到data.image.src:', data.image.src);
          return data.image.src;
        }
        
        if (data.image.base64 || data.image.data) {
          const base64Data = data.image.base64 || data.image.data;
          console.log('找到image对象中的base64数据');
          return 'data:image/png;base64,' + base64Data;
        }
      }
    }
    
    // 检查data.output或data.outputs字段
    ['output', 'outputs'].forEach(key => {
      if (data[key]) {
        console.log(`检查${key}字段:`, data[key]);
        
        // 如果是数组，检查第一个元素
        if (Array.isArray(data[key]) && data[key].length > 0) {
          const firstItem = data[key][0];
          
          // 如果是字符串，可能是URL或base64
          if (typeof firstItem === 'string') {
            console.log(`${key}[0]是字符串:`, firstItem.substring(0, 30) + '...');
            
            if (firstItem.startsWith('data:') || firstItem.startsWith('http') || firstItem.startsWith('/')) {
              return firstItem;
            } else if (firstItem.length > 100) { // 可能是base64
              return 'data:image/png;base64,' + firstItem;
            }
          } 
          // 如果是对象，寻找常见字段
          else if (typeof firstItem === 'object' && firstItem !== null) {
            console.log(`${key}[0]是对象:`, Object.keys(firstItem));
            
            // 检查常见字段
            for (const field of ['image', 'url', 'src', 'imageUrl', 'base64']) {
              if (field in firstItem && firstItem[field]) {
                console.log(`找到${key}[0].${field}:`, 
                  typeof firstItem[field] === 'string' ? 
                    firstItem[field].substring(0, 30) + '...' : firstItem[field]);
                
                if (typeof firstItem[field] === 'string') {
                  if (field === 'base64' || (firstItem[field].length > 100 && !firstItem[field].startsWith('http'))) {
                    return 'data:image/png;base64,' + firstItem[field];
                  }
                  return firstItem[field];
                }
              }
            }
          }
        } 
        // 如果不是数组而是对象
        else if (typeof data[key] === 'object' && data[key] !== null) {
          console.log(`${key}是对象:`, Object.keys(data[key]));
          
          // 检查常见字段
          for (const field of ['image', 'url', 'src', 'imageUrl', 'base64']) {
            if (field in data[key] && data[key][field]) {
              console.log(`找到${key}.${field}:`, 
                typeof data[key][field] === 'string' ? 
                  data[key][field].substring(0, 30) + '...' : data[key][field]);
              
              if (typeof data[key][field] === 'string') {
                if (field === 'base64' || (data[key][field].length > 100 && !data[key][field].startsWith('http'))) {
                  return 'data:image/png;base64,' + data[key][field];
                }
                return data[key][field];
              }
            }
          }
        }
      }
    });
    
    // 深度搜索所有字段
    const findImageUrl = (obj: any, path = ''): string | null => {
      // 辅助函数：判断字符串是否可能是图像URL
      const isLikelyImageUrl = (str: string): boolean => {
        // 常见图像扩展名
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.tiff', '.avif', '.heic'];
        
        // 检查是否以这些扩展名结尾
        const hasImageExtension = imageExtensions.some(ext => 
          str.toLowerCase().endsWith(ext)
        );
        
        // 检查是否是常见的URL模式
        const isUrlPattern = 
          str.startsWith('http') || 
          str.startsWith('https') || 
          str.startsWith('/') || 
          str.startsWith('./') ||
          str.includes('/uploads/') || 
          str.includes('/generated/') ||
          str.includes('/images/') ||
          str.includes('/img/') ||
          str.includes('/assets/') ||
          str.includes('/static/') ||
          str.includes('/media/');
        
        // 检查是否是base64编码的图像
        const isBase64Image = 
          str.startsWith('data:image/') || 
          (/^[A-Za-z0-9+/=]+$/.test(str) && str.length > 100);
        
        return hasImageExtension || isUrlPattern || isBase64Image;
      };
      
      // 如果是null或undefined或不是对象，返回null
      if (!obj || typeof obj !== 'object') return null;
      
      // 处理数组
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const currentPath = path ? `${path}[${i}]` : `[${i}]`;
          
          // 如果是字符串，检查是否是URL
          if (typeof obj[i] === 'string') {
            if (isLikelyImageUrl(obj[i])) {
              console.log(`找到数组中的图像URL: ${currentPath} = ${obj[i]}`);
              return obj[i].startsWith('data:image/') ? obj[i] : 
                     (/^[A-Za-z0-9+/=]+$/.test(obj[i]) && obj[i].length > 100 && !obj[i].startsWith('http')) ? 
                     'data:image/png;base64,' + obj[i] : obj[i];
            }
          } 
          // 递归检查数组元素
          else if (typeof obj[i] === 'object' && obj[i] !== null) {
            const result = findImageUrl(obj[i], currentPath);
            if (result) return result;
          }
        }
        return null;
      }
      
      // 已知可能包含图像URL的字段名
      const knownImageFields = [
        'url', 'imageUrl', 'image_url', 'imgUrl', 'img_url', 
        'src', 'source', 'href', 'link',
        'image', 'img', 'picture', 'photo', 'thumbnail',
        'base64', 'base64_image', 'data', 'content'
      ];
      
      // 首先检查已知的字段名
      for (const key of knownImageFields) {
        if (key in obj && obj[key]) {
          const currentPath = path ? `${path}.${key}` : key;
          
          // 字符串类型直接检查
          if (typeof obj[key] === 'string') {
            const value = obj[key];
            
            if (isLikelyImageUrl(value)) {
              console.log(`找到已知字段的图像URL: ${currentPath} = ${value.substring(0, 30)}...`);
              
              // 如果是base64编码但没有前缀，添加前缀
              if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 100 && !value.startsWith('data:image/') && !value.startsWith('http')) {
                return 'data:image/png;base64,' + value;
              }
              
              return value;
            }
          } 
          // 如果是对象，递归检查
          else if (typeof obj[key] === 'object' && obj[key] !== null) {
            const result = findImageUrl(obj[key], currentPath);
            if (result) return result;
          }
        }
      }
      
      // 检查所有其他字段
      for (const key in obj) {
        // 已检查过的已知字段跳过
        if (knownImageFields.includes(key)) continue;
        
        const currentPath = path ? `${path}.${key}` : key;
        
        // 检查字符串值
        if (typeof obj[key] === 'string') {
          const value = obj[key];
          
          // 字段名包含图像相关关键词
          const isImageRelatedField = 
            key.toLowerCase().includes('image') ||
            key.toLowerCase().includes('img') ||
            key.toLowerCase().includes('picture') ||
            key.toLowerCase().includes('photo') ||
            key.toLowerCase().includes('thumbnail') ||
            key.toLowerCase().includes('url') ||
            key.toLowerCase().includes('src') ||
            key.toLowerCase().includes('link') ||
            key.toLowerCase().includes('path');
          
          if (isImageRelatedField && isLikelyImageUrl(value)) {
            console.log(`找到字段名相关的图像URL: ${currentPath} = ${value.substring(0, 30)}...`);
            
            // 处理base64编码
            if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 100 && !value.startsWith('data:image/') && !value.startsWith('http')) {
              return 'data:image/png;base64,' + value;
            }
            
            return value;
          }
          
          // 即使字段名不相关，但值看起来像图像URL
          if (isLikelyImageUrl(value)) {
            console.log(`找到可能的图像URL: ${currentPath} = ${value.substring(0, 30)}...`);
            
            // 处理base64编码
            if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 100 && !value.startsWith('data:image/') && !value.startsWith('http')) {
              return 'data:image/png;base64,' + value;
            }
            
            return value;
          }
        } 
        // 递归检查嵌套对象
        else if (typeof obj[key] === 'object' && obj[key] !== null) {
          const result = findImageUrl(obj[key], currentPath);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    // 尝试深度搜索
    const foundUrl = findImageUrl(data);
    if (foundUrl) {
      console.log('通过深度搜索找到URL:', foundUrl);
      return foundUrl;
    }
    
    console.log('未找到任何URL路径');
    console.log('完整响应数据:', JSON.stringify(data));
    return null;
  };
  
  // 添加谷歌翻译函数
  const translateWithGoogle = async (text: string): Promise<string> => {
    try {
      // 使用Google翻译API（不需要API密钥的简单实现）
      const encodedText = encodeURIComponent(text);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodedText}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        // Google翻译API返回格式为嵌套数组
        if (data && data[0] && Array.isArray(data[0])) {
          // 提取翻译结果并合并
          const translatedText = data[0]
            .filter((item: any) => item && item[0])
            .map((item: any) => item[0])
            .join(' ');
          
          return translatedText;
        }
      }
      throw new Error('Google翻译API返回无效数据');
    } catch (error) {
      console.error('Google翻译失败:', error);
      throw error;
    }
  };
  
  // 生成AI背景函数
  const generateAiBackground = async () => {
    if (!aiBackgroundPrompt) return;
    
    try {
      console.log("开始生成背景，风格预设:", stylePreset, "种子值:", seedValue);
      setIsGeneratingAiBackground(true);
      setAiBackgroundStatus('开始生成背景...');
      
      // 添加翻译步骤
      setAiBackgroundStatus('正在翻译提示词...');
      
      // 检查提示词是否含有中文字符
      const containsChinese = /[\u4e00-\u9fa5]/.test(aiBackgroundPrompt) || /[\u4e00-\u9fa5]/.test(negativePrompt);
      let translatedPrompt = aiBackgroundPrompt;
      let translatedNegativePrompt = negativePrompt;
      
      if (containsChinese) {
        try {
          // 首先尝试使用Libre Translate API进行翻译
          try {
            // 将正面提示词和否定提示词合并为一个请求，用特殊标记分隔
            const textToTranslate = negativePrompt 
              ? `${aiBackgroundPrompt}|||NEGATIVE|||${negativePrompt}` 
              : aiBackgroundPrompt;
            
            const response = await fetch('https://libretranslate.de/translate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                q: textToTranslate,
                source: 'zh',
                target: 'en',
                format: 'text'
              }),
              // 设置较短的超时时间，以便在服务不可用时快速切换到备用方案
              signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.translatedText) {
                // 分离翻译后的正面提示词和否定提示词
                const translatedParts = result.translatedText.split('|||NEGATIVE|||');
                translatedPrompt = translatedParts[0].trim();
                if (translatedParts.length > 1) {
                  translatedNegativePrompt = translatedParts[1].trim();
                }
                
                console.log("LibreTranslate翻译结果:", {
                  prompt: translatedPrompt,
                  negativePrompt: translatedNegativePrompt
                });
                setAiBackgroundStatus('提示词翻译完成，开始生成图像...');
              } else {
                throw new Error("翻译API返回了无效结果");
              }
            } else {
              throw new Error(`翻译请求失败，状态码: ${response.status}`);
            }
          } catch (libreTranslateError) {
            // 如果Libre Translate失败，尝试使用Google翻译API
            console.warn("LibreTranslate失败，切换到Google翻译:", libreTranslateError);
            setAiBackgroundStatus('第一翻译服务失败，使用备用翻译...');
            
            try {
              // 翻译正面提示词
              translatedPrompt = await translateWithGoogle(aiBackgroundPrompt);
              
              // 如果有否定提示词，也翻译它
              if (negativePrompt) {
                translatedNegativePrompt = await translateWithGoogle(negativePrompt);
              }
              
              console.log("Google翻译结果:", {
                prompt: translatedPrompt,
                negativePrompt: translatedNegativePrompt
              });
              setAiBackgroundStatus('备用翻译完成，开始生成图像...');
            } catch (googleTranslateError) {
              console.error("Google翻译也失败:", googleTranslateError);
              setAiBackgroundStatus('所有翻译服务均失败，使用原始提示词...');
            }
          }
        } catch (translationError) {
          console.error("翻译过程中出错:", translationError);
          setAiBackgroundStatus('翻译出错，使用原始提示词...');
        }
      } else {
        console.log("提示词不含中文，无需翻译");
      }
      
      // 调用生成背景API - 使用Stable Image Core API
      console.log("准备发送请求，参数:", {
        prompt: translatedPrompt, // 使用翻译后的提示词
        original_prompt: aiBackgroundPrompt, // 保留原始提示词用于记录
        negativePrompt: translatedNegativePrompt, // 使用翻译后的否定提示词
        style_preset: stylePreset,
        output_format: 'webp',
        seed: seedValue > 0 ? seedValue : undefined
      });
      
      // 声明response变量在try块外，以便catch块和try块之后的代码都能访问
      let response;
      
      try {
        response = await generateBackgroundImage({
          prompt: translatedPrompt, // 使用翻译后的提示词
          negativePrompt: translatedNegativePrompt, // 使用翻译后的否定提示词
          style_preset: stylePreset,
          output_format: 'webp',
          seed: seedValue > 0 ? seedValue : undefined // 只有当种子值大于0时才发送
        });
        
        // 完整打印响应
        console.log("=========== 完整API响应 ===========");
        console.log("响应类型:", typeof response);
        console.log("响应键:", Object.keys(response));
        
        // 使用类型断言访问可能存在的额外属性
        const responseAny = response as any;
        if (responseAny.status) {
          console.log("响应状态:", responseAny.status);
        }
        
        if (responseAny.statusText) {
          console.log("响应状态文本:", responseAny.statusText);
        }
        if (responseAny.headers) {
          console.log("响应头:", responseAny.headers);
          if (responseAny.headers['content-type']) {
            console.log("内容类型:", responseAny.headers['content-type']);
          }
        }
        
        if (response.data) {
          const dataType = typeof response.data;
          console.log("数据类型:", dataType);
          
          if (dataType === 'string') {
            const dataStr = response.data as unknown as string;
            console.log("字符串数据前100字符:", dataStr.substring(0, 100));
          } else if (dataType === 'object') {
            // 安全输出对象
            try {
              const jsonStr = JSON.stringify(response.data).substring(0, 1000);
              console.log("对象数据前1000字符:", jsonStr);
            } catch(e) {
              console.log("无法序列化的对象数据");
            }
          } else if (ArrayBuffer.isView(response.data)) {
            console.log("二进制数据长度:", (response.data as any).byteLength);
          }
        }
      } catch (error) {
        console.error('生成背景时出错:', error);
        setAiBackgroundStatus('生成背景时发生错误，请检查控制台');
        setIsGeneratingAiBackground(false);
        return;
      }
      
      // 确保response已定义
      if (!response) {
        setAiBackgroundStatus('获取响应失败');
        setIsGeneratingAiBackground(false);
        return;
      }
      
      // 检查响应是否成功
      if (response.error) {
        console.error("生成背景错误:", response.error);
        setAiBackgroundStatus(`生成背景错误: ${response.error}`);
        setIsGeneratingAiBackground(false);
        return;
      }
      
      // 首先检查是否有直接返回的imageUrl (新版直接调用Stability API的响应格式)
      if (response.data && 'imageUrl' in (response.data as any)) {
        console.log("检测到直接返回的imageUrl");
        const imageUrl = (response.data as any).imageUrl;
        setAiGeneratedBackground(imageUrl);
        setAiBackgroundStatus('背景生成完成');
        setIsGeneratingAiBackground(false);
        return;
      }
      
      // 处理直接标记的响应
      if (response.data && 'direct' in (response.data as any) && (response.data as any).direct === true) {
        console.log("检测到直接API调用的响应");
        if ('imageUrl' in (response.data as any)) {
          const imageUrl = (response.data as any).imageUrl;
          console.log("使用直接返回的imageUrl:", typeof imageUrl, imageUrl.substring(0, 50) + "...");
          setAiGeneratedBackground(imageUrl);
          setAiBackgroundStatus('背景生成完成');
          setIsGeneratingAiBackground(false);
          return;
        }
      }
      
      // 检查是否直接收到了二进制图像数据 (当Accept: "image/*"时)
      if (response.data && 
          'headers' in response && 
          response.headers && 
          typeof response.headers === 'object' &&
          'content-type' in response.headers &&
          typeof response.headers['content-type'] === 'string' &&
          response.headers['content-type'].startsWith('image/')) {
        
        console.log("收到了直接图像响应，内容类型:", response.headers['content-type']);
        
        // 创建Blob URL
        const blob = new Blob([response.data as unknown as BlobPart], { type: response.headers['content-type'] });
        const imageUrl = URL.createObjectURL(blob);
        
        console.log("创建了Blob URL:", imageUrl);
        setAiGeneratedBackground(imageUrl);
        setAiBackgroundStatus('背景生成完成');
        setIsGeneratingAiBackground(false);
        return;
      }
      
      // 如果响应是JSON格式 (当Accept: "application/json"时)
      if (response.data) {
        console.log("响应数据类型:", typeof response.data);
        
        // 打印完整的响应数据结构
        if (typeof response.data === 'object') {
          console.log("响应数据完整结构:", JSON.stringify(response.data));
        }
        
        // 尝试从响应中提取图像URL或base64数据
        const imageUrl = debugResponseUrl(response.data);
        
        if (imageUrl) {
          console.log("成功找到并使用图像URL:", imageUrl);
          console.log("实际设置aiGeneratedBackground的值:", imageUrl);
          setAiGeneratedBackground(imageUrl);
          setAiBackgroundStatus('背景生成完成');
          setIsGeneratingAiBackground(false);
          return;
        } else {
          console.warn("debugResponseUrl未能找到图像URL，尝试其他方法提取...");
          
          // 手动浅层检查一些可能的位置（覆盖一些可能未被debugResponseUrl检测到的路径）
          let foundUrl = null;
          
          // 使用any类型断言来避免TypeScript类型检查错误
          const anyData = response.data as any;
          
          if (anyData.url) {
            foundUrl = anyData.url;
            console.log("找到顶层url:", foundUrl);
          } else if (anyData.image) {
            foundUrl = anyData.image;
            console.log("找到顶层image:", foundUrl);
          } else if (anyData.data && anyData.data.url) {
            foundUrl = anyData.data.url;
            console.log("找到data.url:", foundUrl);
          } else if (anyData.data && anyData.data.image) {
            foundUrl = anyData.data.image;
            console.log("找到data.image:", foundUrl);
          } else if (anyData.result && anyData.result.image) {
            foundUrl = anyData.result.image;
            console.log("找到result.image:", foundUrl);
          } else if (anyData.output) {
            if (typeof anyData.output === 'string') {
              foundUrl = anyData.output;
              console.log("找到output字符串:", foundUrl);
            } else if (Array.isArray(anyData.output) && anyData.output.length > 0) {
              foundUrl = anyData.output[0];
              console.log("找到output数组首项:", foundUrl);
            }
          }
          
          if (foundUrl) {
            if (typeof foundUrl === 'string') {
              if (foundUrl.startsWith('data:image/')) {
                console.log("找到base64图像数据");
                setAiGeneratedBackground(foundUrl);
              } else if (foundUrl.startsWith('http') || foundUrl.startsWith('/')) {
                console.log("找到URL:", foundUrl);
                setAiGeneratedBackground(foundUrl);
              } else if (foundUrl.length > 100 && /^[A-Za-z0-9+/=]+$/.test(foundUrl.substring(0, 100))) {
                console.log("找到可能的base64数据");
                setAiGeneratedBackground('data:image/png;base64,' + foundUrl);
              } else {
                console.log("找到未知格式字符串:", foundUrl.substring(0, 30));
                setAiGeneratedBackground(foundUrl);
              }
              setAiBackgroundStatus('背景生成完成');
              setIsGeneratingAiBackground(false);
              return;
            }
          }
          
          // 如果上面仍未找到有效的URL，尝试解析JobId，可能API使用异步处理
          if (anyData.jobId || anyData.id) {
            const jobId = anyData.jobId || anyData.id;
            console.log("找到jobId，将使用异步处理:", jobId);
            
            // 设置一个加载中的状态图像
            setAiGeneratedBackground('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
            setAiBackgroundStatus('已提交请求，等待处理...');
            
            // 这里可以添加异步检查jobId的逻辑
          } else {
            console.error("无法从响应中提取图像URL或jobId，响应数据:", anyData);
            setAiGeneratedBackground('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
            setAiBackgroundStatus('无法从响应中提取图像URL');
            setIsGeneratingAiBackground(false);
          }
        }
        
        // 如果响应直接是字符串（可能是base64）
        if (typeof response.data === 'string') {
          const dataStr = response.data as unknown as string;
          if (dataStr.startsWith('data:image/')) {
            console.log("响应是base64图像数据");
            setAiGeneratedBackground(dataStr);
            setAiBackgroundStatus('背景生成完成');
            setIsGeneratingAiBackground(false);
            return;
          }
          
          // 如果是长字符串且看起来像base64编码
          if (dataStr.length > 100 && /^[A-Za-z0-9+/=]+$/.test(dataStr.substring(0, 100))) {
            console.log("响应可能是未格式化的base64数据");
            const formattedData = `data:image/png;base64,${dataStr}`;
            setAiGeneratedBackground(formattedData);
            setAiBackgroundStatus('背景生成完成');
            setIsGeneratingAiBackground(false);
            return;
          }
        }
      }
      
      // 如果这里仍然存在老的逻辑检查jobId的代码，保留它作为后备
      if (response.data && 'jobId' in response.data) {
        const jobId = response.data.jobId;
        console.log("响应中包含jobId:", jobId);
        
        if (!jobId) {
          setAiBackgroundStatus('无法获取作业ID');
          setIsGeneratingAiBackground(false);
          return;
        }
        
        // 获取图像结果
        const statusResponse = await checkBackgroundStatus(jobId);
        console.log("状态检查响应:", JSON.stringify(statusResponse));
        
        if (statusResponse.error) {
          console.error("检查状态错误:", statusResponse.error);
          setAiBackgroundStatus(`检查状态错误: ${statusResponse.error}`);
          setIsGeneratingAiBackground(false);
          return;
        }
        
        // 将响应设置为UI状态，以便在界面中查看
        setAiBackgroundStatus(`正在解析响应数据...`);
        
        // 尝试直接输出原始响应，便于调试
        console.log("=============== 原始响应数据 ===============");
        console.log("响应类型:", typeof statusResponse);
        
        try {
          // 遍历响应的所有层级并打印
          const printAllLevels = (obj: any, prefix = '') => {
            if (obj && typeof obj === 'object') {
              Object.entries(obj).forEach(([key, value]) => {
                const path = prefix ? `${prefix}.${key}` : key;
                
                if (value && typeof value === 'object') {
                  console.log(`${path}:`, value);
                  
                  // 如果是数组，打印前3个元素
                  if (Array.isArray(value)) {
                    for (let i = 0; i < Math.min(value.length, 3); i++) {
                      console.log(`${path}[${i}]:`, value[i]);
                    }
                  } else {
                    printAllLevels(value, path);
                  }
                } else if (typeof value === 'string') {
                  // 如果字符串很长（可能是base64），只显示前50个字符
                  const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
                  console.log(`${path}:`, displayValue);
                } else {
                  console.log(`${path}:`, value);
                }
              });
            }
          };
          
          printAllLevels(statusResponse);
        } catch (e) {
          console.error("打印响应时出错:", e);
        }
        console.log("============================================");
        
        // 打印状态响应的详细内容
        console.log("状态响应数据完整结构:", JSON.stringify(statusResponse.data));
        
        // 添加更详细的调试输出
        console.log("状态响应的原始结构:");
        if (statusResponse.data) {
          const data = statusResponse.data as any; // 使用any类型让TypeScript接受以下访问
          console.log("状态响应类型:", typeof data);
          console.log("状态响应顶级键:", Object.keys(data));
          
          // 检查是否有artifacts数组
          if (data.artifacts) {
            console.log("Found artifacts array:", data.artifacts);
            if (Array.isArray(data.artifacts) && data.artifacts.length > 0) {
              console.log("First artifact keys:", Object.keys(data.artifacts[0]));
            }
          }
          
          // 检查是否有result对象
          if (data.result) {
            console.log("Found result object:", data.result);
            console.log("Result keys:", Object.keys(data.result));
          }
          
          // 检查其他可能包含图像的字段
          ['image', 'imageUrl', 'url', 'images', 'output', 'outputs', 'data'].forEach(key => {
            if (key in data) {
              console.log(`Found ${key}:`, data[key]);
            }
          });
        }
        
        // 直接调试检查状态响应中的图像URL
        if (statusResponse.data) {
          // 使用上面定义的辅助函数分析URL
          const imageUrl = debugResponseUrl(statusResponse.data);
          
          if (imageUrl) {
            console.log("成功找到并使用图像URL:", imageUrl);
            setAiGeneratedBackground(imageUrl);
            setAiBackgroundStatus('背景生成完成');
            setIsGeneratingAiBackground(false);
            return;
          }
          
          // 没有找到任何图像URL - 不再使用测试图片
          console.warn("在响应中未找到任何图像URL:", statusResponse);
          setAiBackgroundStatus('未能获取生成的图像URL，请重试');
          setIsGeneratingAiBackground(false);
        } else {
          console.warn("状态响应中没有数据:", statusResponse);
          setAiBackgroundStatus('状态响应中没有数据，请重试');
          setIsGeneratingAiBackground(false);
        }
      } else {
        console.error("响应格式无法识别:", response);
        setAiBackgroundStatus('响应格式无法识别，请重试');
        setIsGeneratingAiBackground(false);
      }
    } catch (outerError) {
      console.error("生成背景过程中发生未捕获错误:", outerError);
      setAiBackgroundStatus('生成背景过程中发生错误，请重试');
      setIsGeneratingAiBackground(false);
      
      // 设置默认图像作为兜底
      console.log("未捕获错误情况下设置默认图像");
      setAiGeneratedBackground('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
    }
    
    // 最终检查，确保aiGeneratedBackground不为null
    setTimeout(() => {
      if (!aiGeneratedBackground) {
        console.log("最终安全检查 - aiGeneratedBackground仍为null，设置兜底默认图像");
        setAiGeneratedBackground('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
        setAiBackgroundStatus('使用默认图像');
      }
    }, 1000);
  };
  
  // 处理图像加载，获取原始尺寸
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // 获取加载的图像
    const img = e.target as HTMLImageElement;
    const newWidth = img.naturalWidth;
    const newHeight = img.naturalHeight;
    
    // 记录尺寸信息
    console.log('图像加载完成，原始尺寸:', { 
      原始宽度: newWidth, 
      原始高度: newHeight,
      图像URL: img.src 
    });
    
    // 如果尺寸无效则进行处理
    if (newWidth <= 0 || newHeight <= 0) {
      console.error('错误：加载的图像尺寸无效', { width: newWidth, height: newHeight });
      
      // 设置一个默认的原始尺寸
      setOriginalSize({ width: 200, height: 200 });
      setAspectRatio(1);
      
      // 设置默认大小
      setLogoSize({ width: 200, height: 200 });
      setStartLogoSize({ width: 200, height: 200 });
      setLogoScale(100);
      
      // 设置图像加载状态并返回
      setBackgroundImageLoaded(true);
      return;
    }
    
    // 始终更新原始尺寸和宽高比，确保信息是最新的
    setOriginalSize({ width: newWidth, height: newHeight });
    setAspectRatio(newWidth / newHeight);
    
    // 计算合适的初始大小（基于容器尺寸的合理比例）
    const container = img.closest('.logo-container')?.parentElement;
    let initialSize = 200; // 默认初始大小
    
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const containerSize = Math.min(containerRect.width, containerRect.height);
      initialSize = containerSize * 0.25; // 取容器尺寸的25%作为初始大小
    }
    
    // 保持宽高比
    let initialWidth = initialSize;
    let initialHeight = initialSize * (newHeight / newWidth);
    
    // 确保最小尺寸
    initialWidth = Math.max(initialWidth, 50);
    initialHeight = Math.max(initialHeight, 50);
    
    // 如果当前没有显示图像（首次加载），则设置初始大小
    // 否则保持当前大小不变
    if (logoSize.width <= 0 || logoSize.height <= 0) {
      setLogoSize({ width: initialWidth, height: initialHeight });
      setStartLogoSize({ width: initialWidth, height: initialHeight });
    }
    
    // 重新计算当前缩放比例（基于最新的originalSize）
    const currentScale = (logoSize.width / newWidth) * 100;
    setLogoScale(Math.round(currentScale));
    
    console.log('图像设置完成:', {
      原始尺寸: { width: newWidth, height: newHeight },
      当前大小: logoSize,
      缩放比例: currentScale,
      宽高比: newWidth / newHeight
    });
    
    // 设置图像加载状态
    setBackgroundImageLoaded(true);
  };
  
  // 拖动处理函数
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    // 停止事件冒泡，防止触发父元素事件
    e.stopPropagation();
    
    // 如果点击的是拖拽区域，而不是调整大小的控制点
    if (!(e.target as HTMLElement).classList.contains('resize-handle')) {
      setIsDragging(true);
      console.log('开始拖动头像');
    }
  };
  
  const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    e.preventDefault(); // 防止其他默认行为
    
    // 获取容器元素
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    // 计算鼠标位置相对于容器的百分比
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // 扩大拖拽范围，允许logo部分移出容器
    // 允许logo中心点在容器外围30%的范围内（增加到30%让操作更灵活）
    const paddingPercentage = 30; // 增加可移动范围到30%
    const boundedX = Math.min(Math.max(x, -paddingPercentage), 100 + paddingPercentage);
    const boundedY = Math.min(Math.max(y, -paddingPercentage), 100 + paddingPercentage);
    
    setLogoPosition({ x: boundedX, y: boundedY });
    console.log('拖动头像中:', { x: boundedX, y: boundedY });
  };
  
  const handleDragEnd = () => {
    if (isDragging) {
      console.log('结束拖动头像');
      setIsDragging(false);
    }
  };
  
  // 添加调整大小处理函数
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>, direction: string) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发拖拽
    e.preventDefault(); // 防止默认行为
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
    const newScale = Math.min(Math.max(logoScale + amount, 10), 200); // 限制缩放范围在10%-200%
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
  
  // 处理文字大小调整开始
  const handleTextResizeStart = (e: React.MouseEvent<HTMLDivElement>, direction: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizingText(true);
    setTextResizeDirection(direction);
    setStartTextSize(textSize);
    setStartTextPosition({x: e.clientX, y: e.clientY});
    console.log('开始调整文字大小:', direction, textSize);
  };
  
  // 处理文字大小调整结束
  const handleTextResizeEnd = () => {
    if (isResizingText) {
      setIsResizingText(false);
      setTextResizeDirection('');
      console.log('结束文字大小调整:', textSize);
    }
  };
  
  // 使用useEffect添加和移除文档级事件监听器
  useEffect(() => {
    const handleGlobalTextResizeMove = (e: globalThis.MouseEvent) => {
      if (!isResizingText) return;
      
      // 计算鼠标移动距离
      const deltaX = e.clientX - startTextPosition.x;
      const deltaY = e.clientY - startTextPosition.y;
      
      // 基于当前文字大小，计算调整的幅度因子
      const scaleFactor = Math.max(1.0, startTextSize / 50);
      
      // 根据调整点位置选择合适的调整方式
      let sizeDelta = 0;
      
      switch (textResizeDirection) {
        case 'br': // 右下角 - 向右下拖动放大
          sizeDelta = Math.max(deltaX, deltaY) * 1.2 * scaleFactor; 
          break;
          
        case 'bl': // 左下角 - 向左下拖动放大（负X，正Y）
          sizeDelta = Math.max(-deltaX, deltaY) * 1.2 * scaleFactor; 
          break;
          
        case 'tr': // 右上角 - 向右上拖动放大（正X，负Y）
          sizeDelta = Math.max(deltaX, -deltaY) * 1.2 * scaleFactor; 
          break;
          
        case 'tl': // 左上角 - 向左上拖动放大（负X，负Y）
          sizeDelta = Math.max(-deltaX, -deltaY) * 1.2 * scaleFactor; 
          break;
      }
      
      // 将扩展/缩小方向与鼠标移动方向对齐
      const isOutwardDrag = (
        (textResizeDirection === 'br' && (deltaX > 0 || deltaY > 0)) ||
        (textResizeDirection === 'bl' && (deltaX < 0 || deltaY > 0)) ||
        (textResizeDirection === 'tr' && (deltaX > 0 || deltaY < 0)) ||
        (textResizeDirection === 'tl' && (deltaX < 0 || deltaY < 0))
      );
      
      // 如果是向内拖动，转换为负值
      if (!isOutwardDrag) {
        sizeDelta = -Math.abs(sizeDelta);
      }
      
      // 应用新的文字大小，确保在合理范围内
      const newSize = Math.max(10, Math.min(300, startTextSize + sizeDelta));
      
      // 只有当变化足够大时才更新状态，减少重绘
      if (Math.abs(newSize - textSize) > 2) {
        setTextSize(newSize);
      }
    };
    
    // 节流函数，减少事件触发频率
    const throttledMove = (e: globalThis.MouseEvent) => {
      // 使用requestAnimationFrame来限制更新频率
      if (!throttledMove.frameId) {
        throttledMove.frameId = requestAnimationFrame(() => {
          handleGlobalTextResizeMove(e);
          throttledMove.frameId = null;
        });
      }
    };
    // 添加类型
    throttledMove.frameId = null as number | null;
    
    const handleGlobalTextResizeEnd = () => {
      if (isResizingText) {
        // 取消任何挂起的帧
        if (throttledMove.frameId) {
          cancelAnimationFrame(throttledMove.frameId);
          throttledMove.frameId = null;
        }
        
        setIsResizingText(false);
        setTextResizeDirection('');
      }
    };
    
    if (isResizingText) {
      // 添加document级别事件监听
      document.addEventListener('mousemove', throttledMove);
      document.addEventListener('mouseup', handleGlobalTextResizeEnd);
      
      // 组件卸载时或状态变更时清理
      return () => {
        if (throttledMove.frameId) {
          cancelAnimationFrame(throttledMove.frameId);
        }
        document.removeEventListener('mousemove', throttledMove);
        document.removeEventListener('mouseup', handleGlobalTextResizeEnd);
      };
    }
  }, [isResizingText, textResizeDirection, startTextSize, startTextPosition, textSize]);
  
  // 同样为文字旋转添加document级别事件监听
  useEffect(() => {
    const handleGlobalTextRotateMove = (e: globalThis.MouseEvent) => {
      if (!isRotatingText) return;
      
      const textElement = document.querySelector('.text-container') as HTMLElement;
      if (!textElement) return;
      
      const rect = textElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // 计算开始角度和当前角度
      const startAngle = Math.atan2(
        startRotationMousePos.y - centerY,
        startRotationMousePos.x - centerX
      );
      const currentAngle = Math.atan2(
        e.clientY - centerY,
        e.clientX - centerX
      );
      
      // 计算角度差（弧度）并转换为度数
      let angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
      
      // 应用新的旋转角度，并确保其在0-360度范围内
      let newRotation = (startRotation + angleDiff) % 360;
      // 处理负角度
      if (newRotation < 0) newRotation += 360;
      
      // 为了平滑旋转，对角度进行四舍五入
      newRotation = Math.round(newRotation);
      
      // 只有当角度变化足够大时才更新
      if (Math.abs(newRotation - textRotation) > 2) {
        setTextRotation(newRotation);
      }
    };
    
    // 节流函数，减少事件触发频率
    const throttledRotateMove = (e: globalThis.MouseEvent) => {
      // 使用RequestAnimationFrame来限制更新频率
      if (!throttledRotateMove.frameId) {
        throttledRotateMove.frameId = requestAnimationFrame(() => {
          handleGlobalTextRotateMove(e);
          throttledRotateMove.frameId = null;
        });
      }
    };
    // 添加类型
    throttledRotateMove.frameId = null as number | null;
    
    const handleGlobalTextRotateEnd = () => {
      if (isRotatingText) {
        // 取消任何挂起的帧
        if (throttledRotateMove.frameId) {
          cancelAnimationFrame(throttledRotateMove.frameId);
          throttledRotateMove.frameId = null;
        }
        setIsRotatingText(false);
      }
    };
    
    if (isRotatingText) {
      document.addEventListener('mousemove', throttledRotateMove);
      document.addEventListener('mouseup', handleGlobalTextRotateEnd);
      
      return () => {
        if (throttledRotateMove.frameId) {
          cancelAnimationFrame(throttledRotateMove.frameId);
        }
        document.removeEventListener('mousemove', throttledRotateMove);
        document.removeEventListener('mouseup', handleGlobalTextRotateEnd);
      };
    }
  }, [isRotatingText, startRotation, startRotationMousePos, textRotation]);
  
  // 处理文字旋转结束
  const handleTextRotateEnd = () => {
    if (isRotatingText) {
      setIsRotatingText(false);
      console.log('结束文字旋转，最终角度:', textRotation);
    }
  };
  
  // 处理Logo旋转开始
  const handleLogoRotateStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsRotatingLogo(true);
    setStartLogoRotation(logoRotation);
    
    // 保存元素中心点和鼠标位置
    const element = e.currentTarget.parentElement;
    if (element) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setStartLogoRotationMousePos({x: e.clientX, y: e.clientY});
      
      console.log('开始旋转Logo，当前角度:', logoRotation);
    }
  };
  
  // 处理Logo旋转结束
  const handleLogoRotateEnd = () => {
    if (isRotatingLogo) {
      setIsRotatingLogo(false);
      console.log('结束Logo旋转，最终角度:', logoRotation);
    }
  };

  // 同样为Logo旋转添加document级别事件监听
  useEffect(() => {
    const handleGlobalLogoRotateMove = (e: globalThis.MouseEvent) => {
      if (!isRotatingLogo) return;
      
      const logoElement = document.querySelector('.logo-container') as HTMLElement;
      if (!logoElement) return;
      
      const rect = logoElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // 计算开始角度和当前角度
      const startAngle = Math.atan2(
        startLogoRotationMousePos.y - centerY,
        startLogoRotationMousePos.x - centerX
      );
      const currentAngle = Math.atan2(
        e.clientY - centerY,
        e.clientX - centerX
      );
      
      // 计算角度差（弧度）并转换为度数
      let angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
      
      // 应用新的旋转角度，并确保其在0-360度范围内
      let newRotation = (startLogoRotation + angleDiff) % 360;
      // 处理负角度
      if (newRotation < 0) newRotation += 360;
      
      // 为了平滑旋转，对角度进行四舍五入
      newRotation = Math.round(newRotation);
      
      // 只有当角度变化足够大时才更新
      if (Math.abs(newRotation - logoRotation) > 2) {
        setLogoRotation(newRotation);
      }
    };
    
    // 节流函数，减少事件触发频率
    const throttledLogoRotateMove = (e: globalThis.MouseEvent) => {
      // 使用RequestAnimationFrame来限制更新频率
      if (!throttledLogoRotateMove.frameId) {
        throttledLogoRotateMove.frameId = requestAnimationFrame(() => {
          handleGlobalLogoRotateMove(e);
          throttledLogoRotateMove.frameId = null;
        });
      }
    };
    // 添加类型
    throttledLogoRotateMove.frameId = null as number | null;
    
    const handleGlobalLogoRotateEnd = () => {
      if (isRotatingLogo) {
        // 取消任何挂起的帧
        if (throttledLogoRotateMove.frameId) {
          cancelAnimationFrame(throttledLogoRotateMove.frameId);
          throttledLogoRotateMove.frameId = null;
        }
        setIsRotatingLogo(false);
      }
    };
    
    if (isRotatingLogo) {
      document.addEventListener('mousemove', throttledLogoRotateMove);
      document.addEventListener('mouseup', handleGlobalLogoRotateEnd);
      
      return () => {
        if (throttledLogoRotateMove.frameId) {
          cancelAnimationFrame(throttledLogoRotateMove.frameId);
        }
        document.removeEventListener('mousemove', throttledLogoRotateMove);
        document.removeEventListener('mouseup', handleGlobalLogoRotateEnd);
      };
    }
  }, [isRotatingLogo, startLogoRotation, startLogoRotationMousePos, logoRotation]);
  
  // 处理Logo大小调整开始
  const handleLogoResizeStart = (e: React.MouseEvent<HTMLDivElement>, direction: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    // 确保logo原始尺寸已经设置
    if (originalSize.width <= 0 || originalSize.height <= 0) {
      console.error('错误：未能获取logo原始尺寸，无法进行缩放');
      return;
    }
    
    setIsResizingLogo(true);
    setLogoResizeDirection(direction);
    
    // 确保当前尺寸信息正确
    setStartLogoSize({
      width: logoSize.width || 200, 
      height: logoSize.height || 200
    });
    
    // 保存起始鼠标位置
    setStartLogoResizePos({x: e.clientX, y: e.clientY});
    
    // 立即设置全局事件监听器，开始追踪鼠标移动，不需要等到下一个渲染周期
    const initialMouseX = e.clientX;
    const initialMouseY = e.clientY;
    
    let lastMouseX = initialMouseX;
    let lastMouseY = initialMouseY;
    let accumulatedDeltaX = 0;
    let accumulatedDeltaY = 0;
    
    // 鼠标移动处理函数 - 在当前闭包内定义，以便访问初始状态
    const handleMouseMove = (e: MouseEvent) => {
      // 计算当前鼠标位置与上次位置的差异
      const currentDeltaX = e.clientX - lastMouseX;
      const currentDeltaY = e.clientY - lastMouseY;
      
      // 更新最后的鼠标位置
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      
      // 第一次移动时，如果差异太大，使用较小的值避免跳动
      if (accumulatedDeltaX === 0 && accumulatedDeltaY === 0) {
        // 使用经过缩放的小增量而不是完全跳过
        accumulatedDeltaX = currentDeltaX * 0.2; // 只使用20%的初始移动量
        accumulatedDeltaY = currentDeltaY * 0.2;
      } else {
        // 累积增量以跟踪总移动距离
        accumulatedDeltaX += currentDeltaX;
        accumulatedDeltaY += currentDeltaY;
      }
      
      // 应用缩放调整逻辑
      let absoluteDelta: number;
      
      // 使用固定的调整系数，不根据尺寸或速度变化
      const adjustmentFactor = 1.5;
      
      // 根据不同方向应用不同的调整逻辑
      switch (direction) {
        case 'br': // 右下角
          absoluteDelta = Math.max(Math.abs(accumulatedDeltaX), Math.abs(accumulatedDeltaY)) * adjustmentFactor;
          absoluteDelta = (accumulatedDeltaX + accumulatedDeltaY > 0) ? absoluteDelta : -absoluteDelta;
          break;
          
        case 'bl': // 左下角
          absoluteDelta = Math.max(Math.abs(accumulatedDeltaX), Math.abs(accumulatedDeltaY)) * adjustmentFactor;
          absoluteDelta = (-accumulatedDeltaX + accumulatedDeltaY > 0) ? absoluteDelta : -absoluteDelta;
          break;
          
        case 'tr': // 右上角
          absoluteDelta = Math.max(Math.abs(accumulatedDeltaX), Math.abs(accumulatedDeltaY)) * adjustmentFactor;
          absoluteDelta = (accumulatedDeltaX - accumulatedDeltaY > 0) ? absoluteDelta : -absoluteDelta;
          break;
          
        case 'tl': // 左上角
          absoluteDelta = Math.max(Math.abs(accumulatedDeltaX), Math.abs(accumulatedDeltaY)) * adjustmentFactor;
          absoluteDelta = (-accumulatedDeltaX - accumulatedDeltaY > 0) ? absoluteDelta : -absoluteDelta;
          break;
          
        default:
          absoluteDelta = 0;
      }
      
      // 确保startLogoSize有有效值
      const safeStartWidth = startLogoSize.width || 200;
      
      // 应用计算的调整量，并增加平滑处理
      const targetWidth = safeStartWidth + absoluteDelta;
      
      // 使用固定的平滑插值系数
      const smoothingFactor = 0.5;
      
      // 使用平滑插值计算新宽度
      let newWidth = logoSize.width + (targetWidth - logoSize.width) * smoothingFactor;
      
      // 确保最小尺寸限制
      newWidth = Math.max(20, newWidth);
      
      // 确保原始尺寸有效
      const safeOriginalWidth = originalSize.width || 200;
      
      // 计算当前缩放比例
      const currentScalePercentage = (newWidth / safeOriginalWidth) * 100;
      
      // 设置最大缩放比例为500%
      const maxScale = 500;
      
      // 根据缩放比例限制计算新宽度
      if (currentScalePercentage > maxScale) {
        newWidth = (safeOriginalWidth * maxScale) / 100;
      }
      
      // 更新大小
      let newHeightValue: number;
      if (maintainAspectRatio && aspectRatio > 0) {
        newHeightValue = newWidth / aspectRatio;
      } else {
        // 如果不保持宽高比，使用当前高度
        newHeightValue = (startLogoSize.height as number) || 200;
      }
      
      // 设置新尺寸，确保为有效值
      setLogoSize({width: newWidth, height: newHeightValue});
      
      // 计算新的缩放比例
      const scalePercentage = (newWidth / safeOriginalWidth) * 100;
      setLogoScale(Math.round(scalePercentage));
    };
    
    // 鼠标释放处理函数
    const handleMouseUp = () => {
      // 移除事件监听
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // 重置状态
      setIsResizingLogo(false);
      setLogoResizeDirection('');
    };
    
    // 添加事件监听
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    console.log('开始调整Logo大小:', direction, '当前大小:', logoSize, '原始尺寸:', originalSize);
  };
  
  // 处理Logo大小调整结束 - 简化，因为大部分逻辑移到了handleLogoResizeStart中
  const handleLogoResizeEnd = () => {
    // 空实现，实际结束逻辑在mouseup事件中处理
    console.log('结束Logo大小调整:', logoSize);
  };
  
  // 为Logo大小调整添加document级别事件监听
  useEffect(() => {
    let lastMouseX = 0;
    let lastMouseY = 0;
    let accumulatedDeltaX = 0;
    let accumulatedDeltaY = 0;
    
    const handleGlobalLogoResizeMove = (e: globalThis.MouseEvent) => {
      if (!isResizingLogo) return;
      
      // 计算当前鼠标位置与上次位置的差异
      const currentDeltaX = e.clientX - lastMouseX;
      const currentDeltaY = e.clientY - lastMouseY;
      
      // 更新最后的鼠标位置
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      
      // 第一次移动时，如果差异太大，使用较小的值避免跳动
      if (accumulatedDeltaX === 0 && accumulatedDeltaY === 0) {
        // 使用经过缩放的小增量而不是完全跳过
        accumulatedDeltaX = currentDeltaX * 0.2; // 只使用20%的初始移动量
        accumulatedDeltaY = currentDeltaY * 0.2;
      } else {
        // 累积增量以跟踪总移动距离
        accumulatedDeltaX += currentDeltaX;
        accumulatedDeltaY += currentDeltaY;
      }
      
      // 应用缩放调整逻辑
      applyLogoResizing(accumulatedDeltaX, accumulatedDeltaY);
    };
    
    // 分离调整大小逻辑，以便于维护
    const applyLogoResizing = (deltaX: number, deltaY: number) => {
      // 使用绝对调整量，根据方向决定增大或减小
      let absoluteDelta: number;
      
      // 使用固定的调整系数，不根据尺寸或速度变化
      // 设置为1.5，这样最终步进比例为 1.5 * 0.5 = 0.75
      const adjustmentFactor = 1.5;
      
      // 根据不同方向应用不同的调整逻辑
      switch (logoResizeDirection) {
        case 'br': // 右下角
          absoluteDelta = Math.max(Math.abs(deltaX), Math.abs(deltaY)) * adjustmentFactor;
          // 使用平滑的判断逻辑，让方向判断更加平滑
          // deltaX和deltaY的加权和用于判断方向
          absoluteDelta = (deltaX + deltaY > 0) ? absoluteDelta : -absoluteDelta;
          break;
          
        case 'bl': // 左下角
          absoluteDelta = Math.max(Math.abs(deltaX), Math.abs(deltaY)) * adjustmentFactor;
          // 如果向左下拖动是正向，向右上拖动是负向
          absoluteDelta = (-deltaX + deltaY > 0) ? absoluteDelta : -absoluteDelta;
          break;
          
        case 'tr': // 右上角
          absoluteDelta = Math.max(Math.abs(deltaX), Math.abs(deltaY)) * adjustmentFactor;
          // 如果向右上拖动是正向，向左下拖动是负向
          absoluteDelta = (deltaX - deltaY > 0) ? absoluteDelta : -absoluteDelta;
          break;
          
        case 'tl': // 左上角
          absoluteDelta = Math.max(Math.abs(deltaX), Math.abs(deltaY)) * adjustmentFactor;
          // 如果向左上拖动是正向，向右下拖动是负向
          absoluteDelta = (-deltaX - deltaY > 0) ? absoluteDelta : -absoluteDelta;
          break;
          
        default:
          absoluteDelta = 0;
      }
      
      // 确保startLogoSize有有效值
      const safeStartWidth = startLogoSize.width || 200;
      
      // 应用计算的调整量，并增加平滑处理
      // 使用当前大小和目标大小之间的插值，而不是直接设置
      const targetWidth = safeStartWidth + absoluteDelta;
      
      // 使用固定的平滑插值系数，不随鼠标速度变化
      // 设置为0.5，提供中等的平滑度和响应性
      const smoothingFactor = 0.5;
      
      // 使用平滑插值计算新宽度
      let newWidth = logoSize.width + (targetWidth - logoSize.width) * smoothingFactor;
      
      // 确保最小尺寸限制
      newWidth = Math.max(20, newWidth);
      
      // 确保原始尺寸有效
      const safeOriginalWidth = originalSize.width || 200;
      
      // 计算当前缩放比例
      const currentScalePercentage = (newWidth / safeOriginalWidth) * 100;
      
      // 设置最大缩放比例为500%
      const maxScale = 500;
      
      // 根据缩放比例限制计算新宽度
      if (currentScalePercentage > maxScale) {
        newWidth = (safeOriginalWidth * maxScale) / 100;
      }
      
      // 更新大小
      let newHeightValue: number;
      if (maintainAspectRatio && aspectRatio > 0) {
        newHeightValue = newWidth / aspectRatio;
      } else {
        // 如果不保持宽高比，使用当前高度
        newHeightValue = (startLogoSize.height as number) || 200;
      }
      
      // 设置新尺寸，确保为有效值
      setLogoSize({width: newWidth, height: newHeightValue});
      
      // 计算新的缩放比例
      const scalePercentage = (newWidth / safeOriginalWidth) * 100;
      setLogoScale(Math.round(scalePercentage));
    };
    
    const handleGlobalLogoResizeStart = () => {
      // 初始化鼠标位置跟踪
      lastMouseX = startLogoResizePos.x;
      lastMouseY = startLogoResizePos.y;
      accumulatedDeltaX = 0;
      accumulatedDeltaY = 0;
      console.log('开始全局鼠标拖动跟踪');
    };
    
    // 节流函数，减少事件触发频率
    const throttledLogoResizeMove = (e: globalThis.MouseEvent) => {
      // 使用RequestAnimationFrame来限制更新频率
      if (!throttledLogoResizeMove.frameId) {
        throttledLogoResizeMove.frameId = requestAnimationFrame(() => {
          handleGlobalLogoResizeMove(e);
          throttledLogoResizeMove.frameId = null;
        });
      }
    };
    // 添加类型
    throttledLogoResizeMove.frameId = null as number | null;
    
    const handleGlobalLogoResizeEnd = () => {
      if (isResizingLogo) {
        // 取消任何挂起的帧
        if (throttledLogoResizeMove.frameId) {
          cancelAnimationFrame(throttledLogoResizeMove.frameId);
          throttledLogoResizeMove.frameId = null;
        }
        handleLogoResizeEnd();
      }
    };
    
    if (isResizingLogo) {
      // 调用初始化函数
      handleGlobalLogoResizeStart();
      
      document.addEventListener('mousemove', throttledLogoResizeMove);
      document.addEventListener('mouseup', handleGlobalLogoResizeEnd);
      
      // 在拖动过程中添加鼠标移出页面时的处理
      document.addEventListener('mouseleave', handleGlobalLogoResizeEnd);
      
      return () => {
        if (throttledLogoResizeMove.frameId) {
          cancelAnimationFrame(throttledLogoResizeMove.frameId);
        }
        document.removeEventListener('mousemove', throttledLogoResizeMove);
        document.removeEventListener('mouseup', handleGlobalLogoResizeEnd);
        document.removeEventListener('mouseleave', handleGlobalLogoResizeEnd);
      };
    }
  }, [isResizingLogo, logoResizeDirection, startLogoSize, startLogoResizePos, aspectRatio, maintainAspectRatio, originalSize?.width]);
  
  // 合成图像函数
  const compositeImage = () => {
    // 检查是否有必要的图像
    const foregroundImage = shouldRemoveBackground ? removeBgResult : removeBgImage;
    
    if (!aiGeneratedBackground) {
      alert('需要至少有AI生成背景才能合成');
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
              transform: translate(-50%, -50%) rotate(${logoRotation}deg); /* 添加logo旋转 */
              width: ${logoSize.width}px;
              height: auto;
              z-index: 30;
            }
            .text-overlay {
              position: absolute;
              top: ${textPosition.y}%;
              left: ${textPosition.x}%;
              transform: translate(-50%, -50%) rotate(${textRotation}deg); /* 添加文字旋转 */
              color: ${textColor};
              font-size: ${textSize}px;
              font-weight: ${fontWeight};
              font-family: ${fontFamily}, sans-serif;
              text-align: center;
              z-index: 40;
              ${showTextBg ? `background-color: ${textBgColor};` : ''}
              padding: ${showTextBg ? `${textPadding}px` : '0'};
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
            ${foregroundImage ? `<img class="foreground" src="${getFullImageUrl(foregroundImage)}" alt="前景" />` : ''}
            ${textContent ? `<div class="text-overlay">${textContent.replace(/You/g, '<span style="font-size: 125%; font-weight: bold;">You</span>')}</div>` : ''}
          </div>
        </body>
        </html>
      `;
      
      // 创建Blob并生成URL
      const blob = new Blob([compositeHtml], { type: 'text/html' });
      const compositeUrl = URL.createObjectURL(blob);
      
      setCompositeResult(compositeUrl);
      setAiBackgroundStatus('已创建合成预览');
      
      console.log('合成预览已创建', {
        背景: aiGeneratedBackground,
        前景: foregroundImage,
        文本: textContent,
        Logo位置: logoPosition,
        Logo大小: logoSize,
        Logo旋转: logoRotation, // 添加日志
        文字位置: textPosition,
        文字大小: textSize,
        文字旋转: textRotation // 添加日志
      });
      
    } catch (error) {
      console.error('创建合成预览时出错:', error);
      setAiBackgroundStatus('创建合成预览时出错');
    }
  };
  
  // 添加监视aiGeneratedBackground状态变化的useEffect
  useEffect(() => {
    if (aiGeneratedBackground) {
      console.log('背景图像URL已更新:', aiGeneratedBackground);
      
      // 预加载图像，确保可以正确显示
      const img = new Image();
      img.onload = () => {
        console.log('背景图像加载成功，尺寸:', img.width, 'x', img.height);
      };
      img.onerror = (e) => {
        console.error('背景图像加载失败:', e);
      };
      img.src = getFullImageUrl(aiGeneratedBackground);
    }
  }, [aiGeneratedBackground]);
  
  // 辅助函数：获取完整URL - 增强版本
  const getFullImageUrl = (relativeUrl: string | null): string => {
    if (!relativeUrl) {
      console.error('传入了空的图片URL, 调用栈:', new Error().stack);
      // 返回一个透明像素的数据URI，而不是空字符串
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    }
    
    console.log('处理图片URL开始:', relativeUrl.substring(0, 50) + (relativeUrl.length > 50 ? '...' : ''));
    
    // 检查是否是Base64编码图像
    if (relativeUrl.startsWith('data:image/')) {
      console.log('URL是Base64编码图像, 直接返回');
      return relativeUrl;
    }
    
    // 已经是完整的HTTP URL - 确保CORS不会阻止加载
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      // 如果是本地开发环境且URL指向API服务器，可能需要使用代理或CORS配置
      if (process.env.NODE_ENV === 'development' && 
         (relativeUrl.includes('localhost:5000') || relativeUrl.includes('127.0.0.1:5000'))) {
        // 如果API服务器配置了CORS，直接返回即可
        console.log('URL是开发环境中的API服务器URL, 直接返回:', relativeUrl);
        return relativeUrl;
      }
      
      // 如果是外部图像URL，可能需要通过后端代理
      if (!relativeUrl.includes(window.location.hostname)) {
        console.log('URL是外部图像, 考虑是否需要代理:', relativeUrl);
        // 如果有代理配置，可以修改为:
        // return `/api/proxy-image?url=${encodeURIComponent(relativeUrl)}`;
      }
      
      console.log('URL已经是完整的HTTP URL, 返回:', relativeUrl);
      return relativeUrl;
    }
    
    if (relativeUrl.startsWith('blob:')) {
      console.log('Blob URL, 返回:', relativeUrl);
      return relativeUrl;
    }
    
    // 确保URL以/开头
    let normalizedUrl = relativeUrl;
    if (!normalizedUrl.startsWith('/')) {
      normalizedUrl = '/' + normalizedUrl;
    }
    
    // 删除结果URL中可能存在的双斜杠
    while (normalizedUrl.includes('//')) {
      normalizedUrl = normalizedUrl.replace('//', '/');
    }
    
    // 构建完整URL - 尝试多种可能的环境变量和硬编码值
    let baseUrl = 'http://localhost:5000'; // 默认值
    
    // 尝试读取可能的环境变量
    if (process.env.NEXT_PUBLIC_API_URL) {
      baseUrl = process.env.NEXT_PUBLIC_API_URL;
      console.log('使用NEXT_PUBLIC_API_URL环境变量:', baseUrl);
    } else if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      console.log('使用NEXT_PUBLIC_API_BASE_URL环境变量:', baseUrl);
    } else if (process.env.NEXT_PUBLIC_BACKEND_URL) {
      baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
      console.log('使用NEXT_PUBLIC_BACKEND_URL环境变量:', baseUrl);
    } else {
      console.log('使用默认API基础URL:', baseUrl);
    }
    
    // 在开发环境中直接使用硬编码值
    if (process.env.NODE_ENV === 'development') {
      baseUrl = 'http://localhost:5000';
      console.log('开发环境使用硬编码URL:', baseUrl);
    }
    
    const fullUrl = `${baseUrl}${normalizedUrl}`;
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

  // 修改条件渲染逻辑
  // 判断函数：是否应该显示"初始预览"
  const shouldShowInitialPreview = () => {
    // 如果正在生成AI背景但已经有背景，继续显示背景而不是初始预览
    if (isGeneratingAiBackground && aiGeneratedBackground) return false;
    
    // 如果有上传的logo或文字内容，也应该保持显示背景预览
    if ((removeBgImage || removeBgResult || textContent) && aiGeneratedBackground) return false;
    
    // 如果正在生成AI背景且没有现有背景，显示初始预览
    if (isGeneratingAiBackground && !aiGeneratedBackground) return true;
    
    // 如果没有AI背景，显示初始预览
    if (!aiGeneratedBackground) return true;
    
    return false;
  };
  
  // 判断函数：是否应该显示"背景预览"
  const shouldShowBackgroundPreview = () => {
    // 如果正在生成AI背景但已经有背景，保持显示背景预览
    if (isGeneratingAiBackground && aiGeneratedBackground) return true;
    
    // 必须有背景且不在生成中
    if (!aiGeneratedBackground || (isGeneratingAiBackground && !aiGeneratedBackground)) {
      // 如果已经停止生成但背景为null，尝试设置一个默认图像
      if (!isGeneratingAiBackground && !aiGeneratedBackground) {
        console.log('生成已停止但背景为null，尝试设置默认图像');
        // 设置一个1x1透明像素作为默认图像
        setTimeout(() => {
          if (!aiGeneratedBackground) {
            console.log('设置默认测试图像');
            setAiGeneratedBackground('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
            setAiBackgroundStatus('使用默认图像');
            // 不再重置logo位置
          }
        }, 500);
      }
      
      return false;
    }
    
    // 修改：如果有背景，但没有LOGO或正在处理LOGO背景，则显示背景预览
    // 允许用户先生成背景再上传LOGO或跳过LOGO直接添加文字
    if (!shouldShowFullPreview()) {
      return true;
    }
    
    return false;
  };
  
  // 判断函数：是否应该显示"实时预览与调整"
  const shouldShowFullPreview = () => {
    // 修改：只要有背景且不在生成中或已有背景但正在生成新背景，就可以显示完整预览
    // 这样在生成新背景时不会改变显示模式
    if (!aiGeneratedBackground) return false;
    
    // 如果正在移除背景处理中，不显示完整预览
    if (isRemovingBg) return false;
    
    // 有背景就可以直接显示完整预览，允许用户添加文字或LOGO
    return true;
  };

  // 添加一个辅助函数，处理文本内容特殊格式
  const formatSpecialText = (text: string): React.ReactNode => {
    // 检查是否包含"You"
    if (!text.includes('You')) {
      return text;
    }
    
    // 分割文本，增强"You"的显示
    const parts = text.split(/(You)/g);
    return parts.map((part, index) => 
      part === 'You' ? (
        <span key={index} style={{ fontSize: '125%', fontWeight: 'bold' }}>
          {part}
        </span>
      ) : part
    );
  };
  
  // 添加删除头像的函数
  const deleteAvatar = () => {
    setRemoveBgImage(null);
    setRemoveBgResult(null);
    setSelectedFileName('');
  };
  
  // 添加删除文字的函数
  const deleteText = () => {
    setTextContent('');
  };
  
  // 处理文字旋转开始
  const handleTextRotateStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsRotatingText(true);
    setStartRotation(textRotation);
    
    // 保存元素中心点和鼠标位置
    const element = e.currentTarget.parentElement;
    if (element) {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setStartRotationMousePos({x: e.clientX, y: e.clientY});
      
      console.log('开始旋转文字，当前角度:', textRotation);
    }
  };

  // 在ProductPage函数开始位置添加这些代码（在state声明部分）
  const textContainerRef = useRef<HTMLDivElement | null>(null);

  // 在ProductPage函数中添加这个函数，放在其他函数旁边
  const getTextOffsetDistance = () => {
    if (!textContainerRef.current) return 0;
    
    // 获取文字容器的尺寸
    const { width, height } = textContainerRef.current.getBoundingClientRect();
    
    // 计算对角线长度的一半（从中心点到边缘的最大距离）
    const diagonalHalf = Math.sqrt(width * width + height * height) / 2;
    
    // 根据文字大小返回适当的偏移量
    // 基础距离(50px) + 文字大小影响的额外距离
    return Math.min(Math.max(0, diagonalHalf - 50), 50); // 限制在0-50px的额外距离范围内
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
      
      {/* 内容容器 - 包裹所有内容，确保居中一致性 */}
      <div className="max-w-screen-xl mx-auto px-4 pb-24">
        {/* 极简风格头部 */}
        <section className="w-full flex flex-col justify-center items-center pt-16 pb-10 text-center">
          <div className="w-full pl-[10%]">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight w-full text-left">
              <span style={{ fontSize: '150%', fontWeight: 'bold' }}>You</span>Tube Banner 制作器
            </h1>
            <p className="mt-4 text-[#8e91c0] text-sm md:text-base text-left">
              简洁高效的频道横幅设计工具
            </p>
            
            {/* 添加分隔线增强视觉效果 */}
            <div className="mt-6 w-24 h-1 bg-gradient-to-r from-[#4868e1] to-[#5a77e6] rounded-full"></div>
          </div>
        </section>
        
        <div className="space-y-10">
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
                    
                    {/* 添加翻译提示 */}
                    <p className="text-[10px] text-[#8e91c0] italic mt-1">
                      提示：中文描述会被自动翻译成英文以获得更好的生成效果
                    </p>
                  </div>
                  
                  {/* 添加否定提示词输入 */}
                  <div className="space-y-1">
                    <label className="text-xs text-[#8e91c0] flex items-center">
                      <span>否定提示词：</span>
                      <span className="text-[10px] ml-1 italic">(不希望出现的元素)</span>
                    </label>
                    <textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      className="smart-input w-full h-12 text-sm py-2 px-3"
                      placeholder="例如: 人物, 文字, 标志, 模糊, 失真"
                      rows={1}
                    ></textarea>
                    <p className="text-[10px] text-[#8e91c0] italic mt-1">
                      提示：指定您不希望在图像中出现的元素，多个元素用逗号分隔
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-[#8e91c0]">选择风格预设：</label>
                    <select
                      value={stylePreset}
                      onChange={(e) => setStylePreset(e.target.value)}
                      className="smart-input w-full text-sm py-2 px-3"
                    >
                      {stylePresets.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* 添加种子参数选项 */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-[#8e91c0] flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={showSeedOption}
                          onChange={() => setShowSeedOption(!showSeedOption)}
                          className="mr-1 h-3 w-3"
                        />
                        自定义种子值
                      </label>
                      <span className="text-xs text-[#6282ff]">
                        {showSeedOption ? (seedValue === 0 ? "随机种子" : `种子值: ${seedValue}`) : ""}
                      </span>
                    </div>
                    
                    {showSeedOption && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="number"
                          min="0"
                          max="4294967294"
                          value={seedValue}
                          onChange={(e) => setSeedValue(Math.max(0, Math.min(4294967294, Number(e.target.value))))}
                          className="smart-input w-full text-sm py-1 px-2"
                          placeholder="0表示随机种子"
                        />
                        <div className="flex justify-between">
                          <button 
                            className="text-xs text-[#4868e1] bg-[#26284e] px-2 py-1 rounded hover:bg-[#323565]"
                            onClick={() => setSeedValue(0)}
                          >
                            随机
                          </button>
                          <button 
                            className="text-xs text-[#4868e1] bg-[#26284e] px-2 py-1 rounded hover:bg-[#323565]"
                            onClick={() => setSeedValue(Math.floor(Math.random() * 4294967294))}
                          >
                            生成新种子
                          </button>
                        </div>
                        <p className="text-[10px] text-[#8e91c0] italic">
                          种子值决定生成的"随机性"，相同种子值会生成相似结果
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    className={`smart-button w-[80%] mx-auto block py-1 px-1.5 text-[15px] ${isGeneratingAiBackground ? '' : 'hover-pulse'} transition-colors duration-500`}
                    style={{
                      animation: isGeneratingAiBackground 
                        ? 'pulseAnimation 3s infinite ease-in-out' 
                        : 'none'
                    }}
                    onClick={generateAiBackground}
                    disabled={!aiBackgroundPrompt || isGeneratingAiBackground}
                  >
                    {isGeneratingAiBackground ? '生成中...' : '生成背景'}
                  </button>
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
                    <div className="flex justify-between items-center">
                      <button 
                        className="smart-button w-3/4 py-1 px-1.5 text-[15px]"
                        onClick={() => removeBgInputRef.current?.click()}
                      >
                        选择图片
                      </button>
                      
                      {/* 添加删除按钮 */}
                      {(removeBgImage || removeBgResult) && (
                        <button 
                          className="bg-[#ff4757] hover:bg-[#ff6b81] text-white py-1 px-2 rounded text-sm transition-colors duration-200"
                          onClick={deleteAvatar}
                          title="删除图片"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* 背景移除切换选项 */}
                  {removeBgImage && (
                    <div className="mt-2">
                      <label className="flex items-center space-x-2 text-sm">
                        <input 
                          type="checkbox" 
                          checked={shouldRemoveBackground} 
                          onChange={(e) => setShouldRemoveBackground(e.target.checked)}
                          className="form-checkbox h-4 w-4 rounded-full bg-[#1a1b36] border-[#3d3f66] text-[#4868e1]"
                        />
                        <span>自动移除背景</span>
                      </label>
                      
                      {/* 手动触发背景移除按钮 */}
                      {!isRemovingBg && shouldRemoveBackground && !removeBgResult && (
                        <button 
                          className="smart-button w-3/4 py-1 px-1.5 text-[15px] mt-2"
                          onClick={startRemoveBackground}
                          disabled={!removeBgImage}
                        >
                          开始处理图片
                        </button>
                      )}
                      
                      {/* 文件名显示 */}
                      {selectedFileName && (
                        <p className="text-xs text-[#8e91c0] mt-2 truncate">
                          已选择: {selectedFileName}
                        </p>
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
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-[#8e91c0]">输入文字内容：</label>
                      
                      {/* 添加删除按钮 */}
                      {textContent && (
                        <button 
                          className="bg-[#ff4757] hover:bg-[#ff6b81] text-white py-0.5 px-2 rounded text-xs transition-colors duration-200"
                          onClick={deleteText}
                          title="删除文字"
                        >
                          删除
                        </button>
                      )}
                    </div>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      className="smart-input w-full text-sm py-2 px-3"
                      placeholder="在此输入显示的文字内容"
                      rows={1}
                    ></textarea>
                    
                    {/* 添加"已选择"提示框 */}
                    {textContent && (
                      <div className="mt-1 px-2 py-1 bg-[#26284e] rounded-md border border-[#4868e1] text-xs text-[#4868e1] flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>已添加文字</span>
                      </div>
                    )}
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
              {/* 预览容器 - 使用固定高度包装所有预览类型 */}
              <div className="smart-card overflow-hidden" style={{ minHeight: '700px' }}>
                {/* 背景预览区域 - 在背景图加载过程中添加头像显示 */}
                {shouldShowBackgroundPreview() && (
                  <div className="p-6 space-y-6 h-full" style={{ display: 'none' }}>
                    <h2 className="text-xl font-medium">背景预览</h2>
                    
                    <div className="relative bg-checkered w-full overflow-hidden rounded-xl" style={{ paddingTop: '56.25%' }}> {/* 16:9比例 */}
                      {/* 背景图 */}
                      {aiGeneratedBackground && (
                        <img 
                          key={`background-${new Date().getTime()}`} // 添加key以强制重新加载
                          src={getFullImageUrl(aiGeneratedBackground)} 
                          alt="背景" 
                          className={`absolute top-0 left-0 w-full h-full object-cover ${isRemovingBg ? 'opacity-80' : 'opacity-100'} transition-opacity duration-300`}
                          style={{ zIndex: 1 }}
                          onLoad={(e) => {
                            console.log('背景图像加载成功:', (e.target as HTMLImageElement).src);
                            // 显示成功消息
                            setAiBackgroundStatus('背景图加载成功');
                            setBackgroundImageLoaded(true); // 设置图片加载完成
                          }}
                          onError={(e) => {
                            console.error('背景图像加载失败:', (e.target as HTMLImageElement).src);
                            setBackgroundImageLoaded(false); // 设置图片加载失败
                            
                            // 尝试设置备用图像
                            if (aiGeneratedBackground) {
                              const img = e.target as HTMLImageElement;
                              img.onerror = null; // 防止无限循环
                              
                              // 检查是否是Base64数据，如果不是再尝试使用原始URL
                              if (!aiGeneratedBackground.startsWith('data:')) {
                                // 清除可能的相对路径处理
                                if (aiGeneratedBackground.startsWith('http')) {
                                  console.log('尝试直接使用绝对URL:', aiGeneratedBackground);
                                  img.src = aiGeneratedBackground;
                                } else {
                                  // 尝试直接使用原始URL
                                  console.log('尝试直接使用原始URL:', aiGeneratedBackground);
                                  img.src = aiGeneratedBackground;
                                }
                                
                                // 如果还失败，尝试添加随机查询参数避免缓存
                                img.onerror = () => {
                                  const urlWithCache = aiGeneratedBackground.includes('?') 
                                    ? `${aiGeneratedBackground}&t=${new Date().getTime()}` 
                                    : `${aiGeneratedBackground}?t=${new Date().getTime()}`;
                                  
                                  console.log('尝试添加随机查询参数:', urlWithCache);
                                  img.onerror = null;
                                  img.src = urlWithCache;
                                  
                                  // 如果还失败，显示错误信息
                                  img.onerror = () => {
                                    console.error('所有尝试都失败，无法加载图像');
                                    img.onerror = null;
                                    setAiBackgroundStatus('图像加载失败，请尝试重新生成');
                                  };
                                }
                              } else {
                                // 已经是Base64数据，可能格式有问题
                                console.error('Base64图像格式可能有问题');
                                setAiBackgroundStatus('Base64图像加载失败，请尝试重新生成');
                              }
                            }
                          }}
                        />
                      )}
                      
                      {/* 添加头像显示 - 即使在背景加载过程中也能显示头像 */}
                      {(shouldRemoveBackground ? removeBgResult : removeBgImage) && (
                        <div
                          style={{
                            position: 'absolute',
                            top: `${logoPosition.y}%`,
                            left: `${logoPosition.x}%`,
                            transform: 'translate(-50%, -50%)',
                            width: `${logoSize.width}px`,
                            height: 'auto',
                            zIndex: 30,
                            cursor: isDragging ? 'grabbing' : 'grab',
                            userSelect: 'none' // 防止选中图像内容
                          }}
                        >
                          <img 
                            src={getFullImageUrl(shouldRemoveBackground ? removeBgResult : removeBgImage)}
                            alt="LOGO/头像"
                            style={{
                              width: '100%',
                              height: 'auto',
                              pointerEvents: 'none', // 防止图片本身干扰拖拽事件
                              transition: 'width 0.1s ease-out, height 0.1s ease-out',
                              userSelect: 'none' // 防止选中
                            }}
                          />
                        </div>
                      )}
                      
                      {/* 背景生成中的进度指示器 - 不会覆盖现有内容 */}
                      {isGeneratingAiBackground && (
                        <div className="absolute top-4 left-4 z-20 bg-[#1a1b36] bg-opacity-80 p-3 rounded-lg shadow-lg backdrop-blur-sm">
                          <div className="flex items-center space-x-3">
                            <div className="relative w-8 h-8">
                              <div className="absolute inset-0 rounded-full bg-[#4868e1] opacity-20 blur-sm"></div>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#4868e1] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs text-[#4868e1] font-medium">{'背景加载中...'}</p>
                              <div className="w-48 h-1 mt-1 bg-[#26284e] rounded-full overflow-hidden">
                                <div className="h-full bg-[#4868e1] rounded-full" 
                                  style={{
                                    width: '100%', 
                                    animation: 'breatheAnimation 3s infinite ease-in-out'
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 处理中状态 */}
                      {isRemovingBg && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                          <div className="text-center p-8 max-w-md">
                            <div className="w-16 h-16 bg-[#26284e] rounded-full flex items-center justify-center mx-auto mb-4 relative">
                              <div className="absolute inset-0 rounded-full bg-[#4868e1] opacity-20 blur-md"></div>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#4868e1] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </div>
                            
                            {/* 添加进度条 */}
                            <div className="w-full h-1.5 bg-[#26284e] rounded-full overflow-hidden">
                              <div className="h-full bg-[#4868e1] rounded-full" 
                                style={{
                                  width: '100%', 
                                  animation: 'breatheAnimation 3s infinite ease-in-out'
                                }}
                              ></div>
                            </div>
                            <p className="text-xs text-[#4868e1] mt-2">处理中...</p>
                          </div>
                        </div>
                      )}
                      
                      {/* 可拖动的文字 - 只需要背景已生成 */}
                      {textContent && (
                        <div
                          ref={(el) => {
                            // 如果元素存在，存储其尺寸信息
                            if (el) {
                              textContainerRef.current = el;
                            }
                          }}
                          className="text-container"
                          style={{
                            position: 'absolute',
                            top: `${textPosition.y}%`,
                            left: `${textPosition.x}%`,
                            transform: `translate(-50%, -50%) rotate(${textRotation}deg) translateZ(0)`,
                            color: textColor,
                            fontSize: `${textSize}px`,
                            fontWeight: fontWeight,
                            fontFamily: `${fontFamily}, sans-serif`,
                            textAlign: 'center',
                            zIndex: 40, // 文字保持在上方
                            backgroundColor: showTextBg ? textBgColor : 'transparent',
                            padding: showTextBg ? `${textPadding}px` : '0',
                            borderRadius: '8px',
                            maxWidth: '80%',
                            cursor: isEditingText ? 'grabbing' : 'grab',
                            userSelect: 'none',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.4,
                            willChange: 'transform, font-size',
                            backfaceVisibility: 'hidden',
                            WebkitFontSmoothing: 'antialiased',
                            contain: 'content'
                          }}
                          onMouseDown={handleTextDragStart}
                        >
                          {formatSpecialText(textContent)}
                          
                          {/* 文字调整框 */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              border: '1px dashed rgba(72, 104, 225, 0.7)',
                              pointerEvents: 'none',
                              boxSizing: 'border-box',
                              boxShadow: '0 0 0 1px rgba(72, 104, 225, 0.2)',
                              backgroundColor: 'transparent' // 确保背景透明
                            }}
                          ></div>
                          
                          {/* 左上角调整点 */}
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
                              zIndex: 41,
                              boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                            }}
                            onMouseDown={(e) => handleTextResizeStart(e, 'tl')}
                          ></div>
                          
                          {/* 右上角调整点 */}
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
                              zIndex: 41,
                              boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                            }}
                            onMouseDown={(e) => handleTextResizeStart(e, 'tr')}
                          ></div>
                          
                          {/* 右下角调整点 */}
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
                              zIndex: 41,
                              boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                            }}
                            onMouseDown={(e) => handleTextResizeStart(e, 'br')}
                          ></div>
                          
                          {/* 左下角调整点 */}
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
                              zIndex: 41,
                              boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                            }}
                            onMouseDown={(e) => handleTextResizeStart(e, 'bl')}
                          ></div>
                        </div>
                      )}
                      
                      {/* 添加指导说明 - 修改条件：只有在图片已加载成功且没有正在移除背景、没有文本内容和头像，且aiBackgroundStatus不为'背景生成完成'或'背景图加载成功'时显示 */}
                      {backgroundImageLoaded && !isRemovingBg && !textContent && 
                       !(removeBgImage || removeBgResult) &&
                       !(aiBackgroundStatus === '背景生成完成' || aiBackgroundStatus === '背景图加载成功') && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex flex-col items-center space-y-8 w-full">
                            {/* 中间步骤指导 */}
                            <div className="flex flex-col gap-5 mb-4">
                              <div className="flex items-center">
                                <span className="w-8 h-8 bg-[#4868e1] text-white rounded-full flex items-center justify-center mr-3 text-sm shadow-lg glow-effect">1</span>
                                <span className="text-white">生成AI背景</span>
                              </div>
                              <div className="flex items-center">
                                <span className="w-8 h-8 bg-[#4868e1] text-white rounded-full flex items-center justify-center mr-3 text-sm shadow-lg glow-effect">2</span>
                                <span className="text-white">上传LOGO或头像</span>
                              </div>
                              <div className="flex items-center">
                                <span className="w-8 h-8 bg-[#4868e1] text-white rounded-full flex items-center justify-center mr-3 text-sm shadow-lg glow-effect">3</span>
                                <span className="text-white">添加文字 (可选)</span>
                              </div>
                            </div>
                            
                            {/* 蓝色操作指南框 */}
                            <div className="bg-[#4868e1] bg-opacity-40 p-4 rounded-lg backdrop-blur-sm max-w-md">
                              <h3 className="text-white text-base mb-2 font-medium text-center">如何使用</h3>
                              <ol className="text-white text-sm space-y-1 pl-5">
                                <li>输入背景描述并选择风格</li>
                                <li>点击"生成背景"按钮</li>
                                <li>上传您的LOGO或头像完成合成</li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 实时预览和调整控制 - 只有在两个图像都加载完成且没有处理中状态时才显示 */}
                {shouldShowFullPreview() && (
                  <div className="p-6 space-y-6 h-full">
                    <h2 className="text-xl font-medium">实时预览和调整</h2>
                    
                    <div className="relative bg-checkered w-full overflow-hidden rounded-xl" style={{ paddingTop: '56.25%' }}> {/* 16:9比例 */}
                      {/* 背景图 */}
                      {aiGeneratedBackground && (
                        <img 
                          src={getFullImageUrl(aiGeneratedBackground)} 
                          alt="背景" 
                          className="absolute top-0 left-0 w-full h-full object-cover"
                          style={{ zIndex: 1 }}
                        />
                      )}
                      
                      {/* 背景生成中的进度指示器 */}
                      {isGeneratingAiBackground && (
                        <div className="absolute top-4 left-4 z-20 bg-[#1a1b36] bg-opacity-80 p-3 rounded-lg shadow-lg backdrop-blur-sm">
                          <div className="flex items-center space-x-3">
                            <div className="relative w-8 h-8">
                              <div className="absolute inset-0 rounded-full bg-[#4868e1] opacity-20 blur-sm"></div>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#4868e1] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs text-[#4868e1] font-medium">{'背景加载中...'}</p>
                              <div className="w-48 h-1 mt-1 bg-[#26284e] rounded-full overflow-hidden">
                                <div className="h-full bg-[#4868e1] rounded-full" 
                                  style={{
                                    width: '100%', 
                                    animation: 'breatheAnimation 3s infinite ease-in-out'
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 可拖动的LOGO/头像容器 */}
                      <div 
                        className="absolute top-0 left-0 w-full h-full"
                        onMouseDown={handleDragStart}
                        onMouseMove={(e) => {
                          if (isDragging) {
                            handleDragMove(e);
                          } else if (isResizing) {
                            handleResizeMove(e);
                          } else if (isEditingText) {
                            handleTextDragMove(e);
                          } else if (isResizingLogo) {
                            // Logo大小调整由document级事件处理
                          }
                          // 注意：文字大小调整和旋转现在由document级事件处理
                        }}
                        onMouseUp={() => {
                          handleDragEnd();
                          handleResizeEnd();
                          handleTextDragEnd();
                          handleLogoResizeEnd();
                          // 文字大小调整和旋转结束由document级事件处理
                        }}
                        onMouseLeave={() => {
                          handleDragEnd();
                          handleResizeEnd();
                          handleTextDragEnd();
                          handleLogoResizeEnd();
                          // 文字大小调整和旋转结束由document级事件处理
                        }}
                      >
                        {/* LOGO/头像 */}
                        {(shouldRemoveBackground ? removeBgResult : removeBgImage) && (
                          <div
                            style={{
                              position: 'absolute',
                              top: `${logoPosition.y}%`,
                              left: `${logoPosition.x}%`,
                              transform: `translate(-50%, -50%) rotate(${logoRotation}deg)`,
                              width: `${logoSize.width}px`,
                              height: 'auto',
                              zIndex: 30,
                              cursor: isDragging ? 'grabbing' : 'grab',
                              userSelect: 'none' // 防止选中图像内容
                            }}
                            onMouseDown={handleDragStart}
                            className="logo-container"
                          >
                            <img 
                              src={getFullImageUrl(shouldRemoveBackground ? removeBgResult : removeBgImage)}
                              alt="可拖动的LOGO/头像"
                              style={{
                                width: '100%',
                                height: 'auto',
                                pointerEvents: 'none', // 防止图片本身干扰拖拽事件
                                transition: isDragging || isResizing || isResizingLogo ? 'none' : 'width 0.1s ease-out, height 0.1s ease-out',
                                userSelect: 'none' // 防止选中
                              }}
                              onLoad={handleImageLoad}
                              onError={(e) => console.error('预览区域头像图片加载失败', e)}
                              draggable="false" // 防止拖拽图片
                            />
                            
                            {/* 调整框 */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '-10px',
                                left: '-10px',
                                width: 'calc(100% + 20px)',
                                height: 'calc(100% + 20px)',
                                border: '1px solid rgba(72, 104, 225, 0.7)',
                                pointerEvents: 'none',
                                boxSizing: 'border-box',
                                boxShadow: '0 0 0 1px rgba(72, 104, 225, 0.2)',
                                backgroundColor: 'transparent', // 确保背景透明
                                padding: '10px' // 添加内边距
                              }}
                            ></div>
                            
                            {/* 四个角的调整点 */}
                            {/* 左上角 */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '-25px',  // 从-20px调整为-25px
                                left: '-25px', // 从-20px调整为-25px
                                width: '30px',  // 从20px调整为30px
                                height: '30px', // 从20px调整为30px
                                backgroundColor: 'rgba(38, 40, 78, 0.9)',
                                border: '2px solid #4868e1',
                                borderRadius: '50%',
                                cursor: 'nwse-resize',
                                zIndex: 31,  
                                boxShadow: '0 0 8px rgba(72, 104, 225, 0.7)',
                                userSelect: 'none', 
                                touchAction: 'none' 
                              }}
                              className="resize-handle"
                              onMouseDown={(e) => handleLogoResizeStart(e, 'tl')}
                            ></div>
                            
                            {/* 右上角 */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '-25px', // 从-20px调整为-25px
                                right: '-25px', // 从-20px调整为-25px
                                width: '30px', // 从20px调整为30px
                                height: '30px', // 从20px调整为30px
                                backgroundColor: 'rgba(38, 40, 78, 0.9)',
                                border: '2px solid #4868e1',
                                borderRadius: '50%',
                                cursor: 'nesw-resize',
                                zIndex: 31,
                                boxShadow: '0 0 8px rgba(72, 104, 225, 0.7)',
                                userSelect: 'none',
                                touchAction: 'none'
                              }}
                              className="resize-handle"
                              onMouseDown={(e) => handleLogoResizeStart(e, 'tr')}
                            ></div>
                            
                            {/* 左下角 */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '-25px', // 从-20px调整为-25px
                                left: '-25px', // 从-20px调整为-25px
                                width: '30px', // 从20px调整为30px
                                height: '30px', // 从20px调整为30px
                                backgroundColor: 'rgba(38, 40, 78, 0.9)',
                                border: '2px solid #4868e1',
                                borderRadius: '50%',
                                cursor: 'nesw-resize',
                                zIndex: 31,
                                boxShadow: '0 0 8px rgba(72, 104, 225, 0.7)',
                                userSelect: 'none',
                                touchAction: 'none'
                              }}
                              className="resize-handle"
                              onMouseDown={(e) => handleLogoResizeStart(e, 'bl')}
                            ></div>
                            
                            {/* 右下角 */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '-25px', // 从-20px调整为-25px
                                right: '-25px', // 从-20px调整为-25px
                                width: '30px', // 从20px调整为30px
                                height: '30px', // 从20px调整为30px
                                backgroundColor: 'rgba(38, 40, 78, 0.9)',
                                border: '2px solid #4868e1',
                                borderRadius: '50%',
                                cursor: 'nwse-resize',
                                zIndex: 31,
                                boxShadow: '0 0 8px rgba(72, 104, 225, 0.7)',
                                userSelect: 'none',
                                touchAction: 'none'
                              }}
                              className="resize-handle"
                              onMouseDown={(e) => handleLogoResizeStart(e, 'br')}
                            ></div>
                            
                            {/* 添加旋转控制器 - 从logo中心到旋转圈的虚线 */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '0',
                                left: '50%',
                                width: '1px',
                                height: '50px', // 从100px缩短到50px
                                borderLeft: '2px dashed rgba(72, 104, 225, 0.7)',
                                transform: 'translateX(-50%)', 
                                zIndex: 29,
                                pointerEvents: 'none'
                              }}
                            ></div>
                            
                            {/* 旋转控制把手 - 位于虚线的末端 */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '-50px', // 从-100px改为-50px
                                left: '50%',
                                transform: 'translate(-50%, 0)', // 水平居中
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: '#4868e1',
                                border: '2px solid white',
                                zIndex: 31,
                                cursor: 'grab',
                                boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              className="rotate-handle animate-pulse"
                              onMouseDown={handleLogoRotateStart}
                            >
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="18" 
                                height="18" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="white" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                              >
                                <path d="M15 4.55a8 8 0 0 0-6 14.9M9 15v5H4" />
                              </svg>
                            </div>
                            
                            {/* 从圆圈中点到logo中点的虚线 */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '-50px', // 从-100px改为-50px
                                left: '50%',
                                width: '1px',
                                height: '50px', // 从100px缩短到50px
                                borderLeft: '2px dashed rgba(72, 104, 225, 0.7)',
                                transform: 'translateX(-50%)', 
                                zIndex: 29,
                                pointerEvents: 'none'
                              }}
                            ></div>
                          </div>
                        )}
                        
                        {/* 可拖动的文字 */}
                        {textContent && (
                          <>
                            {/* 垂直于文字的虚线旋转控制器 */}
                            <div
                              style={{
                                position: 'absolute',
                                top: `${textPosition.y}%`,
                                left: `${textPosition.x}%`,
                                width: '50px',  // 从100px缩短到50px
                                height: '2px',
                                borderTop: '2px dashed #4868e1',
                                transform: `rotate(${textRotation + 90}deg)`, // 垂直于文字，以中心为起点
                                transformOrigin: 'left center', // 修改变换原点为左侧中心点
                                zIndex: 45, // 提高z-index，确保在文字上层
                                pointerEvents: 'none'
                              }}
                            ></div>
                            
                            {/* 旋转控制把手 - 使用绝对定位，基于文字位置计算 */}
                            <div
                              style={{
                                position: 'absolute',
                                // 使用三角函数计算精确坐标
                                top: `calc(${textPosition.y}% + ${Math.sin((textRotation + 90) * Math.PI / 180) * (50 + getTextOffsetDistance())}px)`,
                                left: `calc(${textPosition.x}% + ${Math.cos((textRotation + 90) * Math.PI / 180) * (50 + getTextOffsetDistance())}px)`,
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: '#4868e1',
                                border: '2px solid white',
                                transform: `translate(-50%, -50%) rotate(${textRotation}deg)`, // 只需旋转自身
                                zIndex: 45, // 提高z-index，确保在文字上层
                                cursor: 'grab',
                                boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseDown={handleTextRotateStart}
                              className="animate-pulse"
                            >
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="18" 
                                height="18" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="white" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                style={{
                                  transform: `rotate(${-textRotation - 90}deg)` // 保持图标方向一致
                                }}
                              >
                                <path d="M15 4.55a8 8 0 0 0-6 14.9M9 15v5H4" />
                              </svg>
                            </div>
                            
                            {/* 文字容器 */}
                            <div
                              className="text-container"
                              style={{
                                position: 'absolute',
                                top: `${textPosition.y}%`,
                                left: `${textPosition.x}%`,
                                transform: `translate(-50%, -50%) rotate(${textRotation}deg) translateZ(0)`,
                                color: textColor,
                                fontSize: `${textSize}px`,
                                fontWeight: fontWeight,
                                fontFamily: `${fontFamily}, sans-serif`,
                                textAlign: 'center',
                                zIndex: 40, // 文字保持在上方
                                backgroundColor: showTextBg ? textBgColor : 'transparent',
                                padding: showTextBg ? `${textPadding}px` : '0',
                                borderRadius: '8px',
                                maxWidth: '80%',
                                cursor: isEditingText ? 'grabbing' : 'grab',
                                userSelect: 'none',
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.4,
                                willChange: 'transform, font-size',
                                backfaceVisibility: 'hidden',
                                WebkitFontSmoothing: 'antialiased',
                                contain: 'content'
                              }}
                              onMouseDown={handleTextDragStart}
                            >
                              {formatSpecialText(textContent)}
                              
                              {/* 文字调整框 */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  border: '1px dashed rgba(72, 104, 225, 0.7)',
                                  pointerEvents: 'none',
                                  boxSizing: 'border-box',
                                  boxShadow: '0 0 0 1px rgba(72, 104, 225, 0.2)',
                                  backgroundColor: 'transparent' // 确保背景透明
                                }}
                              ></div>
                              
                              {/* 左上角调整点 */}
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
                                  zIndex: 41,
                                  boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                                }}
                                onMouseDown={(e) => handleTextResizeStart(e, 'tl')}
                              ></div>
                              
                              {/* 右上角调整点 */}
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
                                  zIndex: 41,
                                  boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                                }}
                                onMouseDown={(e) => handleTextResizeStart(e, 'tr')}
                              ></div>
                              
                              {/* 右下角调整点 */}
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
                                  zIndex: 41,
                                  boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                                }}
                                onMouseDown={(e) => handleTextResizeStart(e, 'br')}
                              ></div>
                              
                              {/* 左下角调整点 */}
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
                                  zIndex: 41,
                                  boxShadow: '0 0 5px rgba(72, 104, 225, 0.5)'
                                }}
                                onMouseDown={(e) => handleTextResizeStart(e, 'bl')}
                              ></div>
                            </div>
                          </>
                        )}
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
                          max="200"
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
                )}
              </div>
                
              {/* 合成预览结果 - 作为独立区域显示，不会覆盖原预览 */}
              {compositeResult && (
                <div className="smart-card p-6 space-y-6 bg-[#191a32] rounded-xl shadow-lg border border-[#26284e]" data-result-section>
                  <h2 className="text-xl font-medium flex items-center border-b border-[#26284e] pb-4">
                    <span className="bg-[#203045] text-[#4acfff] px-2 py-1 rounded-full text-xs mr-2">完成</span>
                    合成结果
                  </h2>
                  
                  {/* 新的合成结果显示区域 */}
                  <div className="mt-4 relative w-full overflow-hidden rounded-xl" style={{ paddingTop: '56.25%' }}> {/* 16:9比例 */}
                    <iframe 
                      src={compositeResult} 
                      className="absolute top-0 left-0 w-full h-full border-none"
                      title="合成预览"
                    ></iframe>
                  </div>
                  
                  {/* 合成结果下方的操作区域 */}
                  <div className="mt-6 p-4 bg-[#1e203a] rounded-lg">
                    <h3 className="text-md font-medium mb-3 text-[#4acfff]">合成图像已生成</h3>
                    <p className="text-sm text-[#8e91c0] mb-4">您可以下载或在新窗口中查看完整效果</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href={compositeResult}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-4 text-[15px] bg-[#26284e] text-white text-center rounded-md hover:bg-[#323565] transition flex items-center justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        在新窗口中打开
                      </a>
                      <a
                        href={compositeResult}
                        download="ai-composed-image.html"
                        className="smart-button flex-1 py-2 text-[15px] flex items-center justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        下载合成结果
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
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