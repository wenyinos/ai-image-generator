<p align="right">
  <a href="README.zh.md">🇨🇳 中文</a>
</p>

# AI Image Generator

A web application for AI image generation powered by Alibaba Cloud DashScope, supporting **text-to-image** and **image-to-image** modes. Built with Bootstrap 5 on the frontend and an Express proxy for API requests, with support for multiple models.

## Features

### 🎨 Text-to-Image Mode
- **Multi-model support**: 16+ DashScope text-to-image models including Wanxiang 2.7, Wanxiang 2.x, Qwen Qwen-Image, Z-Image, and more
- **Model switching**: Switch between models directly from the frontend, with automatic adaptation to sync/async API protocols
- **Generation parameters**: Control image count (1-4), size, random seed, negative prompt, prompt enhancement, watermark, and more
- **Dynamic size presets**: Automatically updates available size options when switching models

### 🖼️ Image-to-Image Mode
- **Reference image upload**: Drag-and-drop / click to upload, automatic compression for large images (>1MB, max 1536px), up to 10MB
- **Upload progress**: Real-time upload percentage display for better network experience
- **Timeout optimization**: 5-minute backend timeout prevents large image upload failures
- **Reference strength control**: Adjustable slider to control similarity between generated and reference images (0-1)
- **Multi-model support**: Wanxiang 2.7 and 2.6 series models (default: wan2.6-image)
- **Image preview**: Instant preview of reference image before uploading

### 🌐 General Features
- **API Key management**: Enter API Key on the frontend, auto-cached locally, with direct link to DashScope console
- **Custom Favicon**: Multi-size site icons for different devices and browsers
- **Responsive UI**: Built with Bootstrap 5,适配 desktop and mobile
- **Real-time preview**: Images displayed immediately after generation, with grid view and one-click download
- **Shortcut support**: Ctrl+Enter for quick generation

## Supported Models

### Text-to-Image Models

| Series | Model Name | Description | Max Resolution |
|--------|------------|-------------|----------------|
| ⭐ Wanxiang 2.7 | `wan2.7-image-pro` | Latest recommended, supports 4K & batch generation | 4K |
| ⭐ Wanxiang 2.7 | `wan2.7-image` | Fast version | 2K |
| 🎨 Wanxiang 2.6 | `wan2.6-image` | Text-image mixed output | 1280×1280 |
| Wanxiang 2.6 | `wan2.6-t2i` | Standard model | 1440×1440 |
| Wanxiang 2.5 | `wan2.5-t2i-preview` | Preview version | 1440×1440 |
| Wanxiang 2.2 | `wan2.2-t2i-flash` | Turbo version | 1440×1440 |
| Wanxiang 2.2 | `wan2.2-t2i-plus` | Enhanced version | 1440×1440 |
| Wanxiang 2.1 | `wanx2.1-t2i-turbo` | Classic fast version | 1024×1024 |
| Wanxiang 2.1 | `wanx2.1-t2i-plus` | Classic pro version | 1024×1024 |
| Wanxiang 2.0 | `wanx2.0-t2i-turbo` | Early version | 1024×1024 |
| 💬 Qwen | `qwen-image-2.0-pro` | Excellent text rendering | 2048×2048 |
| 💬 Qwen | `qwen-image-2.0` | Accelerated version | 2048×2048 |
| 💬 Qwen | `qwen-image-max` | Strong realism | 1664×928 |
| 💬 Qwen | `qwen-image-plus` | Artistic style | 1664×928 |
| 💬 Qwen | `qwen-image` | Standard version | 1664×928 |
| 🚀 Z-Image | `z-image-turbo` | Lightweight & fast | 1024×1024 |

### Image-to-Image Models

| Series | Model Name | Description | Max Resolution |
|--------|------------|-------------|----------------|
| ⭐ Wanxiang 2.7 | `wan2.7-image-pro` | Best quality | 2K |
| ⭐ Wanxiang 2.7 | `wan2.7-image` | Fast version | 2K |
| 🎨 Wanxiang 2.6 | `wan2.6-image` | Text-image mixed | 2K |

## Quick Start

### 1. Prerequisites

- Node.js >= 18.0.0
- Alibaba Cloud DashScope API Key (can be entered on the frontend, or configured server-side via environment variables; [get one here](https://bailian.console.aliyun.com/cn-beijing?apiKey=1&tab=model#/api-key))

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables (Optional)

Copy the environment template:

```bash
cp .env.example .env
```

Edit the `.env` file:

```env
# Optional: configure API Key here; used when frontend leaves it blank
DASHSCOPE_API_KEY=your_api_key_here
# Server port, default 3000
PORT=3000

# Optional: CORS whitelist (comma-separated), e.g.:
# CORS_ORIGIN=http://localhost:3000,https://your-domain.com
# If not set, all origins are allowed (backward compatible).

# Optional: upstream DashScope request timeout (ms), default 120000
# DASHSCOPE_TIMEOUT_MS=120000

# Optional: API rate limiting (per IP, simple in-memory)
# RATE_LIMIT_WINDOW_MS=60000
# RATE_LIMIT_MAX=30

# Optional: debug logging toggle (true/1 to enable)
# DEBUG=false
```

### 4. Start the Server

```bash
npm start
```

After starting, visit: http://localhost:3000

## Project Structure

```
ai-image-generator/
├── server.js           # Express backend, DashScope API proxy
├── package.json        # Project dependencies
├── .env.example        # Environment variable template
├── .gitignore
├── README.md           # Project documentation (English)
├── README.zh.md        # Project documentation (Chinese)
└── public/
    ├── index.html      # Bootstrap 5 frontend page
    ├── app.js          # Frontend logic
    └── favicon/
        ├── favicon.ico              # Standard site icon
        ├── favicon-16x16.png        # 16x16 PNG icon
        ├── favicon-32x32.png        # 32x32 PNG icon
        └── apple-touch-icon.png     # Apple touch device icon
```

## Notes

- Generated image URLs are valid for **24 hours**, please download them promptly
- Different models have different default and maximum resolutions; the frontend adapts automatically
- Wanxiang 2.7/2.6 use synchronous APIs; other models use asynchronous APIs (auto-polling)
- Image-to-image mode only supports **image models** (`wan2.7-image-pro`, `wan2.7-image`, `wan2.6-image`), **not text-to-image models** (`t2i` series)
- API Key can be entered on the frontend (saved in browser localStorage) or configured server-side only via `.env` (not exposed to the frontend)

## License

MIT
