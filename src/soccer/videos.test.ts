import { youtubeId } from './utils';

describe('youtubeId', () => {
  const ID = 'dQw4w9WgXcQ';

  it('reads the id from the usual YouTube link shapes', () => {
    expect(youtubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(youtubeId(`https://youtube.com/watch?v=${ID}&t=42s`)).toBe(ID);
    expect(youtubeId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(youtubeId(`https://youtu.be/${ID}?si=abc`)).toBe(ID);
    expect(youtubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(youtubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(youtubeId(`https://www.youtube.com/live/${ID}?feature=share`)).toBe(ID);
    expect(youtubeId(`  https://youtu.be/${ID}  `)).toBe(ID);
  });

  it('rejects other sites, plain text, http and malformed ids', () => {
    expect(youtubeId(`https://vimeo.com/watch?v=${ID}`)).toBe('');
    expect(youtubeId(`https://evil.com/youtube.com/watch?v=${ID}`)).toBe('');
    expect(youtubeId(`http://www.youtube.com/watch?v=${ID}`)).toBe('');
    expect(youtubeId('https://www.youtube.com/watch?v=short')).toBe('');
    expect(youtubeId('https://www.youtube.com/')).toBe('');
    expect(youtubeId('not a link')).toBe('');
    expect(youtubeId('')).toBe('');
  });
});
