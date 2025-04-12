"use client";

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent, MetalTabsList, MetalTabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, MetalCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, MetalInput } from '@/components/ui/input';
import { Label, MetalLabel } from '@/components/ui/label';

export default function FormPanel() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <MetalTabsList className="grid grid-cols-3">
          <MetalTabsTrigger value="basic">基本信息</MetalTabsTrigger>
          <MetalTabsTrigger value="style">风格设置</MetalTabsTrigger>
          <MetalTabsTrigger value="ai">AI背景</MetalTabsTrigger>
        </MetalTabsList>
        
        <TabsContent value="basic" className="mt-4">
          <MetalCard>
            <CardHeader>
              <CardTitle className="text-lg text-metal-text-primary">频道信息</CardTitle>
              <CardDescription className="text-metal-text-secondary">设置您YouTube频道的基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <MetalLabel htmlFor="channelName">频道名称</MetalLabel>
                <MetalInput id="channelName" placeholder="输入您的频道名称" />
              </div>
              
              <div className="space-y-2">
                <MetalLabel htmlFor="channelSlogan">频道口号</MetalLabel>
                <textarea 
                  id="channelSlogan" 
                  placeholder="输入您的频道描述或口号" 
                  className="w-full min-h-[80px] px-3 py-2 rounded-md bg-metal-bg-tertiary/50 border border-metal-border text-metal-text-primary focus:outline-none focus:border-metal-blue"
                />
              </div>
              
              <div className="space-y-2">
                <MetalLabel>上传Logo</MetalLabel>
                <div className="h-24 border-2 border-dashed border-metal-border rounded-lg flex items-center justify-center hover:border-metal-blue transition-colors cursor-pointer">
                  <span className="text-metal-text-secondary">点击或拖放文件</span>
                </div>
              </div>
            </CardContent>
          </MetalCard>
        </TabsContent>
        
        <TabsContent value="style" className="mt-4">
          <MetalCard>
            <CardHeader>
              <CardTitle className="text-lg text-metal-text-primary">风格设置</CardTitle>
              <CardDescription className="text-metal-text-secondary">选择Banner的外观风格</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <MetalLabel htmlFor="theme">主题风格</MetalLabel>
                <select
                  id="theme"
                  className="w-full h-10 px-3 rounded-md bg-metal-bg-tertiary/50 border border-metal-border text-metal-text-primary focus:outline-none focus:border-metal-blue"
                >
                  <option value="tech-dark">科技 / 深色</option>
                  <option value="creative-light">创意 / 明亮</option>
                  <option value="gaming">游戏风格</option>
                  <option value="minimal">极简主义</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <MetalLabel>主色调</MetalLabel>
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 border border-white cursor-pointer"></div>
                  <div className="w-8 h-8 rounded-full bg-purple-500 border border-metal-border cursor-pointer"></div>
                  <div className="w-8 h-8 rounded-full bg-green-500 border border-metal-border cursor-pointer"></div>
                  <div className="w-8 h-8 rounded-full bg-red-500 border border-metal-border cursor-pointer"></div>
                  <div className="w-8 h-8 rounded-full bg-orange-500 border border-metal-border cursor-pointer"></div>
                </div>
              </div>
              
              <div className="space-y-2">
                <MetalLabel htmlFor="layout">布局方式</MetalLabel>
                <select
                  id="layout"
                  className="w-full h-10 px-3 rounded-md bg-metal-bg-tertiary/50 border border-metal-border text-metal-text-primary focus:outline-none focus:border-metal-blue"
                >
                  <option value="centered">居中布局</option>
                  <option value="left">左侧重点</option>
                  <option value="right">右侧重点</option>
                  <option value="split">分屏布局</option>
                </select>
              </div>
            </CardContent>
          </MetalCard>
        </TabsContent>
        
        <TabsContent value="ai" className="mt-4">
          <MetalCard>
            <CardHeader>
              <CardTitle className="text-lg text-metal-text-primary">AI背景生成</CardTitle>
              <CardDescription className="text-metal-text-secondary">使用AI生成专业背景图像</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <MetalLabel htmlFor="aiPrompt">提示词</MetalLabel>
                <textarea 
                  id="aiPrompt" 
                  placeholder="描述您希望的背景风格，例如：深色科技风格，带有蓝色粒子效果" 
                  className="w-full min-h-[80px] px-3 py-2 rounded-md bg-metal-bg-tertiary/50 border border-metal-border text-metal-text-primary focus:outline-none focus:border-metal-blue"
                />
              </div>
              
              <div className="space-y-2">
                <MetalLabel htmlFor="negativePrompt">负面提示词（可选）</MetalLabel>
                <MetalInput 
                  id="negativePrompt" 
                  placeholder="不希望出现的元素，例如：文字、人物、模糊效果" 
                />
              </div>
              
              <div className="space-y-2">
                <MetalLabel>参考图像（可选）</MetalLabel>
                <div className="h-24 border-2 border-dashed border-metal-border rounded-lg flex items-center justify-center hover:border-metal-blue transition-colors cursor-pointer">
                  <span className="text-metal-text-secondary">上传参考图片</span>
                </div>
              </div>
            </CardContent>
          </MetalCard>
        </TabsContent>
      </Tabs>
      
      <Button variant="metal" className="w-full h-12 rounded-md">
        生成Banner
      </Button>
    </div>
  );
} 