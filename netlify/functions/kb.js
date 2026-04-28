exports.handler = async function (event) {
  const method = event.httpMethod;
  const repo   = process.env.GITHUB_REPO;
  const file   = process.env.GITHUB_FILE;
  const token  = process.env.GITHUB_TOKEN;
  const apiURL = `https://api.github.com/repos/${repo}/contents/${file}`;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  try {
    // Helper: get current file + sha
    async function getFile() {
      const res = await fetch(apiURL, { headers });
      if (res.status === 404) return { docs: [], sha: null };
      const data = await res.json();
      const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      return { docs: content, sha: data.sha };
    }

    // Helper: save file
    async function saveFile(docs, sha) {
      const content = Buffer.from(JSON.stringify(docs, null, 2)).toString('base64');
      const body = { message: 'Update knowledge base', content };
      if (sha) body.sha = sha;
      await fetch(apiURL, { method: 'PUT', headers, body: JSON.stringify(body) });
    }

    // GET — return all docs
    if (method === 'GET') {
      const { docs } = await getFile();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docs.map(d => ({ name: d.name, content: d.content })))
      };
    }

    // POST — add a doc
    if (method === 'POST') {
      const { name, content } = JSON.parse(event.body);
      const { docs, sha } = await getFile();
      const existing = docs.findIndex(d => d.name === name);
      if (existing >= 0) docs[existing].content = content;
      else docs.push({ name, content });
      await saveFile(docs, sha);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // DELETE — remove a doc
    if (method === 'DELETE') {
      const { name } = JSON.parse(event.body);
      const { docs, sha } = await getFile();
      const filtered = docs.filter(d => d.name !== name);
      await saveFile(filtered, sha);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
