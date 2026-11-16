import React from 'react';
import { Venue } from '../types';

interface Props {
  venues: Venue[];
  /** Selected venue id, '' for none. */
  value: string;
  onChange: (venueId: string) => void;
  /** Opens the dialog to add a new pitch. */
  onAdd: () => void;
  /** Opens the dialog to edit a pitch. */
  onEdit: (venue: Venue) => void;
}

/** Venue cards: photo (or a pitch pattern), name, address, map link. One can be selected. */
const VenuePicker = ({ venues, value, onChange, onAdd, onEdit }: Props) => (
  <div className="sc-vgrid" role="radiogroup" aria-label="Địa điểm">
    {venues.map((v) => {
      const selected = value === v.id;
      const cover = v.images && v.images[0];
      const extra = (v.images?.length || 0) - 1;
      return (
        <div key={v.id} role="radio" aria-checked={selected} tabIndex={0} className={`sc-vcard${selected ? ' on' : ''}`}
          onClick={() => onChange(v.id)}
          onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onChange(v.id); } }}>
          <div className="sc-vcard-media">
            {cover ? <img src={cover} alt="" loading="lazy" /> : <i className="bx bx-football" aria-hidden="true"></i>}
            {extra > 0 && <span className="sc-vcard-count"><i className="bx bx-images" aria-hidden="true"></i>{extra + 1}</span>}
            <span className="sc-vcard-check" aria-hidden="true"><i className="bx bx-check"></i></span>
          </div>
          <div className="sc-vcard-body">
            <b className="sc-vcard-name">{v.name}</b>
            {v.address && <p className="sc-vcard-addr"><i className="bx bx-map" aria-hidden="true"></i><span>{v.address}</span></p>}
            <div className="sc-vcard-actions">
              {v.mapUrl && <a className="sc-map-link" href={v.mapUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><i className="bx bx-map-pin" aria-hidden="true"></i>Bản đồ</a>}
              <button type="button" className="sc-vcard-edit" onClick={(e) => { e.stopPropagation(); onEdit(v); }}><i className="bx bx-edit-alt" aria-hidden="true"></i>Sửa</button>
            </div>
          </div>
        </div>
      );
    })}
    <button type="button" className="sc-vcard add" onClick={onAdd}>
      <span className="sc-vcard-plus" aria-hidden="true"><i className="bx bx-plus"></i></span>
      <b>Sân khác</b>
      <small>Thêm tên sân, địa chỉ, bản đồ và hình ảnh</small>
    </button>
  </div>
);

export default VenuePicker;
