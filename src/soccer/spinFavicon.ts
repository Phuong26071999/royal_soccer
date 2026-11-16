/**
 * Makes the browser-tab icon spin: the ball image is redrawn rotated on a small canvas
 * and swapped into <link rel="icon"> a few times a second. Returns a function that stops it.
 * Skipped when the user prefers reduced motion; paused while the tab is in the background.
 */
export function startSpinningFavicon(src = '/logo192.png'): () => void {
  if (typeof window === 'undefined' || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    return () => undefined;
  }

  const SIZE = 48;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;

  // One icon link that we own; the static ones are removed so the browser has a single source.
  const original = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
  original.forEach((l) => l.parentNode?.removeChild(l));
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  document.head.appendChild(link);

  const img = new Image();
  let angle = 0;
  let timer = 0;
  let stopped = false;

  const draw = () => {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(angle);
    ctx.drawImage(img, -SIZE / 2, -SIZE / 2, SIZE, SIZE);
    ctx.restore();
    link.href = canvas.toDataURL('image/png');
    angle += (Math.PI * 2) / 28; // a full turn in about 28 frames
  };

  const start = () => {
    if (stopped || timer || !img.complete || !img.naturalWidth) return;
    timer = window.setInterval(draw, 110);
  };
  const stop = () => {
    window.clearInterval(timer);
    timer = 0;
  };
  const onVisibility = () => (document.hidden ? stop() : start());

  img.onload = () => {
    draw();
    start();
  };
  img.onerror = () => {
    // Could not load the picture: put the static icons back.
    link.parentNode?.removeChild(link);
    original.forEach((l) => document.head.appendChild(l));
  };
  img.src = src;
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stopped = true;
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    link.parentNode?.removeChild(link);
    original.forEach((l) => document.head.appendChild(l));
  };
}
