const PERPLEXITY_SEARCH_API_URL = 'https://api.perplexity.ai/search';
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

  let searchResponse = null;
  let searchText = '';

  try {
    searchResponse = await testSearch();
    searchText = await searchResponse.text();
  } catch {
    searchResponse = null;
  }

  if (searchResponse && searchResponse.ok) {
    return res.status(200).json({ valid: true });
  }

  if (searchResponse && isExplicitInvalidKey(searchText)) {
    return res.status(200).json({ valid: false, error: 'explicit_invalid_api_key' });
  }

  if (searchResponse && !isAmbiguousAuth(searchResponse.status)) {
    // Non-auth errors (rate limit, plan limits, transient upstream issues)
    // still indicate the key was accepted by the auth layer.
    return res.status(200).json({ valid: true });
  }

  try {
    const chatResponse = await testChat();
    const chatText = await chatResponse.text();

    if (chatResponse.ok) {
      return res.status(200).json({ valid: true });
    }

    if (isExplicitInvalidKey(chatText)) {
      return res.status(200).json({ valid: false, error: 'explicit_invalid_api_key' });
    }

    if (isAmbiguousAuth(chatResponse.status)) {
      return res.status(200).json({ valid: null, error: 'upstream_auth_ambiguous' });
    }

    return res.status(200).json({ valid: true });
  } catch {
    if (searchResponse && isExplicitInvalidKey(searchText)) {
      return res.status(200).json({ valid: false, error: 'explicit_invalid_api_key' });
    }

    if (searchResponse && isAmbiguousAuth(searchResponse.status)) {
      return res.status(200).json({ valid: null, error: 'upstream_auth_ambiguous' });
    }

    return res.status(200).json({ valid: null, error: 'upstream_unreachable' });
  }
}

module.exports = handler;
