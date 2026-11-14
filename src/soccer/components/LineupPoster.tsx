import React from 'react';
import { Member } from '../types';
import { Club, DEFAULT_CARD_COLOR, inkFor } from '../clubs';
import Avatar from './Avatar';
import { TIERS, shortName } from '../utils';

interface Props {
  title: string;
  vs: string;
  starters: Member[];
  subs: Member[];
  /** Club whose colour and crest dress the poster; none = site green. */
  club?: Club;
  /** Line under the matchup: next fixture (date, pitch) or a generic label. */
  info?: string;
}

// Poster reads like a team sheet: keeper first, then defenders, then forwards.
const SHEET_ORDER = [4, 2, 3, 0, 1];

/** "Starting XI" poster: crest tile, then one tile per player with a giant shirt number behind the portrait. */
const LineupPoster = ({ title, vs, starters, subs, club, info = 'Giao hữu' }: Props) => {
  const color = club?.color || DEFAULT_CARD_COLOR;
  const style = { '--cc': color, '--ci': inkFor(color) } as React.CSSProperties;
  const ordered = [...SHEET_ORDER.map((i) => starters[i]), ...starters.slice(SHEET_ORDER.length)].filter(Boolean) as Member[];
  const tile = (m: Member, i: number) => (
    <div key={m.id} className={`sc-xi-tile${i % 2 ? ' alt' : ''}`}>
      <b className="sc-xi-no">{m.number ?? '--'}</b>
      <span className="sc-xi-photo"><Avatar member={m} size={96} /></span>
      <span className="sc-xi-name">{shortName(m.name)}</span>
      <em className={`sc-xi-tier t${m.tier}`} title={TIERS[m.tier].name}>{TIERS[m.tier].label}</em>
    </div>
  );
  return (
    <article className="sc-xi" style={style} aria-label={`Đội hình xuất phát ${title}`}>
     <div className="sc-xi-in">
      <svg className="sc-xi-wave top" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H100V7C82 14 70 1 52 6S18 12 0 6Z" /></svg>
      <svg className="sc-xi-wave bottom" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 14H100V7C82 0 70 13 52 8S18 2 0 8Z" /></svg>
      <header className="sc-xi-head">
        <small>Sân 5 người</small>
        <b>Xuất phát</b>
      </header>
      <div className="sc-xi-grid">
        <div className="sc-xi-tile crest">
          {club ? <img src={club.crest} alt={club.name} referrerPolicy="no-referrer" /> : <strong className="sc-xi-mark">V</strong>}
          <em>{title}</em>
        </div>
        {ordered.map((m, i) => tile(m, i))}
      </div>
      {subs.length > 0 && (
        <>
          <h4 className="sc-xi-sub-title">Dự bị</h4>
          <div className="sc-xi-grid">{subs.map((m, i) => tile(m, i))}</div>
        </>
      )}
      <footer className="sc-xi-foot">
        <b>{vs}</b>
        <span>{info}</span>
      </footer>
     </div>
    </article>
  );
};

export default LineupPoster;
