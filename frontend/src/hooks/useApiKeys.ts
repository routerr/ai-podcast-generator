import { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { ApiKeys } from '../types';

/**
 * API 金鑰管理 Hook
 * @returns 包含 API 金鑰狀態和操作函數的物件
 */
export const useApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    perplexityKey: '',
    geminiKey: '',
    openaiKey: '' // 新增 OpenAI API 金鑰
  });
  
  const [keyStatus, setKeyStatus] = useState<{
    perplexityValid: boolean | null;
    geminiValid: boolean | null;
    openaiValid: boolean | null; // 新增 OpenAI 金鑰狀態
  }>({
    perplexityValid: null,
    geminiValid: null,
    openaiValid: null
  });

  // 初始化時從 localStorage 讀取金鑰
  useEffect(() => {
    const perplexityKey = storageService.getApiKey('perplexityKey') || '';
    const geminiKey = storageService.getApiKey('geminiKey') || '';
    const openaiKey = storageService.getApiKey('openaiKey') || ''; // 讀取 OpenAI 金鑰
    
    setApiKeys({
      perplexityKey,
      geminiKey,
      openaiKey
    });
    
    // 檢查金鑰是否存在並設置狀態
    setKeyStatus({
      perplexityValid: perplexityKey ? null : false, // null 表示未驗證，false 表示空值
      geminiValid: geminiKey ? null : false,
      openaiValid: openaiKey ? null : false
    });
  }, []);

  // 保存 Perplexity API 金鑰
  const savePerplexityKey = (key: string) => {
    storageService.saveApiKey('perplexityKey', key);
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      perplexityKey: key
    }));
    setKeyStatus((prev: { perplexityValid: boolean | null; geminiValid: boolean | null; openaiValid: boolean | null }) => ({
      ...prev,
      perplexityValid: key ? null : false
    }));
  };

  // 保存 Gemini API 金鑰
  const saveGeminiKey = (key: string) => {
    storageService.saveApiKey('geminiKey', key);
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      geminiKey: key
    }));
    setKeyStatus((prev: { perplexityValid: boolean | null; geminiValid: boolean | null; openaiValid: boolean | null }) => ({
      ...prev,
      geminiValid: key ? null : false
    }));
  };

  // 保存 OpenAI API 金鑰
  const saveOpenaiKey = (key: string) => {
    storageService.saveApiKey('openaiKey', key);
    setApiKeys((prev: ApiKeys) => ({
      ...prev,
      openaiKey: key
    }));
    setKeyStatus((prev: { perplexityValid: boolean | null; geminiValid: boolean | null; openaiValid: boolean | null }) => ({
      ...prev,
      openaiValid: key ? null : false
    }));
  };

  // 清除所有 API 金鑰
  const clearAllKeys = () => {
    storageService.clearAllApiKeys();
    setApiKeys({
      perplexityKey: '',
      geminiKey: '',
      openaiKey: ''
    });
    setKeyStatus({
      perplexityValid: false,
      geminiValid: false,
      openaiValid: false
    });
  };

  // 驗證 API 金鑰格式 (基本檢查)
  const validateApiKey = (key: string): boolean => {
    // 基本檢查：非空且長度合理
    return key.length > 10;
  };

  // 驗證 Perplexity API 金鑰
  const validatePerplexityKey = () => {
    const isValid = validateApiKey(apiKeys.perplexityKey);
    setKeyStatus((prev: { perplexityValid: boolean | null; geminiValid: boolean | null; openaiValid: boolean | null }) => ({
      ...prev,
      perplexityValid: isValid
    }));
    return isValid;
  };

  // 驗證 Gemini API 金鑰
  const validateGeminiKey = () => {
    const isValid = validateApiKey(apiKeys.geminiKey);
    setKeyStatus((prev: { perplexityValid: boolean | null; geminiValid: boolean | null; openaiValid: boolean | null }) => ({
      ...prev,
      geminiValid: isValid
    }));
    return isValid;
  };

  // 驗證 OpenAI API 金鑰
  const validateOpenaiKey = () => {
    const isValid = validateApiKey(apiKeys.openaiKey || '');
    setKeyStatus((prev: { perplexityValid: boolean | null; geminiValid: boolean | null; openaiValid: boolean | null }) => ({
      ...prev,
      openaiValid: isValid
    }));
    return isValid;
  };

  return {
    apiKeys,
    keyStatus,
    savePerplexityKey,
    saveGeminiKey,
    saveOpenaiKey, // 新增保存 OpenAI 金鑰函數
    clearAllKeys,
    validatePerplexityKey,
    validateGeminiKey,
    validateOpenaiKey // 新增驗證 OpenAI 金鑰函數
  };
};