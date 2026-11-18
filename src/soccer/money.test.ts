import { MAX_MONEY, nextMoney } from './utils';

/** Simulates typing a string one character at a time into the money field. */
const type = (chars: string, start = 0) => chars.split("").reduce((amount, ch) => nextMoney(amount, `${amount ? amount.toLocaleString('vi-VN') : ''}${ch}`), start);

describe('money input', () => {
  it('turns typed digits into thousands: 100 -> 100.000', () => {
    expect(type('1')).toBe(1000);
    expect(type('65')).toBe(65000);
    expect(type('100')).toBe(100000);
    expect(type('1500')).toBe(1500000);
  });

  it('backspace removes the last typed digit', () => {
    const back = (amount: number) => nextMoney(amount, amount.toLocaleString('vi-VN').slice(0, -1));
    expect(back(100000)).toBe(10000);
    expect(back(10000)).toBe(1000);
    expect(back(1000)).toBe(0);
  });

  it('keeps a pasted full amount and treats a short replacement as thousands', () => {
    expect(nextMoney(0, '250000')).toBe(250000);
    expect(nextMoney(100000, '250000')).toBe(250000);
    expect(nextMoney(100000, '5')).toBe(5000); // select all, type 5
  });

  it('clears when emptied and ignores non-digits and absurd amounts', () => {
    expect(nextMoney(100000, '')).toBe(0);
    expect(nextMoney(0, 'abc')).toBe(0);
    expect(nextMoney(MAX_MONEY, `${MAX_MONEY.toLocaleString('vi-VN')}0`)).toBe(MAX_MONEY);
  });
});
