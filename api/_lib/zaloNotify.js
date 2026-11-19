'use strict';

/**
 * Zalo Bot notifications for match (lịch đá) create / delete.
 *
 * Called by /api/soccer right AFTER the new state was durably saved, so the
 * message is only sent for changes that really persisted. The bot token and
 * chat id are server-side env vars (ZALO_BOT_TOKEN, ZALO_GROUP_CHAT_ID) and
 * are never returned to the client or logged. There is no public endpoint:
 * the only way to trigger a message is a successful, validated save.
 *
 * Duplicates: a message is produced from the diff between the stored state and
 * the new state, and the save is version-checked, so a replayed/conflicting
 * request produces no diff and therefore no message.
 * Failures (missing config, bad token, timeout) are logged without secrets and
 * never affect the save.
 */

const API_BASE = 'https://bot-api.zaloplatforms.com';
const TIMEOUT_MS = 4000;
const MAX_MESSAGES_PER_SAVE = 5;

const enabled = () => Boolean((process.env.ZALO_BOT_TOKEN || '').trim() && (process.env.ZALO_GROUP_CHAT_ID || '').trim());

/** "2026-11-20T19:30" -> { date: "20/11/2026", time: "19:30" } */
function formatWhen(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(String(value || ''));
  return m ? { date: `${m[3]}/${m[2]}/${m[1]}`, time: m[4] || '' } : { date: String(value || ''), time: '' };
}

function buildMessage(kind, match) {
  const { date, time } = formatWhen(match.date);
  const created = kind === 'created';
  return [
    created ? '⚽🟢 LỊCH ĐÁ MỚI' : '⚽🔴 ĐÃ HỦY LỊCH ĐÁ',
    '━━━━━━━━━━━━━━',
    `📅 ${date}${time ? `  •  🕘 ${time}` : ''}`,
    match.location ? `🏟️ ${match.location}` : null,
    match.address ? `📍 ${match.address}` : null,
    match.mapUrl ? `🗺️ ${match.mapUrl}` : null,
    match.note ? `📝 ${match.note}` : null,
    '━━━━━━━━━━━━━━',
    created ? '✅ Đã tạo thành công — anh em nhớ điểm danh nhé!' : '❌ Trận này đã bị xóa khỏi lịch.',
  ].filter((line) => line !== null).join('\n');
}

/** Matches added / removed between two states (by id). */
function diffMatches(before, after) {
  const old = new Map((before || []).map((m) => [m.id, m]));
  const now = new Map((after || []).map((m) => [m.id, m]));
  return [
    ...[...now.values()].filter((m) => !old.has(m.id)).map((m) => ({ kind: 'created', match: m })),
    ...[...old.values()].filter((m) => !now.has(m.id)).map((m) => ({ kind: 'deleted', match: m })),
  ];
}

async function sendText(text, fetchImpl) {
  const token = process.env.ZALO_BOT_TOKEN.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.ZALO_GROUP_CHAT_ID.trim(), text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // 401/403/404 mean an invalid or expired token / chat id. Never log the URL or body (it holds the token).
      console.error(`[zalo] sendMessage rejected with HTTP ${res.status}${res.status === 401 || res.status === 403 || res.status === 404 ? ' (check ZALO_BOT_TOKEN / ZALO_GROUP_CHAT_ID)' : ''}`);
      return false;
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/** Never throws. Resolves to the number of messages delivered. */
async function notifyMatchChanges(before, after, fetchImpl = globalThis.fetch) {
  try {
    if (!enabled() || typeof fetchImpl !== 'function') return 0;
    const events = diffMatches(before, after).slice(0, MAX_MESSAGES_PER_SAVE);
    let sent = 0;
    for (const { kind, match } of events) {
      try {
        if (await sendText(buildMessage(kind, match), fetchImpl)) sent += 1;
      } catch (err) {
        console.error('[zalo] notification failed:', err && err.name === 'AbortError' ? 'timeout' : 'network error');
      }
    }
    return sent;
  } catch (err) {
    console.error('[zalo] unexpected error while notifying');
    return 0;
  }
}

/** Whole days from today (Vietnam time, UTC+7) to the match day; negative when it is over. */
function daysUntil(matchDate, now = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(matchDate || ''));
  if (!m) return null;
  const today = new Date(now + 7 * 3600 * 1000);
  const a = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - a) / 86400000);
}

function buildReminder(match, members = [], now = Date.now()) {
  const { date, time } = formatWhen(match.date);
  const left = daysUntil(match.date, now);
  const when = left === 0 ? 'HÔM NAY' : left === 1 ? 'NGÀY MAI' : left > 1 ? `CÒN ${left} NGÀY` : '';
  const names = (match.attendees || []).map((id) => (members.find((x) => x.id === id) || {}).name).filter(Boolean);
  return [
    `⏰⚽ NHẮC HẸN ĐÁ BÓNG${when ? ` — ${when}` : ''}`,
    '━━━━━━━━━━━━━━',
    `📅 ${date}${time ? `  •  🕘 ${time}` : ''}`,
    match.location ? `🏟️ ${match.location}` : null,
    match.address ? `📍 ${match.address}` : null,
    match.mapUrl ? `🗺️ ${match.mapUrl}` : null,
    match.note ? `📝 ${match.note}` : null,
    names.length ? `👥 Đã điểm danh (${names.length}): ${names.join(', ')}` : null,
    '━━━━━━━━━━━━━━',
    '🔔 Anh em sắp xếp thời gian, đến đúng giờ nhé!',
  ].filter((line) => line !== null).join('\n').slice(0, 1800);
}

/** Sends a reminder for one stored match. Resolves to 'sent' | 'not_configured' | 'failed'. Never throws. */
async function sendReminder(match, members, fetchImpl = globalThis.fetch) {
  if (!enabled() || typeof fetchImpl !== 'function') return 'not_configured';
  try {
    return (await sendText(buildReminder(match, members), fetchImpl)) ? 'sent' : 'failed';
  } catch (err) {
    console.error('[zalo] reminder failed:', err && err.name === 'AbortError' ? 'timeout' : 'network error');
    return 'failed';
  }
}

module.exports = { notifyMatchChanges, diffMatches, buildMessage, formatWhen, buildReminder, sendReminder, daysUntil };
