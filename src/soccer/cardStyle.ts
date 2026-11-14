import { useCallback, useEffect, useState } from 'react';

export type CardStyle = 'compact' | 'sticker' | 'ultimate' | 'legacy';
export const CARD_STYLES: { id: CardStyle; label: string }[] = [
  { id: 'compact', label: 'Gọn' },
  { id: 'sticker', label: 'Sticker' },
  { id: 'ultimate', label: 'Ultimate' },
  { id: 'legacy', label: 'Legacy' },
];

const KEY = 'sc-card-style';
const EVENT = 'sc-card-style-change';
const valid = (v: unknown): v is CardStyle => CARD_STYLES.some((s) => s.id === v);

function read(): CardStyle {
  try {
    const v = window.localStorage.getItem(KEY);
    if (valid(v)) return v;
  } catch {
    // Storage blocked: fall back to the default.
  }
  return 'ultimate';
}

/** Card look used by the members list and the player preview; shared across components, remembered per browser. */
export function useCardStyle(): [CardStyle, (s: CardStyle) => void] {
  const [style, setStyle] = useState<CardStyle>(read);
  useEffect(() => {
    const onChange = () => setStyle(read());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  const set = useCallback((s: CardStyle) => {
    try {
      window.localStorage.setItem(KEY, s);
    } catch {
      // Not remembered, still applied below.
    }
    setStyle(s);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [style, set];
}
