const PERPLEXITY_SEARCH_API_URL = 'https://api.perplexity.ai/search';
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

const parseBoundedNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)));
};

const normalizeCountryCode = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!/^[A-Za-z]{2}$/.test(trimmed)) {
    return null;
  }

  return trimmed.toUpperCase();
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
  const query = typeof body.query === 'string' ? body.query.trim() : '';

  if (!apiKey || apiKey.length <= 10 || apiKey.length > MAX_PERPLEXITY_API_KEY_LENGTH) {
    return res.status(400).json({ error: 'missing_or_invalid_api_key' });
  }

  if (!query) {
    return res.status(400).json({ error: 'missing_query' });
  }

  const maxResults = parseBoundedNumber(body.max_results, 10, 1, 20);
  const maxTokensPerPage = parseBoundedNumber(body.max_tokens_per_page, 2048, 128, 8192);
  const country = normalizeCountryCode(body.country);

  try {
    const requestPayload = {
      query,
      max_results: maxResults,
      max_tokens_per_page: maxTokensPerPage
    };
    if (country) {
      requestPayload.country = country;
    }

    const upstreamResponse = await fetch(PERPLEXITY_SEARCH_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
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
