import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff, XCircle } from 'lucide-react';
import { useApiKeys } from '../hooks/useApiKeys';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { LLMFallbackProvider, LLMProvider } from '../types';
import { getProviderDisplayName, isLocalOllamaBaseUrl } from '../services/llmWorkflowService';
import './ApiKeyPanel.css';

interface ApiKeyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const providerOptions: LLMProvider[] = ['gemini', 'perplexity', 'openrouter', 'ollama'];

export const ApiKeyPanel: React.FC<ApiKeyPanelProps> = ({ isOpen, onClose }) => {
  const {
    apiKeys,
    keyStatus,
    keyErrors,
    savePerplexityKey,
    saveGeminiKey,
    saveOpenrouterKey,
    saveOllamaKey,
    saveOpenaiKey,
    clearAllKeys,
    markPerplexityKeyEdited,
    markGeminiKeyEdited,
    markOpenaiKeyEdited,
    testPerplexityKey,
    testGeminiKey,
    testOpenaiKey
  } = useApiKeys();

  const { apiKeys: appApiKeys, config, dispatch } = useAppContext();
  const { t } = useI18n();

  const [perplexityKey, setPerplexityKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [ollamaKey, setOllamaKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');

  const [showPerplexityKey, setShowPerplexityKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [showOllamaKey, setShowOllamaKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  const [isTestingPerplexity, setIsTestingPerplexity] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isTestingOpenai, setIsTestingOpenai] = useState(false);

  const [testedPerplexityKey, setTestedPerplexityKey] = useState('');
  const [testedGeminiKey, setTestedGeminiKey] = useState('');
  const [testedOpenaiKey, setTestedOpenaiKey] = useState('');

  const normalizeWrapping = (key: string) => {
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

  const normalizeApiKey = (key: string) =>
    normalizeWrapping(key)
      .replace(/^Bearer\s+/i, '')
      .replace(/\s+/g, '');

  const normalizeGeminiInput = (key: string) => normalizeWrapping(key);

  const normalizedPerplexityKey = normalizeApiKey(perplexityKey);
  const normalizedGeminiKey = normalizeGeminiInput(geminiKey);
  const normalizedOpenrouterKey = normalizeApiKey(openrouterKey);
  const normalizedOllamaKey = normalizeApiKey(ollamaKey);
  const normalizedOpenaiKey = normalizeApiKey(openaiKey);

  const canApplyPerplexity =
    keyStatus.perplexityValid !== false &&
    testedPerplexityKey.length > 0 &&
    testedPerplexityKey === normalizedPerplexityKey;

  const canApplyGemini =
    keyStatus.geminiValid !== false &&
    testedGeminiKey.length > 0 &&
    testedGeminiKey === normalizedGeminiKey;

  const canApplyOpenai =
    keyStatus.openaiValid !== false &&
    testedOpenaiKey.length > 0 &&
    testedOpenaiKey === normalizedOpenaiKey;

  const allowAnonymousLocalOllama = useMemo(
    () => isLocalOllamaBaseUrl(config.ollamaBaseUrl),
    [config.ollamaBaseUrl]
  );

  const canApplyOllama = normalizedOllamaKey.length > 0 || allowAnonymousLocalOllama;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPerplexityKey(apiKeys.perplexityKey || '');
    setGeminiKey(apiKeys.geminiKey || '');
    setOpenrouterKey(apiKeys.openrouterKey || '');
    setOllamaKey(apiKeys.ollamaKey || '');
    setOpenaiKey(apiKeys.openaiKey || '');

    setTestedPerplexityKey('');
    setTestedGeminiKey('');
    setTestedOpenaiKey('');
  }, [apiKeys, isOpen]);

  const updateConfig = (patch: Partial<typeof config>) => {
    dispatch({
      type: 'SET_CONFIG',
      payload: {
        ...config,
        ...patch
      }
    });
  };

  const updatePrimaryProvider = (provider: LLMProvider) => {
    const nextFallback = config.llmFallbackProvider === provider ? 'none' : config.llmFallbackProvider;
    updateConfig({
      llmPrimaryProvider: provider,
      llmFallbackProvider: nextFallback
    });
  };

  const updateFallbackProvider = (provider: LLMFallbackProvider) => {
    const normalizedFallback = provider === config.llmPrimaryProvider ? 'none' : provider;
    updateConfig({ llmFallbackProvider: normalizedFallback });
  };

  const syncApiKeysToContext = (patch: Partial<typeof appApiKeys>) => {
    dispatch({
      type: 'SET_API_KEYS',
      payload: {
        ...appApiKeys,
        ...patch
      }
    });
  };

  const handleTestPerplexityKey = async () => {
    if (!normalizedPerplexityKey) {
      return;
    }

    setIsTestingPerplexity(true);
    const validation = await testPerplexityKey(normalizedPerplexityKey);
    setIsTestingPerplexity(false);
    setTestedPerplexityKey(validation === false ? '' : normalizedPerplexityKey);

    if (validation !== false) {
      savePerplexityKey(normalizedPerplexityKey);
      syncApiKeysToContext({ perplexityKey: normalizedPerplexityKey });
      setPerplexityKey(normalizedPerplexityKey);
    }
  };

  const handleTestGeminiKey = async () => {
    if (!normalizedGeminiKey) {
      return;
    }

    setIsTestingGemini(true);
    const validation = await testGeminiKey(normalizedGeminiKey);
    setIsTestingGemini(false);
    setTestedGeminiKey(validation === false ? '' : normalizedGeminiKey);

    if (validation !== false) {
      saveGeminiKey(normalizedGeminiKey);
      syncApiKeysToContext({ geminiKey: normalizedGeminiKey });
      setGeminiKey(normalizedGeminiKey);
    }
  };

  const handleTestOpenaiKey = async () => {
    if (!normalizedOpenaiKey) {
      return;
    }

    setIsTestingOpenai(true);
    const validation = await testOpenaiKey(normalizedOpenaiKey);
    setIsTestingOpenai(false);
    setTestedOpenaiKey(validation === false ? '' : normalizedOpenaiKey);

    if (validation !== false) {
      saveOpenaiKey(normalizedOpenaiKey);
      syncApiKeysToContext({ openaiKey: normalizedOpenaiKey });
      setOpenaiKey(normalizedOpenaiKey);
    }
  };

  const handleApplyPerplexityKey = () => {
    if (!canApplyPerplexity) {
      return;
    }

    savePerplexityKey(normalizedPerplexityKey);
    syncApiKeysToContext({ perplexityKey: normalizedPerplexityKey });
  };

  const handleApplyGeminiKey = () => {
    if (!canApplyGemini) {
      return;
    }

    saveGeminiKey(normalizedGeminiKey);
    syncApiKeysToContext({ geminiKey: normalizedGeminiKey });
  };

  const handleApplyOpenrouterKey = () => {
    if (!normalizedOpenrouterKey) {
      return;
    }

    saveOpenrouterKey(normalizedOpenrouterKey);
    syncApiKeysToContext({ openrouterKey: normalizedOpenrouterKey });
  };

  const handleApplyOllamaKey = () => {
    if (!canApplyOllama) {
      return;
    }

    saveOllamaKey(normalizedOllamaKey);
    syncApiKeysToContext({ ollamaKey: normalizedOllamaKey });
  };

  const handleApplyOpenaiKey = () => {
    if (!canApplyOpenai) {
      return;
    }

    saveOpenaiKey(normalizedOpenaiKey);
    syncApiKeysToContext({ openaiKey: normalizedOpenaiKey });
  };

  const handleClearAllKeys = () => {
    clearAllKeys();
    setPerplexityKey('');
    setGeminiKey('');
    setOpenrouterKey('');
    setOllamaKey('');
    setOpenaiKey('');
    setTestedPerplexityKey('');
    setTestedGeminiKey('');
    setTestedOpenaiKey('');

    dispatch({
      type: 'SET_API_KEYS',
      payload: {
        perplexityKey: '',
        geminiKey: '',
        openrouterKey: '',
        ollamaKey: '',
        openaiKey: ''
      }
    });
  };

  const renderKeyStatus = (isValid: boolean | null) => {
    if (isValid === null) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }

    return isValid ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  const keyStatusText = (isValid: boolean | null) => {
    if (isValid === null) {
      return t('api.status.notValidated');
    }

    return isValid ? t('api.status.valid') : t('api.status.invalid');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center espresso-overlay backdrop-blur-sm">
      <div className="espresso-card rounded-2xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">{t('api.title')}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors espresso-btn-secondary"
              aria-label={t('api.closeAria')}
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide espresso-muted">{t('api.llmRoutingTitle')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-sm font-medium espresso-muted">{t('api.primaryProvider')}</label>
                  <select
                    value={config.llmPrimaryProvider}
                    onChange={(event) => updatePrimaryProvider(event.target.value as LLMProvider)}
                    className="w-full rounded-lg px-3 py-2 espresso-select"
                  >
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>
                        {getProviderDisplayName(provider)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium espresso-muted">{t('api.fallbackProvider')}</label>
                  <select
                    value={config.llmFallbackProvider}
                    onChange={(event) => updateFallbackProvider(event.target.value as LLMFallbackProvider)}
                    className="w-full rounded-lg px-3 py-2 espresso-select"
                  >
                    <option value="none">{t('api.none')}</option>
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>
                        {getProviderDisplayName(provider)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium espresso-muted">{t('api.openrouterModel')}</label>
                  <input
                    type="text"
                    value={config.openrouterModel}
                    onChange={(event) => updateConfig({ openrouterModel: event.target.value })}
                    className="w-full rounded-lg px-3 py-2 espresso-input"
                    placeholder="meta-llama/llama-3.3-70b-instruct:free"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium espresso-muted">{t('api.ollamaModel')}</label>
                  <input
                    type="text"
                    value={config.ollamaModel}
                    onChange={(event) => updateConfig({ ollamaModel: event.target.value })}
                    className="w-full rounded-lg px-3 py-2 espresso-input"
                    placeholder="llama3.1:8b"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium espresso-muted">{t('api.ollamaBaseUrl')}</label>
                <input
                  type="text"
                  value={config.ollamaBaseUrl}
                  onChange={(event) => updateConfig({ ollamaBaseUrl: event.target.value })}
                  className="w-full rounded-lg px-3 py-2 espresso-input"
                  placeholder="https://api.ollama.com"
                />
                <p className="text-xs espresso-muted">{t('api.ollamaLocalNoKeyHint')}</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium espresso-muted">{t('api.perplexityLabel')}</label>
              <div className="relative">
                <input
                  type={showPerplexityKey ? 'text' : 'password'}
                  value={perplexityKey}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setPerplexityKey(nextValue);
                    markPerplexityKeyEdited(nextValue);
                    if (normalizeApiKey(nextValue) !== testedPerplexityKey) {
                      setTestedPerplexityKey('');
                    }
                  }}
                  placeholder={t('api.perplexityPlaceholder')}
                  className="w-full rounded-lg px-4 py-3 pr-12 espresso-input"
                />

                <button
                  type="button"
                  onClick={() => setShowPerplexityKey(!showPerplexityKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 espresso-muted hover:text-white"
                  aria-label={showPerplexityKey ? t('api.hideKey') : t('api.showKey')}
                >
                  {showPerplexityKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderKeyStatus(keyStatus.perplexityValid)}
                  <span className="text-sm espresso-muted">{keyStatusText(keyStatus.perplexityValid)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestPerplexityKey}
                    disabled={!normalizedPerplexityKey || isTestingPerplexity}
                    className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors espresso-btn-secondary"
                  >
                    {isTestingPerplexity ? t('api.testing') : t('api.test')}
                  </button>
                  <button
                    onClick={handleApplyPerplexityKey}
                    disabled={!canApplyPerplexity}
                    className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors espresso-btn-primary"
                  >
                    {t('api.apply')}
                  </button>
                </div>
              </div>

              {keyErrors.perplexityError && <p className="text-xs text-[#f9e2af]">{keyErrors.perplexityError}</p>}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium espresso-muted">{t('api.geminiLabel')}</label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setGeminiKey(nextValue);
                    markGeminiKeyEdited(nextValue);
                    if (normalizeGeminiInput(nextValue) !== testedGeminiKey) {
                      setTestedGeminiKey('');
                    }
                  }}
                  placeholder={t('api.geminiPlaceholder')}
                  className="w-full rounded-lg px-4 py-3 pr-12 espresso-input"
                />

                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 espresso-muted hover:text-white"
                  aria-label={showGeminiKey ? t('api.hideKey') : t('api.showKey')}
                >
                  {showGeminiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderKeyStatus(keyStatus.geminiValid)}
                  <span className="text-sm espresso-muted">{keyStatusText(keyStatus.geminiValid)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestGeminiKey}
                    disabled={!normalizedGeminiKey || isTestingGemini}
                    className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors espresso-btn-secondary"
                  >
                    {isTestingGemini ? t('api.testing') : t('api.test')}
                  </button>
                  <button
                    onClick={handleApplyGeminiKey}
                    disabled={!canApplyGemini}
                    className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors espresso-btn-primary"
                  >
                    {t('api.apply')}
                  </button>
                </div>
              </div>

              {keyErrors.geminiError && <p className="text-xs text-[#f9e2af]">{keyErrors.geminiError}</p>}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium espresso-muted">{t('api.openrouterLabel')}</label>
              <div className="relative">
                <input
                  type={showOpenrouterKey ? 'text' : 'password'}
                  value={openrouterKey}
                  onChange={(event) => setOpenrouterKey(event.target.value)}
                  placeholder={t('api.openrouterPlaceholder')}
                  className="w-full rounded-lg px-4 py-3 pr-12 espresso-input"
                />

                <button
                  type="button"
                  onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 espresso-muted hover:text-white"
                  aria-label={showOpenrouterKey ? t('api.hideKey') : t('api.showKey')}
                >
                  {showOpenrouterKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={handleApplyOpenrouterKey}
                  disabled={!normalizedOpenrouterKey}
                  className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors espresso-btn-primary"
                >
                  {t('api.apply')}
                </button>
              </div>

              <p className="text-xs espresso-muted">{t('api.runtimeValidationHint')}</p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium espresso-muted">{t('api.ollamaLabel')}</label>
              <div className="relative">
                <input
                  type={showOllamaKey ? 'text' : 'password'}
                  value={ollamaKey}
                  onChange={(event) => setOllamaKey(event.target.value)}
                  placeholder={t('api.ollamaPlaceholder')}
                  className="w-full rounded-lg px-4 py-3 pr-12 espresso-input"
                />

                <button
                  type="button"
                  onClick={() => setShowOllamaKey(!showOllamaKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 espresso-muted hover:text-white"
                  aria-label={showOllamaKey ? t('api.hideKey') : t('api.showKey')}
                >
                  {showOllamaKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={handleApplyOllamaKey}
                  disabled={!canApplyOllama}
                  className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors espresso-btn-primary"
                >
                  {t('api.apply')}
                </button>
              </div>

              <p className="text-xs espresso-muted">{t('api.runtimeValidationHint')}</p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium espresso-muted">{t('api.openaiLabel')}</label>
              <div className="relative">
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setOpenaiKey(nextValue);
                    markOpenaiKeyEdited(nextValue);
                    if (normalizeApiKey(nextValue) !== testedOpenaiKey) {
                      setTestedOpenaiKey('');
                    }
                  }}
                  placeholder={t('api.openaiPlaceholder')}
                  className="w-full rounded-lg px-4 py-3 pr-12 espresso-input"
                />

                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 espresso-muted hover:text-white"
                  aria-label={showOpenaiKey ? t('api.hideKey') : t('api.showKey')}
                >
                  {showOpenaiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderKeyStatus(keyStatus.openaiValid)}
                  <span className="text-sm espresso-muted">{keyStatusText(keyStatus.openaiValid)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestOpenaiKey}
                    disabled={!normalizedOpenaiKey || isTestingOpenai}
                    className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors espresso-btn-secondary"
                  >
                    {isTestingOpenai ? t('api.testing') : t('api.test')}
                  </button>
                  <button
                    onClick={handleApplyOpenaiKey}
                    disabled={!canApplyOpenai}
                    className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors espresso-btn-primary"
                  >
                    {t('api.apply')}
                  </button>
                </div>
              </div>

              {keyErrors.openaiError && <p className="text-xs text-[#f9e2af]">{keyErrors.openaiError}</p>}
            </div>

            <div className="pt-4">
              <button
                onClick={handleClearAllKeys}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors espresso-btn-danger"
              >
                {t('api.clearAll')}
              </button>

              <p className="mt-3 text-xs espresso-muted">{t('api.note')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
