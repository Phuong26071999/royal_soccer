const { notifyMatchChanges, diffMatches, buildMessage } = require('../../api/_lib/zaloNotify');

const m = (id, over = {}) => ({ id, date: '2026-11-20T19:30', location: 'Sân A', note: '', ...over });
const ok = () => jest.fn().mockResolvedValue({ ok: true, status: 200 });

describe('zalo match notifications (Zalo API mocked)', () => {
  const env = process.env;
  beforeEach(() => { process.env = { ...env, ZALO_BOT_TOKEN: 'SECRET-TOKEN', ZALO_GROUP_CHAT_ID: 'group1' }; jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { process.env = env; jest.restoreAllMocks(); });

  it('detects created and deleted matches only (edits are ignored)', () => {
    const d = diffMatches([m('a'), m('b')], [m('b', { note: 'x' }), m('c')]);
    expect(d.map((e) => `${e.kind}:${e.match.id}`)).toEqual(['created:c', 'deleted:a']);
  });

  it('formats the message from real data', () => {
    const text = buildMessage('created', m('m1', { location: 'Hoàng Kim' }));
    expect(text).toContain('LỊCH ĐÁ MỚI');
    expect(text).not.toContain('m1');
    expect(text).toContain('20/11/2026');
    expect(text).toContain('19:30');
    expect(text).toContain('Hoàng Kim');
  });

  it('sends one message per created match to the bot API', async () => {
    const fetchMock = ok();
    expect(await notifyMatchChanges([], [m('a')], fetchMock)).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://bot-api.zaloplatforms.com/botSECRET-TOKEN/sendMessage');
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: 'group1' });
  });

  it('sends a delete message', async () => {
    const fetchMock = ok();
    await notifyMatchChanges([m('a')], [], fetchMock);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain('ĐÃ HỦY');
  });

  it('sends nothing when nothing was created or deleted (duplicate / replayed save)', async () => {
    const fetchMock = ok();
    expect(await notifyMatchChanges([m('a')], [m('a')], fetchMock)).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is skipped when Zalo is not configured', async () => {
    delete process.env.ZALO_BOT_TOKEN;
    const fetchMock = ok();
    expect(await notifyMatchChanges([], [m('a')], fetchMock)).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws and never logs the token when Zalo fails', async () => {
    const bad = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    expect(await notifyMatchChanges([], [m('a')], bad)).toBe(0);
    const boom = jest.fn().mockRejectedValue(new Error('network https://x/botSECRET-TOKEN'));
    expect(await notifyMatchChanges([], [m('a')], boom)).toBe(0);
    expect(JSON.stringify(console.error.mock.calls)).not.toContain('SECRET-TOKEN');
  });
});
