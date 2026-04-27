import { del, list } from '@vercel/blob';

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
    const { source_id } = req.body;

    if (!source_id) {
      return res.status(400).json({ error: 'Missing source_id' });
    }

    const pathname = `samples/${source_id}.json`;

    // Find the blob by pathname
    const result = await list({ prefix: pathname, limit: 1 });
    if (result.blobs.length === 0) {
      return res.status(404).json({ error: `Sample not found: ${source_id}` });
    }

    await del(result.blobs[0].url);

    return res.status(200).json({ ok: true, deleted: source_id });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: err.message });
  }
}
