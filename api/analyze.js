export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Resolve API Key from Vercel environment variables
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    console.error('[Vercel API Proxy] AI_API_KEY environment variable is missing.');
    res.status(500).json({ error: 'Server configuration error: AI_API_KEY is missing.' });
    return;
  }

  try {
    const bodyString = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;

    const response = await fetch('https://gen.ai.kku.ac.th/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: bodyString
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('[Vercel API Proxy] Error during proxy request:', error);
    res.status(500).json({ error: `Internal proxy error: ${error.message}` });
  }
}
