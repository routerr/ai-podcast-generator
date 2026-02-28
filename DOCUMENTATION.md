# AI Podcast Generator — Comprehensive Documentation

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Getting Started](#3-getting-started)
4. [Configuration & API Keys](#4-configuration--api-keys)
5. [User Workflow](#5-user-workflow)
6. [Component Reference](#6-component-reference)
7. [Service Reference](#7-service-reference)
8. [State Management](#8-state-management)
9. [Known Limitations](#9-known-limitations)
10. [Deployment](#10-deployment)
11. [Development Guide](#11-development-guide)
12. [Changelog of Fixes](#12-changelog-of-fixes)

---

## 1. Overview

AI Podcast Generator is a **fully browser-based** application that turns any topic into an AI-powered podcast. It is a spiritual successor to Google NotebookLM's Audio Overview feature and requires no server infrastructure — all processing happens client-side via third-party API calls made directly from the browser.

### Key Features

| Feature | Description |
|---------|-------------|
| **Deep Web Research** | Uses Perplexity AI to search the web and compile comprehensive information on any topic |
| **Structured Outline** | Automatically generates a podcast outline with editable sections |
| **Script Generation** | Google Gemini produces a natural, conversational dialogue script |
| **Multilingual** | English and Traditional Chinese (繁體中文) |
| **Two Formats** | Host + Expert dialogue or Solo Narrator monologue |
| **Flexible Length** | Short (~5 min), Medium (~15 min), or Long (~30 min) |
| **Text-to-Speech** | OpenAI TTS (high-quality, downloadable) or browser Web Speech API (playback only) |
| **Privacy First** | API keys and all content stay in the browser — nothing is sent to any server of ours |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Browser)                   │
│                                                               │
│  Research → Outline → Script → Audio                         │
│  (AppContext / useReducer for global state)                   │
└───────────────┬─────────────────────────┬────────────────────┘
                │ direct API calls         │
     ┌──────────▼──────────┐   ┌──────────▼──────────┐
     │   Perplexity API    │   │   Google Gemini API  │
     │  (research, outline)│   │  (script generation) │
     └─────────────────────┘   └──────────────────────┘
                                          │
                               ┌──────────▼──────────┐
                               │    OpenAI TTS API    │
                               │  (audio synthesis)   │
                               └─────────────────────-┘
```

### No Backend Required

Everything runs entirely in the browser. There is no Node.js server, no Python backend, and no database. API keys are stored in `localStorage` and sent directly from the browser to the respective third-party APIs.

---

## 3. Getting Started

### Prerequisites

- Node.js 18 or later
- npm 8 or later
- A modern browser (Chrome, Edge, Firefox, or Safari)

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-podcast-generator.git
cd ai-podcast-generator/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
# → Open http://localhost:3000
```

### Production Build

```bash
cd frontend
npm run build
# → Static files are output to frontend/dist/
```

Deploy the `dist/` folder to any static hosting provider (Vercel, Netlify, GitHub Pages, Cloudflare Pages, etc.).

---

## 4. Configuration & API Keys

### Required API Keys

| Key | Provider | Purpose | Required? |
|-----|----------|---------|-----------|
| **Perplexity API Key** | [Perplexity AI](https://docs.perplexity.ai/) | Web research & outline generation | **Yes** |
| **Google Gemini API Key** | [Google AI Studio](https://aistudio.google.com/) | Podcast script generation | **Yes** |
| **OpenAI API Key** | [OpenAI](https://platform.openai.com/) | High-quality TTS & audio download | Optional |

### Entering Keys

1. Click the **Settings (⚙)** icon in the top-right header.
2. Enter each key and click **Save**.
3. Keys are stored in `localStorage` with the prefix `ai_podcast_generator_api_key_` and are never transmitted to any server other than the respective API provider.

### Optional Environment Variables

For hosted deployments you can pre-populate keys via Vite environment variables — users can still override them at runtime:

```
# frontend/.env.local (for local dev)
VITE_PERPLEXITY_API_KEY=pplx-...
VITE_GEMINI_API_KEY=AIza...
VITE_OPENAI_API_KEY=sk-...
```

> **Note:** Environment variables are embedded in the JavaScript bundle at build time. Do **not** commit `.env` files to version control.

### Recommended Models (used automatically)

| Stage | Model |
|-------|-------|
| Research | `llama-3.1-sonar-small-128k-online` (Perplexity) |
| Outline | `llama-3.1-sonar-large-128k-online` (Perplexity) |
| Script | `gemini-1.5-flash` (Google) |
| TTS | `tts-1` (OpenAI, when key is present) |

---

## 5. User Workflow

```
1. Research  →  2. Outline  →  3. Script  →  4. Audio
```

### Step 1: Research

1. Enter a **topic** (e.g. "How does CRISPR gene editing work?").
2. Select **Language** (English or Traditional Chinese).
3. Select **Format** (Host + Expert Dialogue or Solo Narrator).
4. Select **Length** (Short / Medium / Long).
5. Press **Research**.
6. Perplexity searches the web and returns:
   - A summary
   - Key points
   - Cited sources
7. Review the results, then click **Generate Outline →**.

### Step 2: Outline

- The outline is auto-generated from the research.
- You can:
  - **Refine Outline** — regenerate with Perplexity (includes current structure as context).
  - **Edit** individual section titles (click the "Edit" button next to each section).
  - **+ Add Section** — append a blank section.
  - **Remove** a section.
- When satisfied, click **Generate Script →**.

### Step 3: Script

- The script is automatically generated when you arrive at this step (if a Gemini key is present).
- The script displays **section by section**, colour-coded by speaker (blue = Host, green = Expert).
- You can:
  - **Edit** individual dialogue lines inline.
  - **Regenerate Section** — re-generate just one section's dialogue.
  - **Refine** the entire script by typing feedback (e.g. "Make the tone more casual") and clicking **Refine**.
  - **Regenerate** the entire script from scratch.
- Click **Generate Audio →** when ready.

### Step 4: Audio

- Select **Host Voice** and **Expert Voice** from the dropdowns.
  - OpenAI voices are labelled **(HD)** and require an OpenAI key.
  - Browser voices are free but vary by OS/browser and cannot be downloaded.
- Adjust **Speed** (0.5× – 2.0×).
- Click **Generate Audio**.
- Once generated:
  - **Play/Pause** in the browser for preview.
  - **Download** (only available with an OpenAI key; file is MP3).

> **Without an OpenAI key:** Audio plays through the browser's built-in speaker. Download is not available because the Web Speech API cannot be captured as a file.

---

## 6. Component Reference

### `App.tsx`

Root component. Manages:
- The API Key panel open/close state.
- Step indicator rendering.
- Global error toast.
- Automatic redirect from the legacy `input` step to `research`.

### `Header.tsx`

Simple header bar with the app logo and a Settings button. Calls `onApiKeyClick` prop to open the panel managed by `App.tsx`.

### `ApiKeyPanel.tsx`

Modal for entering, saving, and clearing API keys. Saves to `localStorage` via `useApiKeys` hook **and** dispatches `SET_API_KEYS` to `AppContext` so all panels immediately see the new keys.

### `ResearchPanel.tsx`

- Topic input field (Enter key submits).
- Language, Format, and Length selectors (config persisted in AppContext).
- Calls `PerplexityService.researchTopic()`.
- Displays summary, key points, and sources.

### `OutlinePanel.tsx`

- Calls `PerplexityService.generateOutline()`.
- Editable section list (inline title editing, add/remove sections).
- Refine button regenerates with current structure as context.

### `ScriptPanel.tsx`

- Auto-generates script on mount via `GeminiService.generatePodcastScript()`.
- Per-section regeneration via `GeminiService.generateSectionDialogue()`.
- Whole-script refinement via `GeminiService.refineScript()`.
- Inline dialogue editing.

### `AudioPanel.tsx`

- Voice selector (Web Speech + OpenAI voices merged into one list).
- Speed slider (0.5× – 2.0×) — actually passed to TTS service.
- Calls `TTSService.generatePodcastAudio()` then `AudioService.mergeAudioBlobs()`.
- Waveform display uses **stable pre-computed heights** (no re-render jitter).
- Download uses correct file extension (`.mp3` with OpenAI, `.wav` otherwise).

---

## 7. Service Reference

### `PerplexityService`

```typescript
class PerplexityService {
  researchTopic(topic: string, language?: 'en' | 'zh-TW'): Promise<ResearchResult>
  generateOutline(research: ResearchResult, language?: 'en' | 'zh-TW'): Promise<Outline>
  generateSectionContent(section: OutlineSection, research: ResearchResult): Promise<string>
}
```

- Uses `llama-3.1-sonar-small-128k-online` for research and `llama-3.1-sonar-large-128k-online` for outlines.
- Prompts are language-aware (English or Traditional Chinese).
- JSON responses are parsed with a robust regex that handles markdown code fences.
- Outline sections always have unique IDs (generated if the API omits them).

### `GeminiService`

```typescript
class GeminiService {
  generatePodcastScript(apiKey, outline, research, config?): Promise<Script>
  generateSectionDialogue(apiKey, section, research, previousContext?, config?): Promise<Dialogue[]>
  refineScript(apiKey, script, feedback, config?): Promise<Script>
}
```

- Uses `gemini-1.5-flash`.
- Supports **dialogue** (Host + Expert) and **solo** (Narrator) formats.
- Supports English and Traditional Chinese prompts.
- After refinement, dialogues are **re-distributed evenly** across sections (fixes the blank-section bug).
- Duration estimation uses word count (150 words/min) instead of a naive dialogue-count heuristic.
- Parses emotion tags (`[curious]`, `[excited]`, `[thoughtful]`, `[neutral]`, and Chinese equivalents).

### `TTSService`

```typescript
class TTSService {
  synthesizeWithOpenAI(dialogue, apiKey, options): Promise<Blob>
  speakWithWebSpeech(dialogue, voiceURI, rate?): Promise<void>
  generatePodcastAudio(
    dialogues, hostVoiceId, expertVoiceId,
    onProgress?, openaiKey?, rate?,
    hostOpenAIVoice?, expertOpenAIVoice?
  ): Promise<Blob[]>
}
```

**Important:** The Web Speech API cannot be recorded — its output goes directly to the OS audio device. When no OpenAI key is provided, `generatePodcastAudio` **plays** each line through the browser and returns an empty placeholder Blob. Download is only available with an OpenAI key.

### `AudioService`

```typescript
class AudioService {
  mergeAudioBlobs(audioBlobs: Blob[]): Promise<Blob>
  addPause(duration: number): Promise<Blob>   // duration in ms
  getAudioDuration(audioBlob: Blob): Promise<number>   // seconds
  createDownloadLink(audioBlob: Blob, filename: string): void
}
```

- Decodes all blobs, concatenates their PCM frames, then re-encodes as WAV.
- PCM samples are **correctly interleaved** for multi-channel audio (L R L R …).
- `createDownloadLink` revokes the object URL after 10 seconds (enough time for the browser to start the download).

### `StorageService`

Simple `localStorage` wrapper with a `ai_podcast_generator_api_key_` prefix to avoid collisions.

---

## 8. State Management

The application uses React Context + `useReducer` (`AppContext`).

### State Shape

```typescript
interface AppState {
  apiKeys: { perplexityKey: string; geminiKey: string; openaiKey?: string };
  currentStep: 'research' | 'outline' | 'script' | 'audio';
  topic: string;
  config: { language: 'en' | 'zh-TW'; format: 'solo' | 'dialogue'; length: 'short' | 'medium' | 'long' };
  podcastState: { topic, research, outline, script, audioBlob };
  audioState: { isGenerating, progress, audioBlob, audioUrl, duration, error };
  isLoading: boolean;
  error: string | null;
}
```

### Key Actions

| Action | Effect |
|--------|--------|
| `SET_API_KEYS` | Updates all three API keys in context |
| `SET_CURRENT_STEP` | Navigates between steps |
| `SET_CONFIG` | Updates language / format / length |
| `UPDATE_PODCAST_STATE` | Merges partial podcast state |
| `SET_AUDIO_STATE` | Merges partial audio state |
| `SET_SCRIPT` / `UPDATE_SCRIPT` | Sets or replaces the current script |
| `RESET` | Returns to initial state |

### API Key Synchronisation

On mount, `AppProvider` reads all three keys from `localStorage` and dispatches `SET_API_KEYS`. When the user saves a key through `ApiKeyPanel`, it writes to `localStorage` **and** dispatches `SET_API_KEYS` — so the change is immediately visible to all panels without a page reload.

---

## 9. Known Limitations

| Limitation | Details |
|------------|---------|
| **Web Speech download** | The browser's built-in TTS cannot be captured as an audio file. Download requires an OpenAI key. |
| **WAV file size** | Without OpenAI, merged audio is WAV (uncompressed). A 15-minute podcast may be 100–200 MB. With OpenAI the output is MP3. |
| **No MP3 encoding in browser** | Browser-native MP3 encoding requires a third-party WASM library (e.g. `lamejs`) which is not currently included. |
| **API rate limits** | Long podcasts generate many TTS requests sequentially; OpenAI's `tts-1` rate limit may throttle generation. |
| **Perplexity response format** | Research results depend on the LLM returning valid JSON. A plain-text fallback is used, but key points and sources may be empty. |
| **No persistent storage** | State is in memory only; refreshing the page loses all progress. |
| **API key security** | Keys are in plain text in `localStorage`. Suitable for personal use. For shared deployments, consider adding CORS-restricted API keys or a proxy. |

---

## 10. Deployment

### Vercel (recommended)

1. Fork the repository.
2. Connect to Vercel.
3. Set root directory to `frontend` (or use `vercel.json` at the repo root).
4. Optionally set `VITE_PERPLEXITY_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_OPENAI_API_KEY` as environment variables.
5. Deploy.

### Other Static Hosts (Netlify, GitHub Pages, Cloudflare Pages)

```bash
cd frontend
npm install
npm run build
# Upload the contents of dist/ to your host
```

For single-page app routing, configure your host to redirect all 404s to `index.html`.

### `vercel.json`

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite"
}
```

---

## 11. Development Guide

### Project Structure

```
ai-podcast-generator/
├── frontend/
│   ├── src/
│   │   ├── components/     # UI components (one per step + shared)
│   │   ├── contexts/       # AppContext (global state)
│   │   ├── hooks/          # useApiKeys
│   │   ├── services/       # API integrations + audio processing
│   │   ├── types/          # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── DOCUMENTATION.md        # This file
├── README.md
├── CHANGELOG.md
└── DEPLOY.md
```

### Adding a New TTS Provider

1. Add a new method to `TTSService` (e.g. `synthesizeWithElevenLabs`).
2. Add voice options to `AudioPanel`'s voice list.
3. Route the new provider in `TTSService.generatePodcastAudio`.

### Adding a New Language

1. Add the language code to `SessionConfig.language` in `types/index.ts`.
2. Add the option to the Language selector in `ResearchPanel`.
3. Add language-conditional prompt strings to `PerplexityService` and `GeminiService`.

### Adding a New LLM Model

Update the model constant at the top of the relevant service file:

```typescript
// perplexityService.ts
const ONLINE_MODEL = 'llama-3.1-sonar-small-128k-online';
const LARGE_ONLINE_MODEL = 'llama-3.1-sonar-large-128k-online';

// geminiService.ts
const GEMINI_MODEL = 'gemini-1.5-flash';
```

### Coding Conventions

- **Styling:** Tailwind CSS utility classes only — dark glass-morphism aesthetic (`bg-white/5`, `border-white/10`).
- **State:** Global changes go through `AppContext` dispatch; local UI state uses `useState`.
- **API calls:** All calls are made from service classes, not directly from components.
- **TypeScript:** Strict mode. No `any` unless unavoidable.

---

## 12. Changelog of Fixes

This section documents all bugs fixed and features implemented in the `claude/fix-app-issues-vOTtE` branch.

### Critical Bug Fixes

| Bug | Fix |
|-----|-----|
| **API keys never reached service panels** | `AppProvider` now loads keys from `localStorage` on mount and dispatches `SET_API_KEYS`. `ApiKeyPanel` also dispatches after saving. |
| **Input step was a placeholder stub** | The `input` step has been removed. The app now starts at the `research` step, which includes the topic input field. |
| **Duplicate `ApiKeyPanel` rendering** | `Header.tsx` had its own internal panel state and rendered a second panel. This has been removed — `App.tsx` is the single source of truth. |
| **`refineScript` emptied all sections** | After refinement, `dialogueIds` were filtered against new dialogue IDs that didn't exist, leaving all sections blank. Fixed by re-distributing dialogues evenly (same logic as initial generation). |
| **Web Speech API recording was broken** | `speechSynthesis` cannot be captured by Web Audio API. Replaced broken approach with `speakWithWebSpeech` (playback only) and clear UI messaging. |
| **Stereo WAV PCM interleaving wrong** | Old code wrote all of channel 0 then all of channel 1 (non-standard). Fixed to interleave: L₀ R₀ L₁ R₁ … |
| **`createDownloadLink` revoked URL before download** | URL was revoked immediately after click. Now revoked after 10-second delay. |

### UI / UX Fixes

| Issue | Fix |
|-------|-----|
| **ResearchPanel had light theme** | Rewritten with consistent dark glass theme matching Script/Audio panels. |
| **OutlinePanel had light theme** | Rewritten with consistent dark glass theme. |
| **No step progress indicator** | Added `StepIndicator` component in `App.tsx` showing numbered steps with completion state. |
| **Waveform re-rendered with random heights** | `Math.random()` was called on every render. Replaced with stable pre-computed heights (`WAVEFORM_HEIGHTS` constant). |
| **Rate slider had no effect** | `rate` state was stored but never passed to `TTSService`. Now passed through `generateAudio` → `generatePodcastAudio`. |
| **Voice selector ignored for OpenAI TTS** | Host/expert voices were always `onyx`/`nova` regardless of selection. Now the selected voice ID is passed as the OpenAI voice. |
| **Download filename had `.mp3` for WAV audio** | Extension is now `.mp3` when OpenAI key is present (actual MP3) and `.wav` otherwise. |
| **All UI text was in Chinese** | Research, Outline, Script, and Audio panels are now in English, matching the Header and API Key panel. |

### Features Implemented

| Feature | Implementation |
|---------|---------------|
| **Language selector** | English / Traditional Chinese; passed to Perplexity and Gemini prompts. |
| **Format selector** | Host + Expert Dialogue or Solo Narrator; changes system prompts and speaker parsing. |
| **Length selector** | Short / Medium / Long; added to generation prompts as target duration hint. |
| **Outline section IDs guaranteed** | `generateOutline` now ensures every section has a unique ID (generated if AI omits it). |
| **Better duration estimation** | Duration is now calculated from word count (~150 wpm) rather than dialogue count × 5s. |
| **Config passed to all generators** | `generatePodcastScript`, `generateSectionDialogue`, and `refineScript` all accept `config` (language, format, length). |
| **JSON parsing hardened** | Regex now handles multi-line JSON inside code fences correctly. |

### Other Clean-ups

- Removed stale `/api` and `/ws` proxy entries from `vite.config.ts` (leftover from old backend).
- `ApiKeyPanel` now dispatches context update immediately after save — no page reload needed.
- `Header.tsx` simplified: no longer manages its own panel state or renders `ApiKeyPanel`.
