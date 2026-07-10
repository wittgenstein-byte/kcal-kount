const UPSTREAM_URL = 'https://gen.ai.kku.ac.th/api/v1/chat/completions';
const UPSTREAM_TIMEOUT_MS = 25000;

function jsonResponse(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    jsonResponse(res, 405, { error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.AI_API_KEY || '';
  if (!apiKey) {
    jsonResponse(res, 500, {
      error: 'AI_API_KEY is not configured on the server. Add it to your Vercel environment variables.'
    });
    return;
  }

  if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
    jsonResponse(res, 400, { error: 'Empty request body' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      signal: controller.signal
    });

    const responseBody = await upstream.text();
    res
      .status(upstream.status)
      .setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.end(responseBody);
  } catch (error) {
    if (error.name === 'AbortError') {
      jsonResponse(res, 504, { error: 'Upstream request timed out' });
    } else {
      jsonResponse(res, 502, { error: `Upstream request failed: ${error.message}` });
    }
  } finally {
    clearTimeout(timer);
  }
};
