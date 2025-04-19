/**
 * API客户端库
 * 封装所有对后端API的请求
 */

// 使用后端API的URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// 后端API根URL，用于获取静态资源和图片
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// 导入日志器
import logger from './logger';

interface GenerateBackgroundParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
}

interface GenerateBannerParams {
  channelName: string;
  channelSlogan?: string;
  theme?: string;
  backgroundColor?: string;
  logoUrl?: string | null;
  userImageUrl?: string | null;
  blendMode?: string;
  imageOpacity?: number;
  useAI?: boolean;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface JobResponse {
  jobId: string;
  id?: string; // 某些API可能返回id而不是jobId
  status: string;
}

export interface BackgroundStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  result?: {
    imageUrl: string;
    width: number;
    height: number;
  };
  error?: string;
}

export interface BannerStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  previewUrls?: {
    desktop: string;
    mobile: string;
    tablet: string;
  };
  error?: string;
}

interface UploadResponse {
  success: boolean;
  fileUrl: string;
}

/**
 * Img2Img生成参数
 */
export interface Img2ImgParams {
  prompt: string;
  userImageUrl: string;
  backgroundImageUrl?: string;
  negativePrompt?: string;
  imageStrength?: number;
  steps?: number;
  guidanceScale?: number;
}

/**
 * Inpaint参数
 */
export interface InpaintParams {
  prompt: string;
  imageUrl: string;
  maskUrl: string;
  negativePrompt?: string;
  steps?: number;
  guidanceScale?: number;
  grow_mask?: number;
}

/**
 * Search and Replace参数
 */
export interface SearchReplaceParams {
  prompt: string;
  target_prompt: string;
  imageUrl: string;
  negativePrompt?: string;
  steps?: number;
  guidanceScale?: number;
}

/**
 * 头像合成参数
 */
export interface AvatarCompositionParams {
  prompt: string;
  avatarUrl: string;
  backgroundUrl: string;
  negativePrompt?: string;
  imageStrength?: number;
  steps?: number;
  guidanceScale?: number;
  position?: string; // 头像位置：center, top, bottom, left, right, top-left, top-right, bottom-left, bottom-right
  removeBackground?: boolean; // 是否移除头像背景
  enhancedRemoveBackground?: boolean; // 是否使用增强抠图模式
  threshold?: number; // 抠图阈值（标准模式）
  tolerance?: number; // 颜色容差（增强模式）
  scale?: number; // 头像缩放比例：0.1-1.0
  cropShape?: string; // 裁剪形状：circle, square, rectangle, none
}

/**
 * 背景替换和重新打光参数
 */
export interface ReplaceBackgroundParams {
  image: string; // Base64编码的图像或图像URL
  backgroundPrompt: string; // 背景描述提示词
  outputFormat?: string; // 输出格式，默认为png
}

// 添加移除背景参数接口
export interface RemoveBackgroundParams {
  image: string; // Base64编码的图像或图像URL
  outputFormat?: string; // 输出格式，默认为png
}

/**
 * 处理API请求
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const requestStartTime = new Date().getTime();
  const url = `${API_BASE_URL}${endpoint}`;

  logger.info('API请求', `开始请求: ${options?.method || 'GET'} ${url}`, {
    endpoint,
    method: options?.method || 'GET',
    headers: options?.headers,
    bodySize: options?.body ? JSON.stringify(options.body).length : 0
  });
  
  try {
    // 增加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      signal: controller.signal
    });

    // 清除超时计时器
    clearTimeout(timeoutId);

    const requestDuration = new Date().getTime() - requestStartTime;
    
    let data;
    try {
      data = await response.json();
      
      logger.info('API响应', `请求完成: ${options?.method || 'GET'} ${url}`, {
        status: response.status,
        duration: requestDuration + 'ms',
        dataSize: JSON.stringify(data).length
      });
    } catch (parseError: unknown) {
      logger.error('API解析错误', `JSON解析错误: ${parseError instanceof Error ? parseError.message : String(parseError)}`, {
        url,
        status: response.status,
        duration: requestDuration + 'ms'
      });
      
      console.error('JSON解析错误:', parseError);
      return {
        error: '服务器返回了无效的数据格式'
      };
    }

    if (!response.ok) {
      // 根据HTTP状态码提供更具体的错误信息
      let errorMessage = data.message || data.error || '请求失败';
      
      switch (response.status) {
        case 404:
          errorMessage = '请求的资源不存在';
          break;
        case 401:
          errorMessage = '未授权访问';
          break;
        case 403:
          errorMessage = '禁止访问该资源';
          break;
        case 500:
          errorMessage = '服务器内部错误';
          break;
        case 502:
          errorMessage = '网关错误';
          break;
        case 503:
          errorMessage = '服务暂时不可用';
          break;
        case 504:
          errorMessage = '网关超时';
          break;
      }
      
      logger.error('API错误', `请求失败: ${response.status} ${errorMessage}`, {
        url,
        status: response.status,
        error: errorMessage,
        data: data,
        duration: requestDuration + 'ms'
      });
      
      return {
        error: errorMessage,
      };
    }

    return { data };
  } catch (error: unknown) {
    const requestDuration = new Date().getTime() - requestStartTime;
    console.error('API请求错误:', error);
    
    // 提供更具体的错误信息
    let errorMessage = '网络请求失败';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = '请求超时，请稍后重试';
      } else if (error.message.includes('fetch')) {
        errorMessage = '网络连接失败，请检查网络连接';
      } else {
        errorMessage = error.message;
      }
    }
    
    logger.error('API网络错误', errorMessage, {
      url,
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      duration: requestDuration + 'ms'
    });
    
    return {
      error: errorMessage,
    };
  }
}

/**
 * 生成AI背景图片
 */
export async function generateBackgroundImage(params: GenerateBackgroundParams): Promise<ApiResponse<JobResponse>> {
  logger.info('生成背景', '开始生成AI背景图片', { params });
  return fetchApi<JobResponse>('/api/stable-diffusion/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 查询背景生成状态
 */
export async function checkBackgroundStatus(jobId: string): Promise<ApiResponse<BackgroundStatusResponse>> {
  logger.debug('检查状态', `检查背景生成状态: ${jobId}`);
  // 尝试从两个可能的端点获取状态
  try {
    // 先尝试新的端点
    const response = await fetchApi<BackgroundStatusResponse>(`/api/stability/v2beta/status/${jobId}`);
    if (!response.error) {
      return response;
    }
    
    // 如果新端点失败，回退到旧端点
    console.log('新API端点失败，尝试旧端点');
    return fetchApi<BackgroundStatusResponse>(`/api/stable-diffusion/status/${jobId}`);
  } catch (error: any) {
    console.error('状态检查错误:', error);
    return { error: '检查状态失败' };
  }
}

/**
 * 生成Banner
 */
export async function generateBanner(params: GenerateBannerParams): Promise<ApiResponse<JobResponse>> {
  return fetchApi<JobResponse>('/api/banner/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 查询Banner生成状态
 */
export async function checkBannerStatus(jobId: string): Promise<ApiResponse<BannerStatusResponse>> {
  return fetchApi<BannerStatusResponse>(`/api/banner/${jobId}`);
}

/**
 * 上传图片到服务器
 */
export async function uploadImage(file: File): Promise<ApiResponse<UploadResponse>> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    console.log(`准备上传文件: ${file.name}, 大小: ${Math.round(file.size / 1024)}KB`);
    
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
    
    console.log('发送上传请求...');
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      // 不要设置Content-Type，让浏览器自动设置为multipart/form-data
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log('收到上传响应, 状态码:', response.status);
    
    let data: any;
    let responseText: string = '';
    try {
      // 先获取原始响应文本，防止解析错误
      responseText = await response.text();
      console.log('原始响应文本:', responseText);
      
      // 尝试解析JSON
      data = JSON.parse(responseText);
      console.log('解析后的响应数据:', data);
    } catch (parseError: any) {
      console.error('上传响应JSON解析错误:', parseError);
      console.error('原始响应:', responseText);
      return {
        error: '服务器返回了无效的数据格式'
      };
    }

    if (!response.ok) {
      console.error('上传失败，服务器响应:', data);
      return {
        error: data.error || data.message || `上传失败 (${response.status})`,
      };
    }
    
    // 确保数据包含fileUrl
    if (!data.fileUrl) {
      console.error('响应缺少fileUrl字段:', data);
      
      // 尝试寻找其他可能的URL字段
      const possibleUrlKeys = Object.keys(data).filter(key => 
        typeof data[key] === 'string' && 
        (data[key].startsWith('/uploads/') || 
         data[key].startsWith('/generated/') ||
         data[key].startsWith('http'))
      );
      
      if (possibleUrlKeys.length > 0) {
        console.log(`找到可能的URL字段: ${possibleUrlKeys[0]}, 值: ${data[possibleUrlKeys[0]]}`);
        data.fileUrl = data[possibleUrlKeys[0]];
      } else {
        return {
          error: '服务器响应中不包含文件URL'
        };
      }
    }
    
    console.log('文件上传成功，URL:', data.fileUrl);
    return { data: { fileUrl: data.fileUrl, success: true } };
  } catch (error) {
    console.error('上传请求错误:', error);
    
    // 提供更详细的错误信息
    let errorMessage = '文件上传失败';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = '上传超时，请检查网络连接或尝试上传更小的文件';
      } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        errorMessage = '网络错误，请检查您的网络连接';
      } else {
        errorMessage = `上传错误: ${error.message}`;
      }
    }
    
    return {
      error: errorMessage,
    };
  }
}

/**
 * 使用现有图片生成新图片（Img2Img）
 */
export async function generateImg2Img(params: Img2ImgParams): Promise<ApiResponse<JobResponse>> {
  return fetchApi<JobResponse>('/api/stable-diffusion/img2img', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 使用Inpaint功能进行图像编辑
 */
export async function inpaintImage(params: InpaintParams): Promise<ApiResponse<JobResponse>> {
  return fetchApi<JobResponse>('/api/stable-diffusion/inpaint', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 使用Search and Replace功能修改图像
 */
export async function searchReplaceImage(params: SearchReplaceParams): Promise<ApiResponse<JobResponse>> {
  return fetchApi<JobResponse>('/api/stable-diffusion/search-replace', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 使用头像合成功能
 */
export async function avatarComposition(params: AvatarCompositionParams): Promise<ApiResponse<JobResponse>> {
  return fetchApi<JobResponse>('/api/stable-diffusion/avatar-composition', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 获取完整的图片URL
 */
export function getFullImageUrl(imageUrl: string): string {
  if (!imageUrl) {
    console.error('传入了空的图片URL');
    return '';
  }
  
  console.log('处理图片URL:', imageUrl);
  
  // 已经是完整的HTTP URL
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    console.log('URL已经是完整的HTTP URL');
    return imageUrl;
  }

  // 处理uploads路径
  let normalizedUrl = imageUrl;
  
  // 删除结果URL中可能存在的双斜杠
  if (normalizedUrl.includes('//')) {
    normalizedUrl = normalizedUrl.replace(/\/+/g, '/');
    console.log('修正双斜杠后的URL:', normalizedUrl);
  }
  
  // 确保URL以/开头
  if (!normalizedUrl.startsWith('/')) {
    normalizedUrl = '/' + normalizedUrl;
  }
  
  const fullUrl = `${BACKEND_URL}${normalizedUrl}`;
  
  console.log('转换后的完整URL:', fullUrl);
  return fullUrl;
}

/**
 * 替换图像背景并重新打光
 * @param params 参数对象
 */
export async function replaceBackgroundAndRelight(params: ReplaceBackgroundParams): Promise<ApiResponse<JobResponse>> {
  logger.debug('替换背景', '开始请求替换背景和重新打光', { backgroundPrompt: params.backgroundPrompt });
  
  return fetchApi<JobResponse>('/api/stability/v2beta/replace-background', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

/**
 * 使用Stability AI移除图像背景
 * @param params 参数对象
 * @returns 任务响应
 */
export async function removeBackground(params: RemoveBackgroundParams): Promise<ApiResponse<any>> {
  try {
    // 这个API不通过后端，直接调用Stability API
    // 需要使用API Key，首先尝试从前端API路由获取，如果失败再尝试从后端获取
    let keyResponse: ApiResponse<{key: string}>;
    
    try {
      // 尝试从Next.js API路由获取
      const frontendResponse = await fetch('http://localhost:3000/api/stability/get-api-key');
      const data = await frontendResponse.json();
      keyResponse = { data };
    } catch (frontendError) {
      console.log('从前端获取API密钥失败，尝试从后端获取');
      // 尝试从后端获取
      keyResponse = await fetchApi<{key: string}>('/api/stability/get-api-key');
    }
    
    if (keyResponse.error || !keyResponse.data?.key) {
      return { error: keyResponse.error || '无法获取API密钥' };
    }
    
    const apiKey = keyResponse.data.key;
    
    // 准备图像数据
    let imageBlob;
    if (params.image.startsWith('data:')) {
      // 如果是Base64
      const base64Data = params.image.split(',')[1];
      imageBlob = await fetch(params.image).then(r => r.blob());
    } else {
      // 如果是URL
      const imgResponse = await fetch(getFullImageUrl(params.image));
      imageBlob = await imgResponse.blob();
    }
    
    // 创建FormData
    const formData = new FormData();
    formData.append('image', new Blob([await imageBlob.arrayBuffer()]), 'image.png');
    
    if (params.outputFormat) {
      formData.append('output_format', params.outputFormat);
    }
    
    // 直接调用Stability API
    const response = await fetch('https://api.stability.ai/v2beta/stable-image/edit/remove-background', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'image/*'
      },
      body: formData
    });
    
    if (!response.ok) {
      let errorMsg;
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorData.error || `请求失败: ${response.status}`;
      } catch (e) {
        errorMsg = `请求失败: ${response.status}`;
      }
      return { error: errorMsg };
    }
    
    // 这个API直接返回图片数据
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('image/')) {
      // 将图片转换为Base64数据URL
      const imageBuffer = await response.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const imageUrl = `data:${contentType};base64,${base64}`;
      return { data: { imageUrl } };
    } else {
      // 如果不是图片，尝试解析JSON
      try {
        const jsonData = await response.json();
        return { data: jsonData };
      } catch (e) {
        return { error: '无法解析API响应' };
      }
    }
  } catch (error: any) {
    console.error('移除背景API请求失败:', error);
    return { error: error.message || '移除背景请求失败' };
  }
}

export default {
  generateBackgroundImage,
  checkBackgroundStatus,
  generateBanner,
  checkBannerStatus,
  uploadImage,
  getFullImageUrl,
  generateImg2Img,
  inpaintImage,
  searchReplaceImage,
  avatarComposition,
  replaceBackgroundAndRelight,
  removeBackground,
}; 