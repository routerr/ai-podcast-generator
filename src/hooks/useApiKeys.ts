import { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { ApiKeys } from '../types';
import { useAppContext } from '../contexts/AppContext';

const PERPLEXITY_PROXY_ENDPOINTS = ['/pplx/validate', '/api/perplexity/validate'];
const GEMINI_PROXY_ENDPOINTS = ['/gemini/validate', '/api/gemini/validate'];
const OPENAI_PROXY_ENDPOINTS = ['/openai/validate', '/api/openai/validate'];
const OPENROUTER_PROXY_ENDPOINTS = ['/openrouter/validate', '/api/openrouter/validate'];
const OLLAMA_PROXY_ENDPOINTS = ['/ollama/validate', '/api/ollama/validate'];
const MAX_API_KEY_LENGTH = 512;

type KeyStatus = {
  perplexityValid: boolean | null;
  geminiValid: boolean | null;
  openaiValid: boolean | null;
  openrouterValid: boolean | null;
  ollamaValid: boolean | null;
};

type KeyErrors = {
  perplexityError: string | null;
  geminiError: string | null;
  openaiError: string | null;
  openrouterError: string | null;
  ollamaError: string | null;
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
  const { password } = useAppContext();
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
    openaiValid: null,
    openrouterValid: null,
    ollamaValid: null
  });

  const [keyErrors, setKeyErrors] = useState<KeyErrors>({
    perplexityError: null,
    geminiError: null,
    openaiError: null,
    openrouterError: null,
    ollamaError: null
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
    endpoints: string[],
    extraBody?: Record<string, unknown>
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
          body: JSON.stringify({ apiKey, ...extraBody })
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
          if (typeof payload?.valid === 'boolean') {
            return {
              valid: payload.valid,
              error: latestError
            };
          }
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

  const mapValidationError = (provider: 'perplexity' | 'gemini' | 'openai' | 'openrouter' | 'ollama', code?: string): string | null => {
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

    if (provider === 'openrouter') {
      if (code === 'upstream_unreachable' || code === 'proxy_unreachable') {
        return 'OpenRouter validation service is temporarily unreachable.';
      }
      return null;
    }

    if (provider === 'ollama') {
      if (code === 'upstream_unreachable' || code === 'proxy_unreachable') {
        return 'Ollama endpoint is unreachable. Please verify your Base URL.';
      }
      return null;
    }

    return null;
  };

  // 初始化時讀取金鑰：有密碼時優先讀取加密金鑰，並清理舊的平文儲存
  useEffect(() => {
    let cancelled = false;

    const loadApiKeys = async () => {
      const plainPerplexityKey = storageService.getApiKey('perplexityKey') || '';
      const plainGeminiKey = storageService.getApiKey('geminiKey') || '';
      const plainOpenrouterKey = storageService.getApiKey('openrouterKey') || '';
      const plainOllamaKey = storageService.getApiKey('ollamaKey') || '';
      const plainOpenaiKey = storageService.getApiKey('openaiKey') || '';

      const encryptedPerplexityKey = password
        ? await storageService.getApiKeyWithPassword('perplexityKey', password)
        : null;
      const encryptedGeminiKey = password
        ? await storageService.getApiKeyWithPassword('geminiKey', password)
        : null;
      const encryptedOpenrouterKey = password
        ? await storageService.getApiKeyWithPassword('openrouterKey', password)
        : null;
      const encryptedOllamaKey = password
        ? await storageService.getApiKeyWithPassword('ollamaKey', password)
        : null;
      const encryptedOpenaiKey = password
        ? await storageService.getApiKeyWithPassword('openaiKey', password)
        : null;

      if (password) {
        const migrationTargets: Array<{ keyName: string; plainValue: string; encryptedValue: string | null }> = [
          { keyName: 'perplexityKey', plainValue: plainPerplexityKey, encryptedValue: encryptedPerplexityKey },
          { keyName: 'geminiKey', plainValue: plainGeminiKey, encryptedValue: encryptedGeminiKey },
          { keyName: 'openrouterKey', plainValue: plainOpenrouterKey, encryptedValue: encryptedOpenrouterKey },
          { keyName: 'ollamaKey', plainValue: plainOllamaKey, encryptedValue: encryptedOllamaKey },
          { keyName: 'openaiKey', plainValue: plainOpenaiKey, encryptedValue: encryptedOpenaiKey }
        ];

        for (const target of migrationTargets) {
          if (target.plainValue && !target.encryptedValue) {
            await storageService.saveApiKeyWithPassword(target.keyName, target.plainValue, password);
          }
          if (target.plainValue) {
            storageService.removeApiKey(target.keyName);
          }
        }
      }

      const sourcePerplexityKey = password ? (encryptedPerplexityKey || plainPerplexityKey) : plainPerplexityKey;
      const sourceGeminiKey = password ? (encryptedGeminiKey || plainGeminiKey) : plainGeminiKey;
      const sourceOpenrouterKey = password ? (encryptedOpenrouterKey || plainOpenrouterKey) : plainOpenrouterKey;
      const sourceOllamaKey = password ? (encryptedOllamaKey || plainOllamaKey) : plainOllamaKey;
      const sourceOpenaiKey = password ? (encryptedOpenaiKey || plainOpenaiKey) : plainOpenaiKey;

      const storedPerplexityValid = storageService.getApiKeyStatus('perplexityValid');
      const storedGeminiValid = storageService.getApiKeyStatus('geminiValid');
      const storedOpenaiValid = storageService.getApiKeyStatus('openaiValid');
      const storedOpenrouterValid = storageService.getApiKeyStatus('openrouterValid');
      const storedOllamaValid = storageService.getApiKeyStatus('ollamaValid');

      const perplexityKey = sanitizeApiKeyLength(normalizeBearerApiKey(sourcePerplexityKey));
      const geminiKey = sanitizeApiKeyLength(trimApiKey(sourceGeminiKey));
      const openrouterKey = sanitizeApiKeyLength(normalizeBearerApiKey(sourceOpenrouterKey));
      const ollamaKey = sanitizeApiKeyLength(normalizeBearerApiKey(sourceOllamaKey));
      const openaiKey = sanitizeApiKeyLength(normalizeBearerApiKey(sourceOpenaiKey));

      if (!password) {
        if (perplexityKey !== sourcePerplexityKey) {
          storageService.saveApiKey('perplexityKey', perplexityKey);
        }
        if (geminiKey !== sourceGeminiKey) {
          storageService.saveApiKey('geminiKey', geminiKey);
        }
        if (openrouterKey !== sourceOpenrouterKey) {
          storageService.saveApiKey('openrouterKey', openrouterKey);
        }
        if (ollamaKey !== sourceOllamaKey) {
          storageService.saveApiKey('ollamaKey', ollamaKey);
        }
        if (openaiKey !== sourceOpenaiKey) {
          storageService.saveApiKey('openaiKey', openaiKey);
        }
      }

      if (cancelled) {
        return;
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
        openaiError: null,
        openrouterError: null,
        ollamaError: null
      });

      const initialKeyStatus: KeyStatus = {
        perplexityValid: perplexityKey ? (storedPerplexityValid ?? null) : false,
        geminiValid: geminiKey ? (storedGeminiValid ?? null) : false,
        openaiValid: openaiKey ? (storedOpenaiValid ?? null) : false,
        openrouterValid: openrouterKey ? (storedOpenrouterValid ?? null) : false,
        ollamaValid: storedOllamaValid ?? false
      };
      setKeyStatus(initialKeyStatus);
      persistKeyStatus(initialKeyStatus);
    };

    loadApiKeys();
    return () => {
      cancelled = true;
    };
  }, [password]);

  const savePerplexityKey = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(normalizeBearerApiKey(key));
    if (password) {
      if (normalizedKey) {
        storageService.saveApiKeyWithPassword('perplexityKey', normalizedKey, password);
      } else {
        storageService.removeEncryptedKey('perplexityKey');
      }
      storageService.removeApiKey('perplexityKey');
    } else {
      storageService.saveApiKey('perplexityKey', normalizedKey);
    }
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
    if (password) {
      if (normalizedKey) {
        storageService.saveApiKeyWithPassword('geminiKey', normalizedKey, password);
      } else {
        storageService.removeEncryptedKey('geminiKey');
      }
      storageService.removeApiKey('geminiKey');
    } else {
      storageService.saveApiKey('geminiKey', normalizedKey);
    }
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
    if (password) {
      if (normalizedKey) {
        storageService.saveApiKeyWithPassword('openaiKey', normalizedKey, password);
      } else {
        storageService.removeEncryptedKey('openaiKey');
      }
      storageService.removeApiKey('openaiKey');
    } else {
      storageService.saveApiKey('openaiKey', normalizedKey);
    }
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
    if (password) {
      if (normalizedKey) {
        storageService.saveApiKeyWithPassword('openrouterKey', normalizedKey, password);
      } else {
        storageService.removeEncryptedKey('openrouterKey');
      }
      storageService.removeApiKey('openrouterKey');
    } else {
      storageService.saveApiKey('openrouterKey', normalizedKey);
    }
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      openrouterKey: normalizedKey
    }));
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      openrouterValid: normalizedKey ? (prev.openrouterValid === true ? true : null) : false
    }));
    setKeyErrors((prev) => ({ ...prev, openrouterError: null }));
  };

  const saveOllamaKey = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(normalizeBearerApiKey(key));
    if (password) {
      if (normalizedKey) {
        storageService.saveApiKeyWithPassword('ollamaKey', normalizedKey, password);
      } else {
        storageService.removeEncryptedKey('ollamaKey');
      }
      storageService.removeApiKey('ollamaKey');
    } else {
      storageService.saveApiKey('ollamaKey', normalizedKey);
    }
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      ollamaKey: normalizedKey
    }));
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      ollamaValid: prev.ollamaValid === true ? true : null
    }));
    setKeyErrors((prev) => ({ ...prev, ollamaError: null }));
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
      openaiValid: false,
      openrouterValid: false,
      ollamaValid: false
    }));
    setKeyErrors({
      perplexityError: null,
      geminiError: null,
      openaiError: null,
      openrouterError: null,
      ollamaError: null
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

  const markOpenrouterKeyEdited = (key: string) => {
    const normalizedKey = sanitizeApiKeyLength(normalizeBearerApiKey(key));
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      openrouterValid: normalizedKey ? null : false
    }));
    setKeyErrors((prev) => ({ ...prev, openrouterError: null }));
  };

  const markOllamaKeyEdited = () => {
    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      ollamaValid: null
    }));
    setKeyErrors((prev) => ({ ...prev, ollamaError: null }));
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

  const testOpenrouterKey = async (key: string): Promise<boolean | null> => {
    const trimmedKey = normalizeBearerApiKey(key);
    if (!validateApiKey(trimmedKey)) {
      setAndPersistKeyStatus((prev: KeyStatus) => ({
        ...prev,
        openrouterValid: false
      }));
      setKeyErrors((prev) => ({
        ...prev,
        openrouterError: 'API key is empty or malformed.'
      }));
      return false;
    }

    const result = await testViaProxy(
      trimmedKey,
      getProxyEndpoints('/openrouter/validate', OPENROUTER_PROXY_ENDPOINTS)
    );

    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      openrouterValid: result.valid
    }));
    setKeyErrors((prev) => ({
      ...prev,
      openrouterError:
        result.valid === true
          ? null
          : mapValidationError('openrouter', result.error) ||
            (result.valid === false ? 'OpenRouter key appears invalid.' : 'Validation was inconclusive. Please retry.')
    }));
    return result.valid;
  };

  const testOllamaKey = async (key: string, baseUrl: string): Promise<boolean | null> => {
    const trimmedKey = normalizeBearerApiKey(key);

    const result = await testViaProxy(
      trimmedKey,
      getProxyEndpoints('/ollama/validate', OLLAMA_PROXY_ENDPOINTS),
      { baseUrl }
    );

    setAndPersistKeyStatus((prev: KeyStatus) => ({
      ...prev,
      ollamaValid: result.valid
    }));
    setKeyErrors((prev) => ({
      ...prev,
      ollamaError:
        result.valid === true
          ? null
          : mapValidationError('ollama', result.error) ||
            (result.valid === false ? 'Ollama connection or auth failed.' : 'Validation was inconclusive. Please retry.')
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
    markOpenrouterKeyEdited,
    markOllamaKeyEdited,
    testPerplexityKey,
    testGeminiKey,
    testOpenaiKey,
    testOpenrouterKey,
    testOllamaKey
  };
};
