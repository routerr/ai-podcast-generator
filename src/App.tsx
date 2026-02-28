import React, { useEffect, useState } from 'react';
import { useAppContext } from './contexts/AppContext';
import { Header } from './components/Header';
import { ApiKeyPanel } from './components/ApiKeyPanel';
import { LockScreen } from './components/LockScreen';
import ResearchPanel from './components/ResearchPanel';
import OutlinePanel from './components/OutlinePanel';
import ScriptPanel from './components/ScriptPanel';
import AudioPanel from './components/AudioPanel';
import { storageService } from './services/storageService';
import { podcastStorageService } from './services/podcastStorageService';
import { audioCacheService } from './services/audioCacheService';
import { browserResetService } from './services/browserResetService';
import { LLMProvider, SessionConfig } from './types';
import { getMissingProviderKeys } from './services/llmWorkflowService';

const MAX_API_KEY_LENGTH = 512;
const LLM_CONFIG_STORAGE_KEY = 'ai_podcast_generator_llm_config';

const normalizeWrapping = (key: string): string => {
  let normalized = key.trim();

  while (normalized.length >= 2) {
    const firstChar = normalized[0];
    const lastChar = normalized[normalized.length - 1];
    const isMatchingQuotePair =
      (firstChar === '"' && lastChar === '"') ||
      (firstChar === '\'' && lastChar === '\'') ||
      (firstChar === '`' && lastChar === '`');

    if (!isMatchingQuotePair) {
      break;
    }

    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
};

const normalizeBearerApiKey = (key: string): string =>
  normalizeWrapping(key)
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '');
const normalizePlainApiKey = (key: string): string => normalizeWrapping(key);
const sanitizeApiKeyLength = (key: string): string => (key.length <= MAX_API_KEY_LENGTH ? key : '');

const isLlmProvider = (value: string): value is LLMProvider =>
  value === 'gemini' || value === 'perplexity' || value === 'openrouter' || value === 'ollama';

const normalizeSessionConfig = (config: SessionConfig): SessionConfig => ({
  ...config,
  llmPrimaryProvider: isLlmProvider(config.llmPrimaryProvider) ? config.llmPrimaryProvider : 'gemini',
  llmFallbackProvider:
    config.llmFallbackProvider === 'none' || isLlmProvider(config.llmFallbackProvider)
      ? config.llmFallbackProvider
      : 'perplexity',
  geminiModel: normalizePlainApiKey(config.geminiModel || '') || 'gemini-1.5-flash-latest',
  perplexityModel: normalizePlainApiKey(config.perplexityModel || '') || 'sonar-pro',
  openrouterModel: normalizePlainApiKey(config.openrouterModel || '') || 'google/gemini-2.0-flash-lite-preview-02-05:free',
  ollamaModel: normalizePlainApiKey(config.ollamaModel || '') || 'llama3.1:8b',
  ollamaBaseUrl: normalizePlainApiKey(config.ollamaBaseUrl || '') || 'https://api.ollama.com'
});

function App() {
  const { 
    currentStep, 
    apiKeys, 
    config,
    topic,
    podcastState,
    audioState,
    error, 
    dispatch,
    isLocked,
    hasPassword
  } = useAppContext();
  
  const [isApiKeyPanelOpen, setIsApiKeyPanelOpen] = React.useState(false);
  const [isApiKeyStateReady, setIsApiKeyStateReady] = React.useState(false);
  const [isPodcastStateHydrated, setIsPodcastStateHydrated] = React.useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');

  // Check if user has password on mount
  useEffect(() => {
    const checkPasswordStatus = async () => {
      const hasPwd = storageService.hasPasswordHash();
      dispatch({ type: 'SET_HAS_PASSWORD', payload: hasPwd });
      if (!hasPwd) {
        dispatch({ type: 'SET_LOCKED', payload: false });
      }
    };
    checkPasswordStatus();
  }, [dispatch]);

  // Load and decrypt API keys when unlocked
  useEffect(() => {
    if (isLocked || !unlockPassword) return;

    const loadEncryptedKeys = async () => {
      try {
        const perplexityKey = await storageService.getApiKeyWithPassword('perplexityKey', unlockPassword) || '';
        const geminiKey = await storageService.getApiKeyWithPassword('geminiKey', unlockPassword) || '';
        const openrouterKey = await storageService.getApiKeyWithPassword('openrouterKey', unlockPassword) || '';
        const ollamaKey = await storageService.getApiKeyWithPassword('ollamaKey', unlockPassword) || '';
        const openaiKey = await storageService.getApiKeyWithPassword('openaiKey', unlockPassword) || '';

        const pKey = sanitizeApiKeyLength(normalizeBearerApiKey(perplexityKey));
        const gKey = sanitizeApiKeyLength(normalizePlainApiKey(geminiKey));
        const orKey = sanitizeApiKeyLength(normalizeBearerApiKey(openrouterKey));
        const olKey = sanitizeApiKeyLength(normalizeBearerApiKey(ollamaKey));
        const oaKey = sanitizeApiKeyLength(normalizeBearerApiKey(openaiKey));

        dispatch({
          type: 'SET_API_KEYS',
          payload: {
            perplexityKey: pKey,
            geminiKey: gKey,
            openrouterKey: orKey,
            ollamaKey: olKey,
            openaiKey: oaKey
          }
        });
      } catch (err) {
        console.error('Failed to load encrypted keys:', err);
      }
    };

    loadEncryptedKeys();
  }, [isLocked, unlockPassword, dispatch]);

  // Initialize API keys from localStorage (unencrypted fallback)
  useEffect(() => {
    const storedPerplexityKey = storageService.getApiKey('perplexityKey') || '';
    const storedGeminiKey = storageService.getApiKey('geminiKey') || '';
    const storedOpenrouterKey = storageService.getApiKey('openrouterKey') || '';
    const storedOllamaKey = storageService.getApiKey('ollamaKey') || '';
    const storedOpenaiKey = storageService.getApiKey('openaiKey') || '';

    const perplexityKey = sanitizeApiKeyLength(normalizeBearerApiKey(storedPerplexityKey));
    const geminiKey = sanitizeApiKeyLength(normalizePlainApiKey(storedGeminiKey));
    const openrouterKey = sanitizeApiKeyLength(normalizeBearerApiKey(storedOpenrouterKey));
    const ollamaKey = sanitizeApiKeyLength(normalizeBearerApiKey(storedOllamaKey));
    const openaiKey = sanitizeApiKeyLength(normalizeBearerApiKey(storedOpenaiKey));

    if (perplexityKey !== storedPerplexityKey) {
      storageService.saveApiKey('perplexityKey', perplexityKey);
    }
    if (geminiKey !== storedGeminiKey) {
      storageService.saveApiKey('geminiKey', geminiKey);
    }
    if (openrouterKey !== storedOpenrouterKey) {
      storageService.saveApiKey('openrouterKey', openrouterKey);
    }
    if (ollamaKey !== storedOllamaKey) {
      storageService.saveApiKey('ollamaKey', ollamaKey);
    }
    if (openaiKey !== storedOpenaiKey) {
      storageService.saveApiKey('openaiKey', openaiKey);
    }

    dispatch({
      type: 'SET_API_KEYS',
      payload: {
        perplexityKey,
        geminiKey,
        openrouterKey,
        ollamaKey,
        openaiKey
      }
    });

    try {
      const rawConfig = localStorage.getItem(LLM_CONFIG_STORAGE_KEY);
      if (rawConfig) {
        const parsedConfig = JSON.parse(rawConfig) as SessionConfig;
        dispatch({ type: 'SET_CONFIG', payload: normalizeSessionConfig(parsedConfig) });
      }
    } catch (configError) {
      console.error('Failed to load saved LLM config:', configError);
    }

    setIsApiKeyStateReady(true);
  }, [dispatch]);

  useEffect(() => {
    try {
      localStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (configError) {
      console.error('Failed to persist LLM config:', configError);
    }
  }, [config]);

  // 初始化時載入已儲存的播客狀態（包含音訊）
  useEffect(() => {
    let isCancelled = false;
    let hydratedAudioUrl: string | null = null;

    const hydratePodcastState = async () => {
      try {
        const snapshot = await podcastStorageService.load();

        if (!snapshot || isCancelled) {
          return;
        }

        dispatch({ type: 'SET_TOPIC', payload: snapshot.topic });
        dispatch({
          type: 'UPDATE_PODCAST_STATE',
          payload: {
            topic: snapshot.topic,
            research: snapshot.research,
            outline: snapshot.outline,
            script: snapshot.script
          }
        });

        if (snapshot.audioBlob) {
          hydratedAudioUrl = URL.createObjectURL(snapshot.audioBlob);
          dispatch({
            type: 'SET_AUDIO_STATE',
            payload: {
              audioBlob: snapshot.audioBlob,
              audioUrl: hydratedAudioUrl,
              duration: snapshot.audioDuration,
              error: null
            }
          });
        }

        dispatch({ type: 'SET_CURRENT_STEP', payload: snapshot.currentStep });
      } catch (loadError) {
        console.error('Failed to hydrate persisted podcast state:', loadError);
      } finally {
        if (!isCancelled) {
          setIsPodcastStateHydrated(true);
        } else if (hydratedAudioUrl) {
          URL.revokeObjectURL(hydratedAudioUrl);
        }
      }
    };

    hydratePodcastState();

    return () => {
      isCancelled = true;
      if (hydratedAudioUrl) {
        URL.revokeObjectURL(hydratedAudioUrl);
      }
    };
  }, [dispatch]);

  // 檢查 API 金鑰是否存在
  useEffect(() => {
    if (!isApiKeyStateReady) return;

    const missingProviders = getMissingProviderKeys(apiKeys, config);
    if (missingProviders.length > 0) {
      setIsApiKeyPanelOpen(true);
    }
  }, [apiKeys, config, isApiKeyStateReady]);

  // 持久化播客狀態，確保重新整理後仍可播放與下載
  useEffect(() => {
    if (!isPodcastStateHydrated) {
      return;
    }

    const hasPersistableContent = Boolean(
      topic ||
      podcastState.research ||
      podcastState.outline ||
      podcastState.script ||
      audioState.audioBlob
    );

    if (!hasPersistableContent) {
      podcastStorageService.clear().catch((clearError) => {
        console.error('Failed to clear persisted podcast state:', clearError);
      });
      return;
    }

    podcastStorageService.save({
      currentStep,
      topic,
      research: podcastState.research,
      outline: podcastState.outline,
      script: podcastState.script,
      audioBlob: audioState.audioBlob,
      audioDuration: audioState.duration
    }).catch((saveError) => {
      console.error('Failed to persist podcast state:', saveError);
    });
  }, [
    audioState.audioBlob,
    audioState.duration,
    currentStep,
    isPodcastStateHydrated,
    podcastState.outline,
    podcastState.research,
    podcastState.script,
    topic
  ]);

  const closeApiKeyPanel = () => {
    setIsApiKeyPanelOpen(false);
  };

  const openApiKeyPanel = () => {
    setIsApiKeyPanelOpen(true);
  };

  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  const goToLandingPage = () => {
    if (audioState.audioUrl) {
      URL.revokeObjectURL(audioState.audioUrl);
    }

    dispatch({ type: 'RESET_GENERATION_STATE' });
    podcastStorageService.clear().catch((clearError) => {
      console.error('Failed to clear persisted podcast state:', clearError);
    });
    audioCacheService.clear().catch((clearError) => {
      console.error('Failed to clear audio cache:', clearError);
    });
  };

  const handleUnlock = (password: string) => {
    setUnlockPassword(password);
    dispatch({ type: 'SET_PASSWORD', payload: password });
  };

  const handleResetAll = async () => {
    if (audioState.audioUrl) {
      URL.revokeObjectURL(audioState.audioUrl);
    }

    await browserResetService.clearAll();

    window.location.reload();
  };

  if (isLocked && hasPassword) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen espresso-shell">
      <Header onApiKeyClick={openApiKeyPanel} onHomeClick={goToLandingPage} />
      
      {isApiKeyPanelOpen && (
        <ApiKeyPanel 
          isOpen={isApiKeyPanelOpen} 
          onClose={closeApiKeyPanel}
          onResetAll={handleResetAll}
        />
      )}
      
      {error && (
        <div className="fixed top-20 right-4 z-50">
          <div className="mb-6 p-4 rounded-xl espresso-error">
            <div className="flex justify-between items-center">
              <span>{error}</span>
              <button 
                onClick={clearError}
                className="espresso-muted hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(currentStep === 'input' || currentStep === 'research') && <ResearchPanel />}
        
        {currentStep === 'outline' && <OutlinePanel />}
        
        {currentStep === 'script' && <ScriptPanel />}
        
        {currentStep === 'audio' && <AudioPanel />}
      </main>
    </div>
  );
}

export default App;
