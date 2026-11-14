import { Club, DEFAULT_CARD_COLOR } from './clubs';
import { Member } from './types';
import { TIERS, avatarColor, initials, shortName } from './utils';

interface PosterData {
  title: string;
  vs: string;
  starters: Member[];
  subs: Member[];
  club?: Club;
  info?: string;
}

const W = 1080;
const PAD = 64;
const GAP = 14;
const COLS = 3;
const SHEET_ORDER = [4, 2, 3, 0, 1];
const FONT = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';

function mix(hex: string, black: number): string {
  const n = parseInt(hex.slice(1), 16);
  const k = 1 - black;
  const c = (v: number) => Math.round(v * k);
  return `rgb(${c((n >> 16) & 255)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

/** Loads a picture for drawing; resolves null when it can't be fetched with CORS (the poster then falls back). */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('/')) {
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const crestSrc = (club: Club) => {
  const id = club.crest.match(/\/(\d+)\.png$/)?.[1];
  return id ? `/api/crest?id=${id}` : club.crest;
};

function fitText(ctx: CanvasRenderingContext2D, text: string, size: number, maxWidth: number, weight = 800): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && s > 12) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
  return s;
}

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

function roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

/** Draws the "Starting V" poster (same layout as LineupPoster) and returns it as a PNG. */
export async function renderPosterBlob({ title, vs, starters, subs, club, info = 'Giao hữu' }: PosterData): Promise<Blob> {
  await Promise.all(['800', '600', '700'].map((w) => document.fonts.load(`${w} 40px "Barlow Condensed"`).catch(() => [])));
  const color = club?.color || DEFAULT_CARD_COLOR;
  const ordered = [...SHEET_ORDER.map((i) => starters[i]), ...starters.slice(SHEET_ORDER.length)].filter(Boolean) as Member[];
  const [crestImg, ...avatars] = await Promise.all([
    club ? loadImage(crestSrc(club)) : Promise.resolve(null),
    ...[...ordered, ...subs].map((m) => (m.avatar ? loadImage(m.avatar) : Promise.resolve(null))),
  ]);

  const tileW = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const tileH = tileW * 1.2;
  const rows = Math.ceil((ordered.length + 1) / COLS);
  const headH = 250;
  const gridH = rows * tileH + (rows - 1) * GAP;
  const subRows = Math.ceil(subs.length / COLS);
  const subTitleH = subs.length ? 130 : 0;
  const subGridH = subRows ? subRows * tileH + (subRows - 1) * GAP : 0;
  const footH = 230;
  const H = Math.round(PAD + headH + gridH + subTitleH + subGridH + footH);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không vẽ được ảnh.');

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, mix(color, 0.15));
  bg.addColorStop(1, mix(color, 0.6));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.8);
  glow.addColorStop(0, 'rgba(255,255,255,0.22)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H * 0.5);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 34;
  for (let x = -H; x < W + H; x += 78) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
    ctx.stroke();
  }
  ctx.restore();

  // wavy bands top and bottom
  const wave = (top: boolean) => {
    const y0 = top ? 0 : H;
    const dir = top ? 1 : -1;
    const bandH = 150;
    const edge = (x: number, y: number) => [x, y0 + dir * y] as const;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(W, y0);
    ctx.lineTo(...edge(W, bandH * 0.5));
    ctx.bezierCurveTo(...edge(W * 0.82, bandH), ...edge(W * 0.7, bandH * 0.08), ...edge(W * 0.52, bandH * 0.42));
    ctx.bezierCurveTo(...edge(W * 0.34, bandH * 0.78), ...edge(W * 0.18, bandH * 0.86), ...edge(0, bandH * 0.42));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.11)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  wave(true);
  wave(false);

  // header
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `600 34px ${FONT}`;
  spaced(ctx, 11);
  ctx.fillText('SÂN 5 NGƯỜI', W / 2 + 5, PAD + 56);
  ctx.fillStyle = '#fff';
  ctx.font = `800 128px ${FONT}`;
  spaced(ctx, 5);
  ctx.fillText('XUẤT PHÁT', W / 2 + 3, PAD + 180);
  spaced(ctx, 0);

  const gx = (i: number) => PAD + (i % COLS) * (tileW + GAP);
  const gy = (i: number) => PAD + headH + Math.floor(i / COLS) * (tileH + GAP);

  // crest tile
  {
    const x = gx(0);
    const y = gy(0);
    const cx = x + tileW / 2;
    if (crestImg) {
      const s = tileW * 0.62;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 20;
      ctx.drawImage(crestImg, cx - s / 2, y + tileH * 0.1, s, s * (crestImg.naturalHeight / crestImg.naturalWidth));
      ctx.restore();
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${tileW * 0.62}px ${FONT}`;
      ctx.fillText('V', cx, y + tileH * 0.62);
    }
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${tileW * 0.12}px ${FONT}`;
    spaced(ctx, 4);
    ctx.fillText(title.toUpperCase(), cx + 2, y + tileH * 0.93);
    spaced(ctx, 0);
  }

  // one player tile: giant number behind, portrait on the lower part, name up the left edge
  const drawTile = (m: Member, idx: number, x: number, y: number, img: HTMLImageElement | null) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, tileW, tileH);
    ctx.clip();
    ctx.fillStyle = idx % 2 ? mix(color, 0.26) : mix(color, 0.38);
    ctx.fillRect(x, y, tileW, tileH);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, tileW - 2, tileH - 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.font = `800 ${tileW * 1.18}px ${FONT}`;
    ctx.fillText(String(m.number ?? '--'), x + tileW - tileW * 0.03, y + tileW * 0.98);

    const aw = tileW * 0.74;
    const ax = x + tileW * 0.24;
    const ay = y + tileH - aw;
    ctx.save();
    roundRectTop(ctx, ax, ay, aw, aw, aw * 0.14);
    ctx.clip();
    if (img) {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      ctx.drawImage(img, sx, 0, side, side, ax, ay, aw, aw);
    } else {
      ctx.fillStyle = avatarColor(m.id);
      ctx.fillRect(ax, ay, aw, aw);
      ctx.fillStyle = '#10201a';
      ctx.textAlign = 'center';
      ctx.font = `800 ${aw * 0.36}px ${FONT}`;
      ctx.fillText(initials(m.name), ax + aw / 2, ay + aw * 0.6);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(x + tileW * 0.085, y + tileH - tileW * 0.06);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    const label = shortName(m.name).toUpperCase();
    const size = fitText(ctx, label, tileW * 0.13, tileH * 0.88, 600);
    ctx.font = `600 ${size}px ${FONT}`;
    spaced(ctx, 3);
    ctx.fillText(label, 0, 0);
    ctx.restore();

    // tier badge, bottom-right
    const bs = tileW * 0.2;
    const bx = x + tileW - bs - tileW * 0.045;
    const by = y + tileH - bs - tileW * 0.045;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = ({ 5: '#ffe27a', 4: '#8fe0a8', 3: '#e9eee9', 2: '#d9a679', 1: '#aebcb4' } as Record<number, string>)[m.tier] || '#f6d77a';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, bs, bs, bs * 0.18) : ctx.rect(bx, by, bs, bs);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1b1608';
    ctx.textAlign = 'center';
    ctx.font = `800 ${bs * 0.7}px ${FONT}`;
    ctx.fillText(TIERS[m.tier].label, bx + bs / 2, by + bs * 0.74);
    ctx.restore();
  };
  ordered.forEach((m, idx) => drawTile(m, idx, gx(idx + 1), gy(idx + 1), avatars[idx]));

  // subs: the same tiles under a "DỰ BỊ" divider
  if (subs.length) {
    const ty = PAD + headH + gridH + 62;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `700 40px ${FONT}`;
    spaced(ctx, 12);
    ctx.fillText('DỰ BỊ', W / 2 + 6, ty);
    const half = ctx.measureText('DỰ BỊ').width / 2 + 40;
    spaced(ctx, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(PAD, ty - 14, W / 2 - half - PAD, 3);
    ctx.fillRect(W / 2 + half, ty - 14, W / 2 - half - PAD, 3);
    const top = PAD + headH + gridH + subTitleH;
    subs.forEach((m, idx) => drawTile(m, idx, PAD + (idx % COLS) * (tileW + GAP), top + Math.floor(idx / COLS) * (tileH + GAP), avatars[ordered.length + idx]));
  }

  // footer
  const fy = PAD + headH + gridH + subTitleH + subGridH + 100;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = `800 76px ${FONT}`;
  spaced(ctx, 5);
  ctx.fillText(vs.toUpperCase(), W - PAD, fy);
  ctx.font = `600 38px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  spaced(ctx, 9);
  ctx.fillText(info.toUpperCase(), W - PAD, fy + 56);
  spaced(ctx, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh poster.'))), 'image/png');
  });
}
