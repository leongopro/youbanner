import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { fetchWithProgress } from './utils';

// API基础URL，开发环境中使用代理
const API_BASE_URL = process.env.NODE_ENV === 'development' ? '/api' : '/api';

// 创建Axios实例
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API错误:', error.response?.data || error.message);
    return Promise.reject(error.response?.data || error);
  }
);

/**
 * API客户端类
 */
class ApiClient {
  /**
   * 生成Banner
   */
  async generateBanner(data: {
    channelName: string;
    channelSlogan?: string;
    theme?: string;
    layout?: string;
    logoUrl?: string;
    backgroundColor?: string;
    backgroundImageUrl?: string;
  }) {
    return axiosInstance.post('/banners', data);
  }

  /**
   * 获取指定ID的Banner
   */
  async getBanner(id: string) {
    return axiosInstance.get(`/banners/${id}`);
  }

  /**
   * 删除指定ID的Banner
   */
  async deleteBanner(id: string) {
    return axiosInstance.delete(`/banners/${id}`);
  }

  /**
   * 上传Logo
   */
  async uploadLogo(file: File) {
    const formData = new FormData();
    formData.append('logo', file);

    return axiosInstance.post('/upload/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * 上传参考图片
   */
  async uploadReference(file: File) {
    const formData = new FormData();
    formData.append('reference', file);

    return axiosInstance.post('/upload/reference', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * 使用StableDiffusion生成背景图片
   */
  async generateAiBackground(data: {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    steps?: number;
    guidanceScale?: number;
  }) {
    return axiosInstance.post('/stable-diffusion/generate', data);
  }

  /**
   * 检查AI生成任务状态（带进度条）
   */
  async checkGenerationStatus(jobId: string, onProgress?: (progress: number) => void) {
    if (onProgress) {
      return fetchWithProgress(`${API_BASE_URL}/stable-diffusion/status/${jobId}`, {}, onProgress);
    }
    return axiosInstance.get(`/stable-diffusion/status/${jobId}`);
  }
}

// 导出单例
export const api = new ApiClient(); 