import { cryptoService, EncryptedData } from '../utils/cryptoService';

const API_KEY_PREFIX = 'ai_podcast_generator_api_key_';
const API_KEY_STATUS_PREFIX = 'ai_podcast_generator_api_key_status_';
const ENCRYPTED_KEYS_PREFIX = 'ai_podcast_generator_encrypted_';
const KEY_PASSWORD_HASH_PREFIX = 'ai_podcast_generator_password_hash_';
const API_KEY_NAMES = ['perplexityKey', 'geminiKey', 'openrouterKey', 'ollamaKey', 'openaiKey'] as const;

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
  async saveApiKeyWithPassword(keyName: string, value: string, password: string): Promise<void> {
    try {
      const encrypted = await cryptoService.encrypt(value, password);
      localStorage.setItem(getEncryptedKeyName(keyName), JSON.stringify(encrypted));

      const passwordHash = await cryptoService.encrypt(password, password);
      localStorage.setItem(getPasswordHashName(), JSON.stringify(passwordHash));
    } catch (error) {
      console.error('Failed to save encrypted API key:', error);
      throw error;
    }
  },

  async getApiKeyWithPassword(keyName: string, password: string): Promise<string | null> {
    try {
      const encryptedStr = localStorage.getItem(getEncryptedKeyName(keyName));
      if (!encryptedStr) return null;

      const encrypted: EncryptedData = JSON.parse(encryptedStr);
      return await cryptoService.decrypt(encrypted, password);
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return null;
    }
  },

  async hasEncryptedKey(keyName: string): Promise<boolean> {
    return localStorage.getItem(getEncryptedKeyName(keyName)) !== null;
  },

  hasPasswordHash(): boolean {
    return localStorage.getItem(getPasswordHashName()) !== null;
  },

  async setPasswordAndEncryptApiKeys(newPassword: string): Promise<boolean> {
    try {
      for (const keyName of API_KEY_NAMES) {
        const plainTextValue = localStorage.getItem(`${API_KEY_PREFIX}${keyName}`) || '';
        if (!plainTextValue) {
          continue;
        }

        const encrypted = await cryptoService.encrypt(plainTextValue, newPassword);
        localStorage.setItem(getEncryptedKeyName(keyName), JSON.stringify(encrypted));
      }

      const newPasswordHash = await cryptoService.encrypt(newPassword, newPassword);
      localStorage.setItem(getPasswordHashName(), JSON.stringify(newPasswordHash));

      for (const keyName of API_KEY_NAMES) {
        localStorage.removeItem(`${API_KEY_PREFIX}${keyName}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to set password and encrypt API keys:', error);
      return false;
    }
  },

  async verifyPassword(password: string): Promise<boolean> {
    try {
      const passwordHashStr = localStorage.getItem(getPasswordHashName());
      if (!passwordHashStr) return false;

      const passwordHash: EncryptedData = JSON.parse(passwordHashStr);
      const decrypted = await cryptoService.decrypt(passwordHash, password);
      return decrypted === password;
    } catch {
      return false;
    }
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      const decryptedKeys: { name: string; value: string }[] = [];

      for (const keyName of API_KEY_NAMES) {
        const encryptedStr = localStorage.getItem(getEncryptedKeyName(keyName));
        if (encryptedStr) {
          const encrypted: EncryptedData = JSON.parse(encryptedStr);
          const decrypted = await cryptoService.decrypt(encrypted, oldPassword);
          decryptedKeys.push({ name: keyName, value: decrypted });
        }
      }

      localStorage.removeItem(getPasswordHashName());
      for (const key of API_KEY_NAMES) {
        localStorage.removeItem(getEncryptedKeyName(key));
      }

      for (const key of decryptedKeys) {
        const newEncrypted = await cryptoService.encrypt(key.value, newPassword);
        localStorage.setItem(getEncryptedKeyName(key.name), JSON.stringify(newEncrypted));
      }

      const newPasswordHash = await cryptoService.encrypt(newPassword, newPassword);
      localStorage.setItem(getPasswordHashName(), JSON.stringify(newPasswordHash));

      return true;
    } catch (error) {
      console.error('Failed to change password:', error);
      return false;
    }
  },

  removeEncryptedKey(keyName: string): void {
    localStorage.removeItem(getEncryptedKeyName(keyName));
  },

  clearAllEncryptedKeys(): void {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(ENCRYPTED_KEYS_PREFIX) || key.startsWith(KEY_PASSWORD_HASH_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  },

  saveApiKey(keyName: string, value: string): void {
    try {
      localStorage.setItem(`${API_KEY_PREFIX}${keyName}`, value);
    } catch (error) {
      console.error('Failed to save API key to localStorage:', error);
    }
  },

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

  hasApiKey(keyName: string): boolean {
    try {
      return localStorage.getItem(`${API_KEY_PREFIX}${keyName}`) !== null;
    } catch (error) {
      console.error('Failed to check API key in localStorage:', error);
      return false;
    }
  },

  saveApiKeyStatus(statusName: string, value: ApiKeyStatusValue): void {
    try {
      localStorage.setItem(`${API_KEY_STATUS_PREFIX}${statusName}`, toStoredStatus(value));
    } catch (error) {
      console.error('Failed to save API key status to localStorage:', error);
    }
  },

  getApiKeyStatus(statusName: string): ApiKeyStatusValue | undefined {
    try {
      const stored = localStorage.getItem(`${API_KEY_STATUS_PREFIX}${statusName}`);
      return fromStoredStatus(stored);
    } catch (error) {
      console.error('Failed to get API key status from localStorage:', error);
      return undefined;
    }
  },

  removeApiKeyStatus(statusName: string): void {
    try {
      localStorage.removeItem(`${API_KEY_STATUS_PREFIX}${statusName}`);
    } catch (error) {
      console.error('Failed to remove API key status from localStorage:', error);
    }
  }
};

const getEncryptedKeyName = (keyName: string) => `${ENCRYPTED_KEYS_PREFIX}${keyName}`;
const getPasswordHashName = () => KEY_PASSWORD_HASH_PREFIX;
