const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  const store = getStore({
    name: 'knowledge-base',
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_TOKEN
  });

  const method = event.httpMethod;

  try {
    if (method === 'GET') {
      const { blobs } = await store.list();
      const docs = await Promise.all(
        blobs.map(async (b) => {
          const content = await store.get(b.key);
          return { name: b.key, content };
        })
      );
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docs)
      };
    }

    if (method === 'POST') {
      const { name, content } = JSON.parse(event.body);
      await store.set(name, content);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (method === 'DELETE') {
      const { name } = JSON.parse(event.body);
      await store.delete(name);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
