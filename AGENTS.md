# AGENTS.md

## Architecture

Single Express server (`server.js`, ~1500 lines) serves both the API and static frontend. No build step, no bundler, no TypeScript.

- `server.js` — entire backend: API routes, Volcengine HMAC-SHA256 signing, DashScope async polling, Gemini image generation, rate limiting, upload handling, frontdoor access control
- `public/index.html` — single-page UI (Bootstrap 5 CDN)
- `public/app.js` — all frontend logic (~1280 lines, vanilla JS)
- `jimeng-md/` — Chinese-language Volcengine Jimeng API reference docs (not code)
- `public/uploads/` — temp storage for Volcengine i2i uploads; auto-cleaned 5 min after generation

## Commands

```bash
npm install          # install dependencies
npm run dev          # start server (same as npm start, just runs node server.js)
```

There are **no** test, lint, typecheck, format, or build scripts. Run nothing else.

## Environment

Copy `.env.example` to `.env`. Loaded via `dotenv` at server startup. Key variables:

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 3000) |
| `DEBUG` | `true`/`1` for verbose logging |
| `DASHSCOPE_API_KEY` | DashScope fallback key |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Gemini fallback key |
| `VOLCENGINE_ACCESS_KEY` / `VOLCENGINE_SECRET_KEY` | Volcengine fallback creds |
| `PUBLIC_BASE_URL` | Required for Volcengine i2i in production (must be publicly reachable) |
| `FRONTEND_ACCESS_CONTROL_ENABLED` / `FRONTEND_ACCESS_KEY` | Optional frontdoor auth |
| `CORS_ORIGIN` | Comma-separated allowlist (empty = allow all) |

## Provider Routing

The `provider` field in API requests selects the backend: `dashscope` (default), `gemini`, or `volcengine`. Each has completely different request/response shapes:

- **DashScope**: sync models (`wan2.7-*`, `qwen-image-2.0*`) use `/services/aigc/multimodal-generation/generation`; async models poll `/tasks/{id}`
- **Gemini**: direct REST to `generativelanguage.googleapis.com`, returns base64 inline data
- **Volcengine**: HMAC-SHA256 signed requests to `visual.volcengineapi.com`, async submit+poll pattern (`CVSync2AsyncSubmitTask` / `CVSync2AsyncGetResult`)

## Volcengine Gotchas

- Credentials format: `AK:SK` (colon-separated) or `AK:SK:SessionToken` for temporary creds
- `image_urls` must be **publicly reachable HTTP(S) URLs** — no `data:` URLs
- Local uploads go to `public/uploads/` and the server constructs a public URL via `PUBLIC_BASE_URL` or request host detection
- Private/localhost hosts are rejected with an error when `PUBLIC_BASE_URL` is unset
- Model-specific image count constraints are enforced server-side (e.g., `jimeng_i2i_v30` requires exactly 1 image, `jimeng_image2image_dream_inpaint` requires exactly 2)
- The `jimeng-md/` directory contains the upstream API docs (Chinese) — consult these when modifying Volcengine request logic

## File Boundaries

- All backend logic is in `server.js` — there are no separate route files, controllers, or middleware modules
- All frontend logic is in `public/app.js` — no framework, no modules, no build
- Changes to API contract require updating both `server.js` and `public/app.js`
- The `MODEL_CONFIG` and `ALLOWED_SIZES_BY_MODEL` objects in `server.js` define valid sizes per model — update both when adding models

## Gitignore Notes

`.env`, `AGENT.md` (note: singular, not `AGENTS.md`), `.codex`, and `public/uploads/*` are gitignored.
