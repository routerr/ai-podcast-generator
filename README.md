# 🎙️ AI Podcast Generator

A browser-only alternative to Google's NotebookLM Audio Overview feature. Generate AI-powered podcasts from any topic with deep web research, natural dialogue scripts, and high-quality text-to-speech - all running directly in your browser.

## ✨ Features

- **🔍 Deep Research**: AI agents search the web to gather comprehensive information on your topic
- **🎭 Two Formats**: Single narrator or engaging host-expert dialogue
- **🌍 Multilingual**: English and Traditional Chinese (繁體中文) support
- **⏱️ Flexible Length**: Generate short (5 min), medium (15 min), or long (30 min) podcasts
- **🎤 Natural TTS**: High-quality text-to-speech using Edge TTS (free) or OpenAI TTS
- **🔒 Privacy First**: All processing happens in your browser - your data never leaves your machine
- **🌐 Browser-Only**: No server setup required - just open in any modern browser

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend (React + Browser APIs)               │
│  Topic Input → Q&A Flow → Research → Script → TTS → Audio      │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Web LLM     │   │   Web Search    │   │   Web TTS       │
│ (Gemini/      │   │ (Perplexity/    │   │ (Edge TTS /     │
│  OpenAI)      │   │  Google)        │   │  OpenAI TTS)    │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Option 1: Deploy to Vercel (Recommended for public access)

1. Fork this repository
2. Connect your fork to [Vercel](https://vercel.com/)
3. Configure environment variables in Vercel dashboard:
   - `VITE_PERPLEXITY_API_KEY` (optional but recommended)
   - `VITE_OPENAI_API_KEY` (for OpenAI TTS)
   - `VITE_GEMINI_API_KEY` (for Gemini models)
4. Deploy!

### Option 2: Run Locally

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-podcast-generator.git
cd ai-podcast-generator

# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Open your browser to http://localhost:3000
```

### Option 3: Static Deployment

Build the app for production and deploy the static files to any static hosting service:

```bash
cd frontend
npm install
npm run build

# The built files will be in dist/
# Upload these files to your static hosting provider
```

## ⚙️ Configuration

### Environment Variables

Since this is now a browser-only application, API keys are stored in the browser's localStorage and never sent to any server.

For deployments, you can optionally set these environment variables:

| Variable | Description |
|----------|-------------|
| `VITE_PERPLEXITY_API_KEY` | Perplexity API key (recommended for best research) |
| `VITE_OPENAI_API_KEY` | OpenAI API key (for OpenAI TTS) |
| `VITE_GEMINI_API_KEY` | Google Gemini API key (for Gemini models) |

Note: Users can also enter their own API keys directly in the application interface.

### Recommended Models

| Use Case | Provider | Model |
|----------|----------|-------|
| General purpose | Perplexity | `sonar-pro` |
| Best quality research | Perplexity | `sonar-deep-research` |
| Free alternative | Google | `gemini-pro` |
| Best for Chinese | Google | `gemini-pro` |

## 🎨 Workflow

1. **Topic Input**: User enters a topic (e.g., "How does blockchain work?")
2. **Clarifying Questions**: AI asks 3-5 questions to understand the user's needs
3. **Configuration**: User selects language, format, and length
4. **Deep Research**: AI searches the web for relevant information (5-10 min)
5. **Script Generation**: AI creates an engaging podcast script
6. **Audio Synthesis**: TTS converts the script to natural-sounding audio
7. **Delivery**: User can play or download the podcast

## 🔧 Development

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 📊 Performance Notes

- **Research**: 5-10 minutes depending on topic complexity
- **Script Generation**: 1-3 minutes for 30-minute podcast
- **Audio Generation**: ~1 minute per 5 minutes of audio (Edge TTS)
- **Total Time**: 10-20 minutes for a 30-minute podcast

## 🗺️ Roadmap

- [ ] Background music and sound effects
- [ ] Multiple voice options per language
- [ ] Podcast RSS feed generation
- [ ] Transcript editing before audio generation
- [ ] Source citation in audio
- [ ] Multi-episode series generation
- [ ] Export to podcast platforms

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- [Edge TTS](https://github.com/rany2/edge-tts) for free text-to-speech
- [Perplexity](https://perplexity.ai/) for AI-powered deep research with real-time web search
- [Google Gemini](https://gemini.google.com/) for powerful web-based LLM
- [OpenAI](https://openai.com/) for advanced TTS capabilities

---

Made with ❤️ for the open-source community
