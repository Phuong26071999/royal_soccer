const { normalize, replyFor, isMentioned } = require('../../api/_lib/zaloBot');
const webhook = require('../../api/zalo-webhook');

const evt = (text, over = {}) => ({
  event_name: 'message.text.received',
  message: { message_id: 'm1', date: 1, from: { id: 'u1', display_name: 'An', is_bot: false }, chat: { id: 'g1', chat_type: 'GROUP' }, text, ...over },
});
const fresh = () => jest.fn().mockResolvedValue({ allowed: true });

describe('zalo bot keywords', () => {
  const env = process.env;
  beforeEach(() => { process.env = { ...env, ZALO_BOT_NAME: 'Bot David Truong', ZALO_SITE_URL: 'https://site.test', ZALO_CONTACT_INFO: '0900 000 000' }; });
  afterEach(() => { process.env = env; });

  it('normalizes accents, case and spacing', () => {
    expect(normalize('Lịch Hẹn')).toBe('lichhen');
    expect(normalize('Liên hệ')).toBe('lienhe');
    expect(normalize('ĐÁ')).toBe('da');
  });

  it('only reacts when the bot is mentioned', () => {
    expect(replyFor('help')).toBeNull();
    expect(replyFor('@Ai đó help')).toBeNull();
    expect(isMentioned('@Bot David Truong help')).toBe(true);
    expect(isMentioned('@bot david truong help')).toBe(true);
  });

  it('answers each keyword, with or without accents', () => {
    expect(replyFor('@Bot David Truong help')).toContain('CÁC LỆNH');
    expect(replyFor('@Bot David Truong lichhen')).toContain('https://site.test');
    expect(replyFor('@Bot David Truong Lịch hẹn')).toContain('https://site.test');
    expect(replyFor('@Bot David Truong WEBSITE')).toContain('https://site.test');
    expect(replyFor('@Bot David Truong liên hệ')).toContain('0900 000 000');
    expect(replyFor('@Bot David Truong')).toContain('CÁC LỆNH');
    expect(replyFor('hey @Bot David Truong xyz')).toContain('chưa hiểu');
  });

  it('webhook: replies to the same chat for a mention, ignores everything else', async () => {
    const dedupe = fresh();
    expect(await webhook.handleEvent(evt('@Bot David Truong help'), { dedupe })).toMatchObject({ chatId: 'g1' });
    expect(await webhook.handleEvent(evt('chào mọi người'), { dedupe })).toBeNull();
    expect(await webhook.handleEvent({ event_name: 'message.image.received', message: {} }, { dedupe })).toBeNull();
    expect(await webhook.handleEvent(null, { dedupe })).toBeNull();
  });

  it('webhook: ignores bots (no reply loops) and duplicate message ids', async () => {
    expect(await webhook.handleEvent(evt('@Bot David Truong help', { from: { id: 'b', is_bot: true } }), { dedupe: fresh() })).toBeNull();
    process.env.ZALO_BOT_ID = 'bot-1';
    expect(await webhook.handleEvent(evt('@Bot David Truong help', { from: { id: 'bot-1', is_bot: false } }), { dedupe: fresh() })).toBeNull();
    const dup = jest.fn().mockResolvedValue({ allowed: false });
    expect(await webhook.handleEvent(evt('@Bot David Truong help'), { dedupe: dup })).toBeNull();
  });

  it('webhook handler rejects a wrong or missing secret token', async () => {
    process.env.ZALO_WEBHOOK_SECRET = 'correct-secret-123';
    const run = async (headers) => {
      const res = { statusCode: 0, setHeader() {}, end() {} };
      await webhook({ method: 'POST', headers, body: evt('@Bot David Truong help') }, res);
      return res.statusCode;
    };
    expect(await run({})).toBe(403);
    expect(await run({ 'x-bot-api-secret-token': 'nope-nope-nope' })).toBe(403);
    expect(await run({ 'x-bot-api-secret-token': 'correct-secret-123' })).toBe(200);
  });
});
