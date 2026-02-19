const OPENAI_SPEECH_API_URL = 'https://api.openai.com/v1/audio/speech';
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
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const rawApiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
  const apiKey = normalizeBearerApiKey(rawApiKey);
  const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : null;

  if (!apiKey || apiKey.length <= 10 || apiKey.length > MAX_API_KEY_LENGTH) {
    return res.status(400).json({ error: 'missing_or_invalid_api_key' });
  }

  if (!payload || typeof payload.input !== 'string' || payload.input.trim().length === 0) {
    return res.status(400).json({ error: 'missing_payload' });
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

    const contentType = upstreamResponse.headers.get('content-type') || 'audio/mpeg';
    const arrayBuffer = await upstreamResponse.arrayBuffer();
    const bodyBuffer = Buffer.from(arrayBuffer);

    res.status(upstreamResponse.status);
    res.setHeader('Content-Type', contentType);
    return res.send(bodyBuffer);
  } catch {
    return res.status(502).json({ error: 'upstream_unreachable' });
  }
}

module.exports = handler;
