<p align="right">
  <a href="README.zh.md">🇨🇳 中文</a>
</p>

# AI Visual Generator

A production-oriented AI visual generation web app with **text-to-image**, **image-to-image**, and **video generation** workflows.

- Frontend: Bootstrap 5 + vanilla JavaScript (all assets served locally)
- Backend: Express (Node.js)
- Providers: **DashScope**, **Google Gemini**, **Volcengine (Jimeng)**, **Agnes AI**
- Local task records: SQLite (`data/video-tasks.sqlite` by default)

## Features

### Text-to-Image
- Provider switching in UI (DashScope / Gemini / Volcengine / Agnes AI)
- Multi-model support with model-specific size constraints
- Parameters: image count, size, seed, negative prompt, prompt extension, watermark
- Sync/async protocol handling for DashScope models

### Image-to-Image
- Drag & drop upload with client-side compression (max 10MB upload)
- Upload progress indicator
- Reference strength slider (`image_strength`)
- PNG transparency preserved during compression
- Click generated images to download individually
- Volcengine supports:
  - uploaded local image (server stores temp file and exposes HTTP URL)
  - external HTTP(S) image URLs input
- Local uploaded temp file for Volcengine is auto-cleaned **5 minutes after successful generation**

### Video Generation
- Provider switching in UI (DashScope / Volcengine)
- DashScope text-to-video and image-to-video workflows
- Built-in model options for `happyhorse-1.1-*`, `happyhorse-1.0-*`, `wan2.7-*`, and earlier Wan video models
- Jimeng (Volcengine) 1080P video generation: text-to-video, image-to-video (first frame / first+last frame), Pro mode
- Motion imitation (v1.0 / v2.0): upload a person image + template video to generate animated video
- Long-running task progress display through async polling
- Video task records are stored in local SQLite and shown in the UI

### Security & Reliability
- Optional API key input from UI, with server-side `.env` fallback
- Volcengine AK/SK parsing and signature request flow
- XSS-safe error display (HTML-escaped output)
- Request timeout controls per provider
- Basic in-memory API rate limit (respects `X-Forwarded-For` behind reverse proxy)
- CORS allowlist support
- Content Security Policy (CSP) headers with `'self'` only — no external CDN dependencies
- All frontend assets served locally (Bootstrap, Bootstrap Icons, Nunito Sans font, Pixel UI Kit)
- Optional frontend access control with key-based auth, brute-force throttle, and cookie session
- Access cookie signing secret is auto-generated and persisted on first startup if not configured
- Foreground recovery refreshes UI state after returning from a background browser tab

## Providers & Credentials

### DashScope
- Frontend key or `DASHSCOPE_API_KEY`

### Gemini
- Frontend key or `GEMINI_API_KEY` (fallback: `GOOGLE_API_KEY`)

### Volcengine (Jimeng)
- Frontend uses `AK:SK` format
- Or backend env:
  - `VOLCENGINE_ACCESS_KEY`
  - `VOLCENGINE_SECRET_KEY`
  - optional `VOLCENGINE_SESSION_TOKEN`

### Agnes AI
- Frontend key or `AGNES_API_KEY`
- Endpoint: `https://apihub.agnes-ai.com` (configurable via `AGNES_BASE_URL`)
- Supports: text-to-image, image-to-image, text-to-video, image-to-video

## Supported DashScope Models

| Model | Type | Sync/Async | Notes |
|---|---|---|---|
| `wan2.7-image-pro` | wan | sync | Supports up to 4K |
| `wan2.7-image` | wan | sync | Fast, up to 2K |
| `wan2.6-image` | wan | sync | Image+text mixed |
| `wan2.6-t2i` | wan | async | Standard |
| `wan2.5-t2i-preview` | wan | async | Preview |
| `wan2.2-t2i-flash` | wan | async | Fast |
| `wan2.2-t2i-plus` | wan | async | Enhanced |
| `wanx2.1-t2i-turbo` | wan | async | |
| `wanx2.1-t2i-plus` | wan | async | |
| `wanx2.0-t2i-turbo` | wan | async | |
| `qwen-image-2.0-pro` | qwen | sync | Text rendering |
| `qwen-image-2.0-pro-2026-06-22` | qwen | sync | Snapshot |
| `qwen-image-2.0-pro-2026-04-22` | qwen | sync | Snapshot |
| `qwen-image-2.0` | qwen | sync | |
| `qwen-image-max` | qwen | async | Realistic |
| `qwen-image-plus` | qwen | async | Artistic |
| `qwen-image` | qwen | async | |
| `z-image-turbo` | wan | async | Lightweight |

**Gemini**: `gemini-2.5-flash-image` (default)

**Agnes AI**:

| Model | Type | Notes |
|---|---|---|
| `agnes-image-2.1-flash` | agnes | Recommended |
| `agnes-image-2.0-flash` | agnes | |

## Supported DashScope Video Models

### Text-to-Video

| Model | Notes |
|---|---|
| `happyhorse-1.1-t2v` | Recommended |
| `happyhorse-1.0-t2v` | |
| `wan2.7-t2v` | Wan 2.7 text-to-video |
| `wan2.7-t2v-2026-06-12` | Wan 2.7 text-to-video snapshot |
| `wan2.7-t2v-2026-04-25` | Wan 2.7 text-to-video snapshot |
| `wan2.6-t2v` | Wan 2.6 text-to-video |
| `wan2.5-t2v-preview` | Preview |
| `wan2.2-t2v-plus` | Enhanced |
| `wan2.2-t2v-flash` | Fast |
| `wanx2.1-t2v-turbo` | Turbo |

### Image-to-Video

| Model | Notes |
|---|---|
| `happyhorse-1.1-r2v` | Reference-to-video, stable subject & scene, Recommended |
| `happyhorse-1.1-i2v` | Image-to-video |
| `wan2.7-r2v` | Wan 2.7 reference-to-video |
| `wan2.7-r2v-2026-06-12` | Wan 2.7 reference-to-video snapshot |
| `happyhorse-1.0-i2v` | |
| `wan2.7-i2v` | Wan 2.7 image-to-video |
| `wan2.7-i2v-2026-04-25` | Wan 2.7 image-to-video snapshot |
| `wan2.6-i2v-flash` | Fast |
| `wan2.5-i2v-preview` | Preview |
| `wan2.2-i2v-plus` | Enhanced |
| `wanx2.1-i2v-turbo` | Turbo |

### Video Editing

| Model | Notes |
|---|---|
| `wan2.7-videoedit` | Natural language video editing, supports reference image for element replacement |

### Agnes Video

| Model | Notes |
|---|---|
| `agnes-video-v2.0` | Text-to-video, image-to-video (async) |

## Supported Jimeng Video Models

### Video Generation (Volcengine)

| UI Model ID | Upstream `req_key` | Notes |
|---|---|---|
| `jimeng-v3.0-t2v-1080p` | `jimeng_t2v_v30_1080p` | Text-to-video 1080P |
| `jimeng-v3.0-i2v-first-1080p` | `jimeng_i2v_first_v30_1080` | Image-to-video first frame 1080P |
| `jimeng-v3.0-i2v-tail-1080p` | `jimeng_i2v_first_tail_v30_1080` | Image-to-video first+last frame 1080P |
| `jimeng-v3.0-pro` | `jimeng_ti2v_v30_pro` | Pro mode (text/image-to-video) |

### Motion Imitation (Volcengine)

| UI Model ID | Upstream `req_key` | Notes |
|---|---|---|
| `jimeng-motion-2.0` | `jimeng_dreamactor_m20_gen_video` | Multi-person, non-real-person supported |
| `jimeng-motion-1.0` | `jimeng_dream_actor_m1_gen_video_cv` | Single person |

Motion imitation requires uploading a person image and a template video. The server stores uploaded files as temporary public URLs (auto-cleaned after generation).

### Video Translation (Volcengine)

| UI Model ID | Upstream `req_key` | Notes |
|---|---|---|
| `jimeng-video-translate` | `video_translate_v2_cvtob` | Cross-language video lip-sync translation (29 languages) |

Video translation takes a public video URL and source/target language codes. The server submits an async task via `CVSync2AsyncSubmitTask` and polls via `CVSync2AsyncGetResult`. Output video URL is valid for 1 hour.

## Supported Jimeng Models

### Text-to-Image (Volcengine)

| UI Model ID | Upstream `req_key` | Notes |
|---|---|---|
| `jimeng-3.0` | `jimeng_t2i_v30` | Jimeng text-to-image 3.0 |
| `jimeng-3.1` | `jimeng_t2i_v31` | Jimeng text-to-image 3.1 |
| `jimeng-4.0` | `jimeng_t2i_v40` | Jimeng image generation 4.0 |
| `jimeng-4.6` | `jimeng_seedream46_cvtob` | Jimeng image generation 4.6 |

### Image-to-Image (Volcengine)

| UI Model ID | Upstream `req_key` | Notes |
|---|---|---|
| `jimeng-3.0-i2i` | `jimeng_i2i_v30` | Image-to-image 3.0 (exactly 1 input image) |
| `jimeng-material-product` | `jimeng_i2i_extract_tiled_images` | Material extraction — product (exactly 1 input image) |
| `jimeng-material-pod` | `i2i_material_extraction` | Material extraction — POD (exactly 1 input image) |
| `jimeng-upscale` | `jimeng_i2i_seed3_tilesr_cvtob` | Upscale / super-resolution (exactly 1 input image) |
| `jimeng-inpainting` | `jimeng_image2image_dream_inpaint` | Interactive inpainting (exactly 2 images: origin + mask) |
| `jimeng-4.0` | `jimeng_t2i_v40` | Multi-reference image edit/generation |
| `jimeng-4.6` | `jimeng_seedream46_cvtob` | Multi-reference image edit/generation |
| `jimeng-seededit` | `seededit_v3.0` | Smart drawing — text-guided image editing (SeedEdit 3.0) |
| `jimeng-effect` | `i2i_multi_style_zx2x` | Image effects — 23 creative templates (requires 1 face photo) |
| `jimeng-dressing` | `dressing_diffusionV2` | Virtual try-on — model image + garment image |

## Quick Start

### 1. Prerequisites
- Node.js >= 18

### 2. Install
```bash
npm install
```

### 3. Configure env
```bash
cp .env.example .env
```

Minimum example:

```env
PORT=3000
DASHSCOPE_API_KEY=your_dashscope_key
# GEMINI_API_KEY=your_gemini_key
# VOLCENGINE_ACCESS_KEY=your_ak
# VOLCENGINE_SECRET_KEY=your_sk
```

### 4. Start
```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Core:
- `PORT` (default `3000`)
- `DEBUG` (`true/1` to enable)
- `VIDEO_TASK_DB_PATH` (default `data/video-tasks.sqlite`; stores image/video task records)

Provider keys:
- `DASHSCOPE_API_KEY`
- `GEMINI_API_KEY` / `GOOGLE_API_KEY`
- `VOLCENGINE_ACCESS_KEY`
- `VOLCENGINE_SECRET_KEY`
- `VOLCENGINE_SESSION_TOKEN` (optional)

Timeouts:
- `GENERATION_MAX_POLL_ATTEMPTS` (default `90`)
- `GENERATION_POLL_INTERVAL_MS` (default `5000`)
- `GENERATION_REQUEST_TIMEOUT_MS` (default `450000`)
- `VIDEO_GENERATION_MAX_POLL_ATTEMPTS` (default `288`)
- `VIDEO_GENERATION_REQUEST_TIMEOUT_MS` (default `1800000`)
- `DASHSCOPE_TIMEOUT_MS` (optional provider override; default follows `GENERATION_REQUEST_TIMEOUT_MS`)
- `GEMINI_TIMEOUT_MS` (optional provider override; default follows `GENERATION_REQUEST_TIMEOUT_MS`)
- `VOLCENGINE_TIMEOUT_MS` (optional provider override; default follows `GENERATION_REQUEST_TIMEOUT_MS`)

Volcengine request tuning:
- `VOLCENGINE_HOST` (default `visual.volcengineapi.com`)
- `VOLCENGINE_REGION` (default `cn-north-1`)
- `VOLCENGINE_SERVICE` (default `cv`)
- `VOLCENGINE_JIMENG_30_REQ_KEY` (default `jimeng_t2i_v30`)
- `VOLCENGINE_JIMENG_31_REQ_KEY` (default `jimeng_t2i_v31`)
- `VOLCENGINE_JIMENG_I2I_30_REQ_KEY` (default `jimeng_i2i_v30`)
- `VOLCENGINE_JIMENG_MATERIAL_POD_REQ_KEY` (default `i2i_material_extraction`)
- `VOLCENGINE_JIMENG_MATERIAL_PRODUCT_REQ_KEY` (default `jimeng_i2i_extract_tiled_images`)
- `VOLCENGINE_JIMENG_UPSCALE_REQ_KEY` (default `jimeng_i2i_seed3_tilesr_cvtob`)
- `VOLCENGINE_JIMENG_INPAINT_REQ_KEY` (default `jimeng_image2image_dream_inpaint`)
- `VOLCENGINE_JIMENG_40_REQ_KEY` (default `jimeng_t2i_v40`)
- `VOLCENGINE_JIMENG_46_REQ_KEY` (default `jimeng_seedream46_cvtob`)
- `VOLCENGINE_MAX_POLL_ATTEMPTS` (default `90`)
- `VOLCENGINE_POLL_INTERVAL_MS` (default `5000`)

Frontend access control:
- `FRONTEND_ACCESS_CONTROL_ENABLED` (`true/1` to enable)
- `FRONTEND_ACCESS_KEY` (the key users must enter)
- `ACCESS_AUTH_WINDOW_MS` (throttle window, default `300000`)
- `ACCESS_AUTH_MAX_ATTEMPTS` (max failures before lock, default `8`)
- `ACCESS_AUTH_LOCK_MS` (lock duration, default `900000`)
- `ACCESS_COOKIE_SECRET` (HMAC signing key for auth cookie; auto-generated and persisted if unset)
- `ACCESS_COOKIE_SECRET_PATH` (default `data/access-cookie-secret`; generated secret file path)

Gateway:
- `CORS_ORIGIN` (comma-separated allowlist)
- `RATE_LIMIT_WINDOW_MS` (default `60000`)
- `RATE_LIMIT_MAX` (default `30`)

## Volcengine Image URL Requirement (Important)

Volcengine `image_urls` only accepts **publicly reachable HTTP(S) URLs**.
It does **not** accept `data:` URLs.

For local upload in image-to-image mode, backend will:
1. save uploaded image into `public/uploads/`
2. expose a public URL
3. pass this URL to Volcengine

### `PUBLIC_BASE_URL`
Set this in production when behind reverse proxy/CDN:

```env
PUBLIC_BASE_URL=https://image.example.com
```

If your app resolves host to `localhost` or private network, Volcengine will fail to fetch the image.

### Jimeng model-specific rules (implemented)

- `jimeng_t2i_v30` / `jimeng_t2i_v31` (text-to-image):
  - supports `seed = -1` (random)
  - supports `use_pre_llm` (mapped from UI `prompt_extend`)
  - if `width/height` is set, ratio should be `1:3 ~ 3:1`, and area should be `512*512 ~ 2048*2048`
  - backend avoids sending `size` for these two models
- `jimeng_i2i_v30` (image-to-image):
  - requires **exactly 1** `image_urls` item
  - `width/height` valid range is `512 ~ 2016` (when both are set)
  - `scale` range is `0 ~ 1`
- `jimeng_i2i_seed3_tilesr_cvtob` (upscale):
  - requires **exactly 1** input image
  - dedicated params:
    - `resolution`: `4k` or `8k`
    - `scale`: `0 ~ 100`
- `jimeng_image2image_dream_inpaint` (inpainting):
  - requires **exactly 2** input images (origin + mask)
  - supports dedicated `seed` (`-1` for random)
  - in UI, this model uses a dedicated second local upload slot for mask
- `i2i_material_extraction` / `jimeng_i2i_extract_tiled_images` (material extraction):
  - requires **exactly 1** input image
  - requires `image_edit_prompt` parameter
  - `jimeng_i2i_extract_tiled_images` also accepts `lora_weight`

## Frontend Access Control (Optional)

When enabled, visitors must enter an access key before reaching the app. Brute-force protection locks the IP after repeated failures.

```env
FRONTEND_ACCESS_CONTROL_ENABLED=true
FRONTEND_ACCESS_KEY=your_secret_key
```

- Unauthenticated users are redirected to `/unlock`
- `/uploads/*` stays public (Volcengine needs to fetch images)
- Auth is cookie-based (HttpOnly, 7-day expiry)
- Key is auto-saved in browser localStorage (72-hour TTL); re-visits within 72h skip manual input
- If `ACCESS_COOKIE_SECRET` is unset, the server creates `data/access-cookie-secret` on first startup and reuses it
- Multi-instance deployments should set the same `ACCESS_COOKIE_SECRET` on every instance

## Task Records & Local SQLite

Generated image and video task records are stored in local SQLite:

- default path: `data/video-tasks.sqlite`
- table `video_tasks`: video task history
- table `image_tasks`: text-to-image and image-to-image task history

The database is created automatically on startup. You do not need to upload a local DB file unless you want to migrate existing records.

For platforms without persistent disk, set `VIDEO_TASK_DB_PATH` to a persistent volume path.

## Startup Warning

This project uses Node.js built-in `node:sqlite` for local task records. In Node.js v22, that API may still emit:

```text
ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

The server filters only this known SQLite experimental warning during startup. Other warnings are not suppressed.

## Nginx Reverse Proxy (Recommended)

Essential forwarded headers:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header Forwarded "for=$remote_addr;proto=$scheme;host=$host";
```

Optional cache for `/uploads` (for faster image load):

```nginx
location ^~ /uploads/ {
  proxy_pass http://127.0.0.1:3000;
  expires 365d;
  add_header Cache-Control "public, max-age=31536000, immutable" always;
}
```

Full Nginx config example (single file):

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

## API Endpoints

- `GET /health`
  - response: `{ status: 'ok', version: '1.2.0' }`
- `POST /api/generate-image`
  - body: `{ prompt, apiKey, model, provider, parameters }`
  - response: `{ imageUrls: string[] }` or async task metadata when `progressMode` is enabled
- `POST /api/image-to-image`
  - multipart: `image` + optional `imageMask` + fields (`prompt`, `apiKey`, `model`, `provider`, `parameters`, optional `imageUrls`)
  - response: `{ imageUrls: string[] }` or async task metadata when `progressMode` is enabled
- `POST /api/generate-video`
  - multipart: optional `firstFrame` / `lastFrame` + fields (`prompt`, `apiKey`, `model`, `mode`, `parameters`)
  - response: video URL or async task metadata
- `POST /api/jimeng-video`
  - multipart: optional `firstFrame` / `lastFrame` + fields (`apiKey`, `model`, `prompt`, `parameters`)
  - response: async task metadata (Volcengine Jimeng video)
- `POST /api/jimeng-motion`
  - multipart: `motionImage` + `motionVideo` + fields (`apiKey`, `model`)
  - response: async task metadata (Volcengine motion imitation)
- `POST /api/volcengine-video-translate`
  - body: `{ apiKey, videoUrl, srcLanguage, targetLanguage }`
  - response: async task metadata with `queryAction: "CVSync2AsyncGetResult"`
- `POST /api/volcengine-dressing`
  - body: `{ apiKey, modelUrl, garmentData: [{ type, url }] }`
  - response: async task metadata with `queryAction: "CVGetResult"`
- `POST /api/volcengine-seededit`
  - multipart: `image` (optional) + fields (`apiKey`, `prompt`, `scale`, `seed`, `imageUrl`)
  - response: async task metadata with `queryAction: "CVSync2AsyncGetResult"`
- `POST /api/volcengine-effect`
  - multipart: `image` (optional) + fields (`apiKey`, `templateId`, `imageUrl`, `width`, `height`)
  - response: async task metadata with `queryAction: "CVSync2AsyncGetResult"`
- `POST /api/agnes-video`
  - multipart: optional `firstFrame` + fields (`apiKey`, `model`, `prompt`, `parameters`)
  - response: async task metadata (Agnes video)
- `POST /api/agnes-task-status`
  - body: `{ apiKey, taskId, model }`
  - response: task status with `videoUrl` on success
- `POST /api/video-models`
  - returns available/fallback DashScope video model options
- `POST /api/dashscope-task-status`
  - polls DashScope async image/video task status
- `POST /api/volcengine-task-status`
  - polls Volcengine async image task status
- `GET /api/video-task-records`
  - returns local video task records
- `POST /api/video-task-records/import`
  - imports legacy browser-stored video task records into SQLite
- `GET /api/image-task-records`
  - returns local image task records filtered by mode
- `POST /api/access-auth`
  - body: `{ accessKey }` (form-encoded)
  - Returns auth cookie on success
- `POST /api/access-logout`
  - Clears auth cookie
- `GET /unlock`
  - Access key entry page (shown when frontend access control is enabled)

## Project Structure

```text
ai-image-generator/
├── server.js              # Express entry point (middleware, access control, startup)
├── lib/
│   ├── config.js          # Configuration constants, env vars, model mappings
│   ├── database.js        # SQLite init, task CRUD operations
│   ├── utils.js           # Signing, validation, file ops, API helpers
│   ├── middleware.js       # Multer, rate limiting, access control
│   └── routes/
│       ├── video.js       # Video generation APIs (DashScope, Jimeng, motion)
│       ├── image.js       # Image generation APIs (text-to-image, image-to-image)
│       ├── task.js        # Task record & status query APIs
│       └── volcengine-tools.js # Volcengine video translate, dressing, seededit, effect
├── data/
│   ├── video-tasks.sqlite # Local image/video task record database
│   └── access-cookie-secret # Auto-generated cookie signing secret
├── public/
│   ├── index.html         # Single-page UI
│   ├── app.js             # Frontend logic (vanilla JS)
│   ├── favicon/
│   └── uploads/           # Temp files for Volcengine i2i/motion (auto-cleaned)
├── jimeng-md/             # Volcengine Jimeng API reference docs (Chinese)
├── .env.example
├── README.md
└── README.zh.md
```

## License

MIT
