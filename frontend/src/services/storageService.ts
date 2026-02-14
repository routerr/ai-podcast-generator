// API 金鑰儲存服務
const API_KEY_PREFIX = 'ai_podcast_generator_api_key_';

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
        if (key.startsWith(API_KEY_PREFIX)) {
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
  }
};