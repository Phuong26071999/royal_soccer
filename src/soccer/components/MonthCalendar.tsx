import React, { useState } from 'react';
import { Match } from '../types';

interface Props {
  matches: Match[];
  /** Fired for a day with no match (admins use it to prefill the new-match form). */
  onPickEmptyDay?: (day: string) => void;
  onPickMatch: (id: string) => void;
}

// [full label, short label]: the full one shows on wide screens
const WEEKDAYS: Array<[string, string]> = [['Thứ Hai', 'T2'], ['Thứ Ba', 'T3'], ['Thứ Tư', 'T4'], ['Thứ Năm', 'T5'], ['Thứ Sáu', 'T6'], ['Thứ Bảy', 'T7'], ['Chủ Nhật', 'CN']];
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MAX_CHIPS = 2;

/** Month grid (Monday first): today ringed, match days highlighted with kick-off time and pitch, played days dimmed with the score. */
const MonthCalendar = ({ matches, onPickEmptyDay, onPickMatch }: Props) => {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [dir, setDir] = useState<'next' | 'prev' | 'none'>('none');
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
  const prefix = `${year}-${pad(month + 1)}`;
  const monthMatches = matches.filter((m) => m.date.startsWith(prefix));
  const played = monthMatches.filter((m) => m.date.slice(0, 10) < today || (m.date.slice(0, 10) === today && new Date(m.date).getTime() < Date.now())).length;
  const go = (delta: number) => { setDir(delta > 0 ? 'next' : 'prev'); setCursor(new Date(year, month + delta, 1)); };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="sc-month" role="region" aria-label={`Lịch tháng ${month + 1}/${year}`}>
      <header className="sc-month-head">
        <div className="sc-month-title">
          <span className="sc-month-icon" aria-hidden="true"><i className="bx bx-calendar-event"></i></span>
          <div>
            <h3>Tháng {month + 1}<small>/{year}</small></h3>
            <div className="sc-month-stats">
              {monthMatches.length ? (
                <>
                  <span className="sc-month-chip up"><i></i>{monthMatches.length - played} sắp đá</span>
                  <span className="sc-month-chip done"><i></i>{played} đã đá</span>
                </>
              ) : <span className="sc-month-chip">Tháng này chưa có trận</span>}
            </div>
          </div>
        </div>
        <div className="sc-month-nav">
          <button type="button" className="sc-month-arrow" onClick={() => go(-1)} aria-label="Tháng trước"><i className="bx bx-chevron-left" aria-hidden="true"></i></button>
          <button type="button" className="sc-month-today" disabled={isCurrentMonth} onClick={() => { setDir(cursor < new Date(now.getFullYear(), now.getMonth(), 1) ? 'next' : 'prev'); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); }}>Hôm nay</button>
          <button type="button" className="sc-month-arrow" onClick={() => go(1)} aria-label="Tháng sau"><i className="bx bx-chevron-right" aria-hidden="true"></i></button>
        </div>
      </header>

      <div className="sc-month-dow" aria-hidden="true">
        {WEEKDAYS.map(([full, short], i) => <span key={short} className={i > 4 ? 'weekend' : ''}><b className="full">{full}</b><b className="short">{short}</b></span>)}
      </div>
      <div key={prefix} className={`sc-month-grid ${dir}`} role="grid">
        {Array.from({ length: total }, (_, i) => {
          const d = new Date(year, month, i - lead + 1);
          const key = dayKey(d);
          const list = byDay.get(key) || [];
          const out = d.getMonth() !== month;
          const past = key < today;
          const cls = ['sc-md', out && 'out', key === today && 'today', list.length && 'has', past && 'past', (i % 7) > 4 && 'weekend'].filter(Boolean).join(' ');
          const label = `${d.getDate()}/${d.getMonth() + 1}${list.length ? `, ${list.length} trận: ${list.map((m) => `${m.date.slice(11, 16)} ${m.location}`).join('; ')}` : ''}`;
          return (
            <button key={key} type="button" role="gridcell" className={cls} aria-label={label} title={list.length ? label : undefined}
              style={{ '--d': Math.floor(i / 7) } as React.CSSProperties}
              disabled={!list.length && (!onPickEmptyDay || key < today)}
              onClick={() => (list.length ? onPickMatch(list[0].id) : onPickEmptyDay?.(key))}>
              <span className="sc-md-top">
                <span className="sc-md-num">{d.getDate()}</span>
                {key === today && <em className="sc-md-tag">Hôm nay</em>}
                {list.length > 0 && <i className="bx bx-football sc-md-ball" aria-hidden="true"></i>}
              </span>
              {list.slice(0, MAX_CHIPS).map((m) => {
                const done = new Date(m.date).getTime() < Date.now();
                return (
                  <span key={m.id} className={`sc-md-match${done ? ' done' : ''}`}>
                    <i className={`bx ${done ? 'bx-check-circle' : 'bx-time-five'}`} aria-hidden="true"></i>
                    <b>{m.score ? m.score : m.date.slice(11, 16)}</b>
                    <em>{m.location}</em>
                  </span>
                );
              })}
              {list.length > MAX_CHIPS && <span className="sc-md-more">+{list.length - MAX_CHIPS}</span>}
              {!list.length && !out && !past && onPickEmptyDay && <span className="sc-md-add" aria-hidden="true"><i className="bx bx-plus"></i></span>}
            </button>
          );
        })}
      </div>

      <footer className="sc-month-legend" aria-hidden="true">
        <span><i className="today"></i>Hôm nay</span>
        <span><i className="up"></i>Sắp đá</span>
        <span><i className="done"></i>Đã đá</span>
        {onPickEmptyDay && <span className="hint"><i className="bx bx-plus"></i>Bấm ngày trống để tạo trận</span>}
      </footer>
    </div>
  );
};

export default MonthCalendar;
