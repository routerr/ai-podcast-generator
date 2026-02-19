import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useApiKeys } from '../hooks/useApiKeys';
import { useAppContext } from '../contexts/AppContext';
import { useI18n } from '../contexts/I18nContext';
import './ApiKeyPanel.css';

interface ApiKeyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyPanel: React.FC<ApiKeyPanelProps> = ({ isOpen, onClose }) => {
  const {
    apiKeys,
    keyStatus,
    keyErrors,
    savePerplexityKey,
    saveGeminiKey,
    saveOpenaiKey,
    clearAllKeys,
    markPerplexityKeyEdited,
    markGeminiKeyEdited,
    markOpenaiKeyEdited,
    testPerplexityKey,
    testGeminiKey,
    testOpenaiKey
  } = useApiKeys();
  const { apiKeys: appApiKeys, dispatch } = useAppContext();
  const { t } = useI18n();
  const [perplexityKey, setPerplexityKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [showPerplexityKey, setShowPerplexityKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
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
  const normalizedOpenaiKey = normalizeApiKey(openaiKey);

  useEffect(() => {
    if (isOpen) {
      setPerplexityKey(apiKeys.perplexityKey);
      setGeminiKey(apiKeys.geminiKey);
      setOpenaiKey(apiKeys.openaiKey || '');
      setTestedPerplexityKey('');
      setTestedGeminiKey('');
      setTestedOpenaiKey('');
    }
  }, [isOpen, apiKeys]);

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

  const handleTestPerplexityKey = async () => {
    const currentKey = normalizedPerplexityKey;
    if (!currentKey) return;

    setIsTestingPerplexity(true);
    const validation = await testPerplexityKey(currentKey);
    setIsTestingPerplexity(false);
    setTestedPerplexityKey(validation === false ? '' : currentKey);

    if (validation !== false) {
      savePerplexityKey(currentKey);
      dispatch({
        type: 'SET_API_KEYS',
        payload: {
          ...appApiKeys,
          perplexityKey: currentKey
        }
      });
      setPerplexityKey(currentKey);
    }
  };

  const handleTestGeminiKey = async () => {
    const currentKey = normalizedGeminiKey;
    if (!currentKey) return;

    setIsTestingGemini(true);
    const validation = await testGeminiKey(currentKey);
    setIsTestingGemini(false);
    setTestedGeminiKey(validation === false ? '' : currentKey);

    if (validation !== false) {
      saveGeminiKey(currentKey);
      dispatch({
        type: 'SET_API_KEYS',
        payload: {
          ...appApiKeys,
          geminiKey: currentKey
        }
      });
      setGeminiKey(currentKey);
    }
  };

  const handleTestOpenaiKey = async () => {
    const currentKey = normalizedOpenaiKey;
    if (!currentKey) return;

    setIsTestingOpenai(true);
    const validation = await testOpenaiKey(currentKey);
    setIsTestingOpenai(false);
    setTestedOpenaiKey(validation === false ? '' : currentKey);

    if (validation !== false) {
      saveOpenaiKey(currentKey);
      dispatch({
        type: 'SET_API_KEYS',
        payload: {
          ...appApiKeys,
          openaiKey: currentKey
        }
      });
      setOpenaiKey(currentKey);
    }
  };

  const handleApplyPerplexityKey = () => {
    const keyToApply = normalizedPerplexityKey;
    if (!canApplyPerplexity || !keyToApply) return;

    savePerplexityKey(keyToApply);
    dispatch({
      type: 'SET_API_KEYS',
      payload: {
        ...appApiKeys,
        perplexityKey: keyToApply
      }
    });
  };

  const handleApplyGeminiKey = () => {
    const keyToApply = normalizedGeminiKey;
    if (!canApplyGemini || !keyToApply) return;

    saveGeminiKey(keyToApply);
    dispatch({
      type: 'SET_API_KEYS',
      payload: {
        ...appApiKeys,
        geminiKey: keyToApply
      }
    });
  };

  const handleApplyOpenaiKey = () => {
    const keyToApply = normalizedOpenaiKey;
    if (!canApplyOpenai || !keyToApply) return;

    saveOpenaiKey(keyToApply);
    dispatch({
      type: 'SET_API_KEYS',
      payload: {
        ...appApiKeys,
        openaiKey: keyToApply
      }
    });
  };

  const handleClearAllKeys = () => {
    clearAllKeys();
    setPerplexityKey('');
    setGeminiKey('');
    setOpenaiKey('');
    setTestedPerplexityKey('');
    setTestedGeminiKey('');
    setTestedOpenaiKey('');
    dispatch({
      type: 'SET_API_KEYS',
      payload: {
        perplexityKey: '',
        geminiKey: '',
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center espresso-overlay backdrop-blur-sm">
      <div className="espresso-card rounded-2xl w-full max-w-md mx-4 shadow-2xl">
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
              <label className="block text-sm font-medium espresso-muted">
                {t('api.perplexityLabel')}
              </label>

              <div className="relative">
                <input
                  type={showPerplexityKey ? 'text' : 'password'}
                  value={perplexityKey}
                  onChange={(e) => {
                    const nextValue = e.target.value;
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
                  {showPerplexityKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
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
              {keyErrors.perplexityError && (
                <p className="text-xs text-[#f9e2af]">{keyErrors.perplexityError}</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium espresso-muted">
                {t('api.geminiLabel')}
              </label>

              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => {
                    const nextValue = e.target.value;
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
                  {showGeminiKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
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
              {keyErrors.geminiError && (
                <p className="text-xs text-[#f9e2af]">{keyErrors.geminiError}</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium espresso-muted">
                {t('api.openaiLabel')}
              </label>

              <div className="relative">
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => {
                    const nextValue = e.target.value;
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
                  {showOpenaiKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
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
              {keyErrors.openaiError && (
                <p className="text-xs text-[#f9e2af]">{keyErrors.openaiError}</p>
              )}
            </div>

            <div className="pt-4">
              <button
                onClick={handleClearAllKeys}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors espresso-btn-danger"
              >
                {t('api.clearAll')}
              </button>

              <p className="mt-3 text-xs espresso-muted">
                {t('api.note')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
