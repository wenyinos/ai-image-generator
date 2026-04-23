# Repository Guidelines

## Project Structure & Module Organization

- `server.js`: Express server that serves `public/` and proxies requests to Alibaba Cloud DashScope (text-to-image and image-to-image).
- `public/`: Static frontend assets.
  - `public/index.html`: Bootstrap-based UI.
  - `public/app.js`: Frontend logic (model selection, form handling, uploads).
  - `public/favicon/`: Favicons for common platforms.
- `.env.example`: Environment variable template (do not commit real secrets in `.env`).
- `package.json` / `package-lock.json`: Node dependencies and scripts.

## Build, Test, and Development Commands

- `npm install`: Install dependencies.
- `npm run dev`: Start the server locally (same as `npm start`).
- `npm start`: Start the server on `PORT` (defaults to `3000`).

Example setup:

```bash
cp .env.example .env
npm install
npm run dev
```

## Coding Style & Naming Conventions

- JavaScript (Node.js) uses CommonJS (`require(...)`) and `async/await`.
- Indentation: 2 spaces; keep semicolons and prefer single quotes, matching existing files.
- Keep frontend code in `public/` and server routes/handlers in `server.js`; avoid changing API response shapes without updating the UI.

## Testing Guidelines

- No automated test suite is currently configured.
- For changes, include a quick manual smoke test:
  - Start the server and load `http://localhost:3000`.
  - Verify text-to-image and (when relevant) image upload flows.
  - Confirm errors are user-visible (e.g., missing API key, invalid file type, >10MB upload).

## Commit & Pull Request Guidelines

- Follow the existing Conventional Commit style when possible:
  - `feat(server): ...`, `feat(image-upload): ...`, `fix(build): ...`, `chore(deps): ...`
- PRs should include: a short summary, steps to verify, and screenshots for UI changes.
- Keep `package-lock.json` updated with dependency changes. Never commit `.env` or API keys; `node_modules/` should remain untracked.

## Security & Configuration Tips

- Prefer configuring secrets via `.env` (server-side) or local UI input; do not log or persist secrets in server logs.
