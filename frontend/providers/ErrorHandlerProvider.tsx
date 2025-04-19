"use client";

import React, { ReactNode } from 'react';
import useErrorHandler from '@/hooks/useErrorHandler';

interface ErrorHandlerProviderProps {
  children: ReactNode;
}

/**
 * 错误处理Provider组件
 * 在应用级别统一注入全局错误处理
 */
export function ErrorHandlerProvider({ children }: ErrorHandlerProviderProps) {
  // 注册全局错误处理
  useErrorHandler();
  
  return <>{children}</>;
} 