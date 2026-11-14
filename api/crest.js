'use strict';

/**
 * /api/crest?id=<football-data crest id> — same-origin copy of a club crest.
 *
 * The poster is drawn on a canvas to copy/save it as an image; a canvas that drew a cross-origin picture
 * without CORS headers can't be exported, so the crests are served from our own origin. Only the crest ids
 * the page offers are allowed, so this is not an open proxy.
 */

const { send } = require('./_lib/http');

const ALLOWED = new Set([66, 65, 64, 57, 61, 73, 86, 81, 78, 5, 4, 109, 98, 108, 113, 524]);

async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: { code: 'method_not_allowed' } }, { Allow: 'GET' });
  const id = Number(new URL(req.url, 'http://x').searchParams.get('id'));
  if (!ALLOWED.has(id)) return send(res, 404, { error: { code: 'not_found' } });
  try {
    const upstream = await fetch(`https://crests.football-data.org/${id}.png`, { signal: AbortSignal.timeout(6000) });
    if (!upstream.ok || !/^image\//.test(upstream.headers.get('content-type') || '')) throw new Error(`upstream ${upstream.status}`);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', upstream.headers.get('content-type'));
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(bytes);
  } catch (err) {
    console.error('[crest] upstream error:', err && err.message);
    return send(res, 502, { error: { code: 'crest_error' } });
  }
}

module.exports = handler;
