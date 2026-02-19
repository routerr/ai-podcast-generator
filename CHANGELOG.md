# Changelog

## [2.1.0] - 2026-02-19

### Added
- Configurable LLM routing with primary + fallback providers.
- New provider options for end-to-end LLM workflow: Google Gemini, Perplexity, OpenRouter, and Ollama.
- OpenAI-compatible provider service layer for OpenRouter/Ollama.
- New proxy endpoint for OpenAI-compatible chat completions:
  - Local dev: `/llm/chat` (Vite middleware)
  - Deploy: `/api/llm/chat` (Vercel Serverless Function)
- API settings enhancements:
  - Primary provider selector
  - Fallback provider selector
  - OpenRouter model field
  - Ollama model/base URL fields
  - OpenRouter/Ollama key inputs

### Changed
- Research, outline generation/refinement, and script generation/refinement now use unified provider routing instead of fixed Perplexity/Gemini paths.
- Improved Gemini service coverage to support research + outline generation in the same workflow as script generation.
- API key panel and i18n dictionaries updated for multi-provider workflow controls.
- Local Ollama behavior improved: localhost Ollama base URL can run without mandatory API key.

### Fixed
- Multiple CORS-related provider errors by moving OpenRouter/Ollama calls through local/deploy proxy routes.
- Inconsistent key/config persistence issues in multi-provider scenarios.

## [2.0.0] - 2026-02-14

### Changed
- Complete architecture refactor to browser-only application
- Removed backend dependency
- All processing now happens client-side

### Added
- API Key Management Panel for user-provided API keys
- Perplexity API integration for research and content generation
- Google Gemini API integration for conversational podcast generation
- OpenAI TTS API integration for high-quality audio synthesis
- Web Speech API fallback for free audio generation
- Audio preview and download functionality
- Static deployment support (Vercel, Netlify, GitHub Pages)

### Removed
- Backend server (FastAPI)
- Server-side API endpoints
- Docker backend service
