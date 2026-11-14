import { normalizeGiphyUrl } from './utils';

const direct = 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif';

test('Giphy page, embed and sticker links become the direct gif', () => {
  expect(normalizeGiphyUrl('https://giphy.com/gifs/football-soccer-goal-l0MYt5jPR6QX5pnqM')).toBe(direct);
  expect(normalizeGiphyUrl('https://giphy.com/gifs/l0MYt5jPR6QX5pnqM')).toBe(direct);
  expect(normalizeGiphyUrl('https://giphy.com/embed/l0MYt5jPR6QX5pnqM')).toBe(direct);
  expect(normalizeGiphyUrl('https://giphy.com/stickers/a-b-l0MYt5jPR6QX5pnqM?utm=x')).toBe(direct);
});

test('direct gif and other links are left alone, short links are rejected', () => {
  expect(normalizeGiphyUrl(direct)).toBe(direct);
  expect(normalizeGiphyUrl('https://i.giphy.com/l0MYt5jPR6QX5pnqM.gif')).toBe('https://i.giphy.com/l0MYt5jPR6QX5pnqM.gif');
  expect(normalizeGiphyUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
  expect(normalizeGiphyUrl('https://giphy.com/search/football')).toBe('https://giphy.com/search/football');
  expect(normalizeGiphyUrl('https://gph.is/abc')).toBeNull();
});
