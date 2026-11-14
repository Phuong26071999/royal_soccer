import React from 'react';
import { CARD_STYLES, useCardStyle } from '../cardStyle';

/** Segmented control: how player cards look. */
const CardStylePicker = () => {
  const [style, setStyle] = useCardStyle();
  return (
    <div className="sc-style-picker" role="radiogroup" aria-label="Kiểu thẻ cầu thủ">
      {CARD_STYLES.map((s) => (
        <button key={s.id} type="button" role="radio" aria-checked={style === s.id} className={style === s.id ? 'on' : ''} onClick={() => setStyle(s.id)}>{s.label}</button>
      ))}
    </div>
  );
};

export default CardStylePicker;
