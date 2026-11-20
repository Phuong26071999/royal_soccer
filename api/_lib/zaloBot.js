'use strict';

/**
 * Keyword replies for the Zalo bot ("@Bot David Truong help").
 * Pure functions, no I/O: easy to test and to extend. To add a command, add an
 * entry to COMMANDS (key = what people type, accents/case/spaces ignored).
 */

/** Lowercase, strip Vietnamese accents (đ -> d) and everything except letters/digits. */
function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const botName = () => (process.env.ZALO_BOT_NAME || 'Bot David Truong').trim();
const siteUrl = () => {
  const explicit = (process.env.ZALO_SITE_URL || '').trim();
  if (explicit) return explicit;
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  return vercel ? `https://${vercel}` : '';
};

/** key -> { aliases, reply }. Replies are functions so they read env at call time. */
const COMMANDS = {
  help: {
    aliases: ['trogiup', 'huongdan', 'lenh'],
    reply: () => [
      '🤖 CÁC LỆNH CỦA BOT',
      '━━━━━━━━━━━━━━',
      `Gõ @${botName()} kèm một từ khóa:`,
      '• help — xem danh sách lệnh',
      '• lichhen — link xem lịch đá',
      '• website — địa chỉ website',
      '• lienhe — thông tin liên hệ',
    ].join('\n'),
  },
  lichhen: {
    aliases: ['lich', 'lichda', 'lichhendabong'],
    reply: () => (siteUrl() ? `📅 Xem lịch đá tại:\n${siteUrl()}` : '📅 Chưa cấu hình địa chỉ website (ZALO_SITE_URL).'),
  },
  website: {
    aliases: ['web', 'trang', 'link'],
    reply: () => (siteUrl() ? `🌐 Website:\n${siteUrl()}` : '🌐 Chưa cấu hình địa chỉ website (ZALO_SITE_URL).'),
  },
  lienhe: {
    aliases: ['contact', 'hotline', 'sdt'],
    reply: () => `📞 Liên hệ:\n${(process.env.ZALO_CONTACT_INFO || '').trim() || 'Chưa cấu hình thông tin liên hệ (ZALO_CONTACT_INFO).'}`,
  },
};

/** True when the message addresses the bot: contains "@<bot name>" (accents/case/spacing ignored). */
function isMentioned(text) {
  const name = normalize(botName());
  const flat = String(text || '');
  const at = flat.indexOf('@');
  if (!name || at === -1) return false;
  return normalize(flat.slice(at)).startsWith(name);
}

/** Text after removing "@<bot name>" (works with any spacing/accents the user typed). */
function stripMention(text) {
  const str = String(text || '');
  const target = normalize(botName());
  const at = str.indexOf('@');
  if (at === -1) return str;
  // Walk forward until the normalized text typed after '@' covers the bot name.
  let acc = '';
  let i = at + 1;
  while (i < str.length && acc.length < target.length) {
    acc += normalize(str[i]);
    i += 1;
  }
  return `${str.slice(0, at)} ${str.slice(i)}`;
}

/**
 * Is the bot mentioned? Zalo's docs do not describe mention metadata, so this is defensive:
 *  1. If the message carries a mention-like array (any field named *mention* / *entit*), the
 *     bot counts as mentioned only when an item references the bot (ZALO_BOT_ID, or its name).
 *  2. With no such metadata, fall back to "@<bot name>" in the text.
 * Run with ZALO_WEBHOOK_DEBUG=1 to see which fields a real group message carries.
 */
function isBotMentioned(message) {
  const botId = (process.env.ZALO_BOT_ID || '').trim();
  const name = normalize(botName());
  const lists = Object.keys(message || {})
    .filter((k) => /mention|entit/i.test(k) && Array.isArray(message[k]));
  if (lists.length) {
    return lists.some((k) => message[k].some((item) => {
      const raw = JSON.stringify(item || {});
      return (botId && raw.includes(botId)) || normalize(raw).includes(name);
    }));
  }
  return isMentioned(message && message.text);
}

/** Fixed commands first (exact keyword), otherwise the friendly smart replies. */
function replyFor(text) {
  if (!isMentioned(text)) return null;
  return answer(text);
}

function answer(rawText) {
  const { getBotReply, stripBotMention } = require('./zaloSmartReplies');
  const body = stripMention(stripBotMention(rawText, [botName()]));
  const command = normalize(body);
  if (!command) return COMMANDS.help.reply();
  const hit = Object.keys(COMMANDS).find((key) => key === command || COMMANDS[key].aliases.includes(command));
  return hit ? COMMANDS[hit].reply() : getBotReply(body, { websiteUrl: siteUrl() });
}

/** Reply for a webhook message, or null (stay silent) when the bot is not mentioned. */
function replyForMessage(message) {
  if (!message || !isBotMentioned(message)) return null;
  return answer(message.text);
}

module.exports = { normalize, isMentioned, isBotMentioned, stripMention, replyFor, replyForMessage, COMMANDS };
