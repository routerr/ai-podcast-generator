const OPENAI_MODELS_API_URL = 'https://api.openai.com/v1/models';
const MAX_API_KEY_LENGTH = 512;

const normalizeBearerApiKey = (key) => key.trim().replace(/^Bearer\s+/i, '');

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

  if (!apiKey || apiKey.length <= 10 || apiKey.length > MAX_API_KEY_LENGTH) {
    return res.status(400).json({ valid: false, error: 'missing_or_invalid_api_key' });
  }

  try {
    const upstreamResponse = await fetch(OPENAI_MODELS_API_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (upstreamResponse.ok) {
      return res.status(200).json({ valid: true });
    }

    if (upstreamResponse.status === 401) {
      return res.status(200).json({ valid: false });
    }

    return res.status(200).json({ valid: true });
  } catch {
    return res.status(502).json({ valid: false, error: 'upstream_unreachable' });
  }
}

module.exports = handler;
