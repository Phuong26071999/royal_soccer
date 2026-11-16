import { Fund, Match, Member, PlayerStats, SoccerState } from './types';

export const TIERS: Record<number, { label: string; name: string }> = {
  5: { label: 'S', name: 'Xuất sắc' },
  4: { label: 'A', name: 'Khá' },
  3: { label: 'B', name: 'Trung bình' },
  2: { label: 'C', name: 'Đang lên' },
  1: { label: 'D', name: 'Mới chơi' },
};

const AVATAR_COLORS = ['#0ef', '#ffc533', '#ff6b6b', '#2ed3a0', '#4aa8ff', '#ff8a3d', '#ff7eb6', '#b6e93b'];

export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return letters.map((w) => w.charAt(0)).join('').toUpperCase();
}

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export const formatMoney = (vnd: number) => `${vnd.toLocaleString('vi-VN')} đ`;

/** "YYYY-MM" for a date (local time). */
export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

export function formatMatchDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${time}, ${day}`;
}

export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return base || 'member';
}

export function uniqueId(base: string, taken: Set<string>): string {
  let candidate = base.slice(0, 36);
  for (let i = 2; taken.has(candidate); i++) candidate = `${base.slice(0, 33)}-${i}`;
  return candidate;
}

export const randomId = () => Math.random().toString(36).slice(2, 10);

export const teamPower = (team: Member[]) => team.reduce((sum, m) => sum + m.tier, 0);

/**
 * Crops an image file to a centred square and shrinks it to a small JPEG
 * data URL, so profile photos stay a few KB no matter what the phone shoots.
 */
export const MAX_GIF_BYTES = 400 * 1024;

export function resizePhoto(file: File, size = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Hãy chọn một file ảnh.'));
      return;
    }
    // A canvas would flatten the animation, so GIFs go up untouched (the avatar is cropped square by CSS).
    if (file.type === 'image/gif') {
      if (file.size > MAX_GIF_BYTES) {
        reject(new Error(`GIF quá nặng (${Math.round(file.size / 1024)} KB). Chọn GIF dưới ${MAX_GIF_BYTES / 1024} KB.`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Không đọc được file GIF này.'));
      reader.readAsDataURL(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Trình duyệt không xử lý được ảnh này.'));
        return;
      }
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh này. Thử ảnh JPG hoặc PNG khác.'));
    };
    img.src = url;
  });
}

/**
 * Turns a Giphy page/embed link into the direct GIF file (media.giphy.com/media/<id>/giphy.gif).
 * Other URLs, including direct Giphy media links, come back unchanged; returns null for a short gph.is link,
 * which cannot be resolved in the browser.
 */
export function normalizeGiphyUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }
  const host = url.hostname.toLowerCase();
  if (host === 'gph.is') return null;
  if (host !== 'giphy.com' && host !== 'www.giphy.com') return input;
  const parts = url.pathname.split('/').filter(Boolean);
  if (!['gifs', 'stickers', 'embed', 'clips'].includes(parts[0]) || !parts[1]) return input;
  const last = parts[parts.length - 1];
  const id = (last.match(/-([A-Za-z0-9]+)$/) || [null, last])[1];
  return id && /^[A-Za-z0-9]+$/.test(id) ? `https://media.giphy.com/media/${id}/giphy.gif` : input;
}

/** Fits a club logo into a 192px transparent PNG (no crop, keeps transparency); GIFs go up untouched like profile GIFs. */
export function resizeLogo(file: File, size = 192): Promise<string> {
  if (file.type === 'image/gif') return resizePhoto(file);
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Hãy chọn một file ảnh.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      URL.revokeObjectURL(url);
      if (!ctx) { reject(new Error('Trình duyệt không xử lý được ảnh này.')); return; }
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh này. Thử ảnh PNG hoặc JPG khác.'));
    };
    img.src = url;
  });
}

/**
 * FIFA-style overall rating 50-99: tier sets the base (D 50, C 60, B 70, A 80, S 90),
 * every 2 goals add 1 point, capped at +9.
 */
export const ratingOf = (m: { tier: number; goals: number }): number =>
  Math.min(99, 50 + (m.tier - 1) * 10 + Math.min(9, Math.floor(m.goals / 2)));

export const STAT_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;
export const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = { pac: 'Tốc độ', sho: 'Sút', pas: 'Chuyền', dri: 'Rê bóng', def: 'Thủ', phy: 'Thể lực' };

// How each attribute sits relative to the overall rating (used until someone enters real values).
const STAT_OFFSETS = [-2, -4, 0, 0, -12, -2];

export function defaultStats(rating: number): PlayerStats {
  const v = (i: number) => Math.max(20, Math.min(99, rating + STAT_OFFSETS[i]));
  return { pac: v(0), sho: v(1), pas: v(2), dri: v(3), def: v(4), phy: v(5) };
}

export const statsOf = (m: { tier: number; goals: number; stats?: PlayerStats }): PlayerStats =>
  m.stats || defaultStats(ratingOf(m));

/** Short display name for tight spots: "Phí Võ Quang Vinh" -> "Vinh Phí" (given name first); 1-2 words stay as written. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[parts.length - 1]} ${parts[0]}` : name.trim();
}

/** Ids of everyone who played a match: the explicit attendee list, else everyone placed in a team. */
export function participantsOf(match: Match): string[] {
  if (match.attendees) return match.attendees;
  return Array.from(new Set(match.teams.flat()));
}

export const matchCostTotal = (match: Match) => (match.costs || []).reduce((sum, c) => sum + c.amount, 0);

/** What each attendee pays for a match: total cost split evenly (rounded to the nearest đồng). */
export function matchShare(match: Match): number {
  const n = participantsOf(match).length;
  return n ? Math.round(matchCostTotal(match) / n) : 0;
}

export interface LedgerEntry { match: Match; share: number }

/** The fund everyday payments go to: the open fund that started most recently. */
export function currentFund(state: SoccerState): Fund | undefined {
  return state.funds.filter((f) => f.status === 'open').sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

/** Collected, spent and what is left of one fund. */
export function fundTotals(fund: Fund) {
  const paidCount = Object.values(fund.payments).reduce((sum, ids) => sum + ids.length, 0);
  const totalIn = paidCount * fund.fee;
  const totalOut = fund.expenses.reduce((sum, e) => sum + e.amount, 0);
  return { paidCount, totalIn, totalOut, balance: totalIn - totalOut };
}

export interface PaidMonth { fund: Fund; month: string }

/** A member's fund account: money paid in (all funds), split cost of the matches they played, and what is left. */
export function memberLedger(state: SoccerState, memberId: string) {
  const paidMonths: PaidMonth[] = state.funds.flatMap((fund) => Object.keys(fund.payments)
    .filter((month) => fund.payments[month].includes(memberId))
    .map((month) => ({ fund, month })))
    .sort((a, b) => b.month.localeCompare(a.month));
  const contributed = paidMonths.reduce((sum, p) => sum + p.fund.fee, 0);
  const history: LedgerEntry[] = state.matches
    .filter((m) => participantsOf(m).includes(memberId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((match) => ({ match, share: matchShare(match) }));
  const spent = history.reduce((sum, e) => sum + e.share, 0);
  return { paidMonths, contributed, history, spent, balance: contributed - spent };
}

/** Shrinks a photo to fit within maxSide px (keeps the aspect ratio, no crop) and returns a JPEG data URL. */
export function resizeImage(file: File, maxSide = 720, quality = 0.8): Promise<string> {
  if (file.type === 'image/gif') return resizePhoto(file);
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Hãy chọn một file ảnh.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) { reject(new Error('Trình duyệt không xử lý được ảnh này.')); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh này. Thử ảnh JPG hoặc PNG khác.'));
    };
    img.src = url;
  });
}
