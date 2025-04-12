# AutoYouBanner UI设计文档

## 🎨 设计理念

AutoYouBanner采用**金属感极简主义**设计风格，灵感来源于macOS原生应用（如Logic Pro和Final Cut Pro）。这种设计风格将为创意工具带来专业感和现代感，同时保持用户界面简洁直观。

## 🎭 设计语言特点

- **金属质感渐变**：深灰色调加高光，创造金属拉丝效果
- **毛玻璃效果**：半透明背景配合模糊，增强深度感
- **微妙的光影**：精细阴影和高光，强化UI的层次感
- **高对比文本**：确保在深色背景上可读性
- **拟物化控件**：带有立体感的按钮和滑块，提供触感反馈
- **动效节制**：流畅但不夸张的过渡动画

## 📐 布局结构

### 桌面视图 (>1024px)
```
┌────────────────────────────────────────────────┐
│                    顶部导航栏                   │
├────────────────────┬───────────────────────────┤
│                    │                           │
│                    │                           │
│                    │                           │
│    表单控制区域     │         预览区域          │
│      (1/3)         │          (2/3)           │
│                    │                           │
│                    │                           │
│                    │                           │
├────────────────────┴───────────────────────────┤
│                    状态栏                       │
└────────────────────────────────────────────────┘
```

### 平板视图 (768px-1024px)
```
┌────────────────────────────────────────────┐
│                顶部导航栏                   │
├────────────────────┬───────────────────────┤
│                    │                       │
│                    │                       │
│   表单控制区域      │       预览区域        │
│     (40%)          │        (60%)          │
│                    │                       │
│                    │                       │
├────────────────────┴───────────────────────┤
│                  状态栏                     │
└────────────────────────────────────────────┘
```

### 移动视图 (<768px)
```
┌────────────────────────────┐
│         顶部导航栏          │
├────────────────────────────┤
│                            │
│         预览区域            │
│                            │
├────────────────────────────┤
│                            │
│       表单控制区域          │
│    (可展开/折叠的卡片)      │
│                            │
├────────────────────────────┤
│          状态栏             │
└────────────────────────────┘
```

## 🎨 色彩系统

### 主色调
| 用途 | 颜色代码 | 描述 |
|------|---------|------|
| 背景主色 | `#1c1c1e` | 深空灰，主背景色 |
| 背景次色 | `#2c2c2e` | 中深灰，卡片背景 |
| 背景高亮 | `#3a3a3c` | 中灰，高亮元素背景 |
| 边框色 | `#4c4c4e` | 浅灰，分隔线和边框 |
| 强调色 | `#0A84FF` | 苹果蓝，主按钮和重点元素 |
| 强调次色 | `#0066CC` | 深蓝，强调色的渐变搭配 |
| 警告色 | `#FF9F0A` | 橙色，警告提示 |
| 错误色 | `#FF453A` | 红色，错误提示 |
| 成功色 | `#30D158` | 绿色，成功提示 |

### 文本颜色
| 用途 | 颜色代码 | 描述 |
|------|---------|------|
| 主文本色 | `#F0F0F5` | 近白色，主要文本 |
| 次文本色 | `#AEAEB2` | 浅灰色，次要文本 |
| 禁用文本 | `#68686D` | 深灰色，禁用状态 |

### 渐变
| 用途 | 渐变值 | 描述 |
|------|-------|------|
| 金属背景 | `linear-gradient(to bottom right, #2c2c2e, #1c1c1e)` | 主要背景渐变 |
| 按钮渐变 | `linear-gradient(to right, #0A84FF, #0066CC)` | 主按钮渐变 |
| 标题渐变 | `linear-gradient(to right, #ffffff, #aeaeb2)` | 金属感文本渐变 |

## 🧩 UI组件设计

### 导航栏

**设计特点**：
- 毛玻璃效果背景（`backdrop-blur-md`）
- 渐变标题文本
- 图标按钮带有微妙的悬停效果
- 固定在顶部

```jsx
<header className="fixed top-0 w-full h-12 bg-[#1c1c1e]/80 backdrop-blur-md 
                   border-b border-[#3a3a3c] flex items-center px-6 z-10">
  <h1 className="text-xl font-medium bg-gradient-to-r from-white to-zinc-400 
                 text-transparent bg-clip-text">AutoYouBanner</h1>
  <div className="ml-auto flex gap-3">
    <ThemeToggle />
    <UserMenu />
  </div>
</header>
```

### 表单区域

**设计特点**：
- 标签页组织内容，减少视觉干扰
- 卡片式表单分组
- 控件采用金属质感样式
- 表单操作即时响应

**主要组件**：
1. **Tabs**：分类表单控制项
   - 样式：半透明背景，激活项有明显高亮
   - 分类：基本信息、风格设置、AI背景

2. **卡片**：每个分组使用卡片
   - 样式：暗灰色半透明背景，边缘带细微圆角和阴影
   - 内容：紧凑排列的表单控件

3. **输入控件**：
   - 文本输入：深色背景，浅色文本，蓝色焦点状态
   - 滑块：金属质感滑块，蓝色渐变轨道
   - 下拉选择：毛玻璃背景下拉菜单

```jsx
<Card className="bg-[#2c2c2e]/70 border-[#3a3a3c] shadow-md rounded-xl">
  <CardHeader>
    <CardTitle className="text-zinc-100">频道信息</CardTitle>
    <CardDescription className="text-zinc-400">设置您YouTube频道的基本信息</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="channelName" className="text-zinc-300">频道名称</Label>
      <Input 
        id="channelName" 
        placeholder="输入您的频道名称" 
        className="bg-[#3a3a3c]/50 border-[#4c4c4e] focus:border-[#0A84FF] text-white"
      />
    </div>
    
    <!-- 其他表单控件 -->
  </CardContent>
</Card>
```

### 预览区域

**设计特点**：
- 居中显示的Banner预览
- 金属质感外框，增强视觉焦点
- 安全区域视觉指引
- 底部控制栏附带视图切换和操作按钮

```jsx
<div className="relative">
  <div className="absolute inset-0 bg-gradient-to-r from-[#2c2c2e]/30 
                   to-[#3a3a3c]/30 rounded-xl"></div>
  
  <Card className="w-[800px] max-w-full aspect-[16/9] overflow-hidden 
                 rounded-xl border border-[#3a3a3c] shadow-xl relative backdrop-blur-sm">
    <!-- 预览内容 -->
  </Card>
  
  <!-- 安全区域指示 -->
  <div className="absolute inset-x-[20%] inset-y-[30%] border border-[#0A84FF]/50 
                 border-dashed rounded-lg pointer-events-none">
    <span className="text-[#0A84FF]/70 text-xs bg-black/30 px-2 py-1 rounded">
      安全区域
    </span>
  </div>
</div>
```

### 金属感按钮

**设计特点**：
- 渐变背景模拟金属光泽
- 微妙的内阴影增强按压感
- 悬停状态提供视觉反馈
- 图标+文本组合提升可识别性

```jsx
<Button className="bg-gradient-to-r from-[#0A84FF] to-[#0066CC] hover:from-[#0091FF] 
                  hover:to-[#0077E6] border-none text-white shadow-inner 
                  shadow-white/10 font-medium">
  <Download className="mr-2 h-4 w-4" />
  下载Banner
</Button>

<Button variant="outline" className="bg-[#3a3a3c]/70 border-[#4c4c4e] 
                                   hover:bg-[#4a4a4c] text-white">
  <RefreshCw className="mr-2 h-4 w-4" />
  重新生成
</Button>
```

### 自定义滑块组件

**设计特点**：
- 轨道使用渐变色
- 滑块采用金属质感设计
- 交互时有微妙的光影变化

```css
.metal-slider-track {
  @apply h-1.5 w-full rounded-full bg-[#3a3a3c] overflow-hidden;
}

.metal-slider-range {
  @apply absolute h-full bg-gradient-to-r from-[#0A84FF] to-[#0066CC];
}

.metal-slider-thumb {
  @apply block h-5 w-5 rounded-full border border-[#5a5a5c] 
         bg-gradient-to-br from-[#8e8e93] to-[#636366] shadow-xl 
         transition-all duration-100 ease-out;
}

.metal-slider-thumb:hover {
  @apply from-[#9e9e9e] to-[#737376];
}

.metal-slider-thumb:active {
  @apply scale-95;
}
```

## 📱 响应式设计策略

### 大屏幕 (>1024px)
- 标准左右分栏布局(1/3 + 2/3)
- 完整显示所有控件
- 大尺寸预览区域

### 平板设备 (768px-1024px)
- 保持左右布局，但调整比例(40% + 60%)
- 表单区域变得更紧凑
- 预览区域适当缩小

### 移动设备 (<768px)
- 改为上下布局
- 表单区域使用可折叠卡片
- 预览区域优先显示
- 底部固定的主操作按钮

**关键断点适配技术**：
```jsx
// 移动优先设计
<div className="flex flex-col h-screen lg:flex-row">
  {/* 导航栏 - 始终在顶部 */}
  <header className="h-14 border-b flex items-center px-4">...</header>
  
  {/* 主内容区 - 移动端上下布局，桌面端左右布局 */}
  <main className="flex flex-col lg:flex-row flex-grow overflow-hidden">
    {/* 表单区域 - 移动端100%宽度，桌面端1/3宽度 */}
    <section className="w-full lg:w-2/5 xl:w-1/3 p-4 overflow-y-auto order-2 lg:order-1">
      <div className="sticky top-0 space-y-4">
        {/* 移动端可折叠区域 */}
        <Disclosure>
          <DisclosureButton className="lg:hidden w-full py-2 flex justify-between items-center">
            <span>基本设置</span>
            <ChevronDownIcon className="h-5 w-5" />
          </DisclosureButton>
          <DisclosurePanel>
            <FormPanel />
          </DisclosurePanel>
        </Disclosure>
        
        {/* 桌面端始终显示 */}
        <div className="hidden lg:block">
          <FormPanel />
        </div>
      </div>
    </section>
    
    {/* 预览区域 - 移动端优先显示 */}
    <section className="w-full lg:w-3/5 xl:w-2/3 bg-[#1c1c1e] p-4 flex-shrink-0 order-1 lg:order-2">
      <PreviewPanel />
    </section>
  </main>
  
  {/* 移动端底部操作栏 */}
  <footer className="lg:hidden fixed bottom-0 w-full bg-[#1c1c1e]/90 backdrop-blur-md 
                    border-t border-[#3a3a3c] p-4">
    <Button className="w-full bg-gradient-to-r from-[#0A84FF] to-[#0066CC]">
      下载Banner
    </Button>
  </footer>
</div>
```

## 🌐 PWA & 跨平台支持

为确保应用可以作为WebApp部署到安卓、iOS和PC上，我们将实现：

### PWA配置
- 自定义manifest.json
- 各尺寸图标
- 服务工作线程实现离线功能
- iOS专用meta标签优化

```json
{
  "name": "AutoYouBanner",
  "short_name": "YouBanner",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "theme_color": "#1c1c1e",
  "background_color": "#1c1c1e",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait"
}
```

### 移动设备优化
- 适配不同设备的视口
- 针对触摸优化的控件尺寸（至少48×48px的点击区域）
- 支持手势操作（如预览图的缩放、拖动）
- 添加haptic反馈（iOS和安卓）

### 跨平台兼容性
- 使用媒体查询适配不同设备
- 保持一致的视觉风格
- 实现平台特定功能的优雅降级

## 🛠️ 实现技术栈

- **框架**: Next.js 14 (App Router)
- **样式**: Tailwind CSS + CSS变量系统
- **组件库**: shadcn/ui + Radix UI原语
- **状态管理**: Zustand
- **表单处理**: React Hook Form + Zod
- **图像处理**: fabric.js + WebGL加速
- **动画**: Framer Motion
- **金属感增强**: 自定义CSS + Tailwind插件

## 📐 关键组件设计规范

### 输入控件

| 元素 | 尺寸/样式 |
|------|----------|
| 输入框高度 | 40px (桌面), 48px (移动) |
| 输入框圆角 | 8px |
| 标签字体 | 14px, Medium, #F0F0F5 |
| 占位文本 | 14px, Regular, #AEAEB2 |
| 输入文本 | 14px, Regular, #FFFFFF |
| 焦点状态 | 边框色 #0A84FF |

### 按钮尺寸

| 类型 | 尺寸/样式 |
|------|----------|
| 主按钮 | 高40px，水平内边距16px，圆角8px |
| 次级按钮 | 高40px，水平内边距12px，圆角8px |
| 图标按钮 | 40px × 40px，圆角8px |
| 移动端按钮 | 高48px (增大触摸区域) |

### 间距系统

| 元素关系 | 间距 |
|---------|------|
| 相关表单项之间 | 16px |
| 分组卡片之间 | 24px |
| 卡片内边距 | 16px |
| 文本与输入框 | 8px |
| 按钮组间距 | 12px |

## 🔍 可访问性考量

- **对比度**: 所有文本保持与背景4.5:1以上的对比度
- **键盘导航**: 完整的键盘导航支持，清晰的焦点状态
- **屏幕阅读器**: 所有组件添加适当的ARIA标签
- **减少动效**: 提供减少动效选项
- **文本大小**: 支持操作系统的文本大小调整

## 📱 设备兼容性目标

- **桌面浏览器**: Chrome, Firefox, Safari, Edge (最新2个版本)
- **iOS**: Safari on iOS 14+
- **安卓**: Chrome on Android 8+
- **平板**: iPad OS 14+, Android 9+ 平板设备

---

设计文档由AutoYouBanner团队创建，灵感来源于macOS应用和专业级创意工具。 