import React, { useState } from 'react';
import { Match, SoccerState } from '../types';
import { formatMatchDate, formatMoney, matchCostTotal, matchShare, participantsOf, randomId } from '../utils';
import Avatar from './Avatar';
import MonthCalendar from './MonthCalendar';

interface Props {
  state: SoccerState;
  isAdmin: boolean;
  onAdd: (match: Match) => void;
  onUpdate: (match: Match) => void;
  onRemove: (id: string) => void;
}

const TEAM_NAMES = ['Đội 1', 'Đội 2', 'Đội 3', 'Đội 4'];
// Matches stay "upcoming" for 3 hours after kick-off.
const isUpcoming = (m: Match) => new Date(m.date).getTime() >= Date.now() - 3 * 3600 * 1000;

const COST_PRESETS = ['Tiền sân', 'Nước uống', 'Thuê áo bib'];

/** Who played, what the session cost, and each player's share (cost split evenly). */
const AttendancePanel = ({ match, state, isAdmin, onUpdate }: {
  match: Match; state: SoccerState; isAdmin: boolean; onUpdate: (m: Match) => void;
}) => {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const byId = new Map(state.members.map((m) => [m.id, m]));
  const players = participantsOf(match);
  const total = matchCostTotal(match);
  const share = matchShare(match);
  const costs = match.costs || [];
  const fromTeams = Array.from(new Set(match.teams.flat()));

  const toggle = (id: string) => {
    const next = players.includes(id) ? players.filter((p) => p !== id) : [...players, id];
    onUpdate({ ...match, attendees: next });
  };
  const addCost = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount.replace(/[^0-9]/g, ''));
    if (!value) { setError('Nhập số tiền.'); return; }
    onUpdate({ ...match, costs: [...costs, { id: randomId(), note: note.trim().slice(0, 60), amount: value }] });
    setNote(''); setAmount(''); setError('');
  };

  const summary = `${players.length} người${total ? ` · ${formatMoney(share)}/người` : ''}`;
  return (
    <details className="sc-attend">
      <summary><i className="bx bx-group" aria-hidden="true"></i> Điểm danh &amp; chi phí <span className="sc-attend-sum">{summary}</span></summary>
      <div className="sc-attend-body">
        <div className="sc-attend-head">
          <b>Tham gia ({players.length})</b>
          {isAdmin && (
            <span className="sc-row-gap">
              {fromTeams.length > 0 && <button type="button" className="sc-btn ghost small" onClick={() => onUpdate({ ...match, attendees: fromTeams })}>Lấy từ đội hình</button>}
              <button type="button" className="sc-btn ghost small" onClick={() => onUpdate({ ...match, attendees: state.members.map((m) => m.id) })}>Chọn tất cả</button>
              {players.length > 0 && <button type="button" className="sc-btn ghost small" onClick={() => onUpdate({ ...match, attendees: [] })}>Bỏ chọn</button>}
            </span>
          )}
        </div>
        {isAdmin ? (
          <div className="sc-pick-grid">
            {state.members.map((m) => (
              <button key={m.id} type="button" className={`sc-pick${players.includes(m.id) ? ' on' : ''}`} aria-pressed={players.includes(m.id)} onClick={() => toggle(m.id)}>
                <span className="sc-pick-av"><Avatar member={m} size={38} />{players.includes(m.id) && <i className="bx bx-check" aria-hidden="true"></i>}</span>
                <span className="sc-pick-name">{m.name}</span>
                {m.number !== null && <small className="sc-pick-no">{m.number}</small>}
              </button>
            ))}
          </div>
        ) : players.length ? (
          <div className="sc-pick-grid readonly">
            {players.map((id) => byId.get(id)).filter(Boolean).map((m) => (
              <span key={m!.id} className="sc-pick on"><span className="sc-pick-av"><Avatar member={m!} size={38} /></span><span className="sc-pick-name">{m!.name}</span>{m!.number !== null && <small className="sc-pick-no">{m!.number}</small>}</span>
            ))}
          </div>
        ) : <p className="sc-muted">Chưa điểm danh.</p>}

        <div className="sc-attend-head"><b>Chi phí buổi đá</b><b className="sc-cost-total">{formatMoney(total)}</b></div>
        {costs.length > 0 && (
          <ul className="sc-cost-list">
            {costs.map((c) => (
              <li key={c.id}>
                <span className="sc-grow">{c.note || 'Khoản chi'}</span><b>{formatMoney(c.amount)}</b>
                {isAdmin && <button type="button" className="sc-icon-btn" aria-label="Xóa khoản chi" onClick={() => onUpdate({ ...match, costs: costs.filter((x) => x.id !== c.id) })}><i className="bx bx-x"></i></button>}
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <form className="sc-cost-form" onSubmit={addCost} noValidate>
            <input value={note} maxLength={60} placeholder="Khoản chi (tiền sân, nước...)" aria-label="Tên khoản chi" onChange={(e) => setNote(e.target.value)} list={`cost-presets-${match.id}`} />
            <datalist id={`cost-presets-${match.id}`}>{COST_PRESETS.map((p) => <option key={p} value={p} />)}</datalist>
            <input inputMode="numeric" value={amount} placeholder="Số tiền (đ)" aria-label="Số tiền" onChange={(e) => { setAmount(e.target.value); setError(''); }} />
            <button type="submit" className="sc-btn small"><i className="bx bx-plus" aria-hidden="true"></i>Thêm</button>
          </form>
        )}
        {error && <small className="sc-error" role="alert">{error}</small>}
        <div className="sc-share">
          {total > 0 && players.length > 0 ? (
            <><span>{formatMoney(total)} ÷ {players.length} người</span><b>{formatMoney(share)}<small>/người</small></b></>
          ) : (
            <span className="sc-muted">{total > 0 ? 'Điểm danh để chia tiền cho từng người.' : 'Thêm khoản chi để tính tiền mỗi người.'}</span>
          )}
        </div>
      </div>
    </details>
  );
};

const MatchCard = ({ match, state, isAdmin, onUpdate, onRemove, featured }: {
  match: Match; state: SoccerState; isAdmin: boolean; featured?: boolean;
  onUpdate: (m: Match) => void; onRemove: (id: string) => void;
}) => {
  const [score, setScore] = useState(match.score);
  const byId = new Map(state.members.map((m) => [m.id, m]));
  const d = new Date(match.date);
  const valid = !Number.isNaN(d.getTime());
  return (
    <article id={`match-${match.id}`} className={`sc-match${featured ? ' featured' : ''}`}>
      <div className="sc-match-head">
        <div className="sc-date-block" aria-hidden="true">
          <small>{valid ? d.toLocaleDateString('vi-VN', { weekday: 'short' }) : ''}</small>
          <b>{valid ? String(d.getDate()).padStart(2, '0') : '--'}</b>
          <small>{valid ? `Th${d.getMonth() + 1}` : ''}</small>
        </div>
        <div className="sc-match-info">
          {featured && <span className="sc-chip ok">Trận sắp tới</span>}
          <h3>{formatMatchDate(match.date)}</h3>
          <p><i className="bx bx-map" aria-hidden="true"></i> {match.location}</p>
          {match.note && <p className="sc-muted">{match.note}</p>}
        </div>
        <div className="sc-score">
          {isAdmin ? (
            <input value={score} maxLength={20} placeholder="0 - 0" aria-label="Tỉ số"
              onChange={(e) => setScore(e.target.value)} onBlur={() => score !== match.score && onUpdate({ ...match, score: score.trim() })} />
          ) : match.score ? <b>{match.score}</b> : <span className="sc-muted">Chưa có tỉ số</span>}
        </div>
      </div>
      {match.teams.length > 0 && (
        <div className={`sc-match-teams n${match.teams.length}`}>
          {match.teams.map((team, i) => (
            <div key={i} className={`sc-mini-team c${i}`}>
              <b>{TEAM_NAMES[i]}</b>
              <div className="sc-avatars">
                {team.map((id) => byId.get(id)).filter(Boolean).map((m) => (
                  <span key={m!.id} title={m!.name}><Avatar member={m!} size={28} /></span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <AttendancePanel match={match} state={state} isAdmin={isAdmin} onUpdate={onUpdate} />
      {isAdmin && (
        <div className="sc-match-actions">
          {match.teams.length > 0 && <button type="button" className="sc-btn ghost small" onClick={() => onUpdate({ ...match, teams: [] })}>Xóa đội hình</button>}
          <button type="button" className="sc-link-danger" onClick={() => window.confirm('Xóa trận này?') && onRemove(match.id)}>
            <i className="bx bx-trash" aria-hidden="true"></i> Xóa trận
          </button>
        </div>
      )}
    </article>
  );
};

const ScheduleTab = ({ state, isAdmin, onAdd, onUpdate, onRemove }: Props) => {
  const [form, setForm] = useState({ date: '', location: '', note: '' });
  const [error, setError] = useState('');
  const upcoming = state.matches.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date));
  const past = state.matches.filter((m) => !isUpcoming(m)).sort((a, b) => b.date.localeCompare(a.date));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { setError('Chọn ngày giờ đá.'); return; }
    if (!form.location.trim()) { setError('Nhập địa điểm sân.'); return; }
    onAdd({ id: randomId(), date: form.date, location: form.location.trim(), note: form.note.trim(), score: '', teams: [] });
    setForm({ date: '', location: form.location, note: '' });
    setError('');
  };

  const cardProps = { state, isAdmin, onUpdate, onRemove };
  const showMatch = (id: string) => {
    const el = document.getElementById(`match-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth; // restart the highlight animation
    el.classList.add('flash');
  };
  return (
    <section aria-label="Lịch đá">
      <MonthCalendar matches={state.matches} onPickMatch={showMatch}
        onPickEmptyDay={isAdmin ? (day) => { setForm((f) => ({ ...f, date: `${day}T19:00` })); setError(''); document.querySelector('.sc-match-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } : undefined} />
      {isAdmin && (
        <form className="sc-panel sc-match-form" onSubmit={submit} noValidate>
          <h3>Tạo lịch đá</h3>
          <div className="sc-form-grid">
            <label><span>Ngày giờ</span><input type="datetime-local" value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); setError(''); }} /></label>
            <label><span>Địa điểm</span><input value={form.location} maxLength={120} placeholder="Tên sân" onChange={(e) => { setForm({ ...form, location: e.target.value }); setError(''); }} /></label>
            <label className="sc-span-2"><span>Ghi chú (tùy chọn)</span><input value={form.note} maxLength={200} placeholder="Mang áo màu, tiền sân..." onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          </div>
          {error && <small className="sc-error" role="alert">{error}</small>}
          <button type="submit" className="sc-btn"><i className="bx bx-calendar-plus" aria-hidden="true"></i>Tạo trận</button>
        </form>
      )}

      <h3 className="sc-section-title">Sắp diễn ra</h3>
      {upcoming.length ? (
        <div className="sc-match-list">
          {upcoming.map((m, i) => <MatchCard key={m.id} match={m} featured={i === 0} {...cardProps} />)}
        </div>
      ) : (
        <p className="sc-empty">Chưa có lịch đá nào sắp tới.{isAdmin ? ' Tạo trận ở form phía trên.' : ''}</p>
      )}

      {past.length > 0 && (
        <>
          <h3 className="sc-section-title">Đã đá</h3>
          <div className="sc-match-list">{past.map((m) => <MatchCard key={m.id} match={m} {...cardProps} />)}</div>
        </>
      )}
    </section>
  );
};

export default ScheduleTab;
