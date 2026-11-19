# Image Resizer & Optimizer — AI Outpainting Edition

This version updates the uploaded `image-resizer-optimizer-v2.html` while retaining its existing resize, aspect-ratio, WebP/PNG/JPG, file-size, Smart Crop, Contain, preview and download workflow.

## What changed

- Adds **AI background outpainting** as the default option under **Extend background**.
- Sends the source image and requested dimensions to a backend endpoint (`POST /api/outpaint`).
- The backend prepares a transparent outpainting canvas plus an alpha mask, then calls the OpenAI Images edit API.
- The browser places the AI-generated canvas at the requested output size and composites the original source image over it using the same contain geometry. This is the key safeguard for keeping original typography, logos, people, foreground colours and layout from being repainted by the model.
- Keeps **Smart Crop** as a separate intentional-crop option and retains the browser-only fill methods as alternatives.

## Important quality / preservation note

AI outpainting is generative, so it can only approximate missing background areas; it cannot guarantee a pixel-perfect reconstruction of unseen content. The app protects the original foreground by overlaying the uploaded source again after the AI response. For an image whose ratio differs from the output ratio, the complete original is proportionally scaled to fit (not squeezed or cropped), and AI fills the remaining canvas. Any downscaling to the requested output dimensions is normal resampling.

## Requirements

- Node.js 20 or newer
- An OpenAI API key with API billing/credits enabled and access to GPT Image models
- Backend hosting that can run Node.js and install `sharp`
- Configure CORS to allow your GitHub Pages origin

**ChatGPT Go/Plus/Pro subscriptions do not include API usage credits.** API usage is billed separately through the OpenAI API platform. GPT Image access may require organization verification.

## Local setup (Windows / macOS / Linux)

1. Install Node.js 20+.
2. Open a terminal in this project folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Put your API key in `.env` as `OPENAI_API_KEY=...`.
6. Set `ALLOWED_ORIGINS` to your local frontend origin, e.g. `http://localhost:5500` or `http://127.0.0.1:5500`.
7. Run `npm start`.
8. The API health check should respond at `http://localhost:3000/api/health`.
9. Copy `config.example.js` to `config.js` and set `window.IMAGE_RESIZER_API_BASE = 'http://localhost:3000';`.
10. Serve `index.html` with VS Code Live Server or another local static server. Do not open the HTML as a `file://` URL.

## GitHub Pages + separate backend deployment

GitHub Pages hosts static HTML/JS only; it cannot run this Node backend and must never contain the OpenAI secret.

1. Deploy this Node project to a backend host that supports Node.js (for example Render, Railway, Fly.io or a similar service).
2. Add `OPENAI_API_KEY` as a secret environment variable in the backend host dashboard. Do not commit `.env`.
3. Set `ALLOWED_ORIGINS` to the exact public GitHub Pages origin, e.g. `https://YOUR-GITHUB-USERNAME.github.io` (and add any custom domain if used).
4. Set the backend start command to `npm start` and Node version to 20+.
5. Copy `config.example.js` to `config.js`; set `window.IMAGE_RESIZER_API_BASE` to the deployed backend base URL, e.g. `https://your-api-service.example.com`.
6. Commit `index.html` and `config.js` to your GitHub Pages repository. `config.js` contains only the public backend URL, not the API key.
7. Verify `https://your-api-service.example.com/api/health`, then test AI Extend from the published site.

## API flow

`Browser → POST /api/outpaint (multipart image + width + height + optional prompt) → Node backend → OpenAI Images API → generated background → browser composites original foreground → existing format/quality encoder → download`

The OpenAI key remains server-side. The backend has a 20 MB upload limit by default and a basic per-IP rate limit of 10 outpaint calls per 15 minutes. For a public multi-user release, add authentication or per-user quotas, abuse monitoring, cost limits and a privacy notice. Avoid storing uploaded images unless you explicitly need that feature.

## Files

- `index.html` — updated frontend
- `server.js` — Express backend / OpenAI integration
- `package.json` — dependencies and scripts
- `.env.example` — environment variable template
- `config.example.js` — frontend API URL template
- `.gitignore` — excludes secrets and dependencies
