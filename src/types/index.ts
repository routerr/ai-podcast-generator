// API 金鑰介面
export interface ApiKeys {
  perplexityKey: string;
  geminiKey: string;
  openrouterKey?: string;
  ollamaKey?: string;
  openaiKey?: string; // 新增 OpenAI API 金鑰 (可選)
}

export type LLMProvider = 'gemini' | 'perplexity' | 'openrouter' | 'ollama';
export type LLMFallbackProvider = LLMProvider | 'none';

// UI 語言
export type UILanguage = 'en' | 'ja' | 'zh-CN' | 'zh-TW';

// 研究結果介面
export interface ResearchResult {
  topic: string;
  summary: string;
  keyPoints: string[];
  sources: Source[];
  timestamp: Date;
}

// 來源介面
export interface Source {
  title: string;
  url: string;
  snippet: string;
}

// 大綱介面
export interface Outline {
  title: string;
  description: string;
  sections: OutlineSection[];
}

// 大綱段落介面
export interface OutlineSection {
  id: string;
  title: string;
  keyPoints: string[];
  duration: number; // estimated duration in seconds
}

// 對話介面
export interface Dialogue {
  id: string;
  speaker: 'host' | 'expert';
  text: string;
  emotion?: 'neutral' | 'curious' | 'excited' | 'thoughtful';
  pauseAfter?: number; // milliseconds
}

// 腳本段落介面
export interface ScriptSection {
  id: string;
  title: string;
  dialogueIds: string[];
}

// 腳本介面
export interface Script {
  id: string;
  title: string;
  dialogues: Dialogue[];
  totalDuration: number; // estimated in seconds
  sections: ScriptSection[];
}

// 播客狀態介面
export interface PodcastState {
  topic: string;
  research: ResearchResult | null;
  outline: Outline | null;
  script: Script | null;
  audioBlob: Blob | null;
}

// 應用程式步驟類型
export type AppStep = 'input' | 'research' | 'outline' | 'script' | 'audio';

// 問題介面 (與現有程式碼保持一致)
export interface Question {
  question_id: string;
  question: string;
  options: { key: string; text: string }[];
}

// 會話配置介面 (與現有程式碼保持一致)
export interface SessionConfig {
  language: UILanguage;
  format: 'solo' | 'dialogue';
  length: 'short' | 'medium' | 'long';
  llmPrimaryProvider: LLMProvider;
  llmFallbackProvider: LLMFallbackProvider;
  geminiModel: string;
  perplexityModel: string;
  openrouterModel: string;
  ollamaModel: string;
  ollamaBaseUrl: string;
}

// 新增音訊狀態介面
export interface AudioState {
  isGenerating: boolean;
  progress: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  duration: number;
  error: string | null;
}

// 新增語音選項介面
export interface VoiceOption {
  id: string;
  name: string;
  lang?: string;
  source: 'web-speech' | 'openai';
}
