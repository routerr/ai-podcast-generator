# Changelog

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