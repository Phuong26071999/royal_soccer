import React, { useEffect, useState } from 'react';

interface Props {
  /** Receives the direct GIF url (media.giphy.com/media/<id>/200w.gif). */
  onPick: (url: string) => void;
  onClose: () => void;
}

interface Hit { id: string; title: string }

const thumb = (id: string) => `https://media.giphy.com/media/${id}/100w.gif`;
export const gifUrl = (id: string) => `https://media.giphy.com/media/${id}/200w.gif`;

/** Search box + result grid over /api/giphy (the key stays on the server). Empty query shows trending GIFs. */
const GifSearch = ({ onPick, onClose }: Props) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'' | 'off' | 'fail'>('');
  const [page, setPage] = useState(0);

  // New query -> back to page 0 (debounced); "Xem thêm" bumps the page.
  useEffect(() => { setPage(0); }, [query]);
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/giphy?q=${encodeURIComponent(query.trim())}&offset=${page * 18}`);
        if (!alive) return;
        if (res.status === 501) { setError('off'); setHits([]); return; }
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) { setError('fail'); return; }
        setHits((prev) => (page === 0 ? data.results : [...prev, ...data.results]));
        setMore(Boolean(data.hasMore));
      } catch {
        if (alive) setError('fail');
      } finally {
        if (alive) setLoading(false);
      }
    }, page === 0 ? 450 : 0);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, page]);

  return (
    <div className="sc-gif" role="dialog" aria-label="Tìm GIF">
      <div className="sc-gif-head">
        <label className="sc-search">
          <i className="bx bx-search" aria-hidden="true"></i>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm GIF: bóng đá, ăn mừng..." maxLength={60} aria-label="Tìm GIF" />
        </label>
        <button type="button" className="sc-btn ghost small" onClick={onClose}>Đóng</button>
      </div>
      {error === 'off' && (
        <p className="sc-muted sc-gif-note">Chưa bật tìm GIF trong app (cần GIPHY_API_KEY ở máy chủ). Bạn vẫn dán được link từ{' '}
          <a href="https://giphy.com/search/football" target="_blank" rel="noopener noreferrer">giphy.com</a> vào ô link.</p>
      )}
      {error === 'fail' && <p className="sc-error">Không tìm được GIF lúc này. Thử lại sau.</p>}
      <div className="sc-gif-grid">
        {hits.map((h) => (
          <button key={h.id} type="button" className="sc-gif-item" title={h.title} onClick={() => onPick(gifUrl(h.id))}>
            <img src={thumb(h.id)} alt={h.title} loading="lazy" referrerPolicy="no-referrer" />
          </button>
        ))}
      </div>
      {loading && <p className="sc-muted sc-gif-note"><i className="bx bx-loader-alt bx-spin" aria-hidden="true"></i> Đang tìm...</p>}
      {!loading && !error && !hits.length && <p className="sc-muted sc-gif-note">Không có GIF nào khớp.</p>}
      {more && !loading && <button type="button" className="sc-btn ghost small" onClick={() => setPage((p) => p + 1)}>Xem thêm</button>}
      <small className="sc-muted sc-gif-credit">Powered by GIPHY</small>
    </div>
  );
};

export default GifSearch;
