# API文档

本文档详细说明了AutoYouBanner应用程序提供的所有API端点、请求参数和响应格式。

## 基础URL

所有API请求都基于以下基础URL:

- 开发环境: `http://localhost:5000`
- 生产环境: [生产环境的URL]

## 认证

目前API不需要认证即可访问。在未来版本中，我们计划添加API密钥认证机制。

## API端点

### 背景图像生成

#### 生成背景图像

```
POST /api/stablediffusion/generate
```

生成一个基于提示词的AI背景图像。

**请求参数:**

```json
{
  "prompt": "Beautiful mountain landscape with sunrise, 4K photo, detailed, professional",
  "negativePrompt": "blurry, low quality, distorted, deformed, text, watermark",
  "width": 1024,
  "height": 1024,
  "steps": 30,
  "guidanceScale": 7.5
}
```

| 参数           | 类型     | 必填  | 描述                                     |
|---------------|---------|------|------------------------------------------|
| prompt        | string  | 是    | 描述想要生成的图像内容                      |
| negativePrompt| string  | 否    | 描述不想在图像中出现的内容                  |
| width         | number  | 否    | 图像宽度，必须是64的倍数 (默认: 1024)       |
| height        | number  | 否    | 图像高度，必须是64的倍数 (默认: 1024)       |
| steps         | number  | 否    | 采样步数，数值越高质量越好 (默认: 30)        |
| guidanceScale | number  | 否    | 提示词强度，控制图像与提示的匹配度 (默认: 7.5) |

**响应:**

```json
{
  "jobId": "12345-67890-abcde",
  "status": "processing"
}
```

| 字段    | 类型     | 描述                    |
|--------|---------|------------------------|
| jobId  | string  | 生成任务的唯一标识符      |
| status | string  | 任务状态 (processing)   |

**错误:**

```json
{
  "error": "Invalid prompt provided",
  "message": "提示词不能为空"
}
```

#### 查询背景生成任务状态

```
GET /api/stablediffusion/status/:jobId
```

查询特定背景生成任务的状态。

**路径参数:**

| 参数   | 描述                 |
|-------|---------------------|
| jobId | 生成任务的唯一标识符   |

**响应:**

```json
{
  "status": "completed",
  "result": {
    "imageUrl": "/uploads/background-12345.png",
    "width": 1024,
    "height": 1024
  }
}
```

| 字段                | 类型     | 描述                                   |
|--------------------|---------|---------------------------------------|
| status             | string  | 任务状态 (processing/completed/failed) |
| result             | object  | 任务结果对象 (仅在完成时)                |
| result.imageUrl    | string  | 生成图像的URL路径                       |
| result.width       | number  | 图像宽度                               |
| result.height      | number  | 图像高度                               |

**失败响应:**

```json
{
  "status": "failed",
  "error": "Generation failed due to API error"
}
```

### Banner生成

#### 生成YouTube Banner

```
POST /api/banners
```

生成一个符合YouTube规范的Banner图像。

**请求参数:**

```json
{
  "text": "Channel Name",
  "logoUrl": "/uploads/logo.png",
  "backgroundUrl": "/uploads/background.jpg",
  "textColor": "#ffffff",
  "fontSize": 48,
  "textPosition": "center",
  "template": "minimal"
}
```

| 参数           | 类型     | 必填  | 描述                                   |
|---------------|---------|------|----------------------------------------|
| text          | string  | 是    | Banner上显示的文本                      |
| logoUrl       | string  | 否    | 已上传Logo的URL路径                     |
| backgroundUrl | string  | 否    | 背景图像的URL路径                       |
| textColor     | string  | 否    | 文本颜色，十六进制格式 (默认: #ffffff)   |
| fontSize      | number  | 否    | 文本字体大小 (默认: 48)                 |
| textPosition  | string  | 否    | 文本位置 (left/center/right)           |
| template      | string  | 否    | 预设模板名称                            |

**响应:**

```json
{
  "jobId": "12345-67890-abcde",
  "status": "processing"
}
```

#### 查询Banner生成任务状态

```
GET /api/banners/:jobId
```

查询特定Banner生成任务的状态。

**路径参数:**

| 参数   | 描述                |
|-------|---------------------|
| jobId | 生成任务的唯一标识符  |

**响应:**

```json
{
  "status": "completed",
  "imageUrl": "/uploads/banner-12345.png",
  "previewUrls": {
    "desktop": "/uploads/banner-12345-desktop.png",
    "mobile": "/uploads/banner-12345-mobile.png",
    "tablet": "/uploads/banner-12345-tablet.png"
  }
}
```

### 文件上传

#### 上传图片

```
POST /api/upload
```

上传图片文件(logo或自定义背景)。

**请求:**

必须使用`multipart/form-data`格式，包含名为`image`的文件字段。

**响应:**

```json
{
  "success": true,
  "fileUrl": "/uploads/image-12345.png"
}
```

## 错误处理

所有API错误都会返回适当的HTTP状态码和JSON格式的错误信息：

```json
{
  "error": "错误类型",
  "message": "详细错误描述"
}
```

常见HTTP状态码：

- 400 - 错误请求(参数错误)
- 404 - 资源不存在
- 500 - 服务器内部错误

## 速率限制

为防止API滥用，有以下速率限制：

- Stable Diffusion生成: 每小时10次请求
- Banner生成: 每小时20次请求
- 文件上传: 每小时30次请求，每个文件最大10MB

## 更新日志

- 2024-05-01: 初始API文档发布
- 2024-05-15: 添加了Banner生成的新参数
- 2024-06-01: 增加了文件上传大小限制 