import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并Tailwind CSS类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 延迟执行函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 格式化日期
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 安全地获取嵌套对象属性
 */
export function get(obj: any, path: string, defaultValue: any = undefined) {
  const travel = (regexp: RegExp) =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === obj ? defaultValue : result;
}

/**
 * 随机颜色生成器
 */
export function getRandomColor(): string {
  return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
}

/**
 * 有效URL检查
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 创建一个带有状态追踪的API请求
 */
export async function fetchWithProgress<T>(
  url: string, 
  options: RequestInit = {}, 
  onProgress?: (progress: number) => void
): Promise<T> {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  // 对于流式响应，比如任务进度更新
  if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Cannot read response");
    
    let done = false;
    let result = '';
    
    while (!done) {
      const { done: doneReading, value } = await reader.read();
      done = doneReading;
      
      if (done) break;
      
      const text = new TextDecoder().decode(value);
      result += text;
      
      // 解析进度信息
      try {
        const data = JSON.parse(text);
        if (data.progress && onProgress) {
          onProgress(data.progress);
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    return JSON.parse(result) as T;
  }
  
  return response.json() as T;
} 