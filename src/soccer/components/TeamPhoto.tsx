import React, { useEffect, useState } from 'react';

const SRC = `${process.env.PUBLIC_URL || ''}/team-photo.jpg`;

/** Group photo banner above the top scorers; tap to see the whole photo. */
const TeamPhoto = ({ count }: { count: number }) => {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (broken) return null;
  return (
    <>
      <button type="button" className="sc-team-photo" onClick={() => setOpen(true)} aria-label="Xem toàn bộ ảnh đội bóng">
        <img src={SRC} alt="Ảnh cả đội trên sân" onError={() => setBroken(true)} />
        <span className="sc-team-photo-shade" aria-hidden="true"></span>
        <span className="sc-team-photo-caption">
          <span className="sc-team-photo-tag"><i className="bx bx-group" aria-hidden="true"></i>{count} thành viên</span>
          <b>Giấc Mơ Sân Cỏ</b>
        </span>
        <span className="sc-team-photo-zoom" aria-hidden="true"><i className="bx bx-expand-alt"></i></span>
      </button>
      {open && (
        <div className="sc-lightbox" role="dialog" aria-modal="true" aria-label="Ảnh đội bóng" onClick={() => setOpen(false)}>
          <img src={SRC} alt="Ảnh cả đội trên sân" />
          <button type="button" className="sc-close" onClick={() => setOpen(false)} aria-label="Đóng"><i className="bx bx-x"></i></button>
        </div>
      )}
    </>
  );
};

export default TeamPhoto;
