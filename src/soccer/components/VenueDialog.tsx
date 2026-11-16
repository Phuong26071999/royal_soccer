import React, { useEffect, useRef, useState } from 'react';
import { uploadAvatar } from '../api';
import { Venue } from '../types';
import { randomId, resizeImage } from '../utils';

const MAX_IMAGES = 4;

interface Props {
  /** Editing an existing venue; omit to add a new one. */
  venue?: Venue;
  onClose: () => void;
  onSave: (venue: Venue) => void;
  /** Remove button (hidden when omitted); a built-in pitch with edits shows "restore default" instead of "delete". */
  onRemove?: (venueId: string) => void;
  restoreDefault?: boolean;
}

/** Modal to add or edit a pitch: name, address, Google Maps link and up to 4 photos. */
const VenueDialog = ({ venue, onClose, onSave, onRemove, restoreDefault }: Props) => {
  const idRef = useRef(venue?.id || randomId());
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(venue?.name || '');
  const [address, setAddress] = useState(venue?.address || '');
  const [mapUrl, setMapUrl] = useState(venue?.mapUrl || '');
  const [images, setImages] = useState<string[]>(venue?.images || []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** First of the 4 photo slots not used by the current photos (the slot is part of the stored file's id). */
  const freeSlot = (current: string[]) => {
    for (let slot = 0; slot < MAX_IMAGES; slot++) {
      if (!current.some((url) => url.includes(`id=venue-${idRef.current}-${slot}&`))) return slot;
    }
    return -1;
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setUploading(true);
    let next = images;
    try {
      for (const file of files) {
        const slot = freeSlot(next);
        if (slot < 0) { setError(`Tối đa ${MAX_IMAGES} hình ảnh cho mỗi sân.`); break; }
        const photo = await resizeImage(file);
        const url = await uploadAvatar(`venue-${idRef.current}-${slot}`, photo);
        next = [...next, url];
        setImages(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải ảnh lên được.');
    } finally {
      setUploading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = mapUrl.trim();
    if (!name.trim()) { setError('Nhập tên sân.'); return; }
    if (url && !/^https:\/\//i.test(url)) { setError('Link bản đồ phải bắt đầu bằng https://'); return; }
    onSave({
      id: idRef.current,
      name: name.trim().slice(0, 120),
      address: address.trim().slice(0, 200),
      mapUrl: url,
      ...(images.length ? { images } : {}),
    });
  };

  return (
    <div className="sc-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sc-dialog small sc-venue-dialog" role="dialog" aria-modal="true" aria-labelledby="sc-venue-title" onSubmit={submit} noValidate>
        <button type="button" className="sc-close" onClick={onClose} aria-label="Đóng"><i className="bx bx-x"></i></button>
        <h2 id="sc-venue-title">{venue ? 'Sửa sân' : 'Thêm sân khác'}</h2>
        <label className="sc-field">
          <span>Tên sân</span>
          <input autoFocus value={name} maxLength={120} placeholder="Sân bóng Hoàng Kim" aria-label="Tên sân" onChange={(e) => { setName(e.target.value); setError(''); }} />
        </label>
        <label className="sc-field">
          <span>Địa chỉ</span>
          <input value={address} maxLength={200} placeholder="615 Huỳnh Tấn Phát, Tân Thuận, Hồ Chí Minh" aria-label="Địa chỉ" onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="sc-field">
          <span>Link Google Maps</span>
          <input value={mapUrl} maxLength={800} placeholder="https://www.google.com/maps/..." aria-label="Link Google Maps" onChange={(e) => { setMapUrl(e.target.value); setError(''); }} />
        </label>

        <div className="sc-field">
          <span>Hình ảnh ({images.length}/{MAX_IMAGES})</span>
          <div className="sc-venue-photos">
            {images.map((url) => (
              <div key={url} className="sc-venue-photo">
                <img src={url} alt="" />
                <button type="button" aria-label="Xóa hình" onClick={() => setImages(images.filter((x) => x !== url))}><i className="bx bx-x"></i></button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" className="sc-venue-photo add" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <i className={`bx ${uploading ? 'bx-loader-alt bx-spin' : 'bx-image-add'}`} aria-hidden="true"></i>
                <small>{uploading ? 'Đang tải' : 'Thêm ảnh'}</small>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickFiles} />
        </div>

        {error && <small className="sc-error" role="alert">{error}</small>}
        <div className="sc-venue-actions">
          {venue && onRemove && (
            <button type="button" className="sc-btn ghost sc-danger" onClick={() => window.confirm(restoreDefault ? `Bỏ các chỉnh sửa và khôi phục thông tin mặc định của "${venue.name}"?` : `Xóa sân "${venue.name}" khỏi danh sách?`) && onRemove(venue.id)}>
              <i className={`bx ${restoreDefault ? 'bx-reset' : 'bx-trash'}`} aria-hidden="true"></i>{restoreDefault ? 'Khôi phục mặc định' : 'Xóa sân'}
            </button>
          )}
          <button type="submit" className="sc-btn" disabled={uploading}><i className="bx bx-save" aria-hidden="true"></i>{venue ? 'Lưu' : 'Thêm sân'}</button>
        </div>
      </form>
    </div>
  );
};

export default VenueDialog;
