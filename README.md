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
