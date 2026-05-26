exports.handler = async function (event) {
  const method   = event.httpMethod;
  const repo     = process.env.GITHUB_REPO;
  const file     = process.env.GITHUB_FILE;
  const token    = process.env.GITHUB_TOKEN;
  const apiURL   = `https://api.github.com/repos/${repo}/contents/${file}`;

  console.log('KB function called:', method);
  console.log('GITHUB_REPO:', repo);
  console.log('GITHUB_FILE:', file);
  console.log('GITHUB_TOKEN present:', !!token);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'amare-recepcionista'
  };

  try {
    async function getFile() {
      const res = await fetch(apiURL, { headers });
      console.log('getFile status:', res.status);
      if (res.status === 404) return { docs: [], sha: null };
      const data = await res.json();
      if (data.message) {
        console.log('GitHub error:', data.message);
        throw new Error(data.message);
      }
      const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      return { docs: content, sha: data.sha };
    }

    async function saveFile(docs, sha) {
      const content = Buffer.from(JSON.stringify(docs, null, 2)).toString('base64');
      const body = { message: 'Update knowledge base', content };
      if (sha) body.sha = sha;
      const res = await fetch(apiURL, { method: 'PUT', headers, body: JSON.stringify(body) });
      console.log('saveFile status:', res.status);
      const result = await res.json();
      if (result.message) console.log('saveFile GitHub error:', result.message);
    }

    if (method === 'GET') {
      const { docs } = await getFile();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docs.map(d => ({ name: d.name, content: d.content })))
      };
    }

    if (method === 'POST') {
      const { name, content } = JSON.parse(event.body);
      console.log('Saving doc:', name);
      const { docs, sha } = await getFile();
      const existing = docs.findIndex(d => d.name === name);
      if (existing >= 0) docs[existing].content = content;
      else docs.push({ name, content });
      await saveFile(docs, sha);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (method === 'DELETE') {
      const { name } = JSON.parse(event.body);
      console.log('Deleting doc:', name);
      const { docs, sha } = await getFile();
      const filtered = docs.filter(d => d.name !== name);
      await saveFile(filtered, sha);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (err) {
    console.log('ERROR:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
