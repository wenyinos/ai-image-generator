# Repository Guidelines

## Project Structure & Module Organization
- `server.js`: Express backend entrypoint. Serves static files from `public/` and proxies image generation/edit requests.
- `public/index.html`: Bootstrap-based UI layout.
- `public/app.js`: Frontend behavior (form submit, model selection, upload flow, error display).
- `public/favicon/`: Browser and device icons.
- `package.json`: Scripts and runtime dependencies.
- `.env` (local only): Runtime secrets such as API keys. Never commit this file.

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start local server (`node server.js`) for development.
- `npm start`: Start server in normal mode (same command as `dev`).

Quick start:
```bash
cp .env.example .env
npm install
npm run dev
```
Open `http://localhost:3000` after startup.

## Coding Style & Naming Conventions
- Language/runtime: JavaScript (Node.js, CommonJS modules).
- Use 2-space indentation, semicolons, and single quotes to match existing files.
- Keep server logic in `server.js`; keep UI logic in `public/app.js`.
- Prefer descriptive names (`handleImageUpload`, `requestPayload`) over short abbreviations.
- Avoid changing API response shapes unless frontend handling is updated in the same change.

## Testing Guidelines
- No automated test suite is configured yet.
- Required manual smoke test for each change:
  - Run `npm run dev`.
  - Verify text-to-image generation from the main form.
  - Verify image upload/edit flow (file type and size checks).
  - Confirm backend/frontend errors are visible to users.
- If adding tests later, place them under `tests/` and use `*.test.js` naming.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits, e.g.:
  - `feat(server): add image edit endpoint validation`
  - `fix(ui): show upload size error message`
- PRs should include:
  - concise summary,
  - verification steps,
  - screenshots for UI changes,
  - linked issue (if applicable).

## Security & Configuration Tips
- Store secrets in `.env`; never hardcode API keys.
- Do not log full credentials or raw sensitive payloads.
- Validate file uploads (type, size) and return user-facing error messages.
