'use strict';

/**
 * /api/giphy?q=<text>&offset=<n> — GIF search for profile photos and club logos.
 *
 * The Giphy API key stays on the server (GIPHY_API_KEY). Only GIF ids come back; the browser builds the
 * media.giphy.com URLs itself, so the response stays tiny. Without a key the endpoint answers 501 and the
 * page falls back to "paste a Giphy link".
 */

const { RequestError, send, getClientIp, isAllowedOrigin } = require('./_lib/http');
const { hitLimit } = require('./_lib/rateLimit');

const PAGE_SIZE = 18;
const MAX_OFFSET = 180;
const SEARCH_LIMIT = { limit: 60, windowSeconds: 10 * 60 };
const GIF_ID = /^[A-Za-z0-9]{3,40}$/;

const MESSAGES = {
  method_not_allowed: 'Method not allowed.',
  forbidden_origin: 'Requests from this origin are not allowed.',
  not_configured: 'GIF search is not set up on this deployment (GIPHY_API_KEY is missing).',
  rate_limited: 'Too many searches. Please wait a moment.',
  giphy_error: 'Giphy did not answer. Please try again.',
};

function sendError(res, status, code, headers) {
  send(res, status, { error: { code, message: MESSAGES[code] || MESSAGES.giphy_error } }, headers);
}

async function handler(req, res) {
  try {
    if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed', { Allow: 'GET' });
    if (!isAllowedOrigin(req)) throw new RequestError(403, 'forbidden_origin');
    const key = process.env.GIPHY_API_KEY;
    if (!key) throw new RequestError(501, 'not_configured');

    const params = new URL(req.url, 'http://x').searchParams;
    const q = (params.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const offset = Math.min(Math.max(parseInt(params.get('offset') || '0', 10) || 0, 0), MAX_OFFSET);

    const limit = await hitLimit('giphy', getClientIp(req), SEARCH_LIMIT);
    if (!limit.allowed) throw Object.assign(new RequestError(429, 'rate_limited'), { retryAfter: limit.retryAfter });

    const api = new URL(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}`);
    api.searchParams.set('api_key', key);
    api.searchParams.set('limit', String(PAGE_SIZE));
    api.searchParams.set('offset', String(offset));
    api.searchParams.set('rating', 'g');
    if (q) api.searchParams.set('q', q);

    let data;
    try {
      const response = await fetch(api, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(`giphy ${response.status}`);
      data = await response.json();
    } catch (err) {
      console.error('[giphy] upstream error:', err && err.message);
      throw new RequestError(502, 'giphy_error');
    }
    const results = (Array.isArray(data.data) ? data.data : [])
      .filter((g) => g && GIF_ID.test(String(g.id)))
      .map((g) => ({ id: String(g.id), title: String(g.title || '').slice(0, 80) }));
    const total = (data.pagination && data.pagination.total_count) || 0;
    return send(res, 200, { results, hasMore: offset + PAGE_SIZE < Math.min(total, MAX_OFFSET + PAGE_SIZE) });
  } catch (err) {
    if (err instanceof RequestError) {
      return sendError(res, err.status, err.code, err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : undefined);
    }
    console.error('[giphy] unexpected error:', err);
    return sendError(res, 500, 'giphy_error');
  }
}

module.exports = handler;
