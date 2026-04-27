import { list, del } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let deleted = 0;
    let cursor = undefined;

    do {
      const result = await list({ prefix: 'samples/', cursor, limit: 1000 });
      if (result.blobs.length > 0) {
        await del(result.blobs.map(b => b.url));
        deleted += result.blobs.length;
      }
      cursor = result.cursor;
    } while (cursor);

    return res.status(200).json({ ok: true, deleted });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: err.message });
  }
}
