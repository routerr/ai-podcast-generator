const GEMINI_BASE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-1.5-flash-latest';
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

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const rawApiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
  const apiKey = normalizeApiKey(rawApiKey);
  const payload = typeof body.payload === 'object' && body.payload !== null ? body.payload : null;

  if (!apiKey || apiKey.length <= 10 || apiKey.length > MAX_API_KEY_LENGTH) {
    return res.status(400).json({ error: 'missing_or_invalid_api_key' });
  }

  if (!payload || typeof payload.requestBody !== 'object' || payload.requestBody === null) {
    return res.status(400).json({ error: 'missing_payload' });
  }

  const model =
    typeof payload.model === 'string' && payload.model.trim().length > 0
      ? payload.model.trim()
      : DEFAULT_MODEL;
  const modelCandidates = Array.from(
    new Set([model, DEFAULT_MODEL, 'gemini-1.5-flash', 'gemini-2.0-flash'])
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
          body: JSON.stringify(payload.requestBody)
        }
      );

      const upstreamText = await upstreamResponse.text();
      const isQuotaExceeded =
        upstreamResponse.status === 429 &&
        /quota|resource_exhausted|too many requests/i.test(upstreamText);

      if ((upstreamResponse.status === 404 || isQuotaExceeded) && i < modelCandidates.length - 1) {
        continue;
      }
      const upstreamContentType =
        upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';

      res.status(upstreamResponse.status);
      res.setHeader('Content-Type', upstreamContentType);
      return res.send(upstreamText);
    }

    return res.status(502).json({ error: 'upstream_unreachable' });
  } catch {
    return res.status(502).json({ error: 'upstream_unreachable' });
  }
}

module.exports = handler;
