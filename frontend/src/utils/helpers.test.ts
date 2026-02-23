import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateApiKey,
  formatErrorMessage,
  generateId,
  isEmptyObject,
  safeGetFromLocalStorage,
  safeSetToLocalStorage
} from './helpers';

describe('validateApiKey', () => {
  it('returns false for empty string', () => {
    expect(validateApiKey('')).toBe(false);
  });

  it('returns false for a key shorter than 10 characters', () => {
    expect(validateApiKey('short')).toBe(false);
    expect(validateApiKey('123456789')).toBe(false); // 9 chars
  });

  it('returns false for a non-string value', () => {
    expect(validateApiKey(null as unknown as string)).toBe(false);
    expect(validateApiKey(undefined as unknown as string)).toBe(false);
  });

  it('returns true for a key of exactly 10 characters', () => {
    expect(validateApiKey('1234567890')).toBe(true);
  });

  it('returns true for a valid API key longer than 10 characters', () => {
    expect(validateApiKey('sk-abcdefghijklmnop')).toBe(true);
  });
});

describe('formatErrorMessage', () => {
  it('returns the message property from an Error instance', () => {
    expect(formatErrorMessage(new Error('something went wrong'))).toBe('something went wrong');
  });

  it('returns the string itself when given a string', () => {
    expect(formatErrorMessage('network timeout')).toBe('network timeout');
  });

  it('returns the fallback message for numbers', () => {
    expect(formatErrorMessage(42)).toBe('An unknown error occurred');
  });

  it('returns the fallback message for null', () => {
    expect(formatErrorMessage(null)).toBe('An unknown error occurred');
  });

  it('returns the fallback message for objects', () => {
    expect(formatErrorMessage({ code: 500 })).toBe('An unknown error occurred');
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates distinct IDs across many calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId()));
    expect(ids.size).toBe(200);
  });
});

describe('isEmptyObject', () => {
  it('returns true for an object with no keys', () => {
    expect(isEmptyObject({})).toBe(true);
  });

  it('returns false for an object with at least one key', () => {
    expect(isEmptyObject({ a: 1 })).toBe(false);
    expect(isEmptyObject({ a: undefined })).toBe(false);
  });

  it('returns false for an array (arrays are objects with index keys)', () => {
    expect(isEmptyObject([1, 2] as unknown as object)).toBe(false);
  });
});

describe('safeGetFromLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  it('returns the stored value for a known key', () => {
    localStorage.setItem('testKey', 'testValue');
    expect(safeGetFromLocalStorage('testKey')).toBe('testValue');
  });

  it('returns null for a key that does not exist', () => {
    expect(safeGetFromLocalStorage('nonExistentKey')).toBeNull();
  });

  it('returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    expect(safeGetFromLocalStorage('anyKey')).toBeNull();
  });
});

describe('safeSetToLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  it('stores a value that can be retrieved afterwards', () => {
    safeSetToLocalStorage('myKey', 'myValue');
    expect(localStorage.getItem('myKey')).toBe('myValue');
  });

  it('overwrites an existing value', () => {
    safeSetToLocalStorage('myKey', 'first');
    safeSetToLocalStorage('myKey', 'second');
    expect(localStorage.getItem('myKey')).toBe('second');
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => safeSetToLocalStorage('key', 'value')).not.toThrow();
  });
});
