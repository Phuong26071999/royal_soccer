import React, { useState } from 'react';
import { Match } from '../types';

interface Props {
  matches: Match[];
  /** Fired for a day with no match (admins use it to prefill the new-match form). */
  onPickEmptyDay?: (day: string) => void;
  onPickMatch: (id: string) => void;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Month grid (Monday first): today ringed, match days filled, kick-off time and score shown in the cell. */
const MonthCalendar = ({ matches, onPickEmptyDay, onPickMatch }: Props) => {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  const today = dayKey(now);

  const byDay = new Map<string, Match[]>();
  matches.forEach((m) => {
    const key = m.date.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) || []), m].sort((a, b) => a.date.localeCompare(b.date)));
  });
  const monthMatches = matches.filter((m) => m.date.startsWith(`${year}-${pad(month + 1)}`)).length;
  const go = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <div className="sc-cal" role="region" aria-label={`Lịch tháng ${month + 1}/${year}`}>
      <header className="sc-cal-head">
        <div>
          <h3>Tháng {month + 1}<small>/{year}</small></h3>
          <p className="sc-muted">{monthMatches ? `${monthMatches} trận trong tháng` : 'Tháng này chưa có trận'}</p>
        </div>
        <div className="sc-cal-nav">
          <button type="button" className="sc-btn ghost small" onClick={() => go(-1)} aria-label="Tháng trước"><i className="bx bx-chevron-left" aria-hidden="true"></i></button>
          <button type="button" className="sc-btn ghost small" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>Hôm nay</button>
          <button type="button" className="sc-btn ghost small" onClick={() => go(1)} aria-label="Tháng sau"><i className="bx bx-chevron-right" aria-hidden="true"></i></button>
        </div>
      </header>
      <div className="sc-cal-grid" role="grid">
        {WEEKDAYS.map((w, i) => <span key={w} className={`sc-cal-dow${i > 4 ? ' weekend' : ''}`} role="columnheader">{w}</span>)}
        {Array.from({ length: total }, (_, i) => {
          const d = new Date(year, month, i - lead + 1);
          const key = dayKey(d);
          const list = byDay.get(key) || [];
          const out = d.getMonth() !== month;
          const cls = `sc-cal-day${out ? ' out' : ''}${key === today ? ' today' : ''}${list.length ? ' has' : ''}${key < today ? ' past' : ''}${(i % 7) > 4 ? ' weekend' : ''}`;
          const label = `${d.getDate()}/${d.getMonth() + 1}${list.length ? `, ${list.length} trận` : ''}`;
          return (
            <button key={key} type="button" role="gridcell" className={cls} aria-label={label}
              disabled={!list.length && (!onPickEmptyDay || key < today)}
              onClick={() => (list.length ? onPickMatch(list[0].id) : onPickEmptyDay?.(key))}>
              <b>{d.getDate()}</b>
              {list.map((m) => (
                <span key={m.id} className="sc-cal-match" title={m.location}>
                  <i aria-hidden="true"></i>{m.score ? m.score : m.date.slice(11, 16)}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MonthCalendar;
