import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const PERPLEXITY_SEARCH_API_URL = 'https://api.perplexity.ai/search';
const PERPLEXITY_CHAT_API_URL = 'https://api.perplexity.ai/chat/completions';
const OPENROUTER_CHAT_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_MODELS_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_BASE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_MODELS_API_URL = 'https://api.openai.com/v1/models';
const OPENAI_SPEECH_API_URL = 'https://api.openai.com/v1/audio/speech';
const MAX_API_KEY_LENGTH = 512;

const normalizeWrapping = (key: string): string => {
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

const normalizeBearerApiKey = (key: string): string =>
  normalizeWrapping(key)
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '');
const normalizeApiKey = (key: string): string => normalizeWrapping(key);
const normalizeBaseUrl = (value: string): string =>
  normalizeWrapping(value)
    .replace(/\/+$/, '');

const isLocalOllamaBaseUrl = (value: string): boolean => {
  const normalized = normalizeBaseUrl(value || 'https://api.ollama.com');
  try {
    const parsed = new URL(normalized);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const isPerplexityExplicitInvalidKey = (responseText: string): boolean =>
  /invalid[_\s-]?api[_\s-]?key|invalid[_\s-]?token|incorrect[_\s-]?api[_\s-]?key|api[_\s-]?key\s+is\s+invalid|api[_\s-]?key\s+not\s+valid|invalid authentication credentials/i.test(
    responseText
  );

const isPerplexityAmbiguousAuth = (status: number): boolean => status === 401 || status === 403;

const isGeminiInvalidKey = (status: number, responseText: string): boolean => {
  if (status === 400 || status === 401 || status === 403) {
    return /api[_\s-]?key[_\s-]?invalid|api key not valid|permission denied|request had invalid authentication credentials/i.test(
      responseText
    );
  }
  return false;
};

const parseJsonBody = async (req: any): Promise<Record<string, unknown>> => {
  const chunks: string[] = [];
  const decoder = new TextDecoder();

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? chunk : decoder.decode(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = chunks.join('');
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const sendJson = (res: any, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Proxy-Handled', '1');
  res.end(JSON.stringify(payload));
};

const sendRaw = (res: any, status: number, contentType: string, body: string | Uint8Array) => {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Proxy-Handled', '1');
  res.end(body);
};

const providerProxyMiddlewarePlugin = () => ({
  name: 'provider-proxy-middleware',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const path = (req.url || '').split('?')[0];
      const supportedPaths = [
        '/pplx/validate',
        '/pplx/search',
        '/pplx/chat',
        '/llm/chat',
        '/gemini/validate',
        '/gemini/generate',
        '/openai/validate',
        '/openai/speech',
        '/openrouter/validate',
        '/ollama/validate',
        '/ollama/models'
      ];

      if (!supportedPaths.includes(path)) {
        return next();
      }

      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'method_not_allowed' });
      }

      const body = await parseJsonBody(req);
      const rawApiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
      const provider = typeof body.provider === 'string' ? body.provider : '';
      const rawBaseUrl = typeof body.baseUrl === 'string' ? normalizeBaseUrl(body.baseUrl) : '';
      const ollamaBaseUrl = rawBaseUrl || 'https://api.ollama.com';
      const isOllamaProxyPath =
        (path === '/llm/chat' && provider === 'ollama') ||
        path === '/ollama/validate' ||
        path === '/ollama/models';
      const allowAnonymousOllama = isOllamaProxyPath && isLocalOllamaBaseUrl(ollamaBaseUrl);
      const apiKey =
        path.startsWith('/openai') || path.startsWith('/pplx') || path.startsWith('/llm')
          ? normalizeBearerApiKey(rawApiKey)
          : normalizeApiKey(rawApiKey);

      if (!allowAnonymousOllama && (!apiKey || apiKey.length <= 10 || apiKey.length > MAX_API_KEY_LENGTH)) {
        return sendJson(res, 400, { valid: false, error: 'missing_or_invalid_api_key' });
      }

      if (path === '/pplx/validate') {
        const testSearch = async () =>
          fetch(PERPLEXITY_SEARCH_API_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query: 'Return only OK.',
              max_results: 1,
              max_tokens_per_page: 64
            })
          });

        const testChat = async () =>
          fetch(PERPLEXITY_CHAT_API_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [
                {
                  role: 'user',
                  content: 'Reply with OK.'
                }
              ],
              max_tokens: 16
            })
          });

        let searchResponse: Response | null = null;
        let searchText = '';

        try {
          searchResponse = await testSearch();
          searchText = await searchResponse.text();
        } catch {
          searchResponse = null;
        }

        if (searchResponse && searchResponse.ok) {
          return sendJson(res, 200, { valid: true });
        }

        if (searchResponse && isPerplexityExplicitInvalidKey(searchText)) {
          return sendJson(res, 200, { valid: false, error: 'explicit_invalid_api_key' });
        }

        if (searchResponse && !isPerplexityAmbiguousAuth(searchResponse.status)) {
          return sendJson(res, 200, { valid: true });
        }

        try {
          const chatResponse = await testChat();
          const chatText = await chatResponse.text();

          if (chatResponse.ok) {
            return sendJson(res, 200, { valid: true });
          }

          if (isPerplexityExplicitInvalidKey(chatText)) {
            return sendJson(res, 200, { valid: false, error: 'explicit_invalid_api_key' });
          }

          if (isPerplexityAmbiguousAuth(chatResponse.status)) {
            return sendJson(res, 200, { valid: null, error: 'upstream_auth_ambiguous' });
          }

          return sendJson(res, 200, { valid: true });
        } catch {
          if (searchResponse && isPerplexityExplicitInvalidKey(searchText)) {
            return sendJson(res, 200, { valid: false, error: 'explicit_invalid_api_key' });
          }

          if (searchResponse && isPerplexityAmbiguousAuth(searchResponse.status)) {
            return sendJson(res, 200, { valid: null, error: 'upstream_auth_ambiguous' });
          }

          return sendJson(res, 200, { valid: null, error: 'upstream_unreachable' });
        }
      }

      if (path === '/pplx/search') {
        const query = typeof body.query === 'string' ? body.query.trim() : '';
        if (!query) {
          return sendJson(res, 400, { error: 'missing_query' });
        }

        const maxResultsRaw = Number(body.max_results);
        const maxResults = Number.isFinite(maxResultsRaw)
          ? Math.min(20, Math.max(1, Math.floor(maxResultsRaw)))
          : 10;
        const maxTokensPerPageRaw = Number(body.max_tokens_per_page);
        const maxTokensPerPage = Number.isFinite(maxTokensPerPageRaw)
          ? Math.min(8192, Math.max(128, Math.floor(maxTokensPerPageRaw)))
          : 2048;
        const country =
          typeof body.country === 'string' && /^[A-Za-z]{2}$/.test(body.country.trim())
            ? body.country.trim().toUpperCase()
            : undefined;

        try {
          const searchPayload: Record<string, unknown> = {
            query,
            max_results: maxResults,
            max_tokens_per_page: maxTokensPerPage
          };
          if (country) {
            searchPayload.country = country;
          }

          const upstreamResponse = await fetch(PERPLEXITY_SEARCH_API_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(searchPayload)
          });

          const upstreamText = await upstreamResponse.text();
          const upstreamContentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';
          return sendRaw(res, upstreamResponse.status, upstreamContentType, upstreamText);
        } catch {
          return sendJson(res, 502, { error: 'upstream_unreachable' });
        }
      }

      if (path === '/pplx/chat') {
        const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : null;
        if (!payload) {
          return sendJson(res, 400, { error: 'missing_payload' });
        }

        try {
          const upstreamResponse = await fetch(PERPLEXITY_CHAT_API_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const upstreamText = await upstreamResponse.text();
          const upstreamContentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';
          return sendRaw(res, upstreamResponse.status, upstreamContentType, upstreamText);
        } catch {
          return sendJson(res, 502, { error: 'upstream_unreachable' });
        }
      }

      if (path === '/llm/chat') {
        const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : null;

        if (!payload) {
          return sendJson(res, 400, { error: 'missing_payload' });
        }

        let upstreamUrl = '';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }

        if (provider === 'openrouter') {
          upstreamUrl = OPENROUTER_CHAT_API_URL;
          if (req.headers.origin && typeof req.headers.origin === 'string') {
            headers['HTTP-Referer'] = req.headers.origin;
          }
          headers['X-Title'] = 'AI Podcast Generator';
        } else if (provider === 'ollama') {
          const baseUrl = ollamaBaseUrl;
          if (!/^https?:\/\//i.test(baseUrl)) {
            return sendJson(res, 400, { error: 'invalid_base_url' });
          }
          upstreamUrl = `${baseUrl}/api/chat`;
          
          const payloadRecord = payload as Record<string, any>;
          let ollamaPayload: Record<string, any> = {
            model: payloadRecord.model,
            messages: payloadRecord.messages,
            stream: false,
            options: {}
          };
          if (payloadRecord.max_tokens) {
            ollamaPayload.options.num_predict = payloadRecord.max_tokens;
          }
          if (payloadRecord.temperature !== undefined) {
            ollamaPayload.options.temperature = payloadRecord.temperature;
          }
          
          try {
            const upstreamResponse = await fetch(upstreamUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(ollamaPayload)
            });

            let upstreamText = await upstreamResponse.text();
            if (upstreamResponse.ok) {
              try {
                const parsed = JSON.parse(upstreamText);
                if (parsed.message) {
                  const compatResponse = {
                    choices: [{ message: parsed.message }]
                  };
                  upstreamText = JSON.stringify(compatResponse);
                }
              } catch {
                // Ignore parse errors
              }
            }
            
            const upstreamContentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';
            return sendRaw(res, upstreamResponse.status, upstreamContentType, upstreamText);
          } catch {
            return sendJson(res, 502, { error: 'upstream_unreachable' });
          }
        } else {
          return sendJson(res, 400, { error: 'unsupported_provider' });
        }

        if (provider === 'openrouter') {
          try {
            const upstreamResponse = await fetch(upstreamUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload)
            });

            const upstreamText = await upstreamResponse.text();
            const upstreamContentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';
            return sendRaw(res, upstreamResponse.status, upstreamContentType, upstreamText);
          } catch {
            return sendJson(res, 502, { error: 'upstream_unreachable' });
          }
        }
      }

      if (path === '/gemini/validate') {
        try {
          const upstreamResponse = await fetch(GEMINI_MODELS_API_URL, {
            method: 'GET',
            headers: {
              'x-goog-api-key': apiKey
            }
          });
          const upstreamText = await upstreamResponse.text();

          if (upstreamResponse.ok) {
            return sendJson(res, 200, { valid: true });
          }
          if (isGeminiInvalidKey(upstreamResponse.status, upstreamText)) {
            return sendJson(res, 200, { valid: false });
          }
          return sendJson(res, 200, { valid: true });
        } catch {
          return sendJson(res, 502, { valid: false, error: 'upstream_unreachable' });
        }
      }

      if (path === '/gemini/generate') {
        const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : null;
        const payloadRecord = payload as Record<string, any>;
        if (!payloadRecord || typeof payloadRecord.requestBody !== 'object' || payloadRecord.requestBody === null) {
          return sendJson(res, 400, { error: 'missing_payload' });
        }

        const model =
          typeof payloadRecord.model === 'string' && payloadRecord.model.trim().length > 0
            ? payloadRecord.model.trim()
            : 'gemini-1.5-flash-latest';
        const modelCandidates = Array.from(
          new Set([model, 'gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash'])
        );

        try {
          for (let i = 0; i < modelCandidates.length; i++) {
            const candidateModel = modelCandidates[i];
            const upstreamResponse = await fetch(
              `${GEMINI_BASE_API_URL}/${encodeURIComponent(candidateModel)}:generateContent`,
              {
                method: 'POST',
                headers: {
                  'x-goog-api-key': apiKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(payloadRecord.requestBody)
              }
            );

            const upstreamText = await upstreamResponse.text();
            const isQuotaExceeded =
              upstreamResponse.status === 429 &&
              /quota|resource_exhausted|too many requests/i.test(upstreamText);

            if ((upstreamResponse.status === 404 || isQuotaExceeded) && i < modelCandidates.length - 1) {
              continue;
            }

            const upstreamContentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';
            return sendRaw(res, upstreamResponse.status, upstreamContentType, upstreamText);
          }

          return sendJson(res, 502, { error: 'upstream_unreachable' });
        } catch {
          return sendJson(res, 502, { error: 'upstream_unreachable' });
        }
      }

      if (path === '/openai/validate') {
        try {
          const upstreamResponse = await fetch(OPENAI_MODELS_API_URL, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          });

          if (upstreamResponse.ok) {
            return sendJson(res, 200, { valid: true });
          }
          if (upstreamResponse.status === 401) {
            return sendJson(res, 200, { valid: false });
          }
          return sendJson(res, 200, { valid: true });
        } catch {
          return sendJson(res, 502, { valid: false, error: 'upstream_unreachable' });
        }
      }

      if (path === '/openai/speech') {
        const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : null;
        const payloadRecord = payload as Record<string, any>;
        if (!payloadRecord || typeof payloadRecord.input !== 'string' || payloadRecord.input.trim().length === 0) {
          return sendJson(res, 400, { error: 'missing_payload' });
        }

        try {
          const upstreamResponse = await fetch(OPENAI_SPEECH_API_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const arrayBuffer = await upstreamResponse.arrayBuffer();
          const upstreamContentType = upstreamResponse.headers.get('content-type') || 'audio/mpeg';
          return sendRaw(res, upstreamResponse.status, upstreamContentType, new Uint8Array(arrayBuffer));
        } catch {
          return sendJson(res, 502, { error: 'upstream_unreachable' });
        }
      }

      if (path === '/openrouter/validate') {
        try {
          const upstreamResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          });

          if (upstreamResponse.ok) {
            return sendJson(res, 200, { valid: true });
          }
          if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
            return sendJson(res, 200, { valid: false });
          }
          return sendJson(res, 200, { valid: true });
        } catch {
          return sendJson(res, 502, { valid: false, error: 'upstream_unreachable' });
        }
      }

      if (path === '/ollama/validate') {
        try {
          // Send request to Ollama tags endpoint to check connectivity
          const headers: Record<string, string> = {};
          if (apiKey && !isLocalOllamaBaseUrl(ollamaBaseUrl)) {
            headers.Authorization = `Bearer ${apiKey}`;
          }
          
          const upstreamResponse = await fetch(`${ollamaBaseUrl}/api/tags`, {
            method: 'GET',
            headers
          });

          if (upstreamResponse.ok) {
            return sendJson(res, 200, { valid: true });
          }
          if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
            return sendJson(res, 200, { valid: false });
          }
          return sendJson(res, 200, { valid: true });
        } catch {
          return sendJson(res, 502, { valid: false, error: 'upstream_unreachable' });
        }
      }

      if (path === '/ollama/models') {
        try {
          const headers: Record<string, string> = {};
          if (apiKey && !isLocalOllamaBaseUrl(ollamaBaseUrl)) {
            headers.Authorization = `Bearer ${apiKey}`;
          }

          const upstreamResponse = await fetch(`${ollamaBaseUrl}/api/tags`, {
            method: 'GET',
            headers
          });

          const text = await upstreamResponse.text();
          if (!upstreamResponse.ok) {
            return sendJson(res, upstreamResponse.status, {
              error: 'upstream_error',
              details: text.slice(0, 240)
            });
          }

          const data = JSON.parse(text || '{}') as { models?: Array<{ name?: string; model?: string } | string> };
          const models = Array.isArray(data.models)
            ? data.models
                .map((item) => {
                  if (typeof item === 'string') return item;
                  if (typeof item?.name === 'string') return item.name;
                  if (typeof item?.model === 'string') return item.model;
                  return '';
                })
                .filter((value) => value.length > 0)
            : [];

          return sendJson(res, 200, { models });
        } catch {
          return sendJson(res, 502, { error: 'upstream_unreachable' });
        }
      }

      return next();
    });
  }
});

export default defineConfig({
  plugins: [react(), providerProxyMiddlewarePlugin()],
  cacheDir: './.vite',
  server: {
    port: 3000
  }
});
