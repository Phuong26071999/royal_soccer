'use strict';

/**
 * Answers from the real data (schedule, attendance, results, scorers, fund totals,
 * videos, venues). Pure: takes the saved state and the message, returns text or null.
 *
 * Privacy: everything here is already shown to anyone who opens the website. Individual
 * fund balances are deliberately NOT answered in chat, only group totals.
 */

const VN_OFFSET_MS = 7 * 3600 * 1000;
const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const PRESET_VENUES = [
  { name: 'Sân Bóng Hoàng Kim', address: '615 Huỳnh Tấn Phát, Tân Thuận, Hồ Chí Minh', mapUrl: 'https://www.google.com/maps/place/s%C3%A2n+b%C3%B3ng+%C4%91%C3%A1+ho%C3%A0ng+kim/data=!4m2!3m1!1s0x317525861819c111:0xee9f7d374586e2cf?sa=X&ved=1t:242&ictx=111' },
  { name: 'D7 Sports Park', address: '7b Tân Phú, Khu đô thị Phú Mỹ Hưng, Tân Mỹ, Hồ Chí Minh', mapUrl: 'https://www.google.com/maps/place/D7+Sports+Park/@10.7317864,106.7267681,277m/data=!3m1!1e3!4m6!3m5!1s0x3175252c279ea0c9:0xb0e280d96e6f6ebe!8m2!3d10.7317565!4d106.7273984!16s%2Fg%2F11sw_7q162?entry=ttu&g_ep=EgoyMDI2MTExMC4wIKXMDSoASAFQAw%3D%3D' },
];

/** Lowercase, no accents, single spaces (keeps word boundaries, unlike zaloBot.normalize). */
const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (input, re) => re.test(input);
const money = (n) => `${new Intl.NumberFormat('vi-VN').format(Math.round(n || 0))}đ`;
const first = (arr) => (arr.length ? arr[0] : undefined);

// ---- time helpers (match dates are Vietnam wall-clock "YYYY-MM-DDTHH:mm") ----

const vnNow = (now) => new Date(now + VN_OFFSET_MS);
const stamp = (d) => d.toISOString().slice(0, 16);
const asMs = (value) => Date.parse(`${String(value).slice(0, 16)}:00Z`);

function whenText(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(String(date || ''));
  if (!m) return String(date || '');
  const dow = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return `${WEEKDAYS[dow]}, ${m[3]}/${m[2]}/${m[1]}${m[4] ? ` lúc ${m[4]}` : ''}`;
}

function countdown(date, now) {
  const diff = asMs(date) - vnNow(now).getTime();
  if (diff <= 0) return 'đang diễn ra hoặc vừa bắt đầu';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `còn ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `còn ${hours} giờ ${minutes % 60 ? `${minutes % 60} phút` : ''}`.trim();
  const days = Math.floor(hours / 24);
  return `còn ${days} ngày ${hours % 24 ? `${hours % 24} giờ` : ''}`.trim();
}

// ---- data helpers (mirror src/soccer/utils.ts) ----

const participants = (match) => (match.attendees ? match.attendees : [...new Set((match.teams || []).flat())]);
const costTotal = (match) => (match.costs || []).reduce((sum, c) => sum + c.amount, 0);
const share = (match) => { const n = participants(match).length; return n ? Math.round(costTotal(match) / n) : 0; };
const nameOf = (state, id) => (state.members.find((m) => m.id === id) || {}).name;

function fundTotals(fund) {
  const paid = Object.values(fund.payments || {}).reduce((sum, ids) => sum + ids.length, 0);
  const totalIn = paid * fund.fee;
  const totalOut = (fund.expenses || []).reduce((sum, e) => sum + e.amount, 0);
  return { paid, totalIn, totalOut, balance: totalIn - totalOut };
}

/** Upcoming = not older than 3 hours past kick-off (same rule as the website). */
function split(state, now) {
  const limit = stamp(new Date(vnNow(now).getTime() - 3 * 3600 * 1000));
  const sorted = [...state.matches].sort((a, b) => a.date.localeCompare(b.date));
  return { upcoming: sorted.filter((m) => m.date >= limit), past: sorted.filter((m) => m.date < limit).reverse() };
}

const matchLine = (m) => `${whenText(m.date)} — ${m.location || 'chưa có sân'}`;

function describeMatch(state, m, now, withPeople = true) {
  const ids = participants(m);
  const names = ids.map((id) => nameOf(state, id)).filter(Boolean);
  return [
    `📅 ${whenText(m.date)} (${countdown(m.date, now)})`,
    m.location ? `🏟️ ${m.location}` : null,
    m.address ? `📍 ${m.address}` : null,
    m.mapUrl ? `🗺️ ${m.mapUrl}` : null,
    m.note ? `📝 ${m.note}` : null,
    withPeople ? (names.length ? `👥 ${names.length} người tham gia: ${names.slice(0, 20).join(', ')}${names.length > 20 ? '…' : ''}` : '👥 Chưa có ai điểm danh') : null,
  ].filter(Boolean).join('\n');
}

/** Finds the one member whose full name or given name appears in the message. */
function findMember(state, input) {
  const words = new Set(input.split(' '));
  const full = state.members.filter((m) => input.includes(norm(m.name)) && norm(m.name).length >= 3);
  if (full.length === 1) return full[0];
  const byGiven = state.members.filter((m) => {
    const parts = norm(m.name).split(' ');
    const given = parts[parts.length - 1];
    return given.length >= 3 && words.has(given);
  });
  return byGiven.length === 1 ? byGiven[0] : undefined;
}

const knownVenues = (state) => [
  ...PRESET_VENUES,
  ...(state.venues || []),
  ...state.matches.map((m) => ({ name: m.location, address: m.address, mapUrl: m.mapUrl })),
].filter((v) => v.name);

/** A venue whose name (without the leading "Sân bóng") appears in the message. */
const findVenue = (state, input) => knownVenues(state).find((v) => {
  const n = norm(v.name).replace(/^san (bong )?/, '');
  return n.length >= 3 && input.includes(n);
});

// ---- intents; each returns text, or null when it does not apply ----

const INTENTS = [
  {
    id: 'today',
    test: (i) => has(i, /\b(hom nay|toi nay|sang nay|chieu nay)\b.*\b(co )?(da|tran|keo)\b/) && has(i, /\b(khong|ko|k|chua|hong)\b/),
    run: ({ state, now }) => {
      const today = stamp(vnNow(now)).slice(0, 10);
      const list = split(state, now).upcoming.concat(split(state, now).past).filter((m) => m.date.startsWith(today));
      if (!list.length) return 'Hôm nay chưa có lịch đá nào trên website nha 🙌';
      return `Có đá hôm nay nè ⚽\n${list.map((m) => describeMatch(state, m, now, false)).join('\n\n')}`;
    },
  },
  {
    id: 'tomorrow',
    test: (i) => has(i, /\b(ngay mai|mai)\b.*\b(co )?(da|tran|keo)\b/) && has(i, /\b(khong|ko|k|chua|hong)\b/),
    run: ({ state, now }) => {
      const t = stamp(new Date(vnNow(now).getTime() + 86400000)).slice(0, 10);
      const list = state.matches.filter((m) => m.date.startsWith(t)).sort((a, b) => a.date.localeCompare(b.date));
      if (!list.length) return 'Ngày mai chưa có lịch đá nào trên website nha 🙌';
      return `Ngày mai có đá nè ⚽\n${list.map((m) => describeMatch(state, m, now, false)).join('\n\n')}`;
    },
  },
  {
    id: 'cost',
    test: (i) => has(i, /\b(tien san|chi phi|tien nuoc|chia tien|moi nguoi (dong|chiu|nop)|dong bao nhieu|het bao nhieu tien|ton bao nhieu)\b/),
    run: ({ state, now }) => {
      const m = first(split(state, now).upcoming);
      const target = m && costTotal(m) ? m : first(split(state, now).past.filter((p) => costTotal(p)));
      if (!target) return 'Chưa có khoản chi phí nào được nhập cho các trận. Admin nhập ở phần “Chi phí buổi đá” của trận nha 💸';
      const n = participants(target).length;
      return [
        `💸 Chi phí trận ${whenText(target.date)}:`,
        ...(target.costs || []).map((c) => `• ${c.note || 'Khoản chi'}: ${money(c.amount)}`),
        `Tổng: ${money(costTotal(target))}`,
        n ? `Chia đều ${n} người: ${money(share(target))}/người` : 'Chưa có ai điểm danh nên chưa chia được.',
      ].join('\n');
    },
  },
  {
    id: 'fund',
    test: (i) => has(i, /\b(quy|tong quy|so du|con bao nhieu tien|tien quy|nop quy)\b/),
    run: ({ state, websiteUrl }) => {
      const open = state.funds.filter((f) => f.status === 'open');
      if (!open.length) return `Hiện chưa có quỹ nào đang mở${websiteUrl ? `. Xem thêm ở ${websiteUrl}` : '.'} 💰`;
      const lines = open.map((f) => {
        const t = fundTotals(f);
        return `• ${f.name}: thu ${money(t.totalIn)}, chi ${money(t.totalOut)}, còn ${money(t.balance)} (${t.paid} lượt đóng, ${money(f.fee)}/tháng)`;
      });
      return `💰 QUỸ ĐANG MỞ\n${lines.join('\n')}\n(Số dư từng người xem trong chi tiết thành viên trên website nhé.)`;
    },
  },
  {
    id: 'me',
    test: (i) => has(i, /\b(toi|minh|em|anh|chi|tui|t)\b.*\b(co|da|chua)\b.*\b(di|tham gia|diem danh|trong danh sach|ten)\b/) || has(i, /\bco ten (toi|minh|em|tui)\b/),
    run: ({ state, now, senderName }) => {
      const m = first(split(state, now).upcoming);
      if (!m) return 'Hiện chưa có trận sắp tới để mình kiểm tra nha 🙌';
      const me = senderName ? findMember(state, norm(senderName)) : undefined;
      if (!me) return `Mình chưa nhận ra bạn trong danh sách thành viên (tên Zalo “${senderName || '?'}” khác tên trên web). Bạn hỏi kiểu “Hùng có đi đá không” để mình tra theo tên nha.`;
      const going = participants(m).includes(me.id);
      return going ? `✅ ${me.name} đã có tên trong danh sách trận ${whenText(m.date)} rồi nè!` : `⏳ ${me.name} chưa có tên trong danh sách trận ${whenText(m.date)}. Nhờ admin điểm danh giúp nha!`;
    },
  },
  {
    id: 'memberStat',
    test: (i, ctx) => has(i, /\b(ban|ghi|so ao|ao so|dang cap|xep hang|hang|bao nhieu|di da|co di)\b/) && Boolean(findMember(ctx.state, i)),
    run: ({ state, input, now }) => {
      const mem = findMember(state, input);
      const played = state.matches.filter((m) => participants(m).includes(mem.id)).length;
      const m = first(split(state, now).upcoming);
      const going = m ? participants(m).includes(mem.id) : null;
      return [
        `👤 ${mem.name}${mem.number != null ? ` — áo số ${mem.number}` : ''}`,
        `⚽ ${mem.goals || 0} bàn thắng`,
        `🏟️ Đã tham gia ${played} buổi đá`,
        going === null ? null : (going ? '✅ Có trong danh sách trận sắp tới' : '⏳ Chưa có trong danh sách trận sắp tới'),
      ].filter(Boolean).join('\n');
    },
  },
  {
    id: 'scorers',
    test: (i) => has(i, /\b(vua pha luoi|top ghi ban|ai ghi nhieu|ghi nhieu nhat|top scorer|dan dau|bang xep hang|xep hang ghi ban|ai nhieu ban nhat|da hay nhat|da gioi nhat|xuat sac nhat|mvp|ai da hay|ai da gioi)\b/),
    run: ({ state }) => {
      const top = [...state.members].filter((m) => m.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5);
      if (!top.length) return 'Chưa ai ghi bàn trên bảng vua phá lưới cả 😄 Admin cập nhật bàn thắng trong chi tiết thành viên nha.';
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      return `🏆 VUA PHÁ LƯỚI\n${top.map((m, i) => `${medals[i]} ${m.name} — ${m.goals} bàn`).join('\n')}`;
    },
  },
  {
    id: 'attendance',
    test: (i) => has(i, /\b(ai di da|ai tham gia|ai di|danh sach (di|tham gia|diem danh)|bao nhieu nguoi|may nguoi|diem danh|du nguoi|thieu nguoi|co may nguoi)\b/),
    run: ({ state, now }) => {
      const m = first(split(state, now).upcoming);
      if (!m) return 'Hiện chưa có trận sắp tới nên chưa có danh sách nha 🙌';
      const names = participants(m).map((id) => nameOf(state, id)).filter(Boolean);
      if (!names.length) return `Trận ${whenText(m.date)} chưa có ai điểm danh. Vào website để chọn người tham gia nha ✅`;
      return `✅ ĐIỂM DANH ${whenText(m.date)}\n${names.length} người: ${names.join(', ')}\n${names.length >= 10 ? 'Đủ quân số rồi, ra sân thôi! ⚽' : `Hiện ${names.length} người, ai đi thêm báo admin nha.`}`;
    },
  },
  {
    id: 'lastResult',
    test: (i) => has(i, /\b(tran (vua|truoc|gan day|hom qua|vua roi|cuoi)|ket qua|ti so|ty so|ai thang|thang thua|vua da|da xong)\b/),
    run: ({ state, now }) => {
      const m = first(split(state, now).past);
      if (!m) return 'Chưa có trận nào đã đá trên website nha 🙌';
      return [
        `⚽ TRẬN GẦN NHẤT: ${whenText(m.date)}`,
        m.location ? `🏟️ ${m.location}` : null,
        m.score ? `🔢 Tỉ số: ${m.score}` : '🔢 Chưa nhập tỉ số (admin cập nhật trong trận nha)',
        `👥 ${participants(m).length} người tham gia`,
      ].filter(Boolean).join('\n');
    },
  },
  {
    id: 'upcomingList',
    test: (i) => has(i, /\b(cac tran|nhung tran|tuan nay|tuan sau|danh sach tran|may tran|lich tuan|thang nay|con tran nao|co tran nao)\b/),
    run: ({ state, now }) => {
      const list = split(state, now).upcoming.slice(0, 5);
      if (!list.length) return 'Chưa có trận nào sắp tới trên lịch. Tạo lịch mới ở tab “Lịch đá” nha 📅';
      return `📅 CÁC TRẬN SẮP TỚI\n${list.map((m, i) => `${i + 1}. ${matchLine(m)}`).join('\n')}`;
    },
  },
  {
    id: 'nextMatch',
    test: (i) => has(i, /\b(tran (toi|sap toi|ke tiep|tiep theo|gan nhat|sap da)|lich (toi|sap toi|da|tiep theo)|bao gio da|khi nao da|da luc may gio|may gio da|buoi toi|con bao lau|con may ngay|sap da|da o dau|da san nao|lich da)\b/),
    run: ({ state, now }) => {
      const m = first(split(state, now).upcoming);
      if (!m) return 'Hiện chưa có trận nào sắp tới trên lịch 🙌 Bạn tạo lịch mới ở tab “Lịch đá” nha.';
      return `⚽ TRẬN SẮP TỚI\n${describeMatch(state, m, now)}`;
    },
  },
  {
    id: 'venue',
    test: (i, ctx) => has(i, /\b(san|dia chi|map|ban do|chi duong|duong di)\b/) || (has(i, /\b(o dau|nam o dau|dia diem)\b/) && Boolean(findVenue(ctx.state, i))),
    run: ({ state, input, now }) => {
      const known = knownVenues(state);
      const hit = findVenue(state, input);
      if (hit) return [`🏟️ ${hit.name}`, hit.address ? `📍 ${hit.address}` : null, hit.mapUrl ? `🗺️ ${hit.mapUrl}` : null].filter(Boolean).join('\n');
      if (has(input, /\b(danh sach san|cac san|san quen|co nhung san|san nao)\b/) && !has(input, /\b(da san nao|san nao da)\b/)) {
        const names = [...new Set(known.map((v) => v.name))].slice(0, 8);
        return `🏟️ CÁC SÂN NHÓM HAY ĐÁ\n${names.map((n) => `• ${n}`).join('\n')}\nHỏi “Hoàng Kim ở đâu” để mình gửi địa chỉ và bản đồ nha.`;
      }
      const m = first(split(state, now).upcoming);
      return m ? `🏟️ Trận sắp tới đá ở ${m.location || 'chưa có sân'}${m.address ? `\n📍 ${m.address}` : ''}${m.mapUrl ? `\n🗺️ ${m.mapUrl}` : ''}` : null;
    },
  },
  {
    id: 'video',
    test: (i) => has(i, /\b(video|clip|highlight|xem lai|youtube|quay lai)\b/),
    run: ({ state }) => {
      const list = [...(state.videos || [])].sort((a, b) => b.date.localeCompare(a.date));
      if (!list.length) return 'Chưa có video nào được lưu trong tab “Video” nha 🎬';
      const v = list[0];
      return `🎬 VIDEO MỚI NHẤT\n${v.title} (${v.date.split('-').reverse().join('/')})${v.venueName ? ` — ${v.venueName}` : ''}\n${(v.links || []).slice(0, 3).join('\n') || 'Chưa có link'}`;
    },
  },
  {
    id: 'members',
    test: (i) => has(i, /\b(bao nhieu thanh vien|may thanh vien|so luong thanh vien|co ai trong nhom|danh sach thanh vien|nhom co may)\b/),
    run: ({ state }) => `👥 Nhóm hiện có ${state.members.length} thành viên${state.members.length ? `: ${state.members.slice(0, 25).map((m) => m.name).join(', ')}${state.members.length > 25 ? '…' : ''}` : '.'}`,
  },
  {
    id: 'summary',
    test: (i) => has(i, /\b(tong ket|thong ke|tong quan|bao cao|tinh hinh)\b/),
    run: ({ state, now }) => {
      const { upcoming, past } = split(state, now);
      const funds = state.funds.filter((f) => f.status === 'open').map(fundTotals);
      const left = funds.reduce((sum, t) => sum + t.balance, 0);
      const top = [...state.members].sort((a, b) => b.goals - a.goals)[0];
      return [
        '📊 TỔNG QUAN NHÓM',
        `👥 ${state.members.length} thành viên`,
        `⚽ ${past.length} trận đã đá, ${upcoming.length} trận sắp tới`,
        funds.length ? `💰 Quỹ đang mở còn ${money(left)}` : null,
        top && top.goals > 0 ? `🏆 Vua phá lưới: ${top.name} (${top.goals} bàn)` : null,
      ].filter(Boolean).join('\n');
    },
  },
];

/**
 * @param {string} raw message text with the mention already removed
 * @param {object} state saved app state
 * @param {{now?: number, senderName?: string, websiteUrl?: string}} options
 * @returns {string|null}
 */
function dataReply(raw, state, options = {}) {
  if (!state || !Array.isArray(state.matches) || !Array.isArray(state.members)) return null;
  const input = norm(raw);
  if (!input) return null;
  const ctx = {
    state: { ...state, funds: state.funds || [], videos: state.videos || [], venues: state.venues || [] },
    input,
    now: options.now || Date.now(),
    senderName: options.senderName || '',
    websiteUrl: options.websiteUrl || '',
  };
  for (const intent of INTENTS) {
    if (!intent.test(input, ctx)) continue;
    const text = intent.run(ctx);
    if (text) return text;
  }
  return null;
}

module.exports = { dataReply, whenText, countdown, participants, share, fundTotals };
