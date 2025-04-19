"use client";

import { useEffect } from 'react';
import logger from '@/lib/logger';

/**
 * 错误详情接口
 */
interface ErrorDetails {
  timestamp: string;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  location?: string;
  [key: string]: any; // 允许添加其他属性
}

/**
 * 全局错误处理钩子
 * 捕获未处理的Promise拒绝和全局错误
 */
export default function useErrorHandler() {
  useEffect(() => {
    // 处理未捕获的全局错误
    const handleGlobalError = (event: ErrorEvent) => {
      const { message, filename, lineno, colno, error } = event;
      
      logger.error('全局错误', `未捕获的错误: ${message}`, {
        location: `${filename}:${lineno}:${colno}`,
        errorName: error?.name,
        errorStack: error?.stack,
        timestamp: new Date().toISOString()
      });
      
      // 防止默认的错误处理，如控制台日志
      event.preventDefault();
    };
    
    // 处理未捕获的Promise拒绝
    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let errorDetails: ErrorDetails = {
        timestamp: new Date().toISOString()
      };
      
      // 尝试提取更多错误信息
      if (reason instanceof Error) {
        errorDetails = {
          ...errorDetails,
          errorName: reason.name,
          errorMessage: reason.message,
          errorStack: reason.stack
        };
      } else if (typeof reason === 'object' && reason !== null) {
        // 对于非Error对象，尝试安全地合并属性
        try {
          errorDetails = {
            ...errorDetails,
            // 使用对象展开而不是直接赋值，避免潜在的副作用
            ...Object.keys(reason).reduce((acc, key) => {
              try {
                acc[key] = reason[key];
              } catch (e) {
                // 忽略不可访问的属性
              }
              return acc;
            }, {} as Record<string, any>)
          };
        } catch (e) {
          // 如果无法安全合并，只记录基本信息
          errorDetails.errorMessage = String(reason);
        }
      } else {
        // 对于原始类型值
        errorDetails.errorMessage = String(reason);
      }
      
      logger.error('未处理的Promise拒绝', `Promise被拒绝: ${reason?.message || String(reason)}`, errorDetails);
      
      // 防止默认处理
      event.preventDefault();
    };
    
    // 监听错误事件
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);
    
    // 组件卸载时移除事件监听
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, []);
} 