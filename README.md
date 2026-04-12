# AI 图片生成器

基于阿里云百炼（DashScope）平台的 AI 图片生成 Web 应用，支持**文生图**和**图生图**两种模式。前端使用 Bootstrap 5 构建，后端使用 Express 代理 API 请求，支持多种模型切换。

## 功能特性

### 🎨 文生图模式
- **多模型支持**：内置 16+ 阿里云百炼文生图模型，包括万相 2.7、万相 2.x、千问 Qwen-Image、Z-Image 等
- **模型切换**：支持在前端页面直接切换不同模型，自动适配同步/异步调用协议
- **生成参数控制**：支持图片数量 (1-4张)、尺寸、随机种子、负向提示词、提示词增强、水印等参数调节
- **动态尺寸适配**：切换模型时自动更新可用尺寸选项

### 🖼️ 图生图模式
- **参考图上传**：支持拖拽上传和点击上传，最大 10MB
- **参考图强度控制**：可调滑块控制生成图片与参考图的相似度 (0-1)
- **多模型支持**：支持万相 2.7、2.6 系列模型
- **图片预览**：上传前即时预览参考图

### 🌐 通用功能
- **API Key 管理**：前端输入 API Key，自动缓存至本地，提供直达百炼控制台获取链接
- **自定义 Favicon**：支持多种尺寸的网站图标，适配不同设备和浏览器
- **响应式 UI**：基于 Bootstrap 5，适配桌面和移动端
- **实时预览**：生成完成后直接展示图片，支持多张网格显示和一键下载
- **快捷键支持**：Ctrl+Enter 快速生成

## 支持的模型

### 文生图模型

| 系列 | 模型名称 | 说明 | 最高分辨率 |
|------|----------|------|-----------|
| ⭐ 万相 2.7 | `wan2.7-image-pro` | 最新推荐，支持 4K、组图生成 | 4K |
| ⭐ 万相 2.7 | `wan2.7-image` | 快速版本 | 2K |
| 🎨 万相 2.6 | `wan2.6-image` | 图文混排输出 | 1280×1280 |
| 万相 2.6 | `wan2.6-t2i` | 标准模型 | 1440×1440 |
| 万相 2.5 | `wan2.5-t2i-preview` | 预览版 | 1440×1440 |
| 万相 2.2 | `wan2.2-t2i-flash` | 极速版 | 1440×1440 |
| 万相 2.2 | `wan2.2-t2i-plus` | 增强版 | 1440×1440 |
| 万相 2.1 | `wanx2.1-t2i-turbo` | 经典快速版 | 1024×1024 |
| 万相 2.1 | `wanx2.1-t2i-plus` | 经典专业版 | 1024×1024 |
| 万相 2.0 | `wanx2.0-t2i-turbo` | 早期版本 | 1024×1024 |
| 💬 千问 | `qwen-image-2.0-pro` | 擅长文字渲染 | 2048×2048 |
| 💬 千问 | `qwen-image-2.0` | 加速版 | 2048×2048 |
| 💬 千问 | `qwen-image-max` | 真实感强 | 1664×928 |
| 💬 千问 | `qwen-image-plus` | 艺术风格 | 1664×928 |
| 💬 千问 | `qwen-image` | 标准版 | 1664×928 |
| 🚀 Z-Image | `z-image-turbo` | 轻量快速 | 1024×1024 |

### 图生图模型

| 系列 | 模型名称 | 说明 | 最高分辨率 |
|------|----------|------|-----------|
| ⭐ 万相 2.7 | `wan2.7-image-pro` | 最强效果 | 2K |
| ⭐ 万相 2.7 | `wan2.7-image` | 快速版本 | 2K |
| 🎨 万相 2.6 | `wan2.6-image` | 图文混排 | 2K |
| 万相 2.6 | `wan2.6-t2i` | 标准版本 | 2K |

## 快速开始

### 1. 环境准备

- Node.js >= 18.0.0
- 阿里云百炼 API Key（[获取地址](https://bailian.console.aliyun.com/cn-beijing?apiKey=1&tab=model#/api-key)）

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量（可选）

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 可选：在此配置 API Key，也可在前端页面输入
DASHSCOPE_API_KEY=your_api_key_here
# 服务端口，默认 3000
PORT=3000
```

### 4. 启动服务

```bash
npm start
```

服务启动后访问：http://localhost:3000

## 项目结构

```
AI-image/
├── server.js           # Express 后端，代理 DashScope API
├── package.json        # 项目依赖配置
├── .env.example        # 环境变量模板
├── .gitignore
└── public/
    ├── index.html      # Bootstrap 5 前端页面
    ├── app.js          # 前端交互逻辑
    └── favicon/
        ├── favicon.ico              # 标准网站图标
        ├── favicon-16x16.png        # 16x16 PNG 图标
        ├── favicon-32x32.png        # 32x32 PNG 图标
        └── apple-touch-icon.png     # Apple 触摸设备图标
```

## API 说明

### 文生图接口

后端提供 `/api/generate-image` 接口：

- **方法**：POST
- **请求体**：
  ```json
  {
    "prompt": "图片描述",
    "apiKey": "阿里云百炼 API Key",
    "model": "模型名称（可选）",
    "parameters": {
      "n": 1,
      "size": "auto",
      "seed": 42,
      "negative_prompt": "模糊, 低质量",
      "prompt_extend": true,
      "watermark": false
    }
  }
  ```
- **响应**：
  ```json
  {
    "imageUrls": ["生成的图片 URL 1", "生成的图片 URL 2"]
  }
  ```

### 图生图接口

后端提供 `/api/image-to-image` 接口：

- **方法**：POST (multipart/form-data)
- **请求参数**：
  - `image`: 参考图片文件 (File)
  - `apiKey`: API Key
  - `model`: 模型名称
  - `prompt`: 图片描述（可选）
  - `parameters`: JSON 字符串，包含 n, size, seed, image_strength 等参数
- **响应**：
  ```json
  {
    "imageUrls": ["生成的图片 URL"]
  }
  ```

### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| n | number | 1 | 生成图片数量 (1-4) |
| size | string | auto | 图片尺寸，auto 使用模型默认 |
| seed | number | 随机 | 随机种子，用于结果可复现 |
| negative_prompt | string | - | 负向提示词，不想出现的内容 |
| prompt_extend | boolean | true | 提示词增强（万相2.7不支持） |
| watermark | boolean | false | 是否添加水印 |
| image_strength | number | 0.5 | 图生图参考图强度 (0-1)，仅图生图可用 |

## 注意事项

- 生成的图片 URL 有效期为 **24 小时**，请及时下载保存
- 不同模型的默认分辨率和最大分辨率不同，前端已自动适配
- 万相 2.7/2.6 使用同步接口，其他模型使用异步接口（自动轮询）
- 图生图模式最高支持 2K 分辨率
- API Key 仅保存在浏览器本地存储（localStorage），不会上传至服务器
- 图生图仅支持万相 2.6+ 系列模型

## 项目结构

```
ai-image-generator/
├── server.js           # Express 后端，代理 DashScope API
├── package.json        # 项目依赖配置
├── .env.example        # 环境变量模板
├── .gitignore
├── README.md           # 项目说明文档
└── public/
    ├── index.html      # Bootstrap 5 前端页面
    ├── app.js          # 前端交互逻辑
    └── favicon/
        ├── favicon.ico              # 标准网站图标
        ├── favicon-16x16.png        # 16x16 PNG 图标
        ├── favicon-32x32.png        # 32x32 PNG 图标
        └── apple-touch-icon.png     # Apple 触摸设备图标
```

## 许可证

MIT
