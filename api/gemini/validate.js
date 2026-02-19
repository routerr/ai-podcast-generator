const GEMINI_MODELS_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_API_KEY_LENGTH = 512;

const normalizeApiKey = (key) => key.trim();

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

const isInvalidGeminiKey = (status, responseText) => {
  if (status === 400 || status === 401 || status === 403) {
    return /api[_\s-]?key[_\s-]?invalid|api key not valid|permission denied|request had invalid authentication credentials/i.test(
      responseText
    );
  }

  return false;
};

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ valid: false, error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const rawApiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
  const apiKey = normalizeApiKey(rawApiKey);

  if (!apiKey || apiKey.length <= 10 || apiKey.length > MAX_API_KEY_LENGTH) {
    return res.status(400).json({ valid: false, error: 'missing_or_invalid_api_key' });
  }

  try {
    const upstreamResponse = await fetch(GEMINI_MODELS_API_URL, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    const upstreamText = await upstreamResponse.text();

    if (upstreamResponse.ok) {
      return res.status(200).json({ valid: true });
    }

    if (isInvalidGeminiKey(upstreamResponse.status, upstreamText)) {
      return res.status(200).json({ valid: false });
    }

    // Non-auth failures still indicate key format/auth pipeline is accepted.
    return res.status(200).json({ valid: true });
  } catch {
    return res.status(502).json({ valid: false, error: 'upstream_unreachable' });
  }
}

module.exports = handler;
