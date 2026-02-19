const OPENROUTER_CHAT_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_API_KEY_LENGTH = 512;

const normalizeWrapping = (value) => {
  let normalized = String(value || '').trim();

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

const normalizeBearerApiKey = (key) =>
  normalizeWrapping(key)
    .replace(/^Bearer\s+/i, '')
    .replace(/\s+/g, '');

const normalizeBaseUrl = (value) =>
  normalizeWrapping(value)
    .replace(/\/+$/, '');

const isLocalOllamaBaseUrl = (value) => {
  const normalized = normalizeBaseUrl(value || 'https://api.ollama.com');
  try {
    const parsed = new URL(normalized);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const parseBody = (req) => {
  if (!req || !req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  if (typeof req.body === 'object') {
    return req.body;
  }

  return {};
};

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const provider = typeof body.provider === 'string' ? body.provider : '';
  const rawApiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
  const apiKey = normalizeBearerApiKey(rawApiKey);
  const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : null;
  const rawBaseUrl = typeof body.baseUrl === 'string' ? normalizeBaseUrl(body.baseUrl) : '';
  const ollamaBaseUrl = rawBaseUrl || 'https://api.ollama.com';
  const allowAnonymousOllama = provider === 'ollama' && isLocalOllamaBaseUrl(ollamaBaseUrl);

  if (!allowAnonymousOllama && (!apiKey || apiKey.length <= 10 || apiKey.length > MAX_API_KEY_LENGTH)) {
    return res.status(400).json({ error: 'missing_or_invalid_api_key' });
  }

  if (!payload) {
    return res.status(400).json({ error: 'missing_payload' });
  }

  let upstreamUrl = '';
  const headers = {
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
      return res.status(400).json({ error: 'invalid_base_url' });
    }

    upstreamUrl = `${baseUrl}/v1/chat/completions`;
  } else {
    return res.status(400).json({ error: 'unsupported_provider' });
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const upstreamText = await upstreamResponse.text();
    const upstreamContentType =
      upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';

    res.status(upstreamResponse.status);
    res.setHeader('Content-Type', upstreamContentType);
    return res.send(upstreamText);
  } catch {
    return res.status(502).json({ error: 'upstream_unreachable' });
  }
}

module.exports = handler;
