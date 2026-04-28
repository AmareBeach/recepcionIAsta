exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body   = JSON.parse(event.body);
    const repo   = process.env.GITHUB_REPO;
    const file   = process.env.GITHUB_FILE;
    const token  = process.env.GITHUB_TOKEN;
    const apiURL = `https://api.github.com/repos/${repo}/contents/${file}`;

    // Load KB from GitHub
    let kbContext = '';
    try {
      const res = await fetch(apiURL, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const docs = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
        if (docs.length > 0) {
          const chunks = docs.map(d => `--- [${d.name}] ---\n${(d.content || '').slice(0, 8000)}`);
          kbContext = '\n\n=== BASE DE CONOCIMIENTO ===\n' + chunks.join('\n\n') + '\n=== FIN ===';
        }
      }
    } catch(e) { /* KB not available, continue without it */ }

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
