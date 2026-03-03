# AI Podcast Generator

Create a full podcast pipeline from a single topic:
research -> outline -> script -> audio.

This project is **frontend-first** (React + Vite) with **thin proxy/serverless API routes** to avoid browser CORS issues and keep API keys out of direct third-party browser requests.

## Features

- Topic-to-podcast workflow in 4 steps:
  - Research
  - Outline
  - Script
  - Audio
- Multi-provider LLM routing with primary + fallback:
  - Google Gemini
  - Perplexity
  - OpenRouter
  - Ollama (OpenAI-compatible endpoint)
- Provider settings in UI:
  - Primary provider
  - Fallback provider
  - OpenRouter model
  - Ollama model + base URL
- API key validation and status persistence in browser storage
- Script editing and section-level regeneration
- Audio output:
  - Browser preview via Web Speech API
  - Downloadable audio via OpenAI TTS
- UI language support:
  - English
  - Japanese
  - Simplified Chinese
  - Traditional Chinese

## Architecture

```text
React/Vite frontend
  -> local proxy middleware (during dev)
  -> /api/* serverless routes (during deploy)
  -> upstream providers (Gemini / Perplexity / OpenRouter / Ollama / OpenAI)
```

Key proxy/serverless routes:

- Perplexity
  - `/pplx/validate` / `/api/perplexity/validate`
  - `/pplx/search` / `/api/perplexity/search`
  - `/pplx/chat` / `/api/perplexity/chat`
- Gemini
  - `/gemini/validate` / `/api/gemini/validate`
  - `/gemini/generate` / `/api/gemini/generate`
- OpenAI
  - `/openai/validate` / `/api/openai/validate`
  - `/openai/speech` / `/api/openai/speech`
- OpenAI-compatible providers (OpenRouter/Ollama)
  - `/llm/chat` / `/api/llm/chat`

## Local Development

> There is no root-level `dev` script. Run commands in `frontend/`.

### Option A: Bun

```bash
cd frontend
bun install
bun run dev
```

### Option B: npm

```bash
cd frontend
npm install
npm run dev
```

Default dev URL:

- [http://localhost:5173](http://localhost:5173)

### Production Build (local)

```bash
cd frontend
bun run build
# or: npm run build
```

## Deployment


### GitHub Pages (static frontend)

This repository now includes a GitHub Actions workflow to publish the Vite app to GitHub Pages.

Important runtime note:

- GitHub Pages only serves static assets, so it does **not** host this repo's `/api/*` serverless routes.
- To keep proxy-dependent features (key validation, OpenRouter/Ollama proxy chat) working, deploy the `api/` routes separately (for example Vercel) and set:

```bash
VITE_API_BASE_URL=https://your-proxy-host.example.com
```

The app will prepend `VITE_API_BASE_URL` to proxy endpoints in production.

### Recommended: Vercel

This repository includes:

- Vite frontend (`frontend/`)
- Serverless API routes (`api/`)

Deploy from repository root to keep both frontend and API routes working.

### Important

Pure static hosting without equivalent serverless/proxy routes will break key parts of provider integration (especially where CORS/proxy behavior is required).

## API Keys and Provider Setup

Configure keys in **API Key Settings** in the app:

- Perplexity key
- Gemini key
- OpenRouter key
- Ollama key (optional when using localhost Ollama base URL)
- OpenAI key (required for downloadable audio generation)

Provider routing behavior:

- Primary provider is used first for research/outline/script operations.
- If it fails, fallback provider is attempted (if configured).

## Workflow

1. Enter topic on landing page.
2. Run research.
3. Generate/refine outline.
4. Generate/refine script.
5. Generate audio (OpenAI TTS for downloadable file, Web Speech for preview).

## Repository Structure

```text
api/                  # deploy-time serverless routes
frontend/             # React + Vite frontend
CHANGELOG.md          # release notes
DEPLOY.md             # deployment guide
REFACTOR_ARCHITECTURE.md  # historical architecture refactor doc
```

## License

MIT
