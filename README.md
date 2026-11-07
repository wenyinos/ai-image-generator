<p align="right">
  <a href="README.zh.md">🇨🇳 中文</a>
</p>

# AI Visual Generator

A production-oriented AI visual generation web app with **text-to-image**, **image-to-image**, and **video generation** workflows.

- Frontend: Bootstrap 5 + vanilla JavaScript (all assets served locally)
- Backend: Express (Node.js)
- Providers: **DashScope**, **Volcengine (Jimeng)**, **Agnes AI**, **OpenAI**, **AI778**
- Local task records: SQLite (`data/video-tasks.sqlite` by default)
- Storage backup: S3-compatible object storage (Cloudflare R2 / AWS S3 / Aliyun OSS / Tencent COS / MinIO)

## Features

### New in 2.7.2
- Restored first-frame / first+last-frame uploads for Jimeng 3.0 720P image-to-video models
- Reduced page API requests: the video model list is no longer fetched (built-in list), AI778 model specs are cached locally for 24 hours, and switching back to the tab no longer refreshes lists
- Split API rate limiting: GET read endpoints allow 300 requests/min by default (`RATE_LIMIT_READ_MAX`), write requests remain at `RATE_LIMIT_MAX`

### New in 2.7.1
- AI778 image and video parameters are now generated from the official model specs (`lib/ai778-model-specs.json`)
- Required parameters are filled automatically; common options (resolution, duration, aspect ratio, quality, version, size, complexity, output format, etc.) are selectable per model
- Models that require video/audio input show a clear limitation notice

### New in 2.7.0
- Added **22 AI778 per-call video models** to the Video tab: text-to-video, image-to-video and reference-to-video
- Video model names show the starting price (¥/video) and the resolution multiplier; the model hint shows all resolution tiers
- AI778 video is available alongside Agnes / DashScope / Volcengine; the same `AI778_API_KEY` is shared by image and video
- AI778 video tasks are submitted to `/v1/media/generate` and polled through `/v1/skills/task-status`

### New in 2.6.0
- Added **AI778** image provider: 16 per-call models, each supporting text-to-image and image-to-image; prices are shown next to model names
- AI778 is the default provider for text-to-image and image-to-image; Agnes AI is the default for video generation
- Removed Gemini and Grok (xAI) providers
- Reference image limit raised to **16** for OpenAI and AI778 image-to-image
- OpenAI models are labeled at ¥0.1/image

### Text-to-Image
- Provider switching in UI (DashScope / Volcengine / Agnes AI / OpenAI / AI778)
- Multi-model support with model-specific size constraints
- Parameters: image count, size, seed, negative prompt, prompt extension, watermark
- Sync/async protocol handling for DashScope models
- DashScope qwen-image-3.0 / qwen-image-3.0-pro, wan2.7-image / wan2.7-image-pro text-to-image uses async task polling: shows "queued/generating + elapsed time"
- DashScope model snapshot input: select a model + enter a snapshot date (e.g. `2026-06-22`) to auto-compose `model-snapshot` (e.g. `qwen-image-2.0-pro-2026-06-22`)

### Image-to-Image
- Drag & drop upload with client-side compression (max 10MB upload)
- Upload progress indicator; after upload completes the UI shows "AI generating + elapsed time"
- DashScope qwen-image-3.0 / qwen-image-3.0-pro, wan2.7-image / wan2.7-image-pro image-to-image uses async task polling: shows "queued/generating + elapsed time" instead of being stuck at "upload 100%"
- Reference strength slider (`image_strength`)
- PNG transparency preserved during compression
- Click generated images to download individually
- Volcengine supports:
  - uploaded local image (server stores temp file and exposes HTTP URL)
  - external HTTP(S) image URLs input
- Local uploaded temp file for Volcengine is auto-cleaned **5 minutes after successful generation**
- OpenAI (`gpt-image-2`) image-to-image supports **multiple reference images**: up to 16 uploads per request (official edits `image[]` multi-image form)
- AI778 image-to-image accepts up to 16 reference images (platform media protocol `params.images`)
- DashScope model snapshot input: select a model + enter a snapshot date to auto-compose `model-snapshot`

### Video Generation
- Provider switching in UI (Agnes AI / DashScope / Volcengine)
- DashScope text-to-video and image-to-video workflows
- Built-in model options for `happyhorse-1.1-*`, `happyhorse-1.0-*`, `wan2.7-*`, and earlier Wan video models
- DashScope model snapshot input: select a model + enter a snapshot date to auto-compose `model-snapshot`
- Jimeng (Volcengine) 1080P video generation: text-to-video, image-to-video (first frame / first+last frame), Pro mode
- Motion imitation (v1.0 / v2.0): upload a person image + template video to generate animated video
- Long-running task progress display through async polling
- Video task records are stored in local SQLite and shown in the UI

### UI & Theme (new in 2.5.0)
- Wenyin Open Source Community (wenyinos) style UI: purple design system, branded purple top bar with a centered title, purple footer
- One-click light/dark mode: follows the system preference on first visit, remembers the manual choice; flicker-free loading
- All static assets served locally: fonts (Questrial / Noto Sans SC / Noto Serif SC), icons and styles — zero online requests
- Two-column forms and width-capped buttons on wide screens, adaptive page margins on mobile; the last active tab is restored after a refresh

### Settings Page & Unified Keys (new in 2.0)
- New "Settings" tab: configure API keys per provider (DashScope / OpenAI / Agnes / AI778 / Volcengine AK+SK) in one place
- One set of keys shared across text-to-image, image-to-image and video generation; saved to the browser automatically as you type
- Legacy per-mode key storage is migrated automatically on first load
- Empty keys still fall back to server-side `.env` variables (unchanged)

### Storage Backup (S3-compatible, optional, new in 2.0)
- Configure via a modal in Settings with presets: **Cloudflare R2 (recommended)**, AWS S3, Aliyun OSS, Tencent COS, MinIO, custom endpoint
- Before saving, **list / put / delete** permissions are all verified — backup is only enabled when every check passes (delete requires DELETE permission)
- Generated content is backed up automatically into the bucket under **`backups/YYYY/MM/`**
- Keys are stored only in server-side SQLite (`storage_config` table); APIs return masked values and never send keys back to the browser
- One-click disable: generation keeps working, only backups stop
- **Auto-upload on success (2.2.0)**: `data:` payloads are decoded and uploaded to the bucket directly, never written to the database; http(s) links are backed up asynchronously
- **Database optimization (2.2.0)**: clean legacy media data inside SQLite and compact the database file (VACUUM) with one click from Settings

### Generation History (new in 2.0)
- Every generated image/video is recorded into the local SQLite `history` table
- **No media data in SQLite (2.2.0)**: image/video payloads are uploaded to the backup bucket on success and the database keeps metadata only; the history API no longer returns base64 data (responses could previously reach tens of MB and stall the page)
- Each record shows a type badge (image/video), time, provider·model and backup status (backed up + size / in progress / failed reason / disabled)
- **Download button**: streamed through a backend proxy from the bucket, filename includes type and date
- **Delete**: removes the database record together with the backed-up object in the bucket
- **Pagination & filters (new in 2.0.1)**: page size 10 / 20 / 50 with page and total display; filter by date range (from/to), combinable with the type filter

### Security & Reliability
- API keys configured in the unified Settings page, with server-side `.env` fallback
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

### OpenAI (GPT)
- Frontend key or `OPENAI_API_KEY`
- Endpoint: `https://api.openai.com/v1` (configurable via `OPENAI_BASE_URL`, e.g. an OpenAI-compatible relay)
- Supports: text-to-image (`gpt-image-2`, `image2.5`), image-to-image (`gpt-image-2`, multi-reference up to 16 images)
- Models are labeled ¥0.1/image in the UI
- `image2.5` is text-to-image only in the UI / API: its upstream (relay) only accepts `/images/generations`, so the image-to-image picker lists `gpt-image-2` only

### AI778 (per-call image)
- Frontend key or `AI778_API_KEY`
- Base URL: `https://api.lk888.ai/v1` (configurable via `AI778_BASE_URL`)
- Uses the platform media protocol: `POST /v1/media/generate`, then polls `GET /v1/skills/task-status?task_id=...`
- 16 per-call image models; every model supports text-to-image and image-to-image, each with its price shown next to the model name
- 22 per-call video models are also available in the Video tab (text-to-video, image-to-video, reference-to-video); prices are shown as ¥/video starting price
- Model parameters are rendered dynamically from `lib/ai778-model-specs.json`: required defaults are filled automatically, and common options (resolution, duration, aspect ratio, quality, version, size, etc.) are selectable per model
- Image-to-image accepts up to 16 reference images (base64 data URLs are sent via `params.images`); video generation polls the same task-status endpoint

### HTTP Proxy
- Set `HTTP_PROXY` (or `HTTPS_PROXY`/`ALL_PROXY`) to route external API calls (OpenAI) through a proxy
- Example: `HTTP_PROXY=http://127.0.0.1:7890`

## Supported DashScope Models

| Model | Type | Sync/Async | Notes |
|---|---|---|---|
| `wan2.7-image-pro` | wan | sync | Supports up to 4K |
| `wan2.7-image` | wan | sync | Fast, up to 2K |
| `wan2.6-image` | wan | sync | Image+text mixed |
| `wan2.6-t2i` | wan | async | Standard |
| `qwen-image-3.0-pro` | qwen | sync | Complex layouts, dense info, 2K |
| `qwen-image-3.0` | qwen | sync | Text & image-to-image, 1K/2K |
| `qwen-image-2.0-pro` | qwen | sync | Text rendering |

**OpenAI (GPT)**:

| Model | Type | Notes |
|---|---|---|
| `gpt-image-2` | openai | Text & image-to-image (multi-reference up to 16), size options 1024x1024 / 1536x1024 / 1024x1536 |
| `image2.5` | openai | Text-to-image, 1K/2K (no image-to-image: upstream only accepts `/images/generations`) |

**Agnes AI**:

| Model | Type | Notes |
|---|---|---|
| `agnes-image-2.5-flash` | agnes | Latest, 1K-4K presets, multi-image composition |
| `agnes-image-2.1-flash` | agnes | Recommended |
| `agnes-image-2.0-flash` | agnes | |

**AI778 (per-call)**:

| Model | Notes | Min price |
|---|---|---|
| `tt-image-2.5` | TT Image 2.5, standard/enhanced, 1K-4K, transparent background | ¥0.024/call |
| `tt-image-2` | TT Image 2, flagship, text + edit | ¥0.0349/call |
| `tt-image-2.6` | TT Image 2.6, SVG/GIF output | ¥0.0167/call |
| `banana-2.1` | Nano Banana 2.1 per-call, up to 14 refs, web search | ¥0.0797/call |
| `banana-pro` | Nano Banana Pro, up to 4K | ¥0.1275/call |
| `banana-2` | Nano Banana 2, up to 4K | ¥0.1063/call |
| `doubao-seedream-5-0-pro-260628` | Seedream 5.0 Pro, up to 10 refs | ¥0.2732/call |
| `gk-image-2.0` | GK Image 2.0 | ¥0.3491/call |
| `mj_imagine` | Midjourney | ¥0.425/call |
| `vidu-image-2` | Vidu Image 2, up to 7 refs | ¥0.2561/call |
| `doubao-seedream-5-0-260128` | Seedream 5.0 | ¥0.334/call |
| `wan2.7-image` | Wan 2.7 image | ¥0.1518/call |
| `doubao-seedream-4-5-251128` | Seedream 4.5, up to 4K | ¥0.3795/call |
| `kling-v3-omni` | Kling V3 Omni | ¥0.1822/call |
| `wan2.6-image` | Wan 2.6 image | ¥0.1063/call |
| `kling-v3` | Kling V3 | ¥0.1822/call |

**AI778 per-call video models** (price = minimum ¥/video; multiplier = resolution factor on base price):

| Model | Notes | Min price | Resolution multiplier |
|---|---|---|---|
| `vo3.1` | VO3.1 | ¥0.2189 | same price |
| `gk-video-3` | GK-video-3 | ¥0.2732 | same price |
| `omni-1.1` | Omni 1.1 | ¥0.2733 | 720P×1 / 1080P×1.6667 / 4K×2.5 |
| `viduq3` | Vidu Q3 | ¥0.3029 | 540P×1 / 720P×1.5~1.875 / 1080P×1.8~2 |
| `omni-flash` | omni-flash (currently no active channel) | ¥0.3643 | same price |
| `wan2.6-cankaosheng` | Wan 2.6 reference | ¥0.4144 | 1080P×1.6667 |
| `wan2.6-shouzheng` | Wan 2.6 first frame | ¥0.4782 | 1080P×1.6667 |
| `viduq3-cankaosheng` | Vidu Q3 reference | ¥0.5222 | 540P×0.5~1 / 720P×1~2 / 1080P×1.5~2.5 |
| `video-enhance` | Video upscale (currently no active channel) | ¥0.5951 | same price |
| `pixverse-c1-cankaosheng` | Pix C1 reference | ¥0.6912 | 360P×8~24 / 540P×10~30 / 720P×13~39 / 1080P×24~71 |
| `pixverse-c1-shouweizhen` | Pix C1 first/last frame | ¥0.6912 | 360P×8~24 / 540P×10~30 / 720P×13~39 / 1080P×24~71 |
| `omni_flash-10s-fl` | Omni Flash first/last frame | ¥0.7742 | same price |
| `omni_flash-10s` | Omni Flash 10s | ¥0.7742 | same price |
| `viduq2-cankaosheng` | Vidu Q2 reference | ¥0.9138 | 540P/720P×1 / 1080P×2 |
| `wan2.7-cankaosheng` | Wan 2.7 reference | ¥1.3662 | 1080P×1.6667 |
| `wan2.7-shouweizhen` | Wan 2.7 first/last frame | ¥1.3662 | 1080P×1.6667 |
| `wan2.7-xuxie` | Wan 2.7 video extension | ¥1.3662 | 1080P×1.6667 |
| `kling-v3-omni-cankao` | Kling Omni reference | ¥3.0345 | same price |
| `kling-v3-omni-shouweizhen` | Kling Omni first/last frame | ¥3.0345 | same price |
| `kling-v3-video` | Kling V3 video | ¥3.414 | same price |
| `seedance-2.0-anci` | Seedance 2.0 per-call | ¥5.8443 | same price |
| `seedance-2.5-anci` | Seedance 2.5 per-call | ¥12.5235 | same price |

## Supported DashScope Video Models

> Resolution and aspect-ratio options adapt per model: HappyHorse supports 480P and 9 aspect ratios; wan2.7-r2v caps duration at 10s and reference assets at 5 when a video reference is included.

### Text-to-Video

| Model | Notes |
|---|---|
| `happyhorse-1.1-t2v` | Recommended |
| `happyhorse-1.0-t2v` | |
| `wan3.0-video-prime` | Wan 3.0 video high-speed version, capabilities aligned with wan3.0-video, text/image/video-to-video, up to 30s |
| `wan2.7-t2v` | Wan 2.7 text-to-video |
| `wan2.6-t2v` | Wan 2.6 text-to-video |

### Image-to-Video

| Model | Notes |
|---|---|
| `happyhorse-1.1-r2v` | Reference-to-video, stable subject & scene, Recommended |
| `happyhorse-1.1-i2v` | Image-to-video |
| `wan2.7-r2v` | Wan 2.7 reference-to-video |
| `happyhorse-1.0-i2v` | |
| `wan3.0-video-prime` | Wan 3.0 video high-speed image-to-video (first frame) |
| `wan2.7-i2v` | Wan 2.7 image-to-video |
| `wan2.6-i2v-flash` | Fast |

### Video Editing

| Model | Notes |
|---|---|
| `wan2.7-videoedit` | Natural language video editing, supports reference image for element replacement |

### Agnes Video

| Model | Notes |
|---|---|
| `agnes-video-2.5-flash` | Latest fast model, 4-12s, 720P (async) |
| `agnes-video-2.5` | 4-12s, 720P/1080P/1K/2K (async) |
| `agnes-video-v2.0` | Text-to-video, image-to-video (async) |

## Supported Jimeng Video Models

### Video Generation (Volcengine)

| UI Model ID | Upstream `req_key` | Notes |
|---|---|---|
| `jimeng-v3.0-t2v-1080p` | `jimeng_t2v_v30_1080p` | Text-to-video 1080P |
| `jimeng-v3.0-t2v` | `jimeng_t2v_v30` | Text-to-video 720P |
| `jimeng-v3.0-i2v-first-1080p` | `jimeng_i2v_first_v30_1080` | Image-to-video first frame 1080P |
| `jimeng-v3.0-i2v-tail-1080p` | `jimeng_i2v_first_tail_v30_1080` | Image-to-video first+last frame 1080P |
| `jimeng-v3.0-i2v-first` | `jimeng_i2v_first_v30` | Image-to-video first frame 720P |
| `jimeng-v3.0-i2v-tail` | `jimeng_i2v_first_tail_v30` | Image-to-video first+last frame 720P |
| `jimeng-v3.0-pro` | `jimeng_ti2v_v30_pro` | Pro mode (text/image-to-video) |
| `jimeng-v3.0-recamera` | `jimeng_i2v_recamera_v30` | Camera movement templates (11 templates) |

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
| `jimeng-faceswap` | `face_swap3_6` | Face swap — multi-person (up to 3 faces) |
| `jimeng-faceswap-ai` | `faceswap_ai` | Face swap — single person with beauty enhancement |
| `jimeng-facepretty` | `FacePretty` | Face beauty — auto face enhancement |
| `jimeng-lqir` | `lens_lqir` | Image restoration — smart quality enhancement |
| `jimeng-nnsr2` | `lens_nnsr2_pic_common` | Image restoration — 2x super resolution |

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
- `VOLCENGINE_ACCESS_KEY`
- `VOLCENGINE_SECRET_KEY`
- `VOLCENGINE_SESSION_TOKEN` (optional)

Timeouts:
- `GENERATION_MAX_POLL_ATTEMPTS` (default `90`)
- `GENERATION_POLL_INTERVAL_MS` (default `5000`)
- `GENERATION_REQUEST_TIMEOUT_MS` (default `900000`)
- `VIDEO_GENERATION_MAX_POLL_ATTEMPTS` (default `288`)
- `VIDEO_GENERATION_REQUEST_TIMEOUT_MS` (default `1800000`)
- `DASHSCOPE_TIMEOUT_MS` (optional provider override; default follows `GENERATION_REQUEST_TIMEOUT_MS`)
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
- `RATE_LIMIT_MAX` (default `30`, applies to write requests)
- `RATE_LIMIT_READ_MAX` (default `300`, applies to GET read endpoints so page initialization does not hit 429)

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

### `TRUST_PROXY`
Enable only when deployed behind a reverse proxy:

```env
TRUST_PROXY=1
```

When enabled, `X-Forwarded-For`/`X-Forwarded-Host` headers are trusted (rate limiting, brute-force lockout, public upload URLs). Keep it off for direct deployments to prevent clients from spoofing these headers.

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
- table `history`: generation history and backup status (new in 2.0)
- table `storage_config`: storage backup config incl. keys — keep this file private (new in 2.0)
- no media data in the database (2.2.0): image/video payloads go to the backup bucket; only http(s) links and metadata stay in SQLite

The database is created automatically on startup. You do not need to upload a local DB file unless you want to migrate existing records.

A **Database optimization** button in Settings (`POST /api/history/optimize`) cleans legacy media data inside SQLite and compacts the database file.

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
  - response: `{ status: 'ok', version: '2.7.2' }`
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
- `POST /api/volcengine-faceswap`
  - multipart: `images` (up to 4) + fields (`apiKey`, `model`, `faceType`, `sourceSimilarity`, `imageUrls`)
  - response: `{ imageUrls: string[] }` (synchronous)
- `POST /api/volcengine-facepretty`
  - multipart: `image` (optional) + fields (`apiKey`, `beautyLevel`, `multiFace`, `imageUrl`)
  - response: `{ imageData: string }` (synchronous, base64)
- `POST /api/volcengine-restoration`
  - multipart: `image` (optional) + fields (`apiKey`, `model`, `imageUrl`, `resolutionBoundary`, `enableHdr`, `enableWb`, `hdrStrength`)
  - response: `{ imageUrls: string[] }` (synchronous)
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

### Storage Backup & History (new in 2.0)

- `GET /api/storage-config/view`
  - Returns storage presets and the masked current config (keys are never returned)
- `POST /api/storage-config`
  - body: `{ preset, endpoint, region, bucket, accessKeyId, secretAccessKey, pathStyle }`
  - Verifies list/put/delete permissions before saving; fails with 400 unless all checks pass
- `POST /api/storage-config/disable`
  - Disables backup (keeps the config)
- `POST /api/history`
  - body: `{ type, url, provider, model }`; records generated content (async backup to `backups/YYYY/MM/` when enabled)
- `GET /api/history?limit=&offset=&type=&from=&to=`
  - History list; `type` is `image` or `video`, `from`/`to` is a date range (`YYYY-MM-DD`, inclusive); returns `records` plus the matching `total`
- `DELETE /api/history/:id`
  - Deletes a record; backed-up objects are removed from the bucket too — the record is kept if bucket deletion fails
- `GET /api/history/:id/download`
  - Streams the backed-up object as an attachment download

## Project Structure

```text
ai-image-generator/
├── server.js              # Express entry point (middleware, access control, startup)
├── lib/
│   ├── config.js          # Configuration constants, env vars, model mappings
│   ├── database.js        # SQLite init, task/history/storage-config CRUD
│   ├── storage.js         # S3-compatible storage client (SigV4 signing, permission checks, backup/download/delete)
│   ├── utils.js           # Signing, validation, file ops, API helpers
│   ├── middleware.js       # Multer, rate limiting, access control
│   └── routes/
│       ├── video.js       # Video generation APIs (DashScope, Jimeng, motion)
│       ├── image.js       # Image generation APIs (text-to-image, image-to-image)
│       ├── task.js        # Task record & status query APIs
│       ├── history.js     # History, storage config and backup download proxy APIs
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
