import React, { createContext, useContext, useReducer } from 'react';
import { ApiKeys, PodcastState, AppStep, Question, SessionConfig, ResearchResult, Outline, Script, AudioState } from '../types';

// 定義狀態介面
export interface AppState {
  // API 金鑰
  apiKeys: ApiKeys;
  
  // 步驟狀態
  currentStep: AppStep;
  
  // 主題和問題
  topic: string;
  questions: Question[];
  answers: Record<string, string>;
  
  // 配置
  config: SessionConfig;
  
  // 產生的內容
  podcastState: PodcastState;
  
  // 音訊狀態
  audioState: AudioState;
  
  // 載入狀態
  isLoading: boolean;
  
  // 錯誤處理
  error: string | null;
}

// 定義動作類型
export type AppAction =
  | { type: 'SET_API_KEYS'; payload: ApiKeys }
  | { type: 'SET_CURRENT_STEP'; payload: AppStep }
  | { type: 'SET_TOPIC'; payload: string }
  | { type: 'SET_QUESTIONS'; payload: Question[] }
  | { type: 'SET_ANSWERS'; payload: Record<string, string> }
  | { type: 'UPDATE_ANSWER'; payload: { questionId: string; answer: string } }
  | { type: 'SET_CONFIG'; payload: SessionConfig }
  | { type: 'UPDATE_PODCAST_STATE'; payload: Partial<PodcastState> }
  | { type: 'SET_AUDIO_STATE'; payload: Partial<AudioState> } // 新增音訊狀態動作
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' }
  | { type: 'START_RESEARCH'; payload: { topic: string } }
  | { type: 'SET_RESEARCH_RESULT'; payload: ResearchResult }
  | { type: 'GENERATE_OUTLINE'; payload: ResearchResult }
  | { type: 'SET_OUTLINE'; payload: Outline }
  | { type: 'GENERATE_SCRIPT'; payload: { outline: Outline; research: ResearchResult } }
  | { type: 'SET_SCRIPT'; payload: Script }
  | { type: 'UPDATE_SCRIPT'; payload: Script }
  | { type: 'REFINE_SCRIPT'; payload: { script: Script; feedback: string } };

// 初始狀態
const initialState: AppState = {
  apiKeys: {
    perplexityKey: '',
    geminiKey: '',
    openaiKey: '' // 新增 OpenAI API 金鑰
  },
  currentStep: 'input',
  topic: '',
  questions: [],
  answers: {},
  config: {
    language: 'en',
    format: 'dialogue',
    length: 'medium'
  },
  podcastState: {
    topic: '',
    research: null,
    outline: null,
    script: null,
    audioBlob: null
  },
  audioState: {
    isGenerating: false,
    progress: 0,
    audioBlob: null,
    audioUrl: null,
    duration: 0,
    error: null
  },
  isLoading: false,
  error: null
};

// 建立 Context
interface AppContextType extends AppState {
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Reducer 函數
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_API_KEYS':
      return { ...state, apiKeys: action.payload };
    
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };
    
    case 'SET_TOPIC':
      return { ...state, topic: action.payload };
    
    case 'SET_QUESTIONS':
      return { ...state, questions: action.payload };
    
    case 'SET_ANSWERS':
      return { ...state, answers: action.payload };
    
    case 'UPDATE_ANSWER':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.payload.questionId]: action.payload.answer
        }
      };
    
    case 'SET_CONFIG':
      return { ...state, config: action.payload };
    
    case 'UPDATE_PODCAST_STATE':
      return {
        ...state,
        podcastState: { ...state.podcastState, ...action.payload }
      };
    
    case 'SET_AUDIO_STATE': // 處理音訊狀態更新
      return {
        ...state,
        audioState: { ...state.audioState, ...action.payload }
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'RESET':
      return initialState;
    
    case 'START_RESEARCH':
      return {
        ...state,
        topic: action.payload.topic,
        currentStep: 'research'
      };
    
    case 'SET_RESEARCH_RESULT':
      return {
        ...state,
        podcastState: {
          ...state.podcastState,
          research: action.payload
        }
      };
    
    case 'GENERATE_OUTLINE':
      return {
        ...state,
        podcastState: {
          ...state.podcastState,
          research: action.payload
        },
        currentStep: 'outline'
      };
    
    case 'SET_OUTLINE':
      return {
        ...state,
        podcastState: {
          ...state.podcastState,
          outline: action.payload
        }
      };
    
    case 'GENERATE_SCRIPT':
      return {
        ...state,
        podcastState: {
          ...state.podcastState,
          outline: action.payload.outline,
          research: action.payload.research
        },
        currentStep: 'script'
      };
    
    case 'SET_SCRIPT':
      return {
        ...state,
        podcastState: {
          ...state.podcastState,
          script: action.payload
        }
      };
    
    case 'UPDATE_SCRIPT':
      return {
        ...state,
        podcastState: {
          ...state.podcastState,
          script: action.payload
        }
      };
    
    case 'REFINE_SCRIPT':
      // 這個動作類型用於觸發腳本優化，但實際的優化邏輯在組件中處理
      return state;
    
    default:
      return state;
  }
}

// Provider 元件
interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  return (
    <AppContext.Provider value={{ ...state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// 自訂 hook 用於使用 context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};