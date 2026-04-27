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
    // Progress is keyed by "tag:char" for tagged samples, or just "char" for untagged.
    const progress = {};
    let cursor = undefined;
    let totalFiles = 0;

    do {
      const result = await list({ prefix: 'samples/', cursor, limit: 1000 });
      for (const blob of result.blobs) {
        const name = blob.pathname.replace('samples/', '').replace('.json', '');
        const parts = name.split('_');

        // Detect tag prefix: known tags are "mathvar" and "mathdelim"
        let tag = null;
        let charParts = parts;
        if (parts[0] === 'mathvar' || parts[0] === 'mathdelim') {
          tag = parts[0];
          charParts = parts.slice(1);
        }

        // Reconstruct the character from the safe name
        let char;
        if (charParts[0] === 'upper') {
          char = charParts[1]; // uppercase letter
        } else if (charParts[0].startsWith('u') && charParts[0].length === 5) {
          char = String.fromCharCode(parseInt(charParts[0].slice(1), 16));
        } else {
          char = charParts[0]; // lowercase letter or digit
        }

        // Key includes tag for differentiation
        const key = tag ? `${tag}:${char}` : char;
        progress[key] = (progress[key] || 0) + 1;
        totalFiles++;
      }
      cursor = result.cursor;
    } while (cursor);

    return res.status(200).json({ progress, totalFiles });
  } catch (err) {
    console.error('Progress error:', err);
    return res.status(500).json({ error: err.message });
  }
}
