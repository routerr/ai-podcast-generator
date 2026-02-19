const PERPLEXITY_CHAT_API_URL = 'https://api.perplexity.ai/chat/completions';
const MAX_PERPLEXITY_API_KEY_LENGTH = 512;

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
  const rawApiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
  const apiKey = normalizeBearerApiKey(rawApiKey);
  const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : null;

  if (!apiKey || apiKey.length <= 10 || apiKey.length > MAX_PERPLEXITY_API_KEY_LENGTH) {
    return res.status(400).json({ error: 'missing_or_invalid_api_key' });
  }

  if (!payload) {
    return res.status(400).json({ error: 'missing_payload' });
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
