import React, { useState } from 'react';
import { Match, SoccerState, Venue } from '../types';
import { formatMatchDate, formatMoney, matchCostTotal, matchShare, participantsOf, randomId } from '../utils';
import Avatar from './Avatar';
import MoneyInput from './MoneyInput';
import { allVenues, isPreset } from '../venues';
import VenuePicker from './VenuePicker';
import VenueDialog from './VenueDialog';
import MonthCalendar from './MonthCalendar';

interface Props {
  state: SoccerState;
  isAdmin: boolean;
  onAdd: (match: Match) => void;
  onUpdate: (match: Match) => void;
  onRemove: (id: string) => void;
  onAddVenue: (venue: Venue) => void;
  onUpdateVenue: (venue: Venue) => void;
  onRemoveVenue: (venueId: string) => void;
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
  const [amount, setAmount] = useState(0);
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
    const value = amount;
    if (!value) { setError('Nhập số tiền.'); return; }
    onUpdate({ ...match, costs: [...costs, { id: randomId(), note: note.trim().slice(0, 60), amount: value }] });
    setNote(''); setAmount(0); setError('');
  };

  const summary = `${players.length} người${total ? ` · ${formatMoney(share)}/người` : ''}`;
  return (
    <details className="sc-attend">
      <summary><i className="bx bx-group" aria-hidden="true"></i> Điểm danh &amp; chi phí <span className="sc-attend-sum">{summary}</span></summary>
      <div className="sc-attend-body">
        <div className="sc-roster-head">
          <div className="sc-roster-title">
            <b>Người tham gia</b>
            <span className="sc-roster-count"><b>{players.length}</b>/{state.members.length}</span>
          </div>
          <span className="sc-roster-bar" aria-hidden="true"><span style={{ width: `${state.members.length ? Math.round((players.length / state.members.length) * 100) : 0}%` }}></span></span>
          {isAdmin && (
            <div className="sc-roster-actions">
              {fromTeams.length > 0 && <button type="button" onClick={() => onUpdate({ ...match, attendees: fromTeams })}><i className="bx bx-shuffle" aria-hidden="true"></i>Lấy từ đội hình</button>}
              <button type="button" onClick={() => onUpdate({ ...match, attendees: state.members.map((m) => m.id) })}><i className="bx bx-check-double" aria-hidden="true"></i>Chọn tất cả</button>
              {players.length > 0 && <button type="button" onClick={() => onUpdate({ ...match, attendees: [] })}><i className="bx bx-x" aria-hidden="true"></i>Bỏ chọn</button>}
            </div>
          )}
        </div>
        {isAdmin ? (
          <div className="sc-roster">
            {state.members.map((m, idx) => {
              const on = players.includes(m.id);
              return (
                <button key={m.id} type="button" className={`sc-tile${on ? ' on' : ''}`} style={{ '--i': idx } as React.CSSProperties} aria-pressed={on} onClick={() => toggle(m.id)}>
                  {m.number !== null && <small className="sc-tile-no">{m.number}</small>}
                  <span className="sc-tile-av"><Avatar member={m} size={52} /><i className="bx bx-check" aria-hidden="true"></i></span>
                  <span className="sc-tile-name">{m.name}</span>
                </button>
              );
            })}
          </div>
        ) : players.length ? (
          <div className="sc-roster readonly">
            {players.map((id) => byId.get(id)).filter(Boolean).map((m) => (
              <span key={m!.id} className="sc-tile on">
                {m!.number !== null && <small className="sc-tile-no">{m!.number}</small>}
                <span className="sc-tile-av"><Avatar member={m!} size={52} /></span>
                <span className="sc-tile-name">{m!.name}</span>
              </span>
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
            <MoneyInput value={amount} placeholder="Số tiền (đ)" aria-label="Số tiền" onChange={(v) => { setAmount(v); setError(''); }} />
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

/** Edit the date/time and note of a match (the pitch is changed with "Đổi sân"). */
const MatchEditDialog = ({ match, onClose, onSave }: { match: Match; onClose: () => void; onSave: (m: Match) => void }) => {
  const [date, setDate] = useState(match.date);
  const [note, setNote] = useState(match.note);
  const [error, setError] = useState('');
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) { setError('Chọn ngày giờ đá.'); return; }
    onSave({ ...match, date, note: note.trim().slice(0, 200) });
  };
  return (
    <div className="sc-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sc-dialog small sc-venue-dialog" role="dialog" aria-modal="true" aria-labelledby="sc-edit-match-title" onSubmit={submit} noValidate>
        <button type="button" className="sc-close" onClick={onClose} aria-label="Đóng"><i className="bx bx-x"></i></button>
        <h2 id="sc-edit-match-title">Sửa trận</h2>
        <p className="sc-muted">{match.location}</p>
        <label className="sc-field">
          <span>Ngày giờ</span>
          <input type="datetime-local" value={date} autoFocus aria-label="Ngày giờ" onChange={(e) => { setDate(e.target.value); setError(''); }} />
        </label>
        <label className="sc-field">
          <span>Ghi chú (tùy chọn)</span>
          <input value={note} maxLength={200} placeholder="Mang áo màu, tiền sân..." aria-label="Ghi chú" onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <small className="sc-error" role="alert">{error}</small>}
        <div className="sc-venue-actions">
          <button type="button" className="sc-btn ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="sc-btn"><i className="bx bx-save" aria-hidden="true"></i>Lưu</button>
        </div>
      </form>
    </div>
  );
};

const MatchCard = ({ match, state, isAdmin, onUpdate, onRemove, onPickVenue, featured }: {
  match: Match; state: SoccerState; isAdmin: boolean; featured?: boolean;
  onUpdate: (m: Match) => void; onRemove: (id: string) => void; onPickVenue: (match: Match) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const venue = allVenues(state).find((v) => v.id === match.venueId);
  const photos = (venue && venue.images) || [];
  const mapUrl = match.mapUrl || (venue && venue.mapUrl) || '';
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
          {match.note && <p className="sc-muted">{match.note}</p>}
        </div>
        <div className="sc-score">
          {isAdmin ? (
            <input value={score} maxLength={20} placeholder="0 - 0" aria-label="Tỉ số"
              onChange={(e) => setScore(e.target.value)} onBlur={() => score !== match.score && onUpdate({ ...match, score: score.trim() })} />
          ) : match.score ? <b>{match.score}</b> : <span className="sc-muted">Chưa có tỉ số</span>}
        </div>
      </div>
      <div className="sc-match-venue">
        <div className="sc-mv-thumb">
          {photos[0] ? <a href={photos[0]} target="_blank" rel="noopener noreferrer" aria-label="Xem hình sân"><img src={photos[0]} alt="" loading="lazy" /></a> : <i className="bx bx-map" aria-hidden="true"></i>}
        </div>
        <div className="sc-mv-text">
          <b>{match.location}</b>
          {match.address && <p className="sc-muted">{match.address}</p>}
          <div className="sc-mv-links">
            {mapUrl && /^https:\/\//i.test(mapUrl) && (
              <a className="sc-map-link" href={mapUrl} target="_blank" rel="noopener noreferrer"><i className="bx bx-map-pin" aria-hidden="true"></i>Xem bản đồ</a>
            )}
            {photos.slice(1).map((url) => (
              <a key={url} className="sc-mv-mini" href={url} target="_blank" rel="noopener noreferrer" aria-label="Xem hình sân"><img src={url} alt="" loading="lazy" /></a>
            ))}
          </div>
        </div>
        {isAdmin && <button type="button" className="sc-btn ghost small" onClick={() => onPickVenue(match)}><i className="bx bx-transfer-alt" aria-hidden="true"></i>Đổi sân</button>}
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
          <button type="button" className="sc-btn ghost small" onClick={() => setEditing(true)}><i className="bx bx-edit-alt" aria-hidden="true"></i>Sửa trận</button>
          {match.teams.length > 0 && <button type="button" className="sc-btn ghost small" onClick={() => onUpdate({ ...match, teams: [] })}>Xóa đội hình</button>}
          <button type="button" className="sc-link-danger" onClick={() => window.confirm('Xóa trận này?') && onRemove(match.id)}>
            <i className="bx bx-trash" aria-hidden="true"></i> Xóa trận
          </button>
        </div>
      )}
      {editing && <MatchEditDialog match={match} onClose={() => setEditing(false)} onSave={(next) => { onUpdate(next); setEditing(false); }} />}
    </article>
  );
};

interface VenueDialogState { venue?: Venue; target: 'form' | string }

/** Copies a venue onto a match (name, address, map link and which venue it is). */
const withVenue = (match: Match, v: Venue): Match => {
  const { address, mapUrl, venueId, ...rest } = match;
  return { ...rest, location: v.name, ...(v.address ? { address: v.address } : {}), ...(v.mapUrl ? { mapUrl: v.mapUrl } : {}), venueId: v.id };
};

const ScheduleTab = ({ state, isAdmin, onAdd, onUpdate, onRemove, onAddVenue, onUpdateVenue, onRemoveVenue }: Props) => {
  const [form, setForm] = useState({ date: '', venue: '', note: '' });
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const [chooserFor, setChooserFor] = useState('');
  const [venueDialog, setVenueDialog] = useState<VenueDialogState | null>(null);
  const venues = allVenues(state);
  const chooserMatch = state.matches.find((m) => m.id === chooserFor);
  const [error, setError] = useState('');
  const upcoming = state.matches.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date));
  const past = state.matches.filter((m) => !isUpcoming(m)).sort((a, b) => b.date.localeCompare(a.date));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { setError('Chọn ngày giờ đá.'); return; }
    const venue = venues.find((v) => v.id === form.venue);
    if (!venue) { setError('Chọn địa điểm sân.'); return; }
    onAdd(withVenue({ id: randomId(), date: form.date, location: '', note: form.note.trim(), score: '', teams: [] }, venue));
    setForm({ date: '', venue: form.venue, note: '' });
    setError('');
  };

  const saveVenue = (v: Venue) => {
    const editing = state.venues.some((x) => x.id === v.id); // a built-in pitch is added as an override the first time
    if (editing) onUpdateVenue(v); else onAddVenue(v);
    const target = venueDialog && venueDialog.target;
    if (target === 'form') setForm((f) => ({ ...f, venue: v.id }));
    else if (target) {
      const m = state.matches.find((x) => x.id === target);
      if (m) onUpdate(withVenue(m, v));
      setChooserFor('');
    }
    setVenueDialog(null);
  };
  const deleteVenue = (venueId: string) => {
    onRemoveVenue(venueId);
    setForm((f) => (f.venue === venueId ? { ...f, venue: '' } : f));
    setVenueDialog(null);
  };

  const cardProps = { state, isAdmin, onUpdate, onRemove, onPickVenue: (m: Match) => setChooserFor(m.id) };
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
      <div className="sc-fund-bar">
        <div className="sc-style-picker sc-fund-switch" role="tablist" aria-label="Lịch đá">
          <button type="button" role="tab" aria-selected={view === 'upcoming'} className={view === 'upcoming' ? 'on' : ''} onClick={() => setView('upcoming')}>
            Sắp diễn ra <b>{upcoming.length}</b>
          </button>
          <button type="button" role="tab" aria-selected={view === 'past'} className={view === 'past' ? 'on' : ''} onClick={() => setView('past')}>
            <i className="bx bx-history" aria-hidden="true"></i>Lịch đã đá <b>{past.length}</b>
          </button>
        </div>
      </div>

      {view === 'upcoming' ? (
        upcoming.length ? (
          <div className="sc-match-list">
            <MatchCard key={upcoming[0].id} match={upcoming[0]} featured {...cardProps} />
          </div>
        ) : (
          <p className="sc-empty">Chưa có lịch đá nào sắp tới.{isAdmin ? ' Tạo trận ở form bên dưới.' : ''}</p>
        )
      ) : past.length ? (
        <div className="sc-match-list">{past.map((m) => <MatchCard key={m.id} match={m} {...cardProps} />)}</div>
      ) : (
        <p className="sc-empty">Chưa có trận nào đã đá.</p>
      )}

      {view === 'upcoming' && (
        <>
          <MonthCalendar matches={state.matches} onPickMatch={showMatch}
            onPickEmptyDay={isAdmin ? (day) => { setForm((f) => ({ ...f, date: `${day}T19:00` })); setError(''); document.querySelector('.sc-match-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } : undefined} />
          {isAdmin && (
            <form className="sc-panel sc-match-form" onSubmit={submit} noValidate>
              <h3>Tạo lịch đá</h3>
              <div className="sc-form-grid">
                <label><span>Ngày giờ</span><input type="datetime-local" value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); setError(''); }} /></label>
                <div className="sc-span-2 sc-venues">
                  <span className="sc-venues-label">Địa điểm</span>
                  <VenuePicker venues={venues} value={form.venue} onChange={(id) => { setForm({ ...form, venue: id }); setError(''); }}
                    onAdd={() => setVenueDialog({ target: 'form' })} onEdit={(v) => setVenueDialog({ venue: v, target: 'form' })} />
                </div>
                <label className="sc-span-2"><span>Ghi chú (tùy chọn)</span><input value={form.note} maxLength={200} placeholder="Mang áo màu, tiền sân..." onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              </div>
              {error && <small className="sc-error" role="alert">{error}</small>}
              <button type="submit" className="sc-btn"><i className="bx bx-calendar-plus" aria-hidden="true"></i>Tạo trận</button>
            </form>
          )}

          {upcoming.length > 1 && (
            <>
              <h3 className="sc-section-title">Các trận tiếp theo</h3>
              <div className="sc-match-list">
                {upcoming.slice(1).map((m) => <MatchCard key={m.id} match={m} {...cardProps} />)}
              </div>
            </>
          )}
        </>
      )}

      {chooserMatch && !venueDialog && (
        <div className="sc-overlay" onMouseDown={(e) => e.target === e.currentTarget && setChooserFor('')}>
          <div className="sc-dialog sc-venue-chooser" role="dialog" aria-modal="true" aria-labelledby="sc-chooser-title">
            <button type="button" className="sc-close" onClick={() => setChooserFor('')} aria-label="Đóng"><i className="bx bx-x"></i></button>
            <h2 id="sc-chooser-title">Chọn địa điểm</h2>
            <p className="sc-muted">{formatMatchDate(chooserMatch.date)}</p>
            <VenuePicker venues={venues} value={chooserMatch.venueId || ''}
              onChange={(id) => { const v = venues.find((x) => x.id === id); if (v) onUpdate(withVenue(chooserMatch, v)); setChooserFor(''); }}
              onAdd={() => setVenueDialog({ target: chooserMatch.id })} onEdit={(v) => setVenueDialog({ venue: v, target: chooserMatch.id })} />
          </div>
        </div>
      )}
      {venueDialog && <VenueDialog key={venueDialog.venue?.id || 'new'} venue={venueDialog.venue} onClose={() => setVenueDialog(null)} onSave={saveVenue}
        onRemove={venueDialog.venue && isPreset(venueDialog.venue.id) && !state.venues.some((x) => x.id === venueDialog.venue!.id) ? undefined : deleteVenue}
        restoreDefault={Boolean(venueDialog.venue && isPreset(venueDialog.venue.id))} />}
    </section>
  );
};

export default ScheduleTab;
