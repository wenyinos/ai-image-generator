# AI 文生图

基于阿里云百炼（DashScope）平台的文本生成图像（Text-to-Image）Web 应用。前端使用 Bootstrap 5 构建，后端使用 Express 代理 API 请求，支持多种文生图模型切换。

## 功能特性

- **多模型支持**：内置阿里云百炼最新文生图模型，包括万相 2.7、万相 2.x、千问 Qwen-Image、Z-Image 等
- **模型切换**：支持在前端页面直接切换不同模型，自动适配同步/异步调用协议
- **生成参数控制**：支持图片数量 (1-4张)、尺寸、随机种子、负向提示词、提示词增强、水印等参数调节
- **动态尺寸适配**：切换模型时自动更新可用尺寸选项
- **API Key 管理**：前端输入 API Key，自动缓存至本地，提供直达百炼控制台获取链接
- **自定义 Favicon**：支持多种尺寸的网站图标，适配不同设备和浏览器
- **响应式 UI**：基于 Bootstrap 5，适配桌面和移动端
- **实时预览**：生成完成后直接展示图片，支持多张网格显示和一键下载

## 支持的模型

| 系列 | 模型名称 | 说明 |
|------|----------|------|
| 万相 2.7 | `wan2.7-image-pro` | 最新推荐，支持 4K 输出、组图生成 |
| 万相 2.7 | `wan2.7-image` | 更快生成速度 |
| 万相 2.x | `wan2.6-t2i` | 推荐模型 |
| 万相 2.x | `wan2.5-t2i-preview` | 预览版 |
| 万相 2.x | `wan2.2-t2i-flash` / `wan2.2-t2i-plus` | 极速版 / 专业版 |
| 万相 2.1/2.0 | `wanx2.1-t2i-turbo` / `wanx2.1-t2i-plus` / `wanx2.0-t2i-turbo` | 经典版本 |
| 千问 Qwen-Image | `qwen-image-2.0-pro` | 推荐，擅长文字渲染 |
| 千问 Qwen-Image | `qwen-image-2.0` | 加速版 |
| 千问 Qwen-Image | `qwen-image-max` / `qwen-image-plus` / `qwen-image` | 真实感 / 艺术风格 |
| Z-Image | `z-image-turbo` | 轻量快速 |

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

### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| n | number | 1 | 生成图片数量 (1-4) |
| size | string | auto | 图片尺寸，auto 使用模型默认 |
| seed | number | 随机 | 随机种子，用于结果可复现 |
| negative_prompt | string | - | 负向提示词，不想出现的内容 |
| prompt_extend | boolean | true | 提示词增强 |
| watermark | boolean | false | 是否添加水印 |

## 注意事项

- 生成的图片 URL 有效期为 **24 小时**，请及时下载保存
- 不同模型的默认分辨率和最大分辨率不同，后端已自动适配
- 万相 2.7 和 2.6 使用同步接口，其他模型使用异步接口（自动轮询）
- API Key 仅保存在浏览器本地存储（localStorage），不会上传至服务器

## 许可证

MIT
