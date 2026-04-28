<p align="right">
  <a href="README.zh.md">🇨🇳 中文</a>
</p>

# AI Image Generator

A production-oriented AI image generation web app with **text-to-image** and **image-to-image** workflows.

- Frontend: Bootstrap 5 + vanilla JavaScript
- Backend: Express (Node.js)
- Providers: **DashScope**, **Google Gemini**, **Volcengine (Jimeng)**

## Features

### Text-to-Image
- Provider switching in UI (DashScope / Gemini / Volcengine)
- Multi-model support with model-specific size constraints
- Parameters: image count, size, seed, negative prompt, prompt extension, watermark
- Sync/async protocol handling for DashScope models

### Image-to-Image
- Drag & drop upload with client-side compression (max 10MB upload)
- Upload progress indicator
- Reference strength slider (`image_strength`)
- Volcengine supports:
  - uploaded local image (server stores temp file and exposes HTTP URL)
  - external HTTP(S) image URLs input
- Local uploaded temp file for Volcengine is auto-cleaned **5 minutes after successful generation**

### Security & Reliability
- Optional API key input from UI, with server-side `.env` fallback
- Volcengine AK/SK parsing and signature request flow
- Request timeout controls per provider
- Basic in-memory API rate limit
- CORS allowlist support

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
| `jimeng-3.0-i2i` | `jimeng_i2i_v30` | Jimeng image-to-image 3.0 (exactly 1 input image URL) |
| `jimeng-4.0` | `jimeng_t2i_v40` | Multi-reference image edit/generation |
| `jimeng-4.6` | `jimeng_seedream46_cvtob` | Multi-reference image edit/generation |

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

Provider keys:
- `DASHSCOPE_API_KEY`
- `GEMINI_API_KEY` / `GOOGLE_API_KEY`
- `VOLCENGINE_ACCESS_KEY`
- `VOLCENGINE_SECRET_KEY`
- `VOLCENGINE_SESSION_TOKEN` (optional)

Timeouts:
- `DASHSCOPE_TIMEOUT_MS` (default `120000`)
- `GEMINI_TIMEOUT_MS` (default `180000`)
- `VOLCENGINE_TIMEOUT_MS` (default `120000` in server code)

Volcengine request tuning:
- `VOLCENGINE_HOST` (default `visual.volcengineapi.com`)
- `VOLCENGINE_REGION` (default `cn-north-1`)
- `VOLCENGINE_SERVICE` (default `cv`)
- `VOLCENGINE_JIMENG_30_REQ_KEY` (default `jimeng_t2i_v30`)
- `VOLCENGINE_JIMENG_31_REQ_KEY` (default `jimeng_t2i_v31`)
- `VOLCENGINE_JIMENG_I2I_30_REQ_KEY` (default `jimeng_i2i_v30`)
- `VOLCENGINE_JIMENG_40_REQ_KEY` (default `jimeng_t2i_v40`)
- `VOLCENGINE_JIMENG_46_REQ_KEY` (default `jimeng_seedream46_cvtob`)
- `VOLCENGINE_MAX_POLL_ATTEMPTS` (default `90`)
- `VOLCENGINE_POLL_INTERVAL_MS` (default `2000`)

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

## API Endpoints

- `POST /api/generate-image`
  - body: `{ prompt, apiKey, model, provider, parameters }`
- `POST /api/image-to-image`
  - multipart: `image` + fields (`prompt`, `apiKey`, `model`, `provider`, `parameters`, optional `imageUrls`)

## Project Structure

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

## License

MIT
