// API 金鑰儲存服務
const API_KEY_PREFIX = 'ai_podcast_generator_api_key_';
const API_KEY_STATUS_PREFIX = 'ai_podcast_generator_api_key_status_';

type ApiKeyStatusValue = boolean | null;

const toStoredStatus = (value: ApiKeyStatusValue): string => {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return 'null';
};

const fromStoredStatus = (value: string | null): ApiKeyStatusValue | undefined => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  return undefined;
};

export const storageService = {
  /**
   * 保存 API 金鑰到 localStorage
   * @param keyName 金鑰名稱 (perplexityKey、geminiKey 或 openaiKey)
   * @param value 金鑰值
   */
  saveApiKey(keyName: string, value: string): void {
    try {
      localStorage.setItem(`${API_KEY_PREFIX}${keyName}`, value);
    } catch (error) {
      console.error('Failed to save API key to localStorage:', error);
    }
  },

  /**
   * 從 localStorage 獲取 API 金鑰
   * @param keyName 金鑰名稱 (perplexityKey、geminiKey 或 openaiKey)
   * @returns 金鑰值或 null
   */
  getApiKey(keyName: string): string | null {
    try {
      return localStorage.getItem(`${API_KEY_PREFIX}${keyName}`);
    } catch (error) {
      console.error('Failed to get API key from localStorage:', error);
      return null;
    }
  },

  /**
   * 從 localStorage 刪除指定的 API 金鑰
   * @param keyName 金鑰名稱 (perplexityKey、geminiKey 或 openaiKey)
   */
  removeApiKey(keyName: string): void {
    try {
      localStorage.removeItem(`${API_KEY_PREFIX}${keyName}`);
    } catch (error) {
      console.error('Failed to remove API key from localStorage:', error);
    }
  },

  /**
   * 清除所有 API 金鑰
   */
  clearAllApiKeys(): void {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(API_KEY_PREFIX) || key.startsWith(API_KEY_STATUS_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear API keys from localStorage:', error);
    }
  },

  /**
   * 檢查 API 金鑰是否存在
   * @param keyName 金鑰名稱 (perplexityKey、geminiKey 或 openaiKey)
   * @returns 是否存在
   */
  hasApiKey(keyName: string): boolean {
    try {
      return localStorage.getItem(`${API_KEY_PREFIX}${keyName}`) !== null;
    } catch (error) {
      console.error('Failed to check API key in localStorage:', error);
      return false;
    }
  },

  /**
   * 保存 API 金鑰驗證狀態到 localStorage
   * @param statusName 狀態名稱 (perplexityValid、geminiValid 或 openaiValid)
   * @param value 狀態值 (true/false/null)
   */
  saveApiKeyStatus(statusName: string, value: ApiKeyStatusValue): void {
    try {
      localStorage.setItem(`${API_KEY_STATUS_PREFIX}${statusName}`, toStoredStatus(value));
    } catch (error) {
      console.error('Failed to save API key status to localStorage:', error);
    }
  },

  /**
   * 從 localStorage 獲取 API 金鑰驗證狀態
   * @param statusName 狀態名稱 (perplexityValid、geminiValid 或 openaiValid)
   * @returns 狀態值 (true/false/null)；若不存在則為 undefined
   */
  getApiKeyStatus(statusName: string): ApiKeyStatusValue | undefined {
    try {
      const stored = localStorage.getItem(`${API_KEY_STATUS_PREFIX}${statusName}`);
      return fromStoredStatus(stored);
    } catch (error) {
      console.error('Failed to get API key status from localStorage:', error);
      return undefined;
    }
  },

  /**
   * 刪除指定 API 金鑰驗證狀態
   * @param statusName 狀態名稱
   */
  removeApiKeyStatus(statusName: string): void {
    try {
      localStorage.removeItem(`${API_KEY_STATUS_PREFIX}${statusName}`);
    } catch (error) {
      console.error('Failed to remove API key status from localStorage:', error);
    }
  }
};
