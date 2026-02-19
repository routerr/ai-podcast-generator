import { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { ApiKeys } from '../types';

const PERPLEXITY_PROXY_ENDPOINTS = ['/pplx/validate', '/api/perplexity/validate'];
const GEMINI_PROXY_ENDPOINTS = ['/gemini/validate', '/api/gemini/validate'];
const OPENAI_PROXY_ENDPOINTS = ['/openai/validate', '/api/openai/validate'];
const MAX_API_KEY_LENGTH = 512;

type KeyStatus = {
  perplexityValid: boolean | null;
  geminiValid: boolean | null;
  openaiValid: boolean | null;
};

type KeyErrors = {
  perplexityError: string | null;
  geminiError: string | null;
  openaiError: string | null;
};

type KeyStatusName = keyof KeyStatus;
type ProxyValidationResponse = { valid?: boolean | null; error?: string };

const trimApiKeyWrapping = (key: string): string => {
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

const trimApiKey = (key: string): string => trimApiKeyWrapping(key);
const normalizeBearerApiKey = (key: string): string =>
  trimApiKey(key)
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '');
const sanitizeApiKeyLength = (key: string): string => (key.length <= MAX_API_KEY_LENGTH ? key : '');

const isLocalhostEnvironment = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const getProxyEndpoints = (preferredLocalEndpoint: string, endpoints: string[]): string[] =>
  isLocalhostEnvironment()
    ? [preferredLocalEndpoint]
    : endpoints;

/**
 * API 金鑰管理 Hook
 * @returns 包含 API 金鑰狀態和操作函數的物件
 */
export const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    perplexityKey: '',
    geminiKey: '',
    openrouterKey: '',
    ollamaKey: '',
    openaiKey: ''
  });

  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    perplexityValid: null,
    geminiValid: null,
    openaiValid: null
  });

  const [keyErrors, setKeyErrors] = useState<KeyErrors>({
    perplexityError: null,
    geminiError: null,
    openaiError: null
  });

  const persistKeyStatus = (status: KeyStatus) => {
    (Object.keys(status) as KeyStatusName[]).forEach((statusName) => {
      storageService.saveApiKeyStatus(statusName, status[statusName]);
    });
  };

  const setAndPersistKeyStatus = (updater: (prev: KeyStatus) => KeyStatus) => {
    setKeyStatus((prev: KeyStatus) => {
      const next = updater(prev);
      persistKeyStatus(next);
      return next;
    });
  };

  const validateApiKey = (key: string): boolean => key.length > 10 && key.length <= MAX_API_KEY_LENGTH;

  const testViaProxy = async (
    apiKey: string,
    endpoints: string[]
  ): Promise<{ valid: boolean | null; error?: string }> => {
    let sawProxyError = false;
    let sawReachableProxy = false;
    let latestError: string | undefined;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ apiKey })
        });

        if (response.status === 404 || response.status === 405) {
          continue;
        }

        sawReachableProxy = true;
        let payload: ProxyValidationResponse | undefined;
        try {
          payload = (await response.json()) as ProxyValidationResponse;
        } catch {
          payload = undefined;
        }

        if (typeof payload?.error === 'string' && payload.error.length > 0) {
          latestError = payload.error;
        }

        if (!response.ok) {
          sawProxyError = true;
          continue;
        }

        if (typeof payload?.valid === 'boolean' || payload?.valid === null) {
          return {
            valid: payload.valid ?? null,
            error: latestError
          };
        }

        sawProxyError = true;
      } catch {
        continue;
      }
    }

    if (!sawReachableProxy) {
      return { valid: null, error: 'proxy_unreachable' };
    }

    return { valid: sawProxyError ? null : false, error: latestError };
  };

  const mapValidationError = (provider: 'perplexity' | 'gemini' | 'openai', code?: string): string | null => {
    if (!code) return null;

    if (provider === 'perplexity') {
      switch (code) {
        case 'explicit_invalid_api_key':
          return 'Perplexity key appears invalid. Please re-copy it from Perplexity dashboard.';
        case 'upstream_auth_ambiguous':
          return 'Perplexity validation returned ambiguous 401/403. This can be temporary upstream auth/WAF behavior.';
        case 'upstream_unreachable':
        case 'proxy_unreachable':
          return 'Perplexity validation service is temporarily unreachable. You can still apply this key and continue.';
        case 'missing_or_invalid_api_key':
          return 'API key is empty or malformed.';
        default:
          return 'Perplexity validation did not complete. Please try again.';
      }
    }

    if (provider === 'gemini') {
      if (code === 'upstream_unreachable' || code === 'proxy_unreachable') {
        return 'Gemini validation service is temporarily unreachable.';
      }
      return null;
    }

    if (provider === 'openai') {
      if (code === 'upstream_unreachable' || code === 'proxy_unreachable') {
        return 'OpenAI validation service is temporarily unreachable.';
      }
      return null;
    }

    return null;
  };

  // 初始化時從 localStorage 讀取金鑰
  useEffect(() => {
    const storedPerplexityKey = storageService.getApiKey('perplexityKey') || '';
    const storedGeminiKey = storageService.getApiKey('geminiKey') || '';
    const storedOpenrouterKey = storageService.getApiKey('openrouterKey') || '';
    const storedOllamaKey = storageService.getApiKey('ollamaKey') || '';
    const storedOpenaiKey = storageService.getApiKey('openaiKey') || '';
    const storedPerplexityValid = storageService.getApiKeyStatus('perplexityValid');
    const storedGeminiValid = storageService.getApiKeyStatus('geminiValid');
    const storedOpenaiValid = storageService.getApiKeyStatus('openaiValid');

    const perplexityKey = sanitizeApiKeyLength(normalizeBearerApiKey(storedPerplexityKey));
    const geminiKey = sanitizeApiKeyLength(trimApiKey(storedGeminiKey));
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

    setApiKeys({
      perplexityKey,
      geminiKey,
      openrouterKey,
      ollamaKey,
      openaiKey
    });

    setKeyErrors({
      perplexityError: null,
      geminiError: null,
      openaiError: null
    });

    const initialKeyStatus: KeyStatus = {
      perplexityValid: perplexityKey ? (storedPerplexityValid ?? null) : false,
      geminiValid: geminiKey ? (storedGeminiValid ?? null) : false,
      openaiValid: openaiKey ? (storedOpenaiValid ?? null) : false
    };
    setKeyStatus(initialKeyStatus);
    persistKeyStatus(initialKeyStatus);
  }, []);

  const savePerplexityKey = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(normalizeBearerApiKey(key));
    storageService.saveApiKey('perplexityKey', normalizedKey);
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      perplexityKey: normalizedKey
    }));
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      perplexityValid: normalizedKey ? (prev.perplexityValid === true ? true : null) : false
    }));
    setKeyErrors((prev) => ({ ...prev, perplexityError: null }));
  };

  const saveGeminiKey = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(trimApiKey(key));
    storageService.saveApiKey('geminiKey', normalizedKey);
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      geminiKey: normalizedKey
    }));
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      geminiValid: normalizedKey ? (prev.geminiValid === true ? true : null) : false
    }));
    setKeyErrors((prev) => ({ ...prev, geminiError: null }));
  };

  const saveOpenaiKey = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(normalizeBearerApiKey(key));
    storageService.saveApiKey('openaiKey', normalizedKey);
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      openaiKey: normalizedKey
    }));
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      openaiValid: normalizedKey ? (prev.openaiValid === true ? true : null) : false
    }));
    setKeyErrors((prev) => ({ ...prev, openaiError: null }));
  };

  const saveOpenrouterKey = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(normalizeBearerApiKey(key));
    storageService.saveApiKey('openrouterKey', normalizedKey);
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      openrouterKey: normalizedKey
    }));
  };

  const saveOllamaKey = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(normalizeBearerApiKey(key));
    storageService.saveApiKey('ollamaKey', normalizedKey);
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      ollamaKey: normalizedKey
    }));
  };

  const clearAllKeys = () => {
    storageService.clearAllApiKeys();
    setApiKeys({
      perplexityKey: '',
      geminiKey: '',
      openrouterKey: '',
      ollamaKey: '',
      openaiKey: ''
    });
    setAndPersistKeyStatus(() => ({
      perplexityValid: false,
      geminiValid: false,
      openaiValid: false
    }));
    setKeyErrors({
      perplexityError: null,
      geminiError: null,
      openaiError: null
    });
  };

  const markPerplexityKeyEdited = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(normalizeBearerApiKey(key));
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      perplexityValid: normalizedKey ? null : false
    }));
    setKeyErrors((prev) => ({ ...prev, perplexityError: null }));
  };

  const markGeminiKeyEdited = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(trimApiKey(key));
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      geminiValid: normalizedKey ? null : false
    }));
    setKeyErrors((prev) => ({ ...prev, geminiError: null }));
  };

  const markOpenaiKeyEdited = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(normalizeBearerApiKey(key));
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      openaiValid: normalizedKey ? null : false
    }));
    setKeyErrors((prev) => ({ ...prev, openaiError: null }));
  };

  const testPerplexityKey = async (key: string): Promise<boolean | null> => {
    const trimmedKey = normalizeBearerApiKey(key);
    if (!validateApiKey(trimmedKey)) {
      setAndPersistKeyStatus((prev: KeyStatus) => ({
        ...prev,
        perplexityValid: false
      }));
      setKeyErrors((prev) => ({
        ...prev,
        perplexityError: 'API key is empty or malformed.'
      }));
      return false;
    }

    const result = await testViaProxy(
      trimmedKey,
      getProxyEndpoints('/pplx/validate', PERPLEXITY_PROXY_ENDPOINTS)
    );

    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      perplexityValid: result.valid
    }));
    setKeyErrors((prev) => ({
      ...prev,
      perplexityError:
        result.valid === true
          ? null
          : mapValidationError('perplexity', result.error) ||
            (result.valid === false
              ? 'Perplexity key appears invalid.'
              : 'Perplexity validation was inconclusive. You can still apply this key and continue.')
    }));
    return result.valid;
  };

  const testGeminiKey = async (key: string): Promise<boolean | null> => {
    const trimmedKey = trimApiKey(key);
    if (!validateApiKey(trimmedKey)) {
      setAndPersistKeyStatus((prev: KeyStatus) => ({
        ...prev,
        geminiValid: false
      }));
      setKeyErrors((prev) => ({
        ...prev,
        geminiError: 'API key is empty or malformed.'
      }));
      return false;
    }

    const result = await testViaProxy(
      trimmedKey,
      getProxyEndpoints('/gemini/validate', GEMINI_PROXY_ENDPOINTS)
    );

    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      geminiValid: result.valid
    }));
    setKeyErrors((prev) => ({
      ...prev,
      geminiError:
        result.valid === true
          ? null
          : mapValidationError('gemini', result.error) ||
            (result.valid === false ? 'Gemini key appears invalid.' : 'Validation was inconclusive. Please retry.')
    }));
    return result.valid;
  };

  const testOpenaiKey = async (key: string): Promise<boolean | null> => {
    const trimmedKey = normalizeBearerApiKey(key);
    if (!validateApiKey(trimmedKey)) {
      setAndPersistKeyStatus((prev: KeyStatus) => ({
        ...prev,
        openaiValid: false
      }));
      setKeyErrors((prev) => ({
        ...prev,
        openaiError: 'API key is empty or malformed.'
      }));
      return false;
    }

    const result = await testViaProxy(
      trimmedKey,
      getProxyEndpoints('/openai/validate', OPENAI_PROXY_ENDPOINTS)
    );

    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      openaiValid: result.valid
    }));
    setKeyErrors((prev) => ({
      ...prev,
      openaiError:
        result.valid === true
          ? null
          : mapValidationError('openai', result.error) ||
            (result.valid === false ? 'OpenAI key appears invalid.' : 'Validation was inconclusive. Please retry.')
    }));
    return result.valid;
  };

  return {
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
  };
};
