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

const isExplicitInvalidKey = (responseText) =>
  /invalid[_\s-]?api[_\s-]?key|invalid[_\s-]?token|incorrect[_\s-]?api[_\s-]?key|api[_\s-]?key\s+is\s+invalid|api[_\s-]?key\s+not\s+valid|invalid authentication credentials/i.test(
    responseText
  );

const isAmbiguousAuth = (status) => status === 401 || status === 403;

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
    return res.status(405).json({ valid: false, error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const rawApiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
  const apiKey = normalizeBearerApiKey(rawApiKey);

  if (!apiKey || apiKey.length <= 10 || apiKey.length > MAX_PERPLEXITY_API_KEY_LENGTH) {
    return res.status(400).json({ valid: false, error: 'missing_or_invalid_api_key' });
  }

  // Validate using Chat API only. The Search API (/search) requires a
  // separate plan and reliably returns 401 even for valid keys, making it
  // unsuitable as the primary validation signal.
  try {
    const chatResponse = await fetch(PERPLEXITY_CHAT_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        max_tokens: 16
      })
    });
    const chatText = await chatResponse.text();

    if (chatResponse.ok) {
      return res.status(200).json({ valid: true });
    }

    if (isExplicitInvalidKey(chatText)) {
      return res.status(200).json({ valid: false, error: 'explicit_invalid_api_key' });
    }

    // Non-auth errors (429 rate limit, 500 server error, etc.) still
    // indicate the key passed the auth layer — treat as valid.
    if (!isAmbiguousAuth(chatResponse.status)) {
      return res.status(200).json({ valid: true });
    }

    // 401/403 without an explicit "invalid key" message is ambiguous
    // (WAF, plan restrictions, transient upstream issues).
    return res.status(200).json({ valid: null, error: 'upstream_auth_ambiguous' });
  } catch {
    return res.status(200).json({ valid: null, error: 'upstream_unreachable' });
  }
}

module.exports = handler;
