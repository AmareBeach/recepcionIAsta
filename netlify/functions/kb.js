const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // Load all KB docs from Blobs
    const store = getStore({
      name: 'knowledge-base',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN
    });

    const { blobs } = await store.list();
    let kbContext = '';
    if (blobs.length > 0) {
      const docs = await Promise.all(
        blobs.map(async (b) => {
          const content = await store.get(b.key);
          return `--- [${b.key}] ---\n${(content || '').slice(0, 8000)}`;
        })
      );
      kbContext = '\n\n=== BASE DE CONOCIMIENTO ===\n' + docs.join('\n\n') + '\n=== FIN ===';
    }

    const systemPrompt = (body.system || '') + kbContext;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: body.max_tokens || 1000,
        system: systemPrompt,
        messages: body.messages || []
      })
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
