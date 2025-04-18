# 头像位置自定义功能使用指南

## 功能概述

新版头像合成功能允许您更灵活地控制头像在背景图像上的位置。现在支持以下几种位置设置方式：

1. 预设位置名称
2. 精确像素坐标
3. 百分比位置
4. 直接在请求中使用 `x` 和 `y` 参数

## 使用方法

### 1. 预设位置名称

您可以使用以下预设位置名称，通过 `position` 参数进行设置：

- `center`（默认）- 头像在背景中央，略微偏上以获得更自然的视觉效果
- `top` - 头像在背景顶部中央
- `bottom` - 头像在背景底部中央
- `left` - 头像在背景左侧中央
- `right` - 头像在背景右侧中央
- `top-left` - 头像在背景左上角
- `top-right` - 头像在背景右上角
- `bottom-left` - 头像在背景左下角
- `bottom-right` - 头像在背景右下角

示例请求：
```json
{
  "prompt": "照片风格，自然光线",
  "avatarUrl": "/uploads/avatar.jpg",
  "backgroundUrl": "/uploads/background.png",
  "position": "top-right"
}
```

### 2. 精确像素坐标

您可以使用字符串格式 `"x:像素值,y:像素值"` 指定头像左上角在背景中的精确位置：

示例请求：
```json
{
  "prompt": "照片风格，自然光线",
  "avatarUrl": "/uploads/avatar.jpg",
  "backgroundUrl": "/uploads/background.png",
  "position": "x:100,y:200"
}
```

这将把头像放置在背景图像上坐标为 (100, 200) 的位置。

### 3. 百分比位置

您可以使用百分比格式来相对定位头像，格式为 `"x:百分比%,y:百分比%"`：

示例请求：
```json
{
  "prompt": "照片风格，自然光线",
  "avatarUrl": "/uploads/avatar.jpg",
  "backgroundUrl": "/uploads/background.png",
  "position": "x:25%,y:75%"
}
```

这将把头像放置在背景宽度的 25% 和高度的 75% 位置。

### 4. 直接使用 x 和 y 参数

为了更直观，您也可以直接在请求中使用 `x` 和 `y` 参数来设置位置：

示例请求：
```json
{
  "prompt": "照片风格，自然光线",
  "avatarUrl": "/uploads/avatar.jpg",
  "backgroundUrl": "/uploads/background.png",
  "x": 150,
  "y": 300
}
```

或使用百分比：
```json
{
  "prompt": "照片风格，自然光线",
  "avatarUrl": "/uploads/avatar.jpg",
  "backgroundUrl": "/uploads/background.png",
  "x": "30%",
  "y": "40%"
}
```

## 注意事项

- 系统会自动确保头像位置在有效范围内，防止头像超出背景边界
- 百分比值是相对于背景图像减去头像尺寸后的可用空间计算的，这样能确保即使设置 100% 也不会使头像超出背景
- 如果同时提供 `position` 参数和 `x`/`y` 参数，系统会优先使用 `x`/`y` 参数
- 当使用百分比时，0% 表示最左/最上位置，100% 表示最右/最下位置 