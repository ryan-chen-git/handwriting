import { list } from '@vercel/blob';

export const config = { maxDuration: 30 };

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
    const char = req.query.char;
    const tag = req.query.tag || null;

    if (!char) {
      return res.status(400).json({ error: 'Missing char query parameter' });
    }

    // Build safe name prefix to filter blobs
    let safeName;
    if (/^[a-z]$/.test(char)) safeName = char;
    else if (/^[A-Z]$/.test(char)) safeName = 'upper_' + char;
    else if (/^[0-9]$/.test(char)) safeName = char;
    else safeName = 'u' + char.charCodeAt(0).toString(16).padStart(4, '0');

    if (tag) {
      safeName = `${tag}_${safeName}`;
    }

    const prefix = `samples/${safeName}_`;

    const samples = [];
    let cursor = undefined;

    do {
      const result = await list({ prefix, cursor, limit: 1000 });
      for (const blob of result.blobs) {
        const resp = await fetch(blob.url);
        const data = await resp.json();
        samples.push({
          source_id: data.source_id,
          char: data.char,
          tag: data.tag || null,
          strokes: data.strokes,
          timestamp: data.timestamp,
          url: blob.url,
          pathname: blob.pathname,
        });
      }
      cursor = result.cursor;
    } while (cursor);

    samples.sort((a, b) => a.source_id.localeCompare(b.source_id));

    return res.status(200).json({ char, tag, samples, count: samples.length });
  } catch (err) {
    console.error('List-char error:', err);
    return res.status(500).json({ error: err.message });
  }
}
