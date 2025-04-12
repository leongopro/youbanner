# 🖼️ AutoYouBanner - YouTube横幅生成器

AutoYouBanner是一个响应式Web应用程序，用于自动生成符合YouTube标准的频道横幅（Banner）。

## ✨ 特色功能

- 金属感极简设计界面，灵感来源于macOS应用
- 实时预览生成的横幅，支持多设备视图切换
- 基于Stable Diffusion生成AI背景图像
- 符合YouTube规范的Banner尺寸(2560 x 1440 px)
- 安全区域(1546 x 423 px)可视化指示
- 响应式设计，适配所有设备
- 深色模式支持

## 🚀 快速开始

### 环境要求

- Node.js 16.8.0 或更高版本
- npm 或 yarn 包管理器

### 安装步骤

1. 克隆仓库

```bash
git clone https://github.com/your-username/autoyoubanner.git
cd autoyoubanner
```

2. 安装依赖

```bash
npm install
# 或
yarn
```

3. 启动开发服务器

```bash
npm run dev
# 或
yarn dev
```

4. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 🧰 技术栈

- **框架**: Next.js 14 (App Router)
- **样式**: Tailwind CSS + CSS变量系统
- **组件**: shadcn/ui + Radix UI原语
- **状态管理**: Zustand
- **表单处理**: React Hook Form + Zod验证
- **图像处理**: fabric.js 6.0 + WebGL加速
- **AI集成**: Stable Diffusion
- **TypeScript**: 类型安全的代码

## 📦 功能模块

- **表单面板**: 用户输入区域，包含基本信息、风格设置和AI背景三个选项卡
- **预览面板**: 实时预览生成的Banner，支持桌面和移动视图切换
- **金属感UI组件**: 自定义的金属风格UI组件，提供高品质视觉体验

## 📋 注意事项

- 本项目使用UTF-8编码，请确保编辑器设置正确
- 使用.gitattributes确保跨平台换行符一致性
- 深色模式为默认设计，浅色模式未完全优化

## 🤝 贡献

欢迎提交Pull Request或Issue来改进这个项目。

## 📄 许可证

[MIT](LICENSE)

---

由AutoYouBanner团队创建 © 2024 