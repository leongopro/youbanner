# AutoYouBanner

一个自动生成YouTube Banner和背景图像的工具，使用Stable Diffusion AI生成高质量图像。

![项目标志](https://placehold.co/600x200/3b82f6/ffffff?text=AutoYouBanner)

## 📋 目录

- [功能特点](#-功能特点)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
  - [环境要求](#环境要求)
  - [安装步骤](#安装步骤)
  - [开发模式](#开发模式)
  - [生产环境](#生产环境)
- [API文档](#-api文档)
- [技术栈](#-技术栈)
- [项目结构详解](#-项目结构详解)
- [贡献指南](#-贡献指南)
- [常见问题](#-常见问题)
- [许可证](#-许可证)

## ✨ 功能特点

- **金属感极简设计界面**，灵感来源于macOS应用
- **实时预览**生成的横幅，支持多设备视图切换
- **基于Stable Diffusion生成AI背景图像**
- **符合YouTube规范的Banner尺寸**(2560 x 1440 px)
- **安全区域**(1546 x 423 px)可视化指示
- **响应式设计**，适配所有设备
- **深色模式支持**
- **多语言支持**（中文/英文）

## 🏢 项目结构

项目采用前后端分离架构：

```
autoyoubanner/
├── frontend/           # Next.js前端应用
│   ├── app/            # 页面组件目录(App Router)
│   ├── components/     # 共享组件
│   ├── lib/            # 工具函数和hooks
│   └── styles/         # 全局样式
├── backend/            # Express后端服务
│   ├── controllers/    # 业务逻辑控制器
│   ├── routes/         # API路由定义
│   ├── services/       # 第三方服务集成
│   ├── utils/          # 工具函数
│   └── uploads/        # 上传文件存储目录
└── docs/               # 项目文档
```

## 🚀 快速开始

### 环境要求

- Node.js 16.8.0 或更高版本
- npm 或 yarn 包管理器
- Stable Diffusion API密钥 ([申请地址](https://stability.ai/))

### 安装步骤

1. 克隆仓库

```bash
git clone https://github.com/your-username/autoyoubanner.git
cd autoyoubanner
```

2. 安装依赖

```bash
# 安装所有依赖（根目录、前端和后端）
npm run install-all
```

3. 配置环境变量

```bash
# 复制环境变量示例文件并编辑
cp .env.example .env
# 编辑.env文件，添加Stable Diffusion API密钥
```

### 开发模式

```bash
# 同时启动前端和后端开发服务器
npm run dev

# 或分别启动
npm run frontend  # 启动前端 - 默认端口3000
npm run backend   # 启动后端 - 默认端口5000
```

### 生产环境

```bash
# 构建前端
npm run build

# 运行生产环境
npm start
```

## 📡 API文档

### Stable Diffusion API

- `POST /api/stablediffusion/generate`
  - 功能：生成AI背景图片
  - 参数：
    - prompt: 提示词
    - negativePrompt: 负面提示词(可选)
    - width: 图片宽度
    - height: 图片高度
    - steps: 采样步数
    - guidanceScale: 提示词强度

- `GET /api/stablediffusion/status/:jobId`
  - 功能：查询生成任务状态
  - 返回：任务状态和结果URL

### Banner API

- `POST /api/banners`
  - 功能：生成YouTube Banner
  - 参数：Banner配置对象

- `GET /api/banners/:jobId`
  - 功能：查询Banner生成状态
  - 返回：Banner状态和图片URL

## �� 技术栈

- **前端**:
  - Next.js 14 (App Router)
  - React 18
  - Tailwind CSS
  - TypeScript
  - Radix UI组件
  - Zustand状态管理
  - React Hook Form + Zod验证

- **后端**:
  - Express.js
  - Multer (文件上传)
  - Sharp (图像处理)
  - Node-fetch / Axios
  - Stability AI SDK

## 📦 项目结构详解

### 前端目录结构

```
frontend/
├── app/                    # 路由页面
│   ├── page.tsx            # 首页
│   ├── background/         # 背景生成页面
│   ├── result/             # 结果页面
│   └── layout.tsx          # 全局布局
├── components/             # 组件
│   ├── BackgroundForm.tsx  # 背景生成表单
│   ├── BannerForm.tsx      # Banner生成表单
│   └── Result.tsx          # 结果显示组件
├── lib/                    # 工具和钩子
│   ├── api.ts              # API客户端
│   └── hooks/              # 自定义钩子
├── styles/                 # 样式
│   └── globals.css         # 全局样式
└── public/                 # 静态资源
```

### 后端目录结构

```
backend/
├── controllers/                    # 控制器
│   ├── banner.controller.js        # Banner控制器
│   └── stablediffusion.controller.js # AI图像控制器
├── routes/                         # 路由
│   ├── banner.routes.js            # Banner路由
│   ├── upload.routes.js            # 上传路由
│   └── stablediffusion.routes.js   # AI图像路由
├── services/                       # 服务
│   └── stability.service.js        # Stability AI服务
├── utils/                          # 工具函数
│   ├── translation.js              # 翻译工具
│   └── imageProcessing.js          # 图像处理工具
├── uploads/                        # 上传文件目录
└── server.js                       # 服务器入口文件
```

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出改进建议！

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交Pull Request

## ❓ 常见问题

**Q: 如何获取Stable Diffusion API密钥？**  
A: 访问[Stability AI](https://stability.ai/)网站注册并申请API密钥。

**Q: 应用支持哪些图片格式？**  
A: 支持JPG、PNG和WebP格式的图片上传和生成。

**Q: 是否有API使用限制？**  
A: 是的，Stable Diffusion API有使用限制，请查阅其官方文档了解详情。

## 📄 许可证

本项目采用[MIT](LICENSE)许可证。

---

由AutoYouBanner团队创建 © 2024 