import { put } from '@vercel/blob';

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
    const { char, sample_idx, strokes, tag, canvas } = req.body;

    if (!char || strokes === undefined) {
      return res.status(400).json({ error: 'Missing char or strokes' });
    }

    // Build safe filename
    let safeName;
    if (/^[a-z]$/.test(char)) safeName = char;
    else if (/^[A-Z]$/.test(char)) safeName = 'upper_' + char;
    else if (/^[0-9]$/.test(char)) safeName = char;
    else safeName = 'u' + char.charCodeAt(0).toString(16).padStart(4, '0');

    // Prepend tag if present (e.g. "mathvar", "mathdelim")
    if (tag) {
      safeName = `${tag}_${safeName}`;
    }

    const sourceId = `${safeName}_${String(sample_idx).padStart(3, '0')}`;
    const filename = `samples/${sourceId}.json`;

    const data = {
      char,
      strokes,
      source_id: sourceId,
      tag: tag || null,
      canvas: canvas || null,
      timestamp: Date.now(),
    };

    const blob = await put(filename, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });

    return res.status(200).json({ ok: true, url: blob.url, source_id: sourceId });
  } catch (err) {
    console.error('Save error:', err);
    return res.status(500).json({ error: err.message });
  }
}
