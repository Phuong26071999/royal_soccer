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

const FALLBACK = () => `🤔 Mình chưa hiểu lệnh này. Gõ @${botName()} help để xem các lệnh.`;

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

/** Reply text for a message that mentions the bot, or null when the bot should stay silent. */
function replyFor(text) {
  if (!isMentioned(text)) return null;
  const command = normalize(stripMention(text));
  if (!command) return COMMANDS.help.reply();
  const hit = Object.keys(COMMANDS).find((key) => key === command || COMMANDS[key].aliases.includes(command));
  return hit ? COMMANDS[hit].reply() : FALLBACK();
}

module.exports = { normalize, isMentioned, stripMention, replyFor, COMMANDS };
