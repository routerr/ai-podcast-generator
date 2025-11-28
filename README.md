# 🎙️ AI Podcast Generator

A self-hosted alternative to Google's NotebookLM Audio Overview feature. Generate AI-powered podcasts from any topic with deep web research, natural dialogue scripts, and high-quality text-to-speech.

## ✨ Features

- **🔍 Deep Research**: AI agents search the web to gather comprehensive information on your topic
- **🎭 Two Formats**: Single narrator or engaging host-expert dialogue
- **🌍 Multilingual**: English and Traditional Chinese (繁體中文) support
- **⏱️ Flexible Length**: Generate short (5 min), medium (15 min), or long (30 min) podcasts
- **🎤 Natural TTS**: High-quality text-to-speech using Edge TTS (free) or OpenAI TTS
- **🏠 Self-Hosted**: Full control over your data and infrastructure
- **🤖 Local LLM**: Use Ollama with Llama 3.1 or Qwen 2.5 for complete privacy

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  Topic Input → Q&A Flow → Research Progress → Audio Player      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI + Python)                   │
├─────────────┬─────────────┬─────────────┬─────────────┬────────┤
│   Topic     │  Research   │   Script    │    TTS      │ Audio  │
│   Q&A       │   Agent     │  Generator  │   Engine    │ Store  │
│   Agent     │  (Web)      │  (Dialog)   │             │        │
└─────────────┴─────────────┴─────────────┴─────────────┴────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Local LLM    │   │   Web Search    │   │   TTS Service   │
│  (Ollama)     │   │  (Perplexity/   │   │  (Edge TTS /    │
│  Llama3/Qwen  │   │  Tavily/DDG)    │   │   OpenAI TTS)   │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (optional, recommended)
- FFmpeg (for audio processing)

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-podcast-generator.git
cd ai-podcast-generator

# Copy environment file
cp backend/.env.example backend/.env
# Edit .env with your API keys (optional)

# Start all services
docker-compose up -d

# Pull an LLM model (first time only)
docker exec -it ai-podcast-generator-ollama-1 ollama pull llama3.1:8b
# Or for better Chinese support:
# docker exec -it ai-podcast-generator-ollama-1 ollama pull qwen2.5:7b

# Access the app
open http://localhost:3000
```

### Option 2: Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install FFmpeg (macOS)
brew install ffmpeg
# Or on Ubuntu: sudo apt install ffmpeg

# Copy and configure environment
cp .env.example .env
# Edit .env as needed

# Run the server
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

#### Ollama (Local LLM)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1:8b
# Or for Chinese: ollama pull qwen2.5:7b

# Ollama runs automatically as a service
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `ollama` | LLM provider: `ollama`, `openai`, or `anthropic` |
| `OLLAMA_MODEL` | `llama3.1:8b` | Ollama model name |
| `TTS_PROVIDER` | `edge` | TTS provider: `edge` (free) or `openai` |
| `RESEARCH_PROVIDER` | `perplexity` | Research: `perplexity`, `tavily`, or `duckduckgo` |
| `PERPLEXITY_API_KEY` | - | Perplexity API key (recommended for best research) |
| `PERPLEXITY_MODEL` | `sonar-pro` | Model: `sonar`, `sonar-pro`, or `sonar-deep-research` |
| `TAVILY_API_KEY` | - | Tavily API key (alternative research provider) |
| `OPENAI_API_KEY` | - | OpenAI API key (optional) |

### Recommended Models

| Use Case | Model | VRAM Required |
|----------|-------|---------------|
| English | `llama3.1:8b` | ~6GB |
| Chinese | `qwen2.5:7b` | ~5GB |
| Best quality | `llama3.1:70b-instruct` | ~40GB |

## 📖 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session/start` | POST | Start new session with topic |
| `/api/session/{id}/answer` | POST | Submit Q&A answer |
| `/api/session/{id}/configure` | POST | Set podcast preferences |
| `/api/session/{id}/generate` | POST | Start generation |
| `/api/session/{id}/status` | GET | Check generation status |
| `/api/session/{id}/audio` | GET | Download generated audio |
| `/api/session/{id}/transcript` | GET | Get podcast script |
| `/ws/{session_id}` | WebSocket | Real-time progress updates |

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
# Run backend tests
cd backend
pytest

# Format code
black .
ruff check .

# Build frontend for production
cd frontend
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
- [Ollama](https://ollama.com/) for easy local LLM deployment
- [FastAPI](https://fastapi.tiangolo.com/) for the excellent Python web framework
- [Perplexity](https://perplexity.ai/) for AI-powered deep research with real-time web search
- [Tavily](https://tavily.com/) for AI-powered web search

---

Made with ❤️ for the open-source community
