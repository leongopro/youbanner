"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function PreviewPanel() {
  const [viewMode, setViewMode] = useState('desktop');
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-metal-bg-secondary/30 to-metal-bg-tertiary/30 rounded-xl"></div>
          
          <div className={`overflow-hidden rounded-xl border border-metal-border shadow-xl relative backdrop-blur-sm flex items-center justify-center ${
            viewMode === 'desktop' ? 'w-[800px] max-w-full aspect-[16/9]' : 'w-[400px] max-w-full aspect-[16/9]'
          }`}>
            <div className="text-metal-text-secondary text-center p-4">
              <p className="mb-2">您的Banner预览将显示在这里</p>
              <p className="text-xs opacity-75">当前视图: {viewMode === 'desktop' ? '桌面端' : '移动端'}</p>
            </div>
          </div>
          
          {/* 安全区域指示 */}
          <div className="absolute inset-x-[20%] inset-y-[30%] border border-metal-blue/50 border-dashed rounded-lg pointer-events-none flex items-center justify-center">
            <span className="text-metal-blue/70 text-xs bg-black/30 px-2 py-1 rounded">
              安全区域
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-6 flex items-center justify-between border-t border-metal-border pt-4">
        <div className="flex gap-3">
          <Button 
            variant={viewMode === 'mobile' ? 'metal' : 'outline'} 
            onClick={() => setViewMode('mobile')}
            className={viewMode !== 'mobile' ? 'bg-metal-bg-tertiary/70 border-metal-border hover:bg-metal-bg-tertiary text-metal-text-primary' : ''}
          >
            <span className="w-4 h-4 mr-2">📱</span>
            <span>手机视图</span>
          </Button>
          <Button 
            variant={viewMode === 'desktop' ? 'metal' : 'outline'} 
            onClick={() => setViewMode('desktop')}
            className={viewMode !== 'desktop' ? 'bg-metal-bg-tertiary/70 border-metal-border hover:bg-metal-bg-tertiary text-metal-text-primary' : ''}
          >
            <span className="w-4 h-4 mr-2">🖥️</span>
            <span>桌面视图</span>
          </Button>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" className="bg-metal-bg-tertiary/70 border-metal-border hover:bg-metal-bg-tertiary text-metal-text-primary">
            <span className="w-4 h-4 mr-2">🔄</span>
            <span>重新生成</span>
          </Button>
          <Button variant="metal">
            <span className="w-4 h-4 mr-2">⬇️</span>
            <span>下载Banner</span>
          </Button>
        </div>
      </div>
    </div>
  );
} 