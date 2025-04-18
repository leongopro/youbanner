# 项目结构说明

本文档详细说明了 AutoYouBanner 项目的结构和各个组件的功能。该项目采用前后端分离架构，包含一个 Next.js 前端和 Express 后端。

## 总体架构

```
autoyoubanner/
├── frontend/           # Next.js 前端应用
├── backend/            # Express 后端服务
├── docs/               # 项目文档
├── .env                # 环境变量配置
├── .env.example        # 环境变量示例
├── package.json        # 项目依赖和脚本
└── README.md           # 项目说明
```

## 前端结构

### 目录结构

```
frontend/
├── app/                # 页面组件(Next.js App Router)
│   ├── page.tsx        # 首页
│   ├── layout.tsx      # 全局布局
│   ├── background/     # 背景生成页面
│   └── result/         # 结果页面
├── components/         # 共享组件
│   ├── BackgroundForm.tsx  # 背景生成表单
│   ├── BannerForm.tsx      # Banner生成表单
│   └── Result.tsx          # 结果显示组件
├── lib/                # 工具函数和钩子
│   ├── api.ts          # API客户端
│   └── hooks/          # 自定义钩子
├── styles/             # 样式
│   └── globals.css     # 全局样式
├── public/             # 静态资源
└── package.json        # 前端依赖
```

### 主要组件

#### 页面组件 (`app/`)

- **page.tsx**: 首页，包含Banner生成和AI背景生成选项卡
- **background/page.tsx**: 专门的AI背景生成页面
- **result/page.tsx**: 显示生成结果的页面，处理任务状态监控和图像显示

#### 共享组件 (`components/`)

- **BackgroundForm.tsx**: AI背景生成表单，处理提示词输入和图像生成参数
- **BannerForm.tsx**: YouTube Banner生成表单，管理Logo上传和样式设置
- **Result.tsx**: 结果显示组件，处理加载状态、成功状态和错误显示

#### 工具和API (`lib/`)

- **api.ts**: 封装对后端API的请求，提供类型安全的接口
- **hooks/**: 自定义React钩子，如`useWindowSize`和`useDebounce`

## 后端结构

### 目录结构

```
backend/
├── controllers/                    # 控制器
│   ├── banner.controller.js        # Banner生成控制器
│   └── stablediffusion.controller.js # AI图像生成控制器
├── routes/                         # 路由
│   ├── banner.routes.js            # Banner路由
│   ├── upload.routes.js            # 文件上传路由
│   └── stablediffusion.routes.js   # AI图像生成路由
├── services/                       # 服务层
│   └── stability.service.js        # Stability AI服务
├── utils/                          # 工具函数
│   └── translation.js              # 翻译工具
├── uploads/                        # 上传文件目录
├── server.js                       # 服务器入口文件
└── package.json                    # 后端依赖
```

### 主要模块

#### 控制器 (`controllers/`)

- **banner.controller.js**: 处理YouTube Banner生成请求
- **stablediffusion.controller.js**: 处理AI背景图像生成请求和任务状态

#### 路由 (`routes/`)

- **banner.routes.js**: 定义Banner相关的API端点
- **upload.routes.js**: 处理文件上传的API端点
- **stablediffusion.routes.js**: 定义Stable Diffusion相关的API端点

#### 服务 (`services/`)

- **stability.service.js**: 封装与Stability AI API的交互，处理图像生成请求和响应

#### 工具 (`utils/`)

- **translation.js**: 提供中文到英文的翻译功能，用于处理中文提示词

## 主要功能流程

### AI背景生成流程

1. 用户在前端填写提示词和参数
2. 前端通过`api.ts`中的`generateBackground`函数发送请求
3. 后端`stablediffusion.routes.js`路由接收请求并转发给控制器
4. `stablediffusion.controller.js`控制器创建任务并异步处理
5. 控制器使用`translation.js`翻译中文提示词
6. 控制器调用`stability.service.js`生成图像
7. 服务层与Stability AI API交互，获取生成的图像
8. 图像保存到服务器，URL存储在任务状态中
9. 前端通过`checkBackgroundStatus`函数轮询任务状态
10. 任务完成后，前端显示生成的图像

### YouTube Banner生成流程

1. 用户在前端填写Banner信息并上传Logo
2. 前端通过`api.ts`中的`generateBanner`函数发送请求
3. 后端`banner.routes.js`路由接收请求并转发给控制器
4. `banner.controller.js`控制器处理Banner生成
5. Banner图像保存到服务器，URL返回给前端
6. 前端显示生成的Banner

## 数据流

1. 用户输入 → 前端组件
2. 前端组件 → API客户端
3. API客户端 → 后端路由
4. 后端路由 → 控制器
5. 控制器 → 服务层
6. 服务层 → 外部API/数据处理
7. 服务层 → 控制器
8. 控制器 → 后端路由
9. 后端路由 → API客户端
10. API客户端 → 前端组件
11. 前端组件 → 用户界面

## 部署考虑

- 前端可独立部署到静态网站托管服务
- 后端可部署到Node.js支持的服务器
- 上传目录需要持久化存储
- 环境变量在生产环境中需要安全配置
- 可以使用Docker容器化应用程序 