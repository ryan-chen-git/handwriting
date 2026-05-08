import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Collect all blob URLs
    const blobs = [];
    let cursor = undefined;

    do {
      const result = await list({ prefix: 'samples/', cursor, limit: 1000 });
      for (const blob of result.blobs) {
        blobs.push({ pathname: blob.pathname, url: blob.url });
      }
      cursor = result.cursor;
    } while (cursor);

    // Fetch all sample contents
    const samples = [];
    for (const blob of blobs) {
      try {
        const resp = await fetch(blob.url);
        const data = await resp.json();
        const entry = {
          char: data.char,
          strokes: data.strokes,
          source_id: data.source_id,
        };
        if (data.tag) entry.tag = data.tag;
        if (data.canvas) entry.canvas = data.canvas;
        samples.push(entry);
      } catch (e) {
        console.error(`Failed to fetch ${blob.pathname}:`, e);
      }
    }

    return res.status(200).json({ samples, total: samples.length });
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export const config = {
  maxDuration: 60,
};
