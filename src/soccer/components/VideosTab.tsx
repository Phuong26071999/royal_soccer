import React, { useEffect, useRef, useState } from 'react';
import { SoccerState, VideoItem } from '../types';
import { randomId, youtubeId } from '../utils';
import { allVenues } from '../venues';

const MAX_LINKS = 20;
const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayLabel = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Checks a pasted link; returns an error message, or '' when it can be added to `links`. */
const linkProblem = (value: string, links: string[]) => {
  if (!value.trim()) return 'Dán link YouTube trước.';
  const id = youtubeId(value);
  if (!id) return 'Đây không phải link YouTube hợp lệ.';
  if (links.some((l) => youtubeId(l) === id)) return 'Link này đã có trong danh sách.';
  if (links.length >= MAX_LINKS) return `Tối đa ${MAX_LINKS} link cho mỗi mục.`;
  return '';
};

const Thumb = ({ url }: { url: string }) => {
  const id = youtubeId(url);
  const [broken, setBroken] = useState(false);
  return (
    <span className="sc-vid-thumb">
      {id && !broken ? <img src={thumb(id)} alt="" loading="lazy" onError={() => setBroken(true)} /> : <i className="bx bxl-youtube" aria-hidden="true"></i>}
      <span className="sc-vid-play" aria-hidden="true"><i className="bx bx-play"></i></span>
    </span>
  );
};

/** Input + "Thêm link" button; calls onAdd with a valid, new YouTube link. */
const LinkAdder = ({ links, onAdd }: { links: string[]; onAdd: (url: string) => void }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const problem = linkProblem(value, links);
    if (problem) { setError(problem); return; }
    onAdd(value.trim());
    setValue('');
    setError('');
  };
  return (
    <div className="sc-link-adder">
      <div className="sc-link-adder-row">
        <input value={value} maxLength={400} placeholder="Dán link YouTube (https://youtu.be/...)" aria-label="Link YouTube"
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
        <button type="button" className="sc-btn small" onClick={submit}><i className="bx bx-plus" aria-hidden="true"></i>Thêm link</button>
      </div>
      {error && <small className="sc-error" role="alert">{error}</small>}
    </div>
  );
};

/* ---------- create / edit dialog ---------- */

const VideoDialog = ({ item, state, onClose, onSave }: { item?: VideoItem; state: SoccerState; onClose: () => void; onSave: (v: VideoItem) => void }) => {
  const idRef = useRef(item ? item.id : randomId());
  const venues = allVenues(state);
  const [title, setTitle] = useState(item ? item.title : '');
  const [date, setDate] = useState(item ? item.date : today());
  const [venueId, setVenueId] = useState(item && item.venueId ? item.venueId : '');
  const [links, setLinks] = useState<string[]>(item ? item.links : []);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // A venue that was deleted since is still shown as the saved name.
  const orphan = item && item.venueId && !venues.some((v) => v.id === item.venueId) ? item : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Nhập tiêu đề.'); return; }
    if (!date) { setError('Chọn ngày.'); return; }
    const venue = venues.find((v) => v.id === venueId);
    const keepName = orphan && venueId === orphan.venueId ? orphan.venueName : '';
    onSave({
      id: idRef.current,
      title: title.trim().slice(0, 120),
      date,
      ...(venue ? { venueId: venue.id, venueName: venue.name } : keepName ? { venueId, venueName: keepName } : {}),
      links,
    });
  };

  return (
    <div className="sc-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sc-dialog small sc-video-dialog" role="dialog" aria-modal="true" aria-labelledby="sc-video-title" onSubmit={submit} noValidate>
        <button type="button" className="sc-close" onClick={onClose} aria-label="Đóng"><i className="bx bx-x"></i></button>
        <h2 id="sc-video-title">{item ? 'Sửa video' : 'Thêm video buổi đá'}</h2>
        <label className="sc-field">
          <span>Tiêu đề</span>
          <input autoFocus value={title} maxLength={120} placeholder="Highlight buổi đá 16/11" aria-label="Tiêu đề" onChange={(e) => { setTitle(e.target.value); setError(''); }} />
        </label>
        <div className="sc-video-grid2">
          <label className="sc-field">
            <span>Ngày</span>
            <input type="date" value={date} aria-label="Ngày" onChange={(e) => { setDate(e.target.value); setError(''); }} />
          </label>
          <label className="sc-field">
            <span>Sân đá</span>
            <select value={venueId} aria-label="Sân đá" onChange={(e) => setVenueId(e.target.value)}>
              <option value="">— Chưa chọn —</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              {orphan && <option value={orphan.venueId}>{orphan.venueName || 'Sân đã xóa'}</option>}
            </select>
          </label>
        </div>

        <div className="sc-field">
          <span>Link YouTube ({links.length}/{MAX_LINKS})</span>
          <LinkAdder links={links} onAdd={(url) => setLinks([...links, url])} />
          {links.length > 0 && (
            <ul className="sc-vid-links-edit">
              {links.map((url) => (
                <li key={url}>
                  <Thumb url={url} />
                  <a href={url} target="_blank" rel="noopener noreferrer">{url.replace(/^https:\/\/(www\.)?/, '')}</a>
                  <button type="button" className="sc-icon-btn" aria-label="Xóa link" onClick={() => setLinks(links.filter((l) => l !== url))}><i className="bx bx-x"></i></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <small className="sc-error" role="alert">{error}</small>}
        <div className="sc-venue-actions">
          <button type="button" className="sc-btn ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="sc-btn"><i className="bx bx-save" aria-hidden="true"></i>{item ? 'Lưu' : 'Tạo'}</button>
        </div>
      </form>
    </div>
  );
};

/* ---------- tab ---------- */

interface Props {
  state: SoccerState;
  canEdit: boolean;
  onAdd: (item: VideoItem) => void;
  onUpdate: (item: VideoItem) => void;
  onRemove: (id: string) => void;
}

const VideosTab = ({ state, canEdit, onAdd, onUpdate, onRemove }: Props) => {
  const [dialog, setDialog] = useState<{ item?: VideoItem } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VideoItem | null>(null);

  const sorted = [...state.videos].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  const days = Array.from(new Set(sorted.map((v) => v.date)));

  useEffect(() => {
    if (!confirmDelete) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirmDelete(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmDelete]);

  return (
    <section aria-label="Video">
      <div className="sc-fund-bar">
        <div className="sc-vid-title">
          <h2>Video các buổi đá</h2>
          {!sorted.length && <p className="sc-muted">Lưu lại link YouTube của từng buổi đá, theo ngày.</p>}
        </div>
        {canEdit && <button type="button" className="sc-btn small" onClick={() => setDialog({})}><i className="bx bx-plus" aria-hidden="true"></i>Thêm video</button>}
      </div>

      {days.length ? days.map((day) => (
        <div key={day} className="sc-vid-day">
          <h3 className="sc-vid-day-head"><i className="bx bx-calendar" aria-hidden="true"></i>{dayLabel(day)}</h3>
          <div className="sc-vid-list">
            {sorted.filter((v) => v.date === day).map((v) => (
              <article key={v.id} className="sc-vid-card">
                <header>
                  <div className="sc-vid-card-title">
                    <h4>{v.title}</h4>
                    {v.venueName && <p className="sc-muted"><i className="bx bx-map" aria-hidden="true"></i>{v.venueName}</p>}
                  </div>
                  {canEdit && (
                    <div className="sc-row-gap">
                      <button type="button" className="sc-btn ghost small" onClick={() => setDialog({ item: v })}><i className="bx bx-edit-alt" aria-hidden="true"></i>Sửa</button>
                      <button type="button" className="sc-btn ghost small sc-danger" onClick={() => setConfirmDelete(v)}><i className="bx bx-trash" aria-hidden="true"></i>Xóa</button>
                    </div>
                  )}
                </header>
                {v.links.length ? (
                  <ul className="sc-vid-links">
                    {v.links.map((url, i) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Mở video ${i + 1} của ${v.title}`}>
                          <Thumb url={url} />
                          <span className="sc-vid-meta"><b>Video {i + 1}</b><small>{url.replace(/^https:\/\/(www\.)?/, '').slice(0, 34)}</small></span>
                        </a>
                        {canEdit && <button type="button" className="sc-vid-remove" aria-label="Xóa link" onClick={() => onUpdate({ ...v, links: v.links.filter((l) => l !== url) })}><i className="bx bx-x"></i></button>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="sc-muted">Chưa có link nào.</p>}
              </article>
            ))}
          </div>
        </div>
      )) : (
        <div className="sc-empty sc-fund-empty">
          <i className="bx bxl-youtube" aria-hidden="true"></i>
          <p>Chưa có video nào.{canEdit ? ' Thêm link YouTube của buổi đá để lưu lại.' : ''}</p>
          {canEdit && <button type="button" className="sc-btn" onClick={() => setDialog({})}><i className="bx bx-plus" aria-hidden="true"></i>Thêm video</button>}
        </div>
      )}

      {dialog && (
        <VideoDialog key={dialog.item ? dialog.item.id : 'new'} item={dialog.item} state={state} onClose={() => setDialog(null)}
          onSave={(v) => { if (dialog.item) onUpdate(v); else onAdd(v); setDialog(null); }} />
      )}
      {confirmDelete && (
        <div className="sc-confirm-layer" onMouseDown={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="sc-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sc-vid-del-title">
            <i className="bx bx-trash" aria-hidden="true"></i>
            <h3 id="sc-vid-del-title">Xóa video?</h3>
            <p>"{confirmDelete.title}" và {confirmDelete.links.length} link bên trong sẽ bị xóa.</p>
            <div className="sc-confirm-actions">
              <button type="button" className="sc-btn ghost" autoFocus onClick={() => setConfirmDelete(null)}>Hủy</button>
              <button type="button" className="sc-btn sc-btn-danger" onClick={() => { onRemove(confirmDelete.id); setConfirmDelete(null); }}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default VideosTab;
