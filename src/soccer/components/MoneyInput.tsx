import React from 'react';
import { nextMoney } from '../utils';

interface Props {
  /** Amount in VND; 0 shows the placeholder. */
  value: number;
  onChange: (amount: number) => void;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * Vietnamese money field: shows 100.000 and types in thousands, so keying "100" gives 100.000
 * (no need to type the three zeros). Backspace removes the last typed digit; pasting a full
 * amount such as 250000 keeps it as is.
 */
const MoneyInput = ({ value, onChange, id, placeholder, className, 'aria-label': ariaLabel }: Props) => (
  <input
    id={id}
    className={className}
    inputMode="numeric"
    autoComplete="off"
    aria-label={ariaLabel}
    placeholder={placeholder}
    value={value ? value.toLocaleString('vi-VN') : ''}
    onChange={(e) => onChange(nextMoney(value, e.target.value))}
  />
);

export default MoneyInput;
