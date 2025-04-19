"use client";

import React from 'react';
import Link from 'next/link';

/**
 * 页脚组件
 * 包含版权信息和开发者工具链接
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return (
    <footer className="mt-8 py-6 border-t border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-gray-600">
              &copy; {currentYear} AutoYouBanner. 保留所有权利。
            </p>
          </div>
          
          <div className="flex gap-4 text-sm">
            <Link href="/privacy" className="text-gray-600 hover:text-blue-600">
              隐私政策
            </Link>
            <Link href="/terms" className="text-gray-600 hover:text-blue-600">
              使用条款
            </Link>
            
            {/* 仅在开发环境显示 */}
            {isDevelopment && (
              <Link 
                href="/debug/logs" 
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                title="查看前端日志（仅开发环境）"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="w-4 h-4" 
                  viewBox="0 0 24 24" 
                  fill="none"
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  <circle cx="15" cy="15" r="1"></circle>
                </svg>
                错误日志
              </Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
} 