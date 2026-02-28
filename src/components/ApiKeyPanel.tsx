import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff, XCircle } from 'lucide-react';
import { useApiKeys } from '../hooks/useApiKeys';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import { LLMFallbackProvider, LLMProvider } from '../types';
import { getProviderDisplayName, isLocalOllamaBaseUrl } from '../services/llmWorkflowService';
import { storageService } from '../services/storageService';
import { useToast } from './Toast';
import { useConfirmDialog } from './ConfirmDialog';
import { Toast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import './ApiKeyPanel.css';

interface ApiKeyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onResetAll?: () => Promise<void> | void;
}

const providerOptions: LLMProvider[] = ['gemini', 'perplexity', 'openrouter', 'ollama'];
const defaultModelOptions: Record<LLMProvider, string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'],
  perplexity: ['sonar-pro', 'sonar', 'sonar-reasoning-pro'],
  openrouter: ['openai/gpt-oss-20b:free', 'google/gemini-2.0-flash-lite-preview-02-05:free'],
  ollama: ['minimax-m2.5:cloud', 'llama3.1:8b']
};

const dedupeModels = (models: string[]): string[] => {
  return Array.from(new Set(models.map((model) => model.trim()).filter((model) => model.length > 0)));
};

const isLocalhostEnvironment = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const ApiKeyPanel: React.FC<ApiKeyPanelProps> = ({ isOpen, onClose, onResetAll }) => {
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
    markOpenrouterKeyEdited,
    markOllamaKeyEdited,
    testPerplexityKey,
    testGeminiKey,
    testOpenaiKey,
    testOpenrouterKey,
    testOllamaKey
  } = useApiKeys();

  const { apiKeys: appApiKeys, config, dispatch, hasPassword } = useAppContext();
  const { t } = useI18n();
  const { toast, showToast } = useToast();
  const { dialog, showConfirmDialog } = useConfirmDialog();

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
  const [isTestingOpenrouter, setIsTestingOpenrouter] = useState(false);
  const [isTestingOllama, setIsTestingOllama] = useState(false);

  const [testedPerplexityKey, setTestedPerplexityKey] = useState('');
  const [testedGeminiKey, setTestedGeminiKey] = useState('');
  const [testedOpenaiKey, setTestedOpenaiKey] = useState('');
  const [testedOpenrouterKey, setTestedOpenrouterKey] = useState('');
  const [testedOllamaKey, setTestedOllamaKey] = useState('');
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordChangeNoticeKey, setPasswordChangeNoticeKey] = useState<
    | 'lock.changeSuccess'
    | 'lock.changeFailed'
    | 'lock.changeFillBoth'
    | 'lock.setupSuccess'
    | 'lock.setupFailed'
    | 'lock.setupFillBoth'
    | 'lock.passwordTooShort'
    | 'lock.passwordMismatch'
    | null
  >(null);
  const [modelOptions, setModelOptions] = useState<Record<LLMProvider, string[]>>(defaultModelOptions);
  const [isLoadingModels, setIsLoadingModels] = useState<Record<LLMProvider, boolean>>({
    gemini: false,
    perplexity: false,
    openrouter: false,
    ollama: false
  });
  const [modelErrors, setModelErrors] = useState<Record<LLMProvider, string | null>>({
    gemini: null,
    perplexity: null,
    openrouter: null,
    ollama: null
  });

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

  const canApplyOpenrouter =
    keyStatus.openrouterValid !== false &&
    testedOpenrouterKey.length > 0 &&
    testedOpenrouterKey === normalizedOpenrouterKey;

  const allowAnonymousLocalOllama = useMemo(
    () => isLocalOllamaBaseUrl(config.ollamaBaseUrl),
    [config.ollamaBaseUrl]
  );

  const canApplyOllama =
    allowAnonymousLocalOllama ||
    (keyStatus.ollamaValid !== false &&
      testedOllamaKey.length > 0 &&
      testedOllamaKey === normalizedOllamaKey);

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
    setTestedOpenrouterKey('');
    setTestedOllamaKey('');
    setOldPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordChangeNoticeKey(null);
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

  const getProviderModel = (provider: LLMProvider): string => {
    switch (provider) {
      case 'gemini':
        return config.geminiModel;
      case 'perplexity':
        return config.perplexityModel;
      case 'openrouter':
        return config.openrouterModel;
      case 'ollama':
        return config.ollamaModel;
    }
  };

  const setProviderModel = (provider: LLMProvider, model: string) => {
    switch (provider) {
      case 'gemini':
        updateConfig({ geminiModel: model });
        return;
      case 'perplexity':
        updateConfig({ perplexityModel: model });
        return;
      case 'openrouter':
        updateConfig({ openrouterModel: model });
        return;
      case 'ollama':
        updateConfig({ ollamaModel: model });
        return;
    }
  };

  const backupProviderOptions = useMemo(
    () => providerOptions.filter((provider) => provider !== config.llmPrimaryProvider),
    [config.llmPrimaryProvider]
  );

  const fetchModelsForProvider = async (provider: LLMProvider): Promise<string[]> => {
    if (provider === 'gemini') {
      if (!normalizedGeminiKey) {
        throw new Error('Gemini key is required to fetch models.');
      }
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(normalizedGeminiKey)}`
      );
      if (!response.ok) {
        throw new Error(`Gemini model list fetch failed (${response.status}).`);
      }
      const data = await response.json().catch(() => ({}));
      const models = Array.isArray(data?.models) ? data.models : [];
      return dedupeModels(
        models
          .filter((model: any) => {
            const methods = Array.isArray(model?.supportedGenerationMethods)
              ? model.supportedGenerationMethods
              : [];
            return methods.includes('generateContent') || methods.length === 0;
          })
          .map((model: any) => {
            const name = typeof model?.name === 'string' ? model.name : '';
            return name.startsWith('models/') ? name.slice('models/'.length) : name;
          })
      );
    }

    if (provider === 'perplexity') {
      if (!normalizedPerplexityKey) {
        throw new Error('Perplexity key is required to fetch models.');
      }
      const response = await fetch('https://api.perplexity.ai/models', {
        headers: {
          Authorization: `Bearer ${normalizedPerplexityKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Perplexity model list fetch failed (${response.status}).`);
      }
      const data = await response.json().catch(() => ({}));
      const list = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.models)
          ? data.models
          : Array.isArray(data)
            ? data
            : [];
      return dedupeModels(
        list.map((item: any) => {
          if (typeof item === 'string') return item;
          if (typeof item?.id === 'string') return item.id;
          if (typeof item?.name === 'string') return item.name;
          return '';
        })
      );
    }

    if (provider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) {
        throw new Error(`OpenRouter model list fetch failed (${response.status}).`);
      }
      const data = await response.json().catch(() => ({}));
      const models = Array.isArray(data?.data) ? data.data : [];
      return dedupeModels(
        models.map((item: any) => {
          if (typeof item === 'string') return item;
          if (typeof item?.id === 'string') return item.id;
          if (typeof item?.name === 'string') return item.name;
          return '';
        })
      );
    }

    const normalizedBaseUrl = config.ollamaBaseUrl.trim().replace(/\/+$/, '') || 'https://api.ollama.com';
    if (!allowAnonymousLocalOllama && normalizedOllamaKey.length <= 10) {
      return dedupeModels(defaultModelOptions.ollama);
    }

    const endpoints = isLocalhostEnvironment() ? ['/ollama/models'] : ['/api/ollama/models'];
    let lastStatus = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiKey: normalizedOllamaKey,
            baseUrl: normalizedBaseUrl
          })
        });

        if (response.status === 404 || response.status === 405) {
          continue;
        }

        lastStatus = response.status;
        if (!response.ok) {
          if (response.status === 400) {
            break;
          }
          continue;
        }

        const data = await response.json().catch(() => ({}));
        const models = Array.isArray(data?.models) ? data.models : [];
        return dedupeModels(
          models.map((item: any) => {
            if (typeof item === 'string') return item;
            if (typeof item?.name === 'string') return item.name;
            if (typeof item?.model === 'string') return item.model;
            return '';
          })
        );
      } catch {
        continue;
      }
    }

    throw new Error(`Ollama model list fetch failed${lastStatus ? ` (${lastStatus})` : ''}.`);
  };

  const refreshModelOptions = async (provider: LLMProvider) => {
    setIsLoadingModels((prev) => ({ ...prev, [provider]: true }));
    setModelErrors((prev) => ({ ...prev, [provider]: null }));

    try {
      const fetched = await fetchModelsForProvider(provider);
      const merged = dedupeModels([getProviderModel(provider), ...fetched, ...defaultModelOptions[provider]]);
      setModelOptions((prev) => ({ ...prev, [provider]: merged }));
    } catch (error) {
      const fallbackMerged = dedupeModels([getProviderModel(provider), ...defaultModelOptions[provider]]);
      setModelOptions((prev) => ({ ...prev, [provider]: fallbackMerged }));
      setModelErrors((prev) => ({
        ...prev,
        [provider]: error instanceof Error ? error.message : 'Failed to fetch models.'
      }));
    } finally {
      setIsLoadingModels((prev) => ({ ...prev, [provider]: false }));
    }
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

  const handleTestOpenrouterKey = async () => {
    if (!normalizedOpenrouterKey) {
      return;
    }

    setIsTestingOpenrouter(true);
    const validation = await testOpenrouterKey(normalizedOpenrouterKey);
    setIsTestingOpenrouter(false);
    setTestedOpenrouterKey(validation === false ? '' : normalizedOpenrouterKey);

    if (validation !== false) {
      saveOpenrouterKey(normalizedOpenrouterKey);
      syncApiKeysToContext({ openrouterKey: normalizedOpenrouterKey });
      setOpenrouterKey(normalizedOpenrouterKey);
    }
  };

  const handleTestOllamaKey = async () => {
    if (!normalizedOllamaKey && !allowAnonymousLocalOllama) {
      return;
    }

    setIsTestingOllama(true);
    const validation = await testOllamaKey(normalizedOllamaKey, config.ollamaBaseUrl);
    setIsTestingOllama(false);
    setTestedOllamaKey(validation === false ? '' : normalizedOllamaKey);

    if (validation !== false) {
      saveOllamaKey(normalizedOllamaKey);
      syncApiKeysToContext({ ollamaKey: normalizedOllamaKey });
      setOllamaKey(normalizedOllamaKey);
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
    setTestedOpenrouterKey('');
    setTestedOllamaKey('');

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

  const handleChangePassword = async () => {
    if (!oldPasswordInput || !newPasswordInput) {
      setPasswordChangeNoticeKey('lock.changeFillBoth');
      showToast(t('lock.changeFillBoth'), 'warning');
      return;
    }

    const success = await storageService.changePassword(oldPasswordInput, newPasswordInput);
    if (success) {
      dispatch({ type: 'SET_PASSWORD', payload: newPasswordInput });
      setOldPasswordInput('');
      setNewPasswordInput('');
      setPasswordChangeNoticeKey('lock.changeSuccess');
      showToast(t('lock.changeSuccess'), 'success');
      return;
    }

    setPasswordChangeNoticeKey('lock.changeFailed');
    showToast(t('lock.changeFailed'), 'error');
  };

  const handleSetPassword = async () => {
    if (!newPasswordInput || !confirmPasswordInput) {
      setPasswordChangeNoticeKey('lock.setupFillBoth');
      showToast(t('lock.setupFillBoth'), 'warning');
      return;
    }

    if (newPasswordInput.length < 4) {
      setPasswordChangeNoticeKey('lock.passwordTooShort');
      showToast(t('lock.passwordTooShort'), 'warning');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordChangeNoticeKey('lock.passwordMismatch');
      showToast(t('lock.passwordMismatch'), 'warning');
      return;
    }

    const success = await storageService.setPasswordAndEncryptApiKeys(newPasswordInput);
    if (success) {
      dispatch({ type: 'SET_PASSWORD', payload: newPasswordInput });
      dispatch({ type: 'SET_HAS_PASSWORD', payload: true });
      setOldPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordChangeNoticeKey('lock.setupSuccess');
      showToast(t('lock.setupSuccess'), 'success');
      return;
    }

    setPasswordChangeNoticeKey('lock.setupFailed');
    showToast(t('lock.setupFailed'), 'error');
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const providersToRefresh = [config.llmPrimaryProvider];
    if (config.llmFallbackProvider !== 'none') {
      providersToRefresh.push(config.llmFallbackProvider);
    }

    dedupeModels(providersToRefresh).forEach((providerName) => {
      const provider = providerName as LLMProvider;
      void refreshModelOptions(provider);
    });
  }, [
    isOpen,
    config.llmPrimaryProvider,
    config.llmFallbackProvider,
    normalizedGeminiKey,
    normalizedPerplexityKey
  ]);

  const getPasswordNoticeClass = () => {
    if (passwordChangeNoticeKey === 'lock.changeSuccess' || passwordChangeNoticeKey === 'lock.setupSuccess') {
      return 'text-green-400';
    }

    if (
      passwordChangeNoticeKey === 'lock.changeFillBoth' ||
      passwordChangeNoticeKey === 'lock.setupFillBoth' ||
      passwordChangeNoticeKey === 'lock.passwordTooShort' ||
      passwordChangeNoticeKey === 'lock.passwordMismatch'
    ) {
      return 'text-[#f9e2af]';
    }

    return 'text-[#f38ba8]';
  };

  const modelLabelForProvider = (provider: LLMProvider): string => {
    switch (provider) {
      case 'gemini':
        return 'Gemini Model';
      case 'perplexity':
        return 'Perplexity Model';
      case 'openrouter':
        return t('api.openrouterModel');
      case 'ollama':
        return t('api.ollamaModel');
    }
  };

  const providerKeyLabel = (provider: LLMProvider): string => {
    switch (provider) {
      case 'gemini':
        return t('api.geminiLabel');
      case 'perplexity':
        return t('api.perplexityLabel');
      case 'openrouter':
        return t('api.openrouterLabel');
      case 'ollama':
        return t('api.ollamaLabel');
    }
  };

  const providerKeyPlaceholder = (provider: LLMProvider): string => {
    switch (provider) {
      case 'gemini':
        return t('api.geminiPlaceholder');
      case 'perplexity':
        return t('api.perplexityPlaceholder');
      case 'openrouter':
        return t('api.openrouterPlaceholder');
      case 'ollama':
        return t('api.ollamaPlaceholder');
    }
  };

  const getProviderKeyValue = (provider: LLMProvider): string => {
    switch (provider) {
      case 'gemini':
        return geminiKey;
      case 'perplexity':
        return perplexityKey;
      case 'openrouter':
        return openrouterKey;
      case 'ollama':
        return ollamaKey;
    }
  };

  const getProviderShowKey = (provider: LLMProvider): boolean => {
    switch (provider) {
      case 'gemini':
        return showGeminiKey;
      case 'perplexity':
        return showPerplexityKey;
      case 'openrouter':
        return showOpenrouterKey;
      case 'ollama':
        return showOllamaKey;
    }
  };

  const toggleProviderShowKey = (provider: LLMProvider) => {
    switch (provider) {
      case 'gemini':
        setShowGeminiKey(!showGeminiKey);
        return;
      case 'perplexity':
        setShowPerplexityKey(!showPerplexityKey);
        return;
      case 'openrouter':
        setShowOpenrouterKey(!showOpenrouterKey);
        return;
      case 'ollama':
        setShowOllamaKey(!showOllamaKey);
        return;
    }
  };

  const updateProviderKeyValue = (provider: LLMProvider, nextValue: string) => {
    switch (provider) {
      case 'gemini':
        setGeminiKey(nextValue);
        markGeminiKeyEdited(nextValue);
        if (normalizeGeminiInput(nextValue) !== testedGeminiKey) {
          setTestedGeminiKey('');
        }
        return;
      case 'perplexity':
        setPerplexityKey(nextValue);
        markPerplexityKeyEdited(nextValue);
        if (normalizeApiKey(nextValue) !== testedPerplexityKey) {
          setTestedPerplexityKey('');
        }
        return;
      case 'openrouter':
        setOpenrouterKey(nextValue);
        markOpenrouterKeyEdited(nextValue);
        if (normalizeApiKey(nextValue) !== testedOpenrouterKey) {
          setTestedOpenrouterKey('');
        }
        return;
      case 'ollama':
        setOllamaKey(nextValue);
        markOllamaKeyEdited();
        if (normalizeApiKey(nextValue) !== testedOllamaKey) {
          setTestedOllamaKey('');
        }
        return;
    }
  };

  const getProviderKeyStatus = (provider: LLMProvider): boolean | null => {
    switch (provider) {
      case 'gemini':
        return keyStatus.geminiValid;
      case 'perplexity':
        return keyStatus.perplexityValid;
      case 'openrouter':
        return keyStatus.openrouterValid;
      case 'ollama':
        return keyStatus.ollamaValid;
    }
  };

  const getProviderKeyError = (provider: LLMProvider): string | null => {
    switch (provider) {
      case 'gemini':
        return keyErrors.geminiError;
      case 'perplexity':
        return keyErrors.perplexityError;
      case 'openrouter':
        return keyErrors.openrouterError;
      case 'ollama':
        return keyErrors.ollamaError;
    }
  };

  const isProviderTesting = (provider: LLMProvider): boolean => {
    switch (provider) {
      case 'gemini':
        return isTestingGemini;
      case 'perplexity':
        return isTestingPerplexity;
      case 'openrouter':
        return isTestingOpenrouter;
      case 'ollama':
        return isTestingOllama;
    }
  };

  const canApplyProviderKey = (provider: LLMProvider): boolean => {
    switch (provider) {
      case 'gemini':
        return canApplyGemini;
      case 'perplexity':
        return canApplyPerplexity;
      case 'openrouter':
        return canApplyOpenrouter;
      case 'ollama':
        return canApplyOllama;
    }
  };

  const handleProviderTest = (provider: LLMProvider) => {
    switch (provider) {
      case 'gemini':
        void handleTestGeminiKey();
        return;
      case 'perplexity':
        void handleTestPerplexityKey();
        return;
      case 'openrouter':
        void handleTestOpenrouterKey();
        return;
      case 'ollama':
        void handleTestOllamaKey();
        return;
    }
  };

  const handleProviderApply = (provider: LLMProvider) => {
    switch (provider) {
      case 'gemini':
        handleApplyGeminiKey();
        return;
      case 'perplexity':
        handleApplyPerplexityKey();
        return;
      case 'openrouter':
        handleApplyOpenrouterKey();
        return;
      case 'ollama':
        handleApplyOllamaKey();
        return;
    }
  };

  const renderProviderApiKeyControls = (provider: LLMProvider) => {
    const value = getProviderKeyValue(provider);
    const showKey = getProviderShowKey(provider);
    const status = getProviderKeyStatus(provider);
    const errorMessage = getProviderKeyError(provider);
    const testing = isProviderTesting(provider);
    const canApply = canApplyProviderKey(provider);
    const normalizedValue = provider === 'gemini' ? normalizeGeminiInput(value) : normalizeApiKey(value);
    const isTestDisabled = provider === 'ollama'
      ? (allowAnonymousLocalOllama && !normalizedOllamaKey ? false : (!normalizedOllamaKey || testing))
      : (!normalizedValue || testing);

    return (
      <div className="space-y-2 mt-3">
        <label className="block text-sm font-medium espresso-muted">{providerKeyLabel(provider)}</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(event) => updateProviderKeyValue(provider, event.target.value)}
            placeholder={providerKeyPlaceholder(provider)}
            className="w-full rounded-lg px-3 py-2 pr-11 espresso-input"
          />
          <button
            type="button"
            onClick={() => toggleProviderShowKey(provider)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 espresso-muted hover:text-white"
            aria-label={showKey ? t('api.hideKey') : t('api.showKey')}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {renderKeyStatus(status)}
            <span className="text-sm espresso-muted">{keyStatusText(status)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleProviderTest(provider)}
              disabled={isTestDisabled}
              className="px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors espresso-btn-secondary"
            >
              {testing ? t('api.testing') : t('api.test')}
            </button>
            <button
              onClick={() => handleProviderApply(provider)}
              disabled={!canApply}
              className="px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors espresso-btn-primary"
            >
              {t('api.apply')}
            </button>
          </div>
        </div>
        {errorMessage && <p className="text-xs text-[#f9e2af]">{errorMessage}</p>}
        {(provider === 'openrouter' || provider === 'ollama') && (
          <p className="text-xs espresso-muted">{t('api.runtimeValidationHint')}</p>
        )}
      </div>
    );
  };

  const renderProviderControls = (provider: LLMProvider | 'none') => {
    if (provider === 'none') {
      return null;
    }

    const selectedModel = getProviderModel(provider);
    const options = dedupeModels([selectedModel, ...(modelOptions[provider] || []), ...defaultModelOptions[provider]]);

    return (
      <div className="space-y-2 mt-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium espresso-muted">{modelLabelForProvider(provider)}</label>
          <button
            type="button"
            onClick={() => void refreshModelOptions(provider)}
            className="text-xs espresso-muted hover:text-white transition-colors"
          >
            {isLoadingModels[provider] ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <select
          value={selectedModel}
          onChange={(event) => setProviderModel(provider, event.target.value)}
          className="w-full rounded-lg px-3 py-2 espresso-select"
        >
          {options.map((model) => (
            <option key={`${provider}-${model}`} value={model}>
              {model}
            </option>
          ))}
        </select>
        {modelErrors[provider] && <p className="text-xs text-[#f9e2af]">{modelErrors[provider]}</p>}

        {renderProviderApiKeyControls(provider)}

        {provider === 'ollama' && (
          <>
            <label className="block text-sm font-medium espresso-muted mt-2">{t('api.ollamaBaseUrl')}</label>
            <input
              type="text"
              value={config.ollamaBaseUrl}
              onChange={(event) => updateConfig({ ollamaBaseUrl: event.target.value })}
              className="w-full rounded-lg px-3 py-2 espresso-input"
              placeholder="https://api.ollama.com"
            />
            <p className="text-xs espresso-muted">{t('api.ollamaLocalNoKeyHint')}</p>
          </>
        )}
      </div>
    );
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
    <>
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => {}}
      />
      <ConfirmDialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
        type={dialog.type}
      />
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
                <div className="space-y-2 rounded-lg border border-[#45475a] p-3">
                  <label className="block text-sm font-medium espresso-muted">{t('api.primaryProvider')}</label>
                  <select
                    value={config.llmPrimaryProvider}
                    onChange={(event) => updatePrimaryProvider(event.target.value as LLMProvider)}
                    className="w-full rounded-lg px-3 py-2 espresso-select"
                  >
                    {providerOptions.map((provider) => (
                      <option key={`primary-${provider}`} value={provider}>
                        {getProviderDisplayName(provider)}
                      </option>
                    ))}
                  </select>
                  {renderProviderControls(config.llmPrimaryProvider)}
                </div>

                <div className="space-y-2 rounded-lg border border-[#45475a] p-3">
                  <label className="block text-sm font-medium espresso-muted">{t('api.fallbackProvider')}</label>
                  <select
                    value={config.llmFallbackProvider}
                    onChange={(event) => updateFallbackProvider(event.target.value as LLMFallbackProvider)}
                    className="w-full rounded-lg px-3 py-2 espresso-select"
                  >
                    <option value="none">{t('api.none')}</option>
                    {backupProviderOptions.map((provider) => (
                      <option key={`fallback-${provider}`} value={provider}>
                        {getProviderDisplayName(provider)}
                      </option>
                    ))}
                  </select>
                  {renderProviderControls(config.llmFallbackProvider)}
                </div>
              </div>
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

            <div className="pt-4 border-t border-[#45475a] mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide espresso-muted mb-3">
                {hasPassword ? t('lock.changePassword') : t('lock.setup')}
              </h3>
              <div className="space-y-3">
                {hasPassword && (
                  <input
                    type="password"
                    id="oldPassword"
                    value={oldPasswordInput}
                    onChange={(event) => {
                      setOldPasswordInput(event.target.value);
                      setPasswordChangeNoticeKey(null);
                    }}
                    placeholder={t('lock.oldPassword')}
                    className="w-full rounded-lg px-4 py-3 espresso-input"
                  />
                )}
                <input
                  type="password"
                  id="newPassword"
                  value={newPasswordInput}
                  onChange={(event) => {
                    setNewPasswordInput(event.target.value);
                    setPasswordChangeNoticeKey(null);
                  }}
                  placeholder={hasPassword ? t('lock.newPassword') : t('lock.newPasswordPlaceholder')}
                  className="w-full rounded-lg px-4 py-3 espresso-input"
                />
                {!hasPassword && (
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPasswordInput}
                    onChange={(event) => {
                      setConfirmPasswordInput(event.target.value);
                      setPasswordChangeNoticeKey(null);
                    }}
                    placeholder={t('lock.confirmPasswordPlaceholder')}
                    className="w-full rounded-lg px-4 py-3 espresso-input"
                  />
                )}
                {!hasPassword && (
                  <p className="text-xs espresso-muted">{t('lock.setupPanelHint')}</p>
                )}
                <button
                  onClick={hasPassword ? handleChangePassword : handleSetPassword}
                  className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors espresso-btn-secondary"
                >
                  {hasPassword ? t('lock.changePassword') : t('lock.setup')}
                </button>
                {passwordChangeNoticeKey && (
                  <p className={`text-xs ${getPasswordNoticeClass()}`}>
                    {t(passwordChangeNoticeKey)}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#45475a] mt-6">
              <button
                onClick={() => {
                  showConfirmDialog(
                    t('lock.resetConfirm'),
                    'This action cannot be undone and will remove all saved data for this site, including API keys, password, drafts, and browser cache.',
                    () => {
                      if (onResetAll) {
                        void onResetAll();
                        return;
                      }

                      storageService.clearAllEncryptedKeys();
                      dispatch({ type: 'SET_HAS_PASSWORD', payload: false });
                      dispatch({ type: 'SET_PASSWORD', payload: '' });
                      dispatch({ type: 'SET_LOCKED', payload: false });
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
                      handleClearAllKeys();
                      showToast(t('lock.resetSuccess'), 'success');
                      onClose();
                    },
                    {
                      confirmText: 'Reset',
                      cancelText: 'Cancel',
                      type: 'danger'
                    }
                  );
                }}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors bg-red-900/50 text-red-300 hover:bg-red-900/70"
              >
                {t('lock.resetAll')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
