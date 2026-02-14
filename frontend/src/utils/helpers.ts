/**
 * 工具函數集合
 */

/**
 * 驗證 API 金鑰格式
 * @param key API 金鑰
 * @returns 是否有效
 */
export const validateApiKey = (key: string): boolean => {
  // 基本驗證：檢查是否為非空字串且長度合理
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // 一般 API 金鑰長度至少 10 個字符
  return key.length >= 10;
};

/**
 * 格式化錯誤訊息
 * @param error 錯誤物件
 * @returns 格式化後的錯誤訊息
 */
export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unknown error occurred';
};

/**
 * 延遲函數
 * @param ms 毫秒數
 * @returns Promise
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 生成隨機 ID
 * @returns 隨機 ID 字串
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

/**
 * 檢查是否為空物件
 * @param obj 物件
 * @returns 是否為空物件
 */
export const isEmptyObject = (obj: object): boolean => {
  return Object.keys(obj).length === 0;
};

/**
 * 安全地從 localStorage 獲取項目
 * @param key 鍵名
 * @returns 值或 null
 */
export const safeGetFromLocalStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Failed to get item from localStorage:', error);
    return null;
  }
};

/**
 * 安全地設置 localStorage 項目
 * @param key 鍵名
 * @param value 值
 */
export const safeSetToLocalStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('Failed to set item to localStorage:', error);
  }
};