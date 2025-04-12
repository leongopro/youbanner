"use client";

import FormPanel from "@/components/FormPanel";
import PreviewPanel from "@/components/PreviewPanel";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 w-full h-12 bg-metal-bg-primary/80 backdrop-blur-md border-b border-metal-border flex items-center px-6 z-10">
        <h1 className="text-xl font-medium text-metal-gradient">
          AutoYouBanner
        </h1>
        <div className="ml-auto flex gap-3">
          {/* 这里将来会添加主题切换和用户菜单 */}
        </div>
      </header>
      
      <div className="flex w-full h-full pt-12">
        {/* 左边栏 - 表单区域 */}
        <aside className="w-full lg:w-1/3 bg-metal-bg-secondary/50 backdrop-blur-md border-b lg:border-r border-metal-border p-4 lg:p-6 overflow-y-auto order-2 lg:order-1">
          <FormPanel />
        </aside>

        {/* 右边 - 预览区域 */}
        <main className="w-full lg:w-2/3 bg-metal-bg-primary p-4 lg:p-6 flex flex-col flex-1 order-1 lg:order-2">
          <PreviewPanel />
        </main>
      </div>
      
      {/* 移动端底部操作栏 */}
      <footer className="lg:hidden fixed bottom-0 w-full bg-metal-bg-primary/90 backdrop-blur-md border-t border-metal-border p-4">
        <button className="w-full btn-metal h-12 rounded-md flex items-center justify-center">
          下载Banner
        </button>
      </footer>
    </div>
  );
} 