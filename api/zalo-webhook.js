'use strict';

/**
 * /api/zalo-webhook — receives Zalo Bot webhook events and answers when the bot
 * is mentioned in a message ("@Bot David Truong help").
 *
 * Verified from the official docs (bot.zapps.me/docs/webhook):
 *  - Zalo POSTs JSON { event_name, message } and sends the secret you registered
 *    with setWebhook in the X-Bot-Api-Secret-Token header (checked here, 403 otherwise).
 *  - message: { message_id, from: { id, display_name, is_bot }, chat: { id, chat_type }, text }.
 *  - Reply target is message.chat.id.
 * NOT documented (so handled defensively): how an @mention is represented (we look for
 * "@<ZALO_BOT_NAME>" in the text), retry/dedupe behaviour (we dedupe by message_id), and
 * group payload examples (set ZALO_WEBHOOK_DEBUG=1 to log the payload shape, never the token).
 *
 * Env: ZALO_BOT_TOKEN (existing), ZALO_WEBHOOK_SECRET (8-256 chars, same as setWebhook),
 * optional ZALO_BOT_NAME, ZALO_BOT_ID, ZALO_SITE_URL, ZALO_CONTACT_INFO, ZALO_WEBHOOK_DEBUG.
 */

const crypto = require('crypto');
const { RequestError, send, readBody } = require('./_lib/http');
const { hitLimit } = require('./_lib/rateLimit');
const { sendText } = require('./_lib/zaloNotify');
const { replyForMessage } = require('./_lib/zaloBot');

const MAX_BODY_BYTES = 32 * 1024;
const DEDUPE = { limit: 1, windowSeconds: 60 * 60 };
const FLOOD = { limit: 30, windowSeconds: 60 };

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();
const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

function secretOk(req) {
  const expected = (process.env.ZALO_WEBHOOK_SECRET || '').trim();
  const given = String(req.headers['x-bot-api-secret-token'] || '').trim();
  return Boolean(expected && given && crypto.timingSafeEqual(sha(given), sha(expected)));
}

/** Decides what to do with an event. Returns { chatId, text } to send, or null to ignore. */
async function handleEvent(event, deps = {}) {
  const dedupe = deps.dedupe || ((id) => hitLimit('zalo-event', id, DEDUPE));
  const message = event && event.message;
  if (!event || event.event_name !== 'message.text.received' || !message || typeof message !== 'object') return null;

  const text = str(message.text, 1000);
  const chatId = str(message.chat && message.chat.id, 100);
  const messageId = str(message.message_id, 100);
  if (!text || !chatId || !messageId) return null;

  // Never answer bots (including ourselves) to avoid reply loops.
  const botId = (process.env.ZALO_BOT_ID || '').trim();
  const from = message.from || {};
  if (from.is_bot === true || (botId && str(from.id) === botId)) return null;

  const reply = replyForMessage(message);
  if (!reply) return null;

  // Only now burn the dedupe slot, so ignored messages cost nothing.
  const first = await dedupe(messageId);
  if (!first.allowed) return null;
  return { chatId, text: reply };
}

async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    if (!secretOk(req)) return send(res, 403, { message: 'Unauthorized' });

    const flood = await hitLimit('zalo-flood', 'webhook', FLOOD);
    if (!flood.allowed) return send(res, 200, { ok: true });

    const event = await readBody(req, MAX_BODY_BYTES);
    if (process.env.ZALO_WEBHOOK_DEBUG === '1' && event && typeof event === 'object') {
      const m = event.message || {};
      // Shape only: field names and chat type, no message content or ids.
      console.log('[zalo-webhook] event', event.event_name, 'keys:', Object.keys(m).join(','), 'chat_type:', m.chat && m.chat.chat_type, 'is_bot:', m.from && m.from.is_bot);
    }

    const action = await handleEvent(event);
    if (action && (process.env.ZALO_BOT_TOKEN || '').trim()) {
      try {
        await sendText(action.text, globalThis.fetch, action.chatId);
      } catch (err) {
        console.error('[zalo-webhook] reply failed:', err && err.name === 'AbortError' ? 'timeout' : 'network error');
      }
    }
    // Always 2xx for authenticated events so Zalo does not treat us as down.
    return send(res, 200, { ok: true });
  } catch (err) {
    if (err instanceof RequestError) return send(res, err.status, { error: err.code });
    console.error('[zalo-webhook] unexpected error');
    return send(res, 200, { ok: true });
  }
}

module.exports = handler;
module.exports.handleEvent = handleEvent;
