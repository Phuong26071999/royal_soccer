import React from 'react';
import { Member } from '../types';
import { Club, DEFAULT_CARD_COLOR, inkFor } from '../clubs';
import Avatar from './Avatar';

interface Props {
  title: string;
  vs: string;
  starters: Member[];
  subs: Member[];
  /** Club whose colour and crest dress the poster; none = site green. */
  club?: Club;
}

// Poster reads like a team sheet: keeper first, then defenders, then forwards.
const SHEET_ORDER = [4, 2, 3, 0, 1];

/** "Starting XI" poster: crest tile, then one tile per player with a giant shirt number behind the portrait. */
const LineupPoster = ({ title, vs, starters, subs, club }: Props) => {
  const color = club?.color || DEFAULT_CARD_COLOR;
  const style = { '--cc': color, '--ci': inkFor(color) } as React.CSSProperties;
  const ordered = [...SHEET_ORDER.map((i) => starters[i]), ...starters.slice(SHEET_ORDER.length)].filter(Boolean) as Member[];
  return (
    <article className="sc-xi" style={style} aria-label={`Đội hình xuất phát ${title}`}>
     <div className="sc-xi-in">
      <header className="sc-xi-head">
        <small>Sân 5 người</small>
        <b>Xuất phát</b>
      </header>
      <div className="sc-xi-grid">
        <div className="sc-xi-tile crest">
          {club ? <img src={club.crest} alt={club.name} referrerPolicy="no-referrer" /> : <strong className="sc-xi-mark">V</strong>}
          <em>{title}</em>
        </div>
        {ordered.map((m, i) => (
          <div key={m.id} className={`sc-xi-tile${i % 2 ? ' alt' : ''}`}>
            <b className="sc-xi-no">{m.number ?? '--'}</b>
            <span className="sc-xi-photo"><Avatar member={m} size={96} /></span>
            <span className="sc-xi-name">{m.name}</span>
          </div>
        ))}
      </div>
      <footer className="sc-xi-foot">
        <b>{vs}</b>
        <span>Giao hữu</span>
        {subs.length > 0 && <p><em>Dự bị:</em> {subs.map((m) => m.name).join(' · ')}</p>}
      </footer>
     </div>
    </article>
  );
};

export default LineupPoster;
