# AI 图片生成器

一个面向生产部署的 AI 图片生成 Web 应用，支持**文生图**与**图生图**。

- 前端：Bootstrap 5 + 原生 JavaScript
- 后端：Express (Node.js)
- Provider：**DashScope**、**Google Gemini**、**火山引擎（即梦）**

## 功能特性

### 文生图
- 前端可切换 Provider（DashScope / Gemini / Volcengine）
- 支持多模型与模型级尺寸约束
- 可配置参数：出图数量、尺寸、随机种子、负向提示词、提示词扩写、水印
- DashScope 同步/异步协议自动处理

### 图生图
- 支持拖拽/点击上传，前端自动压缩（上传上限 10MB）
- 上传进度实时显示
- 支持参考图强度滑块（`image_strength`）
- 火山引擎支持两种参考图来源：
  - 本地上传（服务端落盘后转为 HTTP URL）
  - 外部 HTTP(S) 图片 URL 输入
- 火山图生图上传的临时文件会在**成功生成后 5 分钟自动清理**

### 安全与稳定性
- API Key 支持前端输入，也支持服务端 `.env` 回退
- 火山 AK/SK 鉴权签名流程
- Provider 级超时配置
- 内存型 API 频率限制
- CORS 白名单

## Provider 与凭证

### DashScope
- 前端输入，或配置 `DASHSCOPE_API_KEY`

### Gemini
- 前端输入，或配置 `GEMINI_API_KEY`（未配置时回退 `GOOGLE_API_KEY`）

### 火山引擎（即梦）
- 前端输入 `AK:SK`
- 或服务端环境变量：
  - `VOLCENGINE_ACCESS_KEY`
  - `VOLCENGINE_SECRET_KEY`
  - `VOLCENGINE_SESSION_TOKEN`（可选）

## 支持的即梦模型

### 文生图（Volcengine）

| 前端模型 ID | 上游 `req_key` | 说明 |
|---|---|---|
| `jimeng-3.0` | `jimeng_t2i_v30` | 即梦文生图 3.0 |
| `jimeng-3.1` | `jimeng_t2i_v31` | 即梦文生图 3.1 |
| `jimeng-4.0` | `jimeng_t2i_v40` | 即梦图片生成 4.0 |
| `jimeng-4.6` | `jimeng_seedream46_cvtob` | 即梦图片生成 4.6 |

### 图生图（Volcengine）

| 前端模型 ID | 上游 `req_key` | 说明 |
|---|---|---|
| `jimeng-3.0-i2i` | `jimeng_i2i_v30` | 即梦图生图 3.0（仅支持 1 张参考图 URL） |
| `jimeng-4.0` | `jimeng_t2i_v40` | 多参考图编辑/生成 |
| `jimeng-4.6` | `jimeng_seedream46_cvtob` | 多参考图编辑/生成 |

## 快速开始

### 1. 环境准备
- Node.js >= 18

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
```bash
cp .env.example .env
```

最小示例：

```env
PORT=3000
DASHSCOPE_API_KEY=your_dashscope_key
# GEMINI_API_KEY=your_gemini_key
# VOLCENGINE_ACCESS_KEY=your_ak
# VOLCENGINE_SECRET_KEY=your_sk
```

### 4. 启动服务
```bash
npm run dev
```

访问：`http://localhost:3000`

## 环境变量说明

核心：
- `PORT`（默认 `3000`）
- `DEBUG`（`true/1` 开启）

Provider 凭证：
- `DASHSCOPE_API_KEY`
- `GEMINI_API_KEY` / `GOOGLE_API_KEY`
- `VOLCENGINE_ACCESS_KEY`
- `VOLCENGINE_SECRET_KEY`
- `VOLCENGINE_SESSION_TOKEN`（可选）

超时：
- `DASHSCOPE_TIMEOUT_MS`（默认 `120000`）
- `GEMINI_TIMEOUT_MS`（默认 `180000`）
- `VOLCENGINE_TIMEOUT_MS`（代码默认 `120000`）

火山请求调优：
- `VOLCENGINE_HOST`（默认 `visual.volcengineapi.com`）
- `VOLCENGINE_REGION`（默认 `cn-north-1`）
- `VOLCENGINE_SERVICE`（默认 `cv`）
- `VOLCENGINE_JIMENG_30_REQ_KEY`（默认 `jimeng_t2i_v30`）
- `VOLCENGINE_JIMENG_31_REQ_KEY`（默认 `jimeng_t2i_v31`）
- `VOLCENGINE_JIMENG_I2I_30_REQ_KEY`（默认 `jimeng_i2i_v30`）
- `VOLCENGINE_JIMENG_40_REQ_KEY`（默认 `jimeng_t2i_v40`）
- `VOLCENGINE_JIMENG_46_REQ_KEY`（默认 `jimeng_seedream46_cvtob`）
- `VOLCENGINE_MAX_POLL_ATTEMPTS`（默认 `90`）
- `VOLCENGINE_POLL_INTERVAL_MS`（默认 `2000`）

网关：
- `CORS_ORIGIN`（逗号分隔白名单）
- `RATE_LIMIT_WINDOW_MS`（默认 `60000`）
- `RATE_LIMIT_MAX`（默认 `30`）

## 火山图生图 URL 要求（重点）

火山引擎 `image_urls` 只接受**公网可访问 HTTP(S) URL**，不支持 `data:` URL。

图生图本地上传时，后端会：
1. 将图片保存到 `public/uploads/`
2. 生成公网 URL
3. 把该 URL 传给火山引擎

### `PUBLIC_BASE_URL`
生产环境强烈建议配置：

```env
PUBLIC_BASE_URL=https://image.example.com
```

若服务端识别到 `localhost` 或内网地址，火山无法回源拉图，会直接失败。

### 即梦模型差异规则（已实现）

- `jimeng_t2i_v30` / `jimeng_t2i_v31`（文生图）：
  - 支持 `seed = -1`（随机）
  - 支持 `use_pre_llm`（由前端 `prompt_extend` 映射）
  - 若传 `width/height`，宽高比需在 `1:3 ~ 3:1`，面积需在 `512*512 ~ 2048*2048`
  - 后端对这两个模型不传 `size`
- `jimeng_i2i_v30`（图生图）：
  - `image_urls` 必须且仅支持 1 张
  - 若传 `width/height`，单边范围需在 `512 ~ 2016`
  - `scale` 取值范围 `0 ~ 1`
- `jimeng_i2i_seed3_tilesr_cvtob`（智能超清）：
  - 仅支持 1 张输入图
  - 专属参数：
    - `resolution`：`4k` 或 `8k`
    - `scale`：`0 ~ 100`
- `jimeng_image2image_dream_inpaint`（交互编辑 inpainting）：
  - 需 2 张输入图（原图 + mask）
  - 支持专属 `seed`（`-1` 为随机）
  - 前端已提供独立的第二本地上传位用于 Mask 图

## Nginx 反向代理建议

关键透传头：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header Forwarded "for=$remote_addr;proto=$scheme;host=$host";
```

可选：给 `/uploads` 增加缓存头（提升图片加载速度）

```nginx
location ^~ /uploads/ {
  proxy_pass http://127.0.0.1:3000;
  expires 365d;
  add_header Cache-Control "public, max-age=31536000, immutable" always;
}
```

Nginx 完整配置示例（单文件）：

```nginx
server {
  listen 80;
  server_name image.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name image.example.com;

  ssl_certificate     /path/to/fullchain.pem;
  ssl_certificate_key /path/to/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  client_max_body_size 20m;

  location ^~ /uploads/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header Forwarded "for=$remote_addr;proto=$scheme;host=$host";

    expires 365d;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    access_log off;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header Forwarded "for=$remote_addr;proto=$scheme;host=$host";

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
  }
}
```

## API 接口

- `POST /api/generate-image`
  - body: `{ prompt, apiKey, model, provider, parameters }`
- `POST /api/image-to-image`
  - multipart：`image` + 字段（`prompt`、`apiKey`、`model`、`provider`、`parameters`、可选 `imageUrls`）

## 项目结构

```text
ai-image-generator/
├── server.js
├── public/
│   ├── index.html
│   ├── app.js
│   └── favicon/
├── .env.example
├── README.md
└── README.zh.md
```

## 许可证

MIT
