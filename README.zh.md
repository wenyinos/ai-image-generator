# AI 视觉生成

<p align="right">
  <a href="README.md">🇬🇧 English</a>
</p>

一个面向生产部署的 AI 视觉生成 Web 应用，支持**文生图**、**图生图**与**视频生成**。

- 前端：Bootstrap 5 + 原生 JavaScript
- 后端：Express (Node.js)
- Provider：**DashScope**、**Google Gemini**、**火山引擎（即梦）**
- 本地任务记录：SQLite（默认 `data/video-tasks.sqlite`）

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
- PNG 透明通道在压缩时保留
- 点击生成的图片可逐张下载
- 火山引擎支持两种参考图来源：
  - 本地上传（服务端落盘后转为 HTTP URL）
  - 外部 HTTP(S) 图片 URL 输入
- 火山图生图上传的临时文件会在**成功生成后 5 分钟自动清理**

### 视频生成
- 前端可切换 Provider（DashScope / Volcengine）
- 支持 DashScope 文生视频与图生视频
- 内置 `happyhorse-1.0-*`、`wan2.7-*` 以及早期 Wan 视频模型
- 即梦（火山引擎）1080P 视频生成：文生视频、图生视频（首帧/首尾帧）、Pro 模式
- 动作模仿（v1.0 / v2.0）：上传人物图片 + 模板视频生成动态视频
- 长任务通过异步轮询实时显示进度
- 视频任务记录保存到本地 SQLite，并在前端展示

### 安全与稳定性
- API Key 支持前端输入，也支持服务端 `.env` 回退
- 火山 AK/SK 鉴权签名流程
- XSS 安全的错误信息显示（HTML 转义输出）
- Provider 级超时配置
- 内存型 API 频率限制（反向代理下正确识别客户端 IP）
- CORS 白名单
- 可选前端访问密钥保护（防暴力破解 + Cookie 会话）
- 访问 Cookie 签名密钥未配置时会首次启动自动生成并持久化
- 浏览器后台切回前台时会自动恢复前端状态，减少直接生成失败

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

## 支持的 DashScope / Gemini 模型

| 模型 | 类型 | 同步/异步 | 说明 |
|---|---|---|---|
| `wan2.7-image-pro` | wan | 同步 | 最强，支持 4K |
| `wan2.7-image` | wan | 同步 | 快速，支持 2K |
| `wan2.6-image` | wan | 同步 | 图文混排 |
| `wan2.6-t2i` | wan | 异步 | 标准 |
| `wan2.5-t2i-preview` | wan | 异步 | 预览 |
| `wan2.2-t2i-flash` | wan | 异步 | 极速 |
| `wan2.2-t2i-plus` | wan | 异步 | 增强 |
| `wanx2.1-t2i-turbo` | wan | 异步 | |
| `wanx2.1-t2i-plus` | wan | 异步 | |
| `wanx2.0-t2i-turbo` | wan | 异步 | |
| `qwen-image-2.0-pro` | qwen | 同步 | 擅长文字渲染 |
| `qwen-image-2.0` | qwen | 同步 | |
| `qwen-image-max` | qwen | 异步 | 真实感 |
| `qwen-image-plus` | qwen | 异步 | 艺术风格 |
| `qwen-image` | qwen | 异步 | |
| `z-image-turbo` | wan | 异步 | 轻量快速 |

**Gemini**：`gemini-2.5-flash-image`（默认）

## 支持的 DashScope 视频模型

### 文生视频

| 模型 | 说明 |
|---|---|
| `happyhorse-1.0-t2v` | 推荐 |
| `wan2.7-t2v` | 万相 2.7 文生视频 |
| `wan2.7-t2v-2026-04-25` | 万相 2.7 文生视频快照 |
| `wan2.6-t2v` | 万相 2.6 文生视频 |
| `wan2.5-t2v-preview` | 预览 |
| `wan2.2-t2v-plus` | 增强 |
| `wan2.2-t2v-flash` | 极速 |
| `wanx2.1-t2v-turbo` | Turbo |

### 图生视频

| 模型 | 说明 |
|---|---|
| `happyhorse-1.0-i2v` | 推荐 |
| `wan2.7-i2v` | 万相 2.7 图生视频 |
| `wan2.7-i2v-2026-04-25` | 万相 2.7 图生视频快照 |
| `wan2.6-i2v-flash` | 极速 |
| `wan2.5-i2v-preview` | 预览 |
| `wan2.2-i2v-plus` | 增强 |
| `wanx2.1-i2v-turbo` | Turbo |

## 支持的即梦视频模型

### 视频生成（Volcengine）

| 前端模型 ID | 上游 `req_key` | 说明 |
|---|---|---|
| `jimeng-v3.0-t2v-1080p` | `jimeng_t2v_v30_1080p` | 文生视频 1080P |
| `jimeng-v3.0-i2v-first-1080p` | `jimeng_i2v_first_v30_1080` | 图生视频首帧 1080P |
| `jimeng-v3.0-i2v-tail-1080p` | `jimeng_i2v_first_tail_v30_1080` | 图生视频首尾帧 1080P |
| `jimeng-v3.0-pro` | `jimeng_ti2v_v30_pro` | Pro 模式（文/图生视频） |

### 动作模仿（Volcengine）

| 前端模型 ID | 上游 `req_key` | 说明 |
|---|---|---|
| `jimeng-motion-2.0` | `jimeng_dreamactor_m20_gen_video` | 支持多人、非真人 |
| `jimeng-motion-1.0` | `jimeng_dream_actor_m1_gen_video_cv` | 单人 |

动作模仿需上传人物图片和模板视频。服务端将上传文件保存为临时公网 URL，生成完成后自动清理。

### 视频翻译（Volcengine）

| 前端模型 ID | 上游 `req_key` | 说明 |
|---|---|---|
| `jimeng-video-translate` | `video_translate_v2_cvtob` | 跨语种视频口播翻译（支持 29 种语言） |

视频翻译接受公网视频 URL 和源/目标语种代码。服务端通过 `CVSync2AsyncSubmitTask` 提交异步任务，`CVSync2AsyncGetResult` 轮询结果。输出视频 URL 有效期 1 小时。

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
| `jimeng-3.0-i2i` | `jimeng_i2i_v30` | 即梦图生图 3.0（仅支持 1 张参考图） |
| `jimeng-material-product` | `jimeng_i2i_extract_tiled_images` | 素材提取 — 商品提取（仅支持 1 张参考图） |
| `jimeng-material-pod` | `i2i_material_extraction` | 素材提取 — POD 按需定制（仅支持 1 张参考图） |
| `jimeng-upscale` | `jimeng_i2i_seed3_tilesr_cvtob` | 智能超清（仅支持 1 张参考图） |
| `jimeng-inpainting` | `jimeng_image2image_dream_inpaint` | 交互编辑 inpainting（需 2 张：原图 + mask） |
| `jimeng-4.0` | `jimeng_t2i_v40` | 多参考图编辑/生成 |
| `jimeng-4.6` | `jimeng_seedream46_cvtob` | 多参考图编辑/生成 |
| `jimeng-seededit` | `seededit_v3.0` | 智能绘图 — 文字指令编辑图片（SeedEdit 3.0） |
| `jimeng-effect` | `i2i_multi_style_zx2x` | 图像特效 — 23 种创意模板（需单人正面照） |
| `jimeng-dressing` | `dressing_diffusionV2` | 图片换装 — 模特图 + 服装图虚拟试穿 |

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
- `VIDEO_TASK_DB_PATH`（默认 `data/video-tasks.sqlite`，保存图片/视频任务记录）

Provider 凭证：
- `DASHSCOPE_API_KEY`
- `GEMINI_API_KEY` / `GOOGLE_API_KEY`
- `VOLCENGINE_ACCESS_KEY`
- `VOLCENGINE_SECRET_KEY`
- `VOLCENGINE_SESSION_TOKEN`（可选）

超时与轮询：
- `GENERATION_MAX_POLL_ATTEMPTS`（默认 `90`）
- `GENERATION_POLL_INTERVAL_MS`（默认 `5000`）
- `GENERATION_REQUEST_TIMEOUT_MS`（默认 `450000`）
- `VIDEO_GENERATION_MAX_POLL_ATTEMPTS`（默认 `288`）
- `VIDEO_GENERATION_REQUEST_TIMEOUT_MS`（默认 `1800000`）
- `DASHSCOPE_TIMEOUT_MS`（Provider 级覆盖；默认跟随 `GENERATION_REQUEST_TIMEOUT_MS`）
- `GEMINI_TIMEOUT_MS`（Provider 级覆盖；默认跟随 `GENERATION_REQUEST_TIMEOUT_MS`）
- `VOLCENGINE_TIMEOUT_MS`（Provider 级覆盖；默认跟随 `GENERATION_REQUEST_TIMEOUT_MS`）

火山请求调优：
- `VOLCENGINE_HOST`（默认 `visual.volcengineapi.com`）
- `VOLCENGINE_REGION`（默认 `cn-north-1`）
- `VOLCENGINE_SERVICE`（默认 `cv`）
- `VOLCENGINE_JIMENG_30_REQ_KEY`（默认 `jimeng_t2i_v30`）
- `VOLCENGINE_JIMENG_31_REQ_KEY`（默认 `jimeng_t2i_v31`）
- `VOLCENGINE_JIMENG_I2I_30_REQ_KEY`（默认 `jimeng_i2i_v30`）
- `VOLCENGINE_JIMENG_MATERIAL_POD_REQ_KEY`（默认 `i2i_material_extraction`）
- `VOLCENGINE_JIMENG_MATERIAL_PRODUCT_REQ_KEY`（默认 `jimeng_i2i_extract_tiled_images`）
- `VOLCENGINE_JIMENG_UPSCALE_REQ_KEY`（默认 `jimeng_i2i_seed3_tilesr_cvtob`）
- `VOLCENGINE_JIMENG_INPAINT_REQ_KEY`（默认 `jimeng_image2image_dream_inpaint`）
- `VOLCENGINE_JIMENG_40_REQ_KEY`（默认 `jimeng_t2i_v40`）
- `VOLCENGINE_JIMENG_46_REQ_KEY`（默认 `jimeng_seedream46_cvtob`）
- `VOLCENGINE_MAX_POLL_ATTEMPTS`（默认 `90`）
- `VOLCENGINE_POLL_INTERVAL_MS`（默认 `5000`）

前端访问控制：
- `FRONTEND_ACCESS_CONTROL_ENABLED`（`true/1` 开启）
- `FRONTEND_ACCESS_KEY`（访问密钥）
- `ACCESS_AUTH_WINDOW_MS`（防爆破窗口，默认 `300000`）
- `ACCESS_AUTH_MAX_ATTEMPTS`（最大失败次数，默认 `8`）
- `ACCESS_AUTH_LOCK_MS`（锁定时长，默认 `900000`）
- `ACCESS_COOKIE_SECRET`（Cookie 签名密钥；不配置时自动生成并持久化）
- `ACCESS_COOKIE_SECRET_PATH`（默认 `data/access-cookie-secret`，自动生成密钥保存路径）

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
- `i2i_material_extraction` / `jimeng_i2i_extract_tiled_images`（素材提取）：
  - 仅支持 1 张输入图
  - 需要 `image_edit_prompt` 参数
  - `jimeng_i2i_extract_tiled_images` 额外支持 `lora_weight`

## 前端访问控制（可选）

开启后，访客需先输入访问密钥才能使用。含暴力破解防护。

```env
FRONTEND_ACCESS_CONTROL_ENABLED=true
FRONTEND_ACCESS_KEY=your_secret_key
```

- 未认证用户自动跳转 `/unlock`
- `/uploads/*` 保持公开（火山引擎需回源拉图）
- 基于 Cookie 的会话（HttpOnly，7 天有效）
- 密钥自动保存在浏览器 localStorage（72 小时有效），72 小时内再次访问无需手动输入
- 若未配置 `ACCESS_COOKIE_SECRET`，服务端首次启动会生成 `data/access-cookie-secret` 并复用
- 多实例部署建议为所有实例配置相同的 `ACCESS_COOKIE_SECRET`

## 任务记录与本地 SQLite

图片和视频生成任务记录会保存到本地 SQLite：

- 默认路径：`data/video-tasks.sqlite`
- `video_tasks` 表：视频任务记录
- `image_tasks` 表：文生图与图生图任务记录

数据库会在服务启动时自动创建。除非要迁移已有记录，否则部署时无需上传本地数据库文件。

如果部署平台没有持久化磁盘，请将 `VIDEO_TASK_DB_PATH` 指向持久化目录。

## 启动 Warning 说明

项目使用 Node.js 内置 `node:sqlite` 保存本地任务记录。Node.js v22 中该 API 可能输出：

```text
ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

服务启动时只过滤这条已知 SQLite 实验性提示，不会屏蔽其它 warning。

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

  client_max_body_size 80m;

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

- `GET /health`
  - 响应: `{ status: 'ok', version: '1.0.0' }`
- `POST /api/generate-image`
  - body: `{ prompt, apiKey, model, provider, parameters }`
  - 响应: `{ imageUrls: string[] }`，启用 `progressMode` 时返回异步任务信息
- `POST /api/image-to-image`
  - multipart：`image` + 可选 `imageMask` + 字段（`prompt`、`apiKey`、`model`、`provider`、`parameters`、可选 `imageUrls`）
  - 响应: `{ imageUrls: string[] }`，启用 `progressMode` 时返回异步任务信息
- `POST /api/generate-video`
  - multipart：可选 `firstFrame` / `lastFrame` + 字段（`prompt`、`apiKey`、`model`、`mode`、`parameters`）
  - 响应：视频 URL 或异步任务信息
- `POST /api/jimeng-video`
  - multipart：可选 `firstFrame` / `lastFrame` + 字段（`apiKey`、`model`、`prompt`、`parameters`）
  - 响应：异步任务信息（即梦视频生成）
- `POST /api/jimeng-motion`
  - multipart：`motionImage` + `motionVideo` + 字段（`apiKey`、`model`）
  - 响应：异步任务信息（即梦动作模仿）
- `POST /api/volcengine-video-translate`
  - body：`{ apiKey, videoUrl, srcLanguage, targetLanguage }`
  - 响应：异步任务信息，`queryAction: "CVSync2AsyncGetResult"`
- `POST /api/volcengine-dressing`
  - body：`{ apiKey, modelUrl, garmentData: [{ type, url }] }`
  - 响应：异步任务信息，`queryAction: "CVGetResult"`
- `POST /api/volcengine-seededit`
  - multipart：`image`（可选）+ 字段（`apiKey`、`prompt`、`scale`、`seed`、`imageUrl`）
  - 响应：异步任务信息，`queryAction: "CVSync2AsyncGetResult"`
- `POST /api/volcengine-effect`
  - multipart：`image`（可选）+ 字段（`apiKey`、`templateId`、`imageUrl`、`width`、`height`）
  - 响应：异步任务信息，`queryAction: "CVSync2AsyncGetResult"`
- `POST /api/video-models`
  - 返回 DashScope 视频模型列表或本地备用模型列表
- `POST /api/dashscope-task-status`
  - 查询 DashScope 异步图片/视频任务状态
- `POST /api/volcengine-task-status`
  - 查询 Volcengine 异步图片任务状态
- `GET /api/video-task-records`
  - 返回本地视频任务记录
- `POST /api/video-task-records/import`
  - 将浏览器旧视频任务记录导入 SQLite
- `GET /api/image-task-records`
  - 按模式返回本地图片任务记录
- `POST /api/access-auth`
  - body: `{ accessKey }`（form 编码）
  - 成功后返回 auth cookie
- `POST /api/access-logout`
  - 清除 auth cookie
- `GET /unlock`
  - 访问密钥输入页（前端访问控制开启时显示）

## 项目结构

```text
ai-image-generator/
├── server.js              # Express 入口（中间件、访问控制、启动）
├── lib/
│   ├── config.js          # 配置常量、环境变量、模型映射
│   ├── database.js        # SQLite 初始化、任务 CRUD
│   ├── utils.js           # 签名、验证、文件操作、API 工具
│   ├── middleware.js       # multer、限流、访问控制
│   └── routes/
│       ├── video.js       # 视频生成 API（DashScope、即梦、动作模仿）
│       ├── image.js       # 图片生成 API（文生图、图生图）
│       ├── task.js        # 任务记录与状态查询 API
│       └── volcengine-tools.js # 火山引擎视频翻译、图片换装、智能绘图、图像特效
├── data/
│   ├── video-tasks.sqlite # 本地图片/视频任务记录数据库
│   └── access-cookie-secret # 自动生成的 Cookie 签名密钥
├── public/
│   ├── index.html         # 单页 UI
│   ├── app.js             # 前端逻辑（原生 JS）
│   ├── favicon/
│   └── uploads/           # 火山图生图/动作模仿临时文件（自动清理）
├── jimeng-md/             # 即梦 API 参考文档（中文）
├── .env.example
├── README.md
└── README.zh.md
```

## 许可证

MIT
