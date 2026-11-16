import React from 'react';

const C = 32;
const pt = (r: number, deg: number): [number, number] => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
const fmt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const pentagon = (cx: number, cy: number, r: number, rot: number) =>
  Array.from({ length: 5 }, (_, k) => fmt([cx + r * Math.cos(((rot + 72 * k) * Math.PI) / 180), cy + r * Math.sin(((rot + 72 * k) * Math.PI) / 180)])).join(' ');

const CENTER = pentagon(C, C, 9, -90);
const RING = Array.from({ length: 5 }, (_, k) => {
  const a = -90 + 72 * k;
  const [px, py] = pt(31, a);
  return {
    patch: pentagon(px, py, 9, a + 180),
    spoke: [pt(9, a), pt(22, a)] as [[number, number], [number, number]],
    arc: `${fmt(pt(22, a))} ${fmt(pt(25, a + 36))} ${fmt(pt(22, a + 72))}`,
  };
});

/** A classic black-and-white football that keeps spinning (the logo of the page). */
const SoccerBall = ({ size = 34, spin = true }: { size?: number; spin?: boolean }) => (
  <svg className={`sc-logo-ball${spin ? ' spin' : ''}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <radialGradient id="sc-ball-shade" cx=".35" cy=".3" r=".85">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".65" stopColor="#e6ece8" />
        <stop offset="1" stopColor="#aeb9b2" />
      </radialGradient>
      <clipPath id="sc-ball-clip"><circle cx="32" cy="32" r="30" /></clipPath>
    </defs>
    <circle cx="32" cy="32" r="30.5" fill="url(#sc-ball-shade)" />
    <g clipPath="url(#sc-ball-clip)" fill="#14201a" stroke="#14201a" strokeLinejoin="round">
      <polygon points={CENTER} strokeWidth="1" />
      {RING.map((r, i) => <polygon key={i} points={r.patch} strokeWidth="1" />)}
      <g fill="none" strokeWidth="1.5" strokeLinecap="round">
        {RING.map((r, i) => (
          <g key={i}>
            <line x1={r.spoke[0][0]} y1={r.spoke[0][1]} x2={r.spoke[1][0]} y2={r.spoke[1][1]} />
            <polyline points={r.arc} />
          </g>
        ))}
      </g>
    </g>
    <circle cx="32" cy="32" r="30.5" fill="none" stroke="#14201a" strokeWidth="1.6" />
  </svg>
);

export default SoccerBall;
