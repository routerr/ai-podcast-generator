import { describe, it, expect } from 'vitest';
import {
  isLocalOllamaBaseUrl,
  getProviderChain,
  getMissingProviderKeys
} from './llmWorkflowService';
import type { ApiKeys, SessionConfig } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeConfig = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({
  language: 'en',
  format: 'dialogue',
  length: 'medium',
  llmPrimaryProvider: 'gemini',
  llmFallbackProvider: 'none',
  openrouterModel: '',
  ollamaModel: '',
  ollamaBaseUrl: '',
  ...overrides
});

const makeApiKeys = (overrides: Partial<ApiKeys> = {}): ApiKeys => ({
  perplexityKey: '',
  geminiKey: '',
  ...overrides
});

// ---------------------------------------------------------------------------
// isLocalOllamaBaseUrl
// ---------------------------------------------------------------------------

describe('isLocalOllamaBaseUrl', () => {
  it('returns true for a localhost URL', () => {
    expect(isLocalOllamaBaseUrl('http://localhost:11434')).toBe(true);
  });

  it('returns true for 127.0.0.1', () => {
    expect(isLocalOllamaBaseUrl('http://127.0.0.1:11434')).toBe(true);
  });

  it('returns true for 0.0.0.0', () => {
    expect(isLocalOllamaBaseUrl('http://0.0.0.0:11434')).toBe(true);
  });

  it('returns true when trailing slash is present (should be stripped)', () => {
    expect(isLocalOllamaBaseUrl('http://localhost:11434/')).toBe(true);
  });

  it('returns false for the default remote Ollama API URL', () => {
    expect(isLocalOllamaBaseUrl('https://api.ollama.com')).toBe(false);
  });

  it('returns false for an arbitrary remote host', () => {
    expect(isLocalOllamaBaseUrl('https://ollama.myserver.com')).toBe(false);
  });

  it('returns false for an invalid/unparseable URL', () => {
    expect(isLocalOllamaBaseUrl('not-a-url')).toBe(false);
  });

  it('returns false for empty string (falls back to remote default)', () => {
    expect(isLocalOllamaBaseUrl('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getProviderChain
// ---------------------------------------------------------------------------

describe('getProviderChain', () => {
  it('returns only the primary provider when fallback is "none"', () => {
    const config = makeConfig({ llmPrimaryProvider: 'gemini', llmFallbackProvider: 'none' });
    expect(getProviderChain(config)).toEqual(['gemini']);
  });

  it('returns only the primary provider when fallback equals primary', () => {
    const config = makeConfig({ llmPrimaryProvider: 'gemini', llmFallbackProvider: 'gemini' });
    expect(getProviderChain(config)).toEqual(['gemini']);
  });

  it('returns [primary, fallback] when they differ', () => {
    const config = makeConfig({ llmPrimaryProvider: 'gemini', llmFallbackProvider: 'openrouter' });
    expect(getProviderChain(config)).toEqual(['gemini', 'openrouter']);
  });

  it('preserves order: primary first, fallback second', () => {
    const config = makeConfig({ llmPrimaryProvider: 'perplexity', llmFallbackProvider: 'gemini' });
    expect(getProviderChain(config)).toEqual(['perplexity', 'gemini']);
  });

  it('works with ollama as primary', () => {
    const config = makeConfig({ llmPrimaryProvider: 'ollama', llmFallbackProvider: 'none' });
    expect(getProviderChain(config)).toEqual(['ollama']);
  });
});

// ---------------------------------------------------------------------------
// getMissingProviderKeys
// ---------------------------------------------------------------------------

describe('getMissingProviderKeys', () => {
  it('reports gemini as missing when geminiKey is empty', () => {
    const config = makeConfig({ llmPrimaryProvider: 'gemini', llmFallbackProvider: 'none' });
    const apiKeys = makeApiKeys({ geminiKey: '' });
    expect(getMissingProviderKeys(apiKeys, config)).toContain('gemini');
  });

  it('does not report gemini as missing when geminiKey is present', () => {
    const config = makeConfig({ llmPrimaryProvider: 'gemini', llmFallbackProvider: 'none' });
    const apiKeys = makeApiKeys({ geminiKey: 'AIzaSy-valid-key' });
    expect(getMissingProviderKeys(apiKeys, config)).not.toContain('gemini');
  });

  it('reports whitespace-only keys as missing', () => {
    const config = makeConfig({ llmPrimaryProvider: 'gemini', llmFallbackProvider: 'none' });
    const apiKeys = makeApiKeys({ geminiKey: '   ' });
    expect(getMissingProviderKeys(apiKeys, config)).toContain('gemini');
  });

  it('reports both providers missing when both keys are absent', () => {
    const config = makeConfig({
      llmPrimaryProvider: 'gemini',
      llmFallbackProvider: 'openrouter'
    });
    const apiKeys = makeApiKeys({ geminiKey: '', openrouterKey: '' });
    const missing = getMissingProviderKeys(apiKeys, config);
    expect(missing).toContain('gemini');
    expect(missing).toContain('openrouter');
  });

  it('reports only the missing provider when one key is present', () => {
    const config = makeConfig({
      llmPrimaryProvider: 'gemini',
      llmFallbackProvider: 'openrouter'
    });
    const apiKeys = makeApiKeys({ geminiKey: 'valid-key', openrouterKey: '' });
    const missing = getMissingProviderKeys(apiKeys, config);
    expect(missing).not.toContain('gemini');
    expect(missing).toContain('openrouter');
  });

  it('returns an empty array when all keys are present', () => {
    const config = makeConfig({
      llmPrimaryProvider: 'gemini',
      llmFallbackProvider: 'openrouter'
    });
    const apiKeys = makeApiKeys({ geminiKey: 'g-key', openrouterKey: 'or-key' });
    expect(getMissingProviderKeys(apiKeys, config)).toHaveLength(0);
  });

  it('does not require an API key for a local Ollama instance', () => {
    const config = makeConfig({
      llmPrimaryProvider: 'ollama',
      llmFallbackProvider: 'none',
      ollamaBaseUrl: 'http://localhost:11434'
    });
    const apiKeys = makeApiKeys({ ollamaKey: '' });
    expect(getMissingProviderKeys(apiKeys, config)).not.toContain('ollama');
  });

  it('requires an API key for a remote Ollama instance', () => {
    const config = makeConfig({
      llmPrimaryProvider: 'ollama',
      llmFallbackProvider: 'none',
      ollamaBaseUrl: 'https://api.ollama.com'
    });
    const apiKeys = makeApiKeys({ ollamaKey: '' });
    expect(getMissingProviderKeys(apiKeys, config)).toContain('ollama');
  });

  it('does not require a key for a remote Ollama instance when one is provided', () => {
    const config = makeConfig({
      llmPrimaryProvider: 'ollama',
      llmFallbackProvider: 'none',
      ollamaBaseUrl: 'https://api.ollama.com'
    });
    const apiKeys = makeApiKeys({ ollamaKey: 'ollama-api-key' });
    expect(getMissingProviderKeys(apiKeys, config)).not.toContain('ollama');
  });

  it('only checks providers that are in the active chain', () => {
    // perplexity is not in the chain, so its missing key should not be reported
    const config = makeConfig({
      llmPrimaryProvider: 'gemini',
      llmFallbackProvider: 'none'
    });
    const apiKeys = makeApiKeys({ geminiKey: 'valid', perplexityKey: '' });
    expect(getMissingProviderKeys(apiKeys, config)).toHaveLength(0);
  });
});
