const { normalize, replyFor, isMentioned, isBotMentioned, replyForMessage } = require('../../api/_lib/zaloBot');
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
    expect(replyFor('@Bot David Truong help')).toContain('HƯỚNG DẪN SỬ DỤNG');
    expect(replyFor('@Bot David Truong lichhen')).toContain('https://site.test');
    expect(replyFor('@Bot David Truong Lịch hẹn')).toContain('https://site.test');
    expect(replyFor('@Bot David Truong WEBSITE')).toContain('https://site.test');
    expect(replyFor('@Bot David Truong liên hệ')).toContain('0900 000 000');
    expect(replyFor('@Bot David Truong')).toContain('HƯỚNG DẪN SỬ DỤNG');
    expect(replyFor('hey @Bot David Truong kể chuyện vui')).toMatch(/cloud|lịch hẹn|chuyện cười/);
    expect(replyFor('@Bot David Truong cảm ơn')).toBeTruthy();
    expect(replyFor('@Bot David Truong hôm nay thứ mấy')).toContain('Hôm nay là');
  });

  it('uses mention metadata when Zalo sends it, text only as fallback', () => {
    process.env.ZALO_BOT_ID = 'bot-1';
    expect(isBotMentioned({ text: '@Bot David Truong help' })).toBe(true);
    expect(isBotMentioned({ text: 'help', mentions: [{ id: 'bot-1' }] })).toBe(true);
    expect(isBotMentioned({ text: '@Bot David Truong help', mentions: [{ id: 'someone-else', name: 'An' }] })).toBe(false);
    expect(replyForMessage({ text: 'hello' })).resolves.toBeNull();
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

describe('smarter replies', () => {
  const { getBotReply, calculate } = require('../../api/_lib/zaloSmartReplies');
  const opts = { websiteUrl: 'https://s.test', random: () => 0.3, now: new Date('2026-11-19T05:00:00Z') };

  it('shows the detailed guide for help, trợ giúp and an empty tag', () => {
    for (const t of ['', 'help', 'Trợ giúp', 'hướng dẫn sử dụng']) {
      const text = getBotReply(t, opts);
      expect(text).toContain('HƯỚNG DẪN SỬ DỤNG BOT');
      expect(text).toContain('LỆNH NHANH');
      expect(text).toContain('https://s.test');
    }
  });

  it('answers football-group questions by pointing to the website', () => {
    expect(getBotReply('lịch đá tuần này', opts)).toContain('https://s.test');
    expect(getBotReply('chia đội đi', opts)).toContain('Chia đội');
    expect(getBotReply('quỹ còn bao nhiêu', opts)).toContain('Quỹ');
    expect(getBotReply('sân nào vậy', opts)).toContain('bản đồ');
  });

  it('knows tomorrow, weekend and does arithmetic safely', () => {
    expect(getBotReply('ngày mai thứ mấy', opts)).toContain('20/11/2026');
    expect(getBotReply('bao giờ cuối tuần', opts)).toContain('2 ngày');
    expect(getBotReply('tính 12*5+3', opts)).toContain('63');
    expect(getBotReply('10/0', opts)).toContain('Chia cho 0');
    expect(calculate('process.exit()')).toBeNull();
    expect(calculate('hello')).toBeNull();
  });

  it('picks, rolls and keeps accents', () => {
    expect(getBotReply('chọn cơm hay phở', { ...opts, random: () => 0.9 })).toContain('phở');
    expect(getBotReply('random 5 5', opts)).toContain(': 5');
    expect(getBotReply('xúc xắc', opts)).toMatch(/[1-6] 🎲/);
    expect(getBotReply('chào buổi sáng', opts)).toContain('buổi sáng');
  });
});

describe('answers from real data', () => {
  const { dataReply } = require('../../api/_lib/zaloData');
  const { replyForMessage } = require('../../api/_lib/zaloBot');
  const now = Date.UTC(2026, 10, 19, 5, 0); // 19/11/2026 12:00 Vietnam
  const member = (id, name, goals = 0, number = null) => ({ id, name, number, tier: 3, goals, avatar: '' });
  const state = {
    members: [member('a', 'Nguyễn Hùng', 7, 10), member('b', 'Trần Bình', 3, 9), member('c', 'Lê Cường', 0)],
    funds: [{ id: 'f', name: 'Quỹ T11', startDate: '2026-11-01', status: 'open', fee: 100000, payments: { '2026-11': ['a', 'b'] }, expenses: [{ id: 'e', date: '2026-11-05', note: 'Sân', amount: 50000 }] }],
    matches: [
      { id: 'm0', date: '2026-11-12T19:30', location: 'D7 Sports Park', note: '', score: '3 - 2', teams: [], attendees: ['a', 'b'] },
      { id: 'm1', date: '2026-11-21T19:30', location: 'Sân Bóng Hoàng Kim', address: '615 Huỳnh Tấn Phát', note: 'Mang áo trắng', score: '', teams: [], attendees: ['a', 'b'], costs: [{ id: 'x', note: 'Tiền sân', amount: 200000 }] },
    ],
    venues: [],
    videos: [{ id: 'v', title: 'Highlight 12/11', date: '2026-11-12', links: ['https://youtu.be/dQw4w9WgXcQ'] }],
  };
  const ask = (text, extra = {}) => dataReply(text, state, { now, websiteUrl: 'https://s.test', ...extra });

  it('next match with countdown, place, note and who is going', () => {
    const t = ask('trận tới khi nào');
    expect(t).toContain('Thứ Bảy, 21/11/2026 lúc 19:30');
    expect(t).toContain('còn 2 ngày');
    expect(t).toContain('Hoàng Kim');
    expect(t).toContain('Mang áo trắng');
    expect(t).toContain('Nguyễn Hùng, Trần Bình');
  });

  it('attendance, last result, scorers, members, video', () => {
    expect(ask('ai đi đá vậy')).toContain('2 người');
    expect(ask('kết quả trận vừa rồi')).toContain('3 - 2');
    expect(ask('vua phá lưới là ai')).toContain('Nguyễn Hùng — 7 bàn');
    expect(ask('có bao nhiêu thành viên')).toContain('3 thành viên');
    expect(ask('video mới nhất')).toContain('youtu.be/dQw4w9WgXcQ');
  });

  it('costs split evenly and fund totals (no individual balances)', () => {
    expect(ask('tiền sân chia bao nhiêu')).toContain('100.000đ/người');
    const fund = ask('quỹ còn bao nhiêu');
    expect(fund).toContain('còn 150.000đ');
    expect(fund).not.toMatch(/Nguyễn Hùng/);
  });

  it('member lookups by given name, and the sender check', () => {
    expect(ask('Hùng ghi mấy bàn')).toContain('7 bàn thắng');
    expect(ask('tôi có đi đá không', { senderName: 'Trần Bình' })).toContain('đã có tên');
    expect(ask('tôi có đi đá không', { senderName: 'Lê Cường' })).toContain('chưa có tên');
    expect(ask('tôi có đi đá không', { senderName: 'Người lạ' })).toContain('chưa nhận ra');
  });

  it('venues and nothing for unrelated chat', () => {
    expect(ask('Hoàng Kim ở đâu')).toContain('615 Huỳnh Tấn Phát');
    expect(ask('kể chuyện vui')).toBeNull();
    expect(dataReply('trận tới', null)).toBeNull();
  });

  it('replyForMessage uses live data, falls back to friendly rules if loading fails', async () => {
    const msg = { text: '@Bot David Truong trận tới', from: { display_name: 'An' } };
    expect(await replyForMessage(msg, { loadState: async () => state, now })).toContain('TRẬN SẮP TỚI');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await replyForMessage(msg, { loadState: async () => { throw new Error('db'); }, now })).toBeTruthy();
    expect(await replyForMessage({ text: 'trận tới' }, { loadState: async () => state })).toBeNull();
  });

  it('new situations are covered', () => {
    const { getBotReply } = require('../../api/_lib/zaloSmartReplies');
    expect(getBotReply('mang gì đi đá', {})).toContain('giày');
    expect(getBotReply('mình đi trễ xíu', {})).toMatch(/trễ|trên đường/);
    expect(getBotReply('cá độ không', {})).toMatch(/cá cược|cá độ/);
  });
});

describe('real questions from the group', () => {
  const { getBotReply } = require('../../api/_lib/zaloSmartReplies');
  const { dataReply } = require('../../api/_lib/zaloData');
  const reply = (t) => getBotReply(t, { random: () => 0 });

  it('who made the bot, calling the "father", gossip, love, insults and swearing', () => {
    expect(reply('ai làm ra m')).toContain('admin');
    expect(reply('kêu cha m lên đây nói chuyện với tao')).toContain('admin');
    expect(reply('anh Phương có quẩy rồi mày không ?')).toContain('Chuyện đời tư');
    expect(reply('tôi yêu bạn')).toContain('quý bạn');
    expect(reply('dm mày')).toContain('Bình tĩnh');
    expect(reply('ai đá ngu nhất')).toContain('Messi');
  });

  it('sensitive topics get a respectful, neutral answer', () => {
    const text = reply('quan điểm của mày về đồng tính luyến ái là gì');
    expect(text).toContain('không có quan điểm cá nhân');
    expect(text).not.toMatch(/ủng hộ|phản đối|sai trái/);
  });

  it('general knowledge is politely declined instead of the vague fallback', () => {
    expect(reply('viên sỏi xứ albinian nằm ở đâu vậy')).toContain('ngoài vùng phủ sóng');
    expect(reply('thủ đô nước Pháp là gì')).toContain('ngoài vùng phủ sóng');
  });

  it('"ở đâu" in a general question is not mistaken for the pitch, but "ai đá hay nhất" shows scorers', () => {
    const state = { members: [{ id: 'a', name: 'Hùng', goals: 4 }], matches: [{ id: 'm', date: '2099-01-01T19:00', location: 'D7', teams: [], attendees: [] }], funds: [], venues: [], videos: [] };
    expect(dataReply('viên sỏi nằm ở đâu vậy', state)).toBeNull();
    expect(dataReply('ai đá hay nhất', state)).toContain('Hùng — 4 bàn');
  });
});
