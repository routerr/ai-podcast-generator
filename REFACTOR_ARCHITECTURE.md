# AI Podcast Generator - 重構架構設計

## 目錄
1. [現有專案分析摘要](#1-現有專案分析摘要)
2. [重構目標與需求](#2-重構目標與需求)
3. [新架構設計](#3-新架構設計)
4. [組件結構](#4-組件結構)
5. [API 整合詳情](#5-api-整合詳情)
6. [音頻生成方案](#6-音頻生成方案)
7. [實作路線圖](#7-實作路線圖)

---

## 1. 現有專案分析摘要

### 1.1 現有架構概覽

現有專案採用前後端分離架構：

```mermaid
flowchart TB
    subgraph Frontend [前端 - React/TypeScript]
        UI[使用者介面]
        WS[WebSocket 客戶端]
        API[API 客戶端]
    end

    subgraph Backend [後端 - FastAPI/Python]
        Main[主應用程式]
        Session[會話管理器]
        
        subgraph Services [服務層]
            LLM[LLM 服務]
            Research[研究服務]
            Script[腳本服務]
            TTS[TTS 服務]
        end
    end

    subgraph External [外部服務]
        Ollama[Ollama LLM]
        Perplexity[Perplexity API]
        Tavily[Tavily API]
        DuckDuckGo[DuckDuckGo]
        EdgeTTS[Edge TTS]
        OpenAI[OpenAI API]
    end

    UI --> API
    UI --> WS
    API --> Main
    WS --> Main
    Main --> Session
    Main --> Services
    LLM --> Ollama
    LLM --> OpenAI
    Research --> Perplexity
    Research --> Tavily
    Research --> DuckDuckGo
    Script --> LLM
    TTS --> EdgeTTS
    TTS --> OpenAI
```

### 1.2 現有處理流程

```mermaid
sequenceDiagram
    participant User as 使用者
    participant Frontend as 前端
    participant Backend as 後端
    participant LLM as LLM 服務
    participant Research as 研究服務
    participant TTS as TTS 服務

    User->>Frontend: 輸入主題
    Frontend->>Backend: POST /api/session/start
    Backend->>LLM: 生成澄清問題
    LLM-->>Backend: 問題 JSON
    Backend-->>Frontend: Session ID + 問題
    
    User->>Frontend: 回答問題
    Frontend->>Backend: POST /api/session/id/answer
    
    User->>Frontend: 配置播客
    Frontend->>Backend: POST /api/session/id/configure
    
    User->>Frontend: 開始生成
    Frontend->>Backend: POST /api/session/id/generate
    Frontend->>Backend: WebSocket Connect
    
    Backend->>Research: 深度研究
    Research-->>Backend: 研究結果
    Backend-->>Frontend: WS Progress: 40%
    
    Backend->>LLM: 生成腳本
    LLM-->>Backend: 腳本 JSON
    Backend-->>Frontend: WS Progress: 70%
    
    Backend->>TTS: 生成音頻
    TTS-->>Backend: 音頻檔案路徑
    Backend-->>Frontend: WS Progress: 100%
    
    Frontend->>Backend: GET /api/session/id/audio
    Backend-->>Frontend: 音頻檔案
    Frontend-->>User: 播放/下載
```

### 1.3 現有問題與限制

| 問題 | 說明 |
|------|------|
| **後端依賴** | 所有處理都在後端進行，需要維護伺服器 |
| **API Key 管理** | API Key 在後端環境變數中配置，使用者無法自行提供 |
| **部署複雜度** | 需要 Docker、Ollama、FFmpeg 等依賴 |
| **擴展性限制** | 後端資源成為瓶頸 |

---

## 2. 重構目標與需求

### 2.1 核心目標

1. **最大化瀏覽器端處理** - 最小化或消除後端處理需求 ✅ 已完成
2. **使用者提供 API Key** - 透過前端彈出面板管理 Perplexity 和 Gemini API Key ✅ 已完成
3. **Perplexity API** - 用於資料收集、研究、大綱創建和文字編輯 ✅ 已完成
4. **Google Gemini API** - 用於生成對話式播客（主持人帶領大綱提問，專家提供解釋） ✅ 已完成
5. **可下載播客** - 生成的播客音頻可下載 ✅ 已完成

### 2.2 技術需求

| 需求 | 解決方案 |
|------|----------|
| CORS 限制處理 | Perplexity 和 Gemini API 支援 CORS，可直接從瀏覽器調用 ✅ 已驗證 |
| API Key 儲存 | localStorage 安全儲存 ✅ 已實現 |
| 音頻生成 | Web Speech API 或雲端 TTS API ✅ 已實現 |
| 狀態管理 | React Context + useReducer ✅ 已實現 |
| 無後端部署 | 靜態網站託管（Vercel、Netlify 等） ✅ 已實現 |

---

## 3. 新架構設計

### 3.1 系統架構圖

```mermaid
flowchart TB
    subgraph Browser [瀏覽器端]
        subgraph UI [使用者介面]
            Input[主題輸入]
            Questions[問題流程]
            Config[配置面板]
            Progress[進度顯示]
            Player[音頻播放器]
            Settings[API Key 設定面板]
        end
        
        subgraph State [狀態管理]
            Context[React Context]
            Reducer[useReducer]
            LocalStorage[localStorage]
        end
        
        subgraph Services [前端服務層]
            PerplexityService[Perplexity 服務]
            GeminiService[Gemini 服務]
            TTSService[TTS 服務]
            AudioService[音頻處理服務]
        end
        
        subgraph Utils [工具函數]
            APIKeyManager[API Key 管理器]
            AudioEncoder[音頻編碼器]
            Downloader[檔案下載器]
        end
    end

    subgraph ExternalAPIs [外部 API]
        PerplexityAPI[Perplexity API]
        GeminiAPI[Google Gemini API]
        TTSAPI[TTS API 選項]
    end

    UI --> State
    State --> Services
    Services --> ExternalAPIs
    Settings --> LocalStorage
    LocalStorage --> APIKeyManager
    APIKeyManager --> Services
    TTSService --> AudioService
    AudioService --> AudioEncoder
    AudioEncoder --> Downloader
    Downloader --> Player
```

### 3.2 資料流設計

```mermaid
sequenceDiagram
    participant User as 使用者
    participant UI as 前端 UI
    participant State as 狀態管理
    participant Perplexity as Perplexity API
    participant Gemini as Gemini API
    participant TTS as TTS 服務
    participant Audio as 音頻處理

    User->>UI: 開啟設定面板
    UI->>State: 儲存 API Keys 到 localStorage
    
    User->>UI: 輸入主題
    UI->>Perplexity: 生成澄清問題
    Perplexity-->>UI: 問題列表
    
    User->>UI: 回答問題
    User->>UI: 配置播客設定
    
    User->>UI: 開始生成
    UI->>State: 更新進度狀態
    
    UI->>Perplexity: 深度研究主題
    Perplexity-->>UI: 研究結果
    UI->>State: 進度 30%
    
    UI->>Perplexity: 生成播客大綱
    Perplexity-->>UI: 大綱結構
    UI->>State: 進度 50%
    
    UI->>Gemini: 生成對話腳本
    Note over Gemini: 主持人提問 + 專家回答
    Gemini-->>UI: 對話腳本
    UI->>State: 進度 70%
    
    UI->>TTS: 生成音頻
    TTS-->>UI: 音頻 Blob
    UI->>Audio: 合併與處理
    Audio-->>UI: 最終音頻檔案
    UI->>State: 進度 100%
    
    UI-->>User: 播放/下載選項
```

### 3.3 無後端架構優勢

| 優勢 | 說明 |
|------|------|
| **零伺服器成本** | 可部署在免費的靜態託管平台 |
| **即時部署** | 無需等待伺服器配置 |
| **使用者隱私** | API Key 不經過任何伺服器 |
| **無限擴展** | 每個使用者的瀏覽器獨立處理 |
| **開發簡化** | 無需維護後端服務 |

---

## 4. 組件結構

### 4.1 組件樹狀圖

```
App
├── Header
│   └── ApiKeyPanel (彈出面板)
│       ├── PerplexityKeyInput
│       └── GeminiKeyInput
│
├── MainContent
│   ├── ResearchPanel
│   │   └── QuestionFlow
│   ├── OutlinePanel
│   ├── ScriptPanel
│   └── AudioPanel
│       ├── AudioPreview
│       └── DownloadButton
│
└── ErrorBoundary
    └── ErrorDisplay
```

### 4.2 核心組件說明

#### 4.2.1 ApiKeyPanel - API Key 管理彈出面板 ✅ 已實現

```typescript
interface ApiKeyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ApiKeys {
  perplexityApiKey: string;
  geminiApiKey: string;
}

// 功能：
// - 顯示當前 API Key 狀態（已設定/未設定）
// - 輸入欄位帶有顯示/隱藏切換
// - 驗證 API Key 格式
// - 儲存到 localStorage
// - 測試連接按鈕
```

#### 4.2.2 PerplexityService - Perplexity 服務 ✅ 已實現

```typescript
class PerplexityService {
  private apiKey: string;
  private baseUrl: string = 'https://api.perplexity.ai';

  // 生成澄清問題
  async generateQuestions(topic: string): Promise<Question[]>;

  // 深度研究
  async deepResearch(topic: string, context: QaContext): Promise<ResearchResult>;

  // 生成播客大綱
  async generateOutline(research: ResearchResult): Promise<Outline>;

  // 編輯和優化文字
  async editText(content: string, instructions: string): Promise<string>;
}
```

#### 4.2.3 GeminiService - Gemini 服務 ✅ 已實現

```typescript
class GeminiService {
  private apiKey: string;
  private baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';

  // 生成對話腳本
  async generateDialogueScript(
    outline: Outline,
    research: ResearchResult,
    config: PodcastConfig
  ): Promise<DialogueScript>;

  // 生成主持人台詞
  async generateHostLine(context: DialogueContext): Promise<string>;

  // 生成expert回答
  async generateExpertResponse(
    question: string,
    research: ResearchResult
  ): Promise<string>;
}
```

### 4.3 狀態管理結構

```typescript
interface AppState {
  // 步驟狀態
  currentStep: 'input' | 'questions' | 'config' | 'generating' | 'complete';
  
  // 主題和問題
  topic: string;
  questions: Question[];
  answers: Record<string, string>;
  
  // 配置
  config: PodcastConfig;
  
  // 進度
  progress: ProgressState;
  
  // 結果
  research: ResearchResult | null;
  outline: Outline | null;
  script: DialogueScript | null;
  audioBlob: Blob | null;
  
  // API Keys
  apiKeys: ApiKeyState;
  
  // 錯誤處理
  error: Error | null;
}

interface ApiKeyState {
  perplexityKey: string | null;
  geminiKey: string | null;
  isValidated: {
    perplexity: boolean;
    gemini: boolean;
  };
}
```

---

## 5. API 整合詳情

### 5.1 Perplexity API 整合 ✅ 已實現

#### 5.1.1 API 端點

| 端點 | 用途 | 模型 |
|------|------|------|
| `POST /chat/completions` | 生成內容 | sonar, sonar-pro, sonar-deep-research |

#### 5.1.2 請求格式

```typescript
interface PerplexityRequest {
  model: 'sonar' | 'sonar-pro' | 'sonar-deep-research';
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  return_citations?: boolean;
  return_related_questions?: boolean;
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
  citations?: string[];
  related_questions?: string[];
}
```

#### 5.1.3 使用場景

```mermaid
flowchart LR
    subgraph PerplexityUses [Perplexity API 使用場景]
        Q[生成澄清問題]
        R[深度研究]
        O[生成大綱]
        E[文字編輯]
    end
    
    Q --> |sonar-pro| API[Perplexity API]
    R --> |sonar-deep-research| API
    O --> |sonar-pro| API
    E --> |sonar| API
```

#### 5.1.4 CORS 驗證

Perplexity API 支援 CORS，可直接從瀏覽器調用：

```typescript
const response = await fetch('https://api.perplexity.ai/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(request)
});
```

### 5.2 Google Gemini API 整合 ✅ 已實現

#### 5.2.1 API 端點

| 端點 | 用途 |
|------|------|
| `POST /models/{model}:generateContent` | 生成內容 |
| `POST /models/{model}:streamGenerateContent` | 串流生成 |

#### 5.2.2 請求格式

```typescript
interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
    role: 'user' | 'model';
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
  }>;
}
```

#### 5.2.3 對話生成策略

```mermaid
flowchart TB
    subgraph DialogueGeneration [對話生成流程]
        Outline[播客大綱]
        Research[研究結果]
        
        subgraph Loop [逐段生成]
            HostLine[主持人台詞]
            ExpertLine[專家回答]
        end
        
        Script[完整腳本]
    end
    
    Outline --> Loop
    Research --> Loop
    Loop --> HostLine
    Loop --> ExpertLine
    HostLine --> Script
    ExpertLine --> Script
```

#### 5.2.4 CORS 驗證

Gemini API 支援 CORS，可直接從瀏覽器調用：

```typescript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  }
);
```

### 5.3 API Key 安全性考量

| 考量 | 解決方案 |
|------|----------|
| localStorage 安全 | 僅儲存在使用者本地，不上傳任何伺服器 |
| 傳輸安全 | 使用 HTTPS 加密傳輸 |
| 金鑰洩露風險 | 使用者自行承擔風險，建議使用有限額度的 API Key |
| 清除功能 | 提供一鍵清除所有 API Key 功能 |

---

## 6. 音頻生成方案

### 6.1 方案比較

| 方案 | 優點 | 缺點 | 適用場景 |
|------|------|------|----------|
| **Web Speech API** | 免費、無需 API Key、純瀏覽器 | 音質較差、聲音選擇有限 | 快速原型、離線使用 |
| **Google Cloud TTS** | 高品質、多語言 | 需要 API Key、付費 | 專業級播客 |
| **OpenAI TTS** | 非常自然 | 需要 API Key、付費 | 高品質需求 |
| **ElevenLabs** | 最自然的聲音 | 付費、較貴 | 專業播客製作 |

### 6.2 推薦方案：混合模式 ✅ 已實現

```mermaid
flowchart TB
    subgraph TTSOptions [TTS 選項]
        Free[免費選項]
        Paid[付費選項]
    end
    
    Free --> WebSpeech[Web Speech API]
    Free --> ResponsiveVoice[ResponsiveVoice]
    
    Paid --> GoogleTTS[Google Cloud TTS]
    Paid --> OpenAITTS[OpenAI TTS]
    Paid --> ElevenLabs[ElevenLabs]
    
    WebSpeech --> Default[預設選項]
    GoogleTTS --> Recommended[推薦選項]
```

### 6.3 Web Speech API 實作 ✅ 已實現

```typescript
class WebSpeechTTSService {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[];

  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.loadVoices();
  }

  private loadVoices(): void {
    this.voices = this.synth.getVoices();
  }

  async generateAudio(text: string, voice: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const selectedVoice = this.voices.find(v => v.name === voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // 使用 MediaRecorder 錄製音頻
      // 注意：Web Speech API 不直接支援錄製
      // 需要使用替代方案
    });
  }
}
```

### 6.4 替代方案：使用線上 TTS API ✅ 已實現

由於 Web Speech API 無法直接匯出音頻檔案，我們實現了以下方案：

#### 6.4.1 Google Cloud Text-to-Speech

```typescript
class GoogleCloudTTSService {
  private apiKey: string;

  async synthesize(text: string, voice: string): Promise<Blob> {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'en-US', name: voice },
          audioConfig: { audioEncoding: 'MP3' }
        })
      }
    );
    
    const data = await response.json();
    const audioData = atob(data.audioContent);
    const arrayBuffer = new ArrayBuffer(audioData.length);
    const view = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < audioData.length; i++) {
      view[i] = audioData.charCodeAt(i);
    }
    
    return new Blob([arrayBuffer], { type: 'audio/mp3' });
  }
}
```

#### 6.4.2 OpenAI TTS API ✅ 已實現

```typescript
class OpenAITTSService {
  private apiKey: string;

  async synthesize(text: string, voice: string): Promise<Blob> {
    const response = await fetch(
      'https://api.openai.com/v1/audio/speech',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          response_format: 'mp3'
        })
      }
    );
    
    return await response.blob();
  }
}
```

### 6.5 音頻處理流程 ✅ 已實現

```mermaid
flowchart LR
    subgraph AudioPipeline [音頻處理管線]
        Script[腳本段落]
        TTS[TTS 生成]
        Segments[音頻片段]
        Merge[合併處理]
        Final[最終音頻]
    end
    
    Script --> |逐段| TTS
    TTS --> |Blob| Segments
    Segments --> |AudioContext| Merge
    Merge --> |新增停頓| Final
    Final --> |下載| User[使用者]
```

### 6.6 音頻合併實作 ✅ 已實現

```typescript
class AudioMerger {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new AudioContext();
  }

  async mergeAudioBuffers(
    buffers: AudioBuffer[],
    pauseDuration: number = 0.3
  ): Promise<Blob> {
    // 計算總長度
    const sampleRate = this.audioContext.sampleRate;
    const pauseSamples = pauseDuration * sampleRate;
    const totalLength = buffers.reduce(
      (sum, buf) => sum + buf.length + pauseSamples,
      0
    );

    // 創建輸出緩衝區
    const output = this.audioContext.createBuffer(
      1, // 單聲道
      totalLength,
      sampleRate
    );

    // 合併音頻
    let offset = 0;
    for (const buffer of buffers) {
      output.copyToChannel(buffer.getChannelData(0), 0, offset);
      offset += buffer.length + pauseSamples;
    }

    // 轉換為 Blob
    return this.audioBufferToBlob(output);
  }

  private audioBufferToBlob(buffer: AudioBuffer): Blob {
    // 實作 AudioBuffer 轉 MP3/WAV
    // 使用 lamejs 或類似庫進行 MP3 編碼
  }
}
```

---

## 7. 實作路線圖

### 7.1 階段一：基礎架構 ✅ 已完成

```mermaid
flowchart LR
    subgraph Phase1 [階段一]
        A1[建立新 React 專案結構]
        A2[實作 API Key 管理組件]
        A3[實作 localStorage 儲存]
        A4[建立狀態管理架構]
    end
    
    A1 --> A2
    A2 --> A3
    A3 --> A4
```

**任務清單：**
- [x] 建立新的前端專案結構
- [x] 實作 ApiKeyProvider Context
- [x] 建立 ApiKeyModal 彈出面板組件
- [x] 實作 localStorage API Key 儲存與讀取
- [x] 建立 useReducer 狀態管理

### 7.2 階段二：API 整合 ✅ 已完成

```mermaid
flowchart LR
    subgraph Phase2 [階段二]
        B1[實作 Perplexity 服務]
        B2[實作 Gemini 服務]
        B3[實作 API 驗證功能]
        B4[整合到主流程]
    end
    
    B1 --> B2
    B2 --> B3
    B3 --> B4
```

**任務清單：**
- [x] 建立 PerplexityService 類別
- [x] 實作 generateQuestions 方法
- [x] 實作 deepResearch 方法
- [x] 建立 GeminiService 類別
- [x] 實作 generateDialogueScript 方法
- [x] 建立 API Key 驗證功能

### 7.3 階段三：音頻生成 ✅ 已完成

```mermaid
flowchart LR
    subgraph Phase3 [階段三]
        C1[實作 TTS 服務介面]
        C2[整合 OpenAI TTS]
        C3[實作音頻合併]
        C4[實作下載功能]
    end
    
    C1 --> C2
    C2 --> C3
    C3 --> C4
```

**任務清單：**
- [x] 建立 TTSService 介面
- [x] 實作 OpenAI TTS 整合
- [x] 建立 AudioMerger 類別
- [x] 實作音頻下載功能
- [x] 建立 AudioPlayer 組件

### 7.4 階段四：UI/UX 優化 ✅ 已完成

```mermaid
flowchart LR
    subgraph Phase4 [階段四]
        D1[優化進度顯示]
        D2[錯誤處理優化]
        D3[響應式設計]
        D4[無障礙支援]
    end
    
    D1 --> D2
    D2 --> D3
    D3 --> D4
```

**任務清單：**
- [x] 建立進度動畫效果
- [x] 實作完整的錯誤處理
- [x] 優化行動裝置體驗
- [x] 加入 ARIA 標籤

### 7.5 階段五：部署與測試 ✅ 已完成

```mermaid
flowchart LR
    subgraph Phase5 [階段五]
        E1[單元測試]
        E2[整合測試]
        E3[部署設定]
        E4[文檔更新]
    end
    
    E1 --> E2
    E2 --> E3
    E3 --> E4
```

**任務清單：**
- [x] 撰寫服務層單元測試
- [x] 撰寫組件整合測試
- [x] 設定 Vercel/Netlify 部署
- [x] 更新 README 文檔

---

## 附錄

### A. 技術棧總結

| 層級 | 技術 |
|------|------|
| **前端框架** | React 18 + TypeScript |
| **狀態管理** | React Context + useReducer |
| **樣式** | Tailwind CSS |
| **構建工具** | Vite |
| **API 通訊** | Fetch API |
| **音頻處理** | Web Audio API + lamejs |
| **儲存** | localStorage |

### B. API 端點總覽

| API | 端點 | 用途 |
|-----|------|------|
| Perplexity | `https://api.perplexity.ai/chat/completions` | 研究、大綱生成 |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent` | 對話生成 |
| OpenAI TTS | `https://api.openai.com/v1/audio/speech` | 音頻生成 |

### C. 檔案結構建議

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header/
│   │   │   ├── Header.tsx
│   │   │   └── index.ts
│   │   ├── ApiKeyPanel/
│   │   │   ├── ApiKeyPanel.tsx
│   │   │   ├── ApiKeyPanel.css
│   │   │   └── index.ts
│   │   ├── ResearchPanel/
│   │   │   ├── ResearchPanel.tsx
│   │   │   └── index.ts
│   │   ├── OutlinePanel/
│   │   │   ├── OutlinePanel.tsx
│   │   │   └── index.ts
│   │   ├── ScriptPanel/
│   │   │   ├── ScriptPanel.tsx
│   │   │   └── index.ts
│   │   ├── AudioPanel/
│   │   │   ├── AudioPanel.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── common/
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   └── ProgressBar/
│   │   │
│   ├── services/
│   │   ├── PerplexityService.ts
│   │   ├── GeminiService.ts
│   │   ├── TTSService.ts
│   │   ├── AudioService.ts
│   │   └── StorageService.ts
│   │
│   ├── contexts/
│   │   └── AppContext.tsx
│   │
│   ├── hooks/
│   │   ├── useApiKeys.ts
│   │   └── usePodcastGeneration.ts
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   ├── utils/
│   │   └── helpers.ts
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

### D. 瀏覽器支援

| 瀏覽器 | 最低版本 |
|--------|----------|
| Chrome | 90+ |
| Firefox | 90+ |
| Safari | 15+ |
| Edge | 90+ |

---

*文檔版本：2.0*
*最後更新：2026-02-14*
