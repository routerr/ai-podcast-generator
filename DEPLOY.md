# AI Podcast Generator - Deployment Guide

## 1. Overview

This project has two deploy-time parts:

- `frontend/` -> Vite static assets
- `api/` -> serverless proxy routes for provider calls

Because provider requests rely on proxy/serverless routes, this is **not** a pure static-only deployment in its current form.

## 2. Local Development

> Root directory has no `dev` script. Run commands inside `frontend/`.

### 2.1 Prerequisites

- Node.js 18+ (for npm workflow)
- or Bun 1.0+
- Modern browser

### 2.2 Run Locally (Bun)

```bash
cd frontend
bun install
bun run dev
```

### 2.3 Run Locally (npm)

```bash
cd frontend
npm install
npm run dev
```

Open:

- [http://localhost:5173](http://localhost:5173)

## 3. Build

### 3.1 Build with Bun

```bash
cd frontend
bun run build
```

### 3.2 Build with npm

```bash
cd frontend
npm run build
```

## 4. Recommended Deployment: Vercel

### 4.1 Why Vercel

This repo already matches Vercel's default model:

- frontend build output from `frontend/`
- serverless routes in root `api/`

### 4.2 Steps

1. Connect repository to Vercel.
2. Keep root as project directory.
3. Use the existing `vercel.json` settings.
4. Deploy.

### 4.3 Verification Checklist

After deploy, verify these routes return responses (not 404):

- `/api/perplexity/validate`
- `/api/gemini/validate`
- `/api/openai/validate`
- `/api/llm/chat`

And verify app workflow:

1. Save/test keys in API settings.
2. Run research.
3. Generate outline.
4. Generate script.
5. Generate downloadable audio (OpenAI key required).

## 5. Platform Notes

### 5.1 Static-only hosts (GitHub Pages, plain S3 static site)

Not directly compatible unless you provide equivalent backend/proxy endpoints for `/api/*` routes.

### 5.2 Netlify/Cloudflare/etc.

Possible, but you must implement equivalent function routing for all required `/api/*` endpoints.

## 6. Required Runtime Behavior

### 6.1 API Keys

- Keys are stored in browser local storage after user input.
- Validation is performed through local/deploy proxy endpoints.

### 6.2 Provider Routing

Research/outline/script pipeline uses configurable:

- Primary provider
- Fallback provider

Supported providers:

- Gemini
- Perplexity
- OpenRouter
- Ollama (OpenAI-compatible)

## 7. Troubleshooting

### 7.1 `bun run dev` at repository root fails

Cause: no root script.

Fix:

```bash
cd frontend
bun run dev
```

### 7.2 API key test shows proxy unreachable

Checks:

1. Local: confirm Vite dev server is running.
2. Deploy: confirm `/api/*` routes are deployed and not returning 404.
3. Re-test from API settings panel.

### 7.3 Provider requests fail with CORS/network errors

Checks:

1. Ensure requests are going to local/deploy proxy routes, not direct browser calls to upstream APIs.
2. Verify deployment includes both frontend and `api/` routes.

### 7.4 Downloadable audio unavailable

Checks:

1. Ensure OpenAI key is configured.
2. Verify `/api/openai/speech` route works in deployment.

## 8. Security Notes

- Keep API keys in user-managed local storage (default app behavior).
- Use HTTPS in production.
- Rotate provider keys periodically.

---

Last updated: 2026-02-19

## 9. GitHub Pages Deployment

This repo includes `.github/workflows/deploy-pages.yml` to publish `dist/` to GitHub Pages.

### 9.1 Setup

1. In GitHub repo settings, enable **Pages** and set source to **GitHub Actions**.
2. Ensure your default deployment branch is `main` (or adjust the workflow trigger).
3. Push to `main` or run the workflow manually via **Actions**.

### 9.2 Base path

The workflow sets:

- `VITE_BASE_PATH=/<repo-name>/`

so the built app resolves JS/CSS assets correctly under a project Pages URL.

### 9.3 Proxy/API behavior on Pages

GitHub Pages cannot run this repository's `/api/*` serverless routes.

If you want proxy-dependent features on Pages, deploy proxy routes elsewhere and set this repository secret/environment variable for the build:

- `VITE_API_BASE_URL=https://your-proxy-host.example.com`

When set, frontend proxy calls are automatically prefixed with this host.
