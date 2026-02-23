import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from './storageService';

// jsdom provides a real localStorage implementation that is cleared between tests.

describe('storageService', () => {
  beforeEach(() => localStorage.clear());

  // ---------------------------------------------------------------------------
  // saveApiKey / getApiKey
  // ---------------------------------------------------------------------------

  describe('saveApiKey / getApiKey', () => {
    it('stores a key and retrieves it by name', () => {
      storageService.saveApiKey('geminiKey', 'AIzaSy-abc123');
      expect(storageService.getApiKey('geminiKey')).toBe('AIzaSy-abc123');
    });

    it('returns null for a key name that was never saved', () => {
      expect(storageService.getApiKey('unknownKey')).toBeNull();
    });

    it('overwrites a previously saved value', () => {
      storageService.saveApiKey('geminiKey', 'old-key');
      storageService.saveApiKey('geminiKey', 'new-key');
      expect(storageService.getApiKey('geminiKey')).toBe('new-key');
    });

    it('stores different keys independently', () => {
      storageService.saveApiKey('geminiKey', 'gemini-val');
      storageService.saveApiKey('openrouterKey', 'openrouter-val');
      expect(storageService.getApiKey('geminiKey')).toBe('gemini-val');
      expect(storageService.getApiKey('openrouterKey')).toBe('openrouter-val');
    });
  });

  // ---------------------------------------------------------------------------
  // hasApiKey
  // ---------------------------------------------------------------------------

  describe('hasApiKey', () => {
    it('returns false when the key has not been saved', () => {
      expect(storageService.hasApiKey('perplexityKey')).toBe(false);
    });

    it('returns true after saving the key', () => {
      storageService.saveApiKey('perplexityKey', 'pplx-test');
      expect(storageService.hasApiKey('perplexityKey')).toBe(true);
    });

    it('returns false after the key has been removed', () => {
      storageService.saveApiKey('perplexityKey', 'pplx-test');
      storageService.removeApiKey('perplexityKey');
      expect(storageService.hasApiKey('perplexityKey')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // removeApiKey
  // ---------------------------------------------------------------------------

  describe('removeApiKey', () => {
    it('deletes a previously saved key', () => {
      storageService.saveApiKey('geminiKey', 'val');
      storageService.removeApiKey('geminiKey');
      expect(storageService.getApiKey('geminiKey')).toBeNull();
    });

    it('does not throw when removing a key that was never saved', () => {
      expect(() => storageService.removeApiKey('ghostKey')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // clearAllApiKeys
  // ---------------------------------------------------------------------------

  describe('clearAllApiKeys', () => {
    it('removes all saved API keys', () => {
      storageService.saveApiKey('geminiKey', 'g');
      storageService.saveApiKey('perplexityKey', 'p');
      storageService.saveApiKey('openrouterKey', 'or');
      storageService.clearAllApiKeys();
      expect(storageService.getApiKey('geminiKey')).toBeNull();
      expect(storageService.getApiKey('perplexityKey')).toBeNull();
      expect(storageService.getApiKey('openrouterKey')).toBeNull();
    });

    it('removes all saved API key statuses', () => {
      storageService.saveApiKeyStatus('geminiValid', true);
      storageService.saveApiKeyStatus('perplexityValid', false);
      storageService.clearAllApiKeys();
      expect(storageService.getApiKeyStatus('geminiValid')).toBeUndefined();
      expect(storageService.getApiKeyStatus('perplexityValid')).toBeUndefined();
    });

    it('does not remove unrelated localStorage entries', () => {
      localStorage.setItem('some_unrelated_key', 'untouched');
      storageService.saveApiKey('geminiKey', 'g');
      storageService.clearAllApiKeys();
      expect(localStorage.getItem('some_unrelated_key')).toBe('untouched');
    });

    it('is idempotent when called on an already-empty store', () => {
      expect(() => storageService.clearAllApiKeys()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // saveApiKeyStatus / getApiKeyStatus
  // ---------------------------------------------------------------------------

  describe('saveApiKeyStatus / getApiKeyStatus', () => {
    it('persists and retrieves a true status', () => {
      storageService.saveApiKeyStatus('geminiValid', true);
      expect(storageService.getApiKeyStatus('geminiValid')).toBe(true);
    });

    it('persists and retrieves a false status', () => {
      storageService.saveApiKeyStatus('geminiValid', false);
      expect(storageService.getApiKeyStatus('geminiValid')).toBe(false);
    });

    it('persists and retrieves a null status', () => {
      storageService.saveApiKeyStatus('geminiValid', null);
      expect(storageService.getApiKeyStatus('geminiValid')).toBeNull();
    });

    it('returns undefined for a status that was never set', () => {
      expect(storageService.getApiKeyStatus('neverSetStatus')).toBeUndefined();
    });

    it('overwrites a previously saved status', () => {
      storageService.saveApiKeyStatus('geminiValid', true);
      storageService.saveApiKeyStatus('geminiValid', false);
      expect(storageService.getApiKeyStatus('geminiValid')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // removeApiKeyStatus
  // ---------------------------------------------------------------------------

  describe('removeApiKeyStatus', () => {
    it('removes a previously saved status so it reads as undefined', () => {
      storageService.saveApiKeyStatus('geminiValid', true);
      storageService.removeApiKeyStatus('geminiValid');
      expect(storageService.getApiKeyStatus('geminiValid')).toBeUndefined();
    });

    it('does not throw when removing a status that was never saved', () => {
      expect(() => storageService.removeApiKeyStatus('ghostStatus')).not.toThrow();
    });
  });
});
