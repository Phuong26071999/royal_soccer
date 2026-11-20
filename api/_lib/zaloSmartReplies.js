'use strict';

/**
 * Zalo Bot David Truong — smart, friendly Vietnamese keyword replies.
 * (CommonJS port of zalo-bot-smart-replies.js so it runs in the Vercel functions as-is.)
 *
 * IMPORTANT: call getBotReply only after the webhook has verified the event is from a
 * human and mentions the bot. This file does not read appointments, validate webhooks,
 * or send messages. No AI API/payment required.
 */

const BOT_NAME = 'David';
const DEFAULT_WEBSITE = ''; // Set a real address in options.websiteUrl

const botPersonality = Object.freeze({
  name: 'Bot David Truong',
  style: 'Bạn bè, tự nhiên, vui vẻ vừa đủ; tiếng Việt gần gũi, không cứng nhắc.',
  rules: [
    'Xưng mình, gọi người nói chuyện là bạn; không tự nhận là người thật.',
    'Câu trả lời 1-3 câu, ngắn gọn, đúng trọng tâm.',
    'Không giả vờ biết lịch hẹn, số lượng khách, trạng thái hay dữ liệu thời gian thực.',
    'Không công khai số điện thoại hoặc thông tin khách hàng trong nhóm.',
    'Không trả lời tin nhắn không tag bot (việc lọc tag nằm ở webhook).',
    'Không hứa đã tạo, sửa, xóa lịch hẹn nếu chưa có API thực hiện.',
  ],
});

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Removes "@<name>" mentions from the text (call only after the webhook verified the mention). */
function stripBotMention(text = '', names = ['Bot David Truong']) {
  let result = String(text);
  for (const name of names) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`@\\s*${escaped}`, 'gi'), ' ');
  }
  return result.trim();
}

const rules = [
  {
    id: 'help',
    patterns: [/\b(help|menu|huong dan|lenh|lam duoc gi|biet lam gi|chuc nang)\b/],
    replies: [
      'Mình đây 😄 Bạn thử hỏi: “hôm nay thứ mấy”, “mấy giờ rồi”, “website”, “lịch hẹn”, “kể chuyện vui”, “động viên mình” nha.',
      'Có gì cứ tag mình nhé! Mình biết tám chuyện, kể chuyện vui và chỉ chỗ xem lịch hẹn. Gõ “help” để xem gợi ý 😎',
    ],
  },
  {
    id: 'hello',
    patterns: [/\b(hello|hi|hey|helo|chao|xin chao|alo|e bot|bot oi|co ai khong|ping)\b/],
    replies: [
      'Có mình đây 😄 Gọi cái là có mặt luôn. Bạn cần gì nè?',
      'Alo alo, David nghe rõ! Có chuyện gì hay ho không bạn? 👀',
      'Hello bạn ✨ Hôm nay có gì cần mình phụ một tay không?',
      'Mình đây, online bằng cả tấm lòng 🤖 Bạn hỏi đi!',
    ],
  },
  {
    id: 'thanks',
    patterns: [/\b(cam on|thank|thanks|tks|thank you|doi on)\b/],
    replies: [
      'Có gì đâu nè, giúp được là mình vui rồi 😄',
      'Hông có chi! Khi nào cần thì cứ gọi mình nhé 🙌',
      'Quá dễ thương! Có gì cứ tag mình tiếp nha ✨',
    ],
  },
  {
    id: 'bye',
    patterns: [/\b(tam biet|bye|goodbye|bai bai|hen gap lai|di ngu day|ngu ngon)\b/],
    replies: [
      'Okii, gặp lại bạn sau nha 👋',
      'Đi nghỉ ngơi đi nè. Chúc bạn tối vui và ngủ ngon 😴',
      'Bye bạn! Mình vẫn ở đây khi nào cần thì tag nhé 😄',
    ],
  },
  {
    id: 'identity',
    patterns: [/\b(ai vay|ban la ai|may la ai|ten gi|gioi thieu|nguoi hay bot|bot hay nguoi)\b/],
    replies: [
      `Mình là ${BOT_NAME}, bot của nhóm mình nè 🤖 Không phải người thật nhưng rất thích giúp mọi người.`,
      'Mình là Bot David Truong, trợ lý nhỏ của group. Hỏi vui thì mình tám, hỏi lịch hẹn thì mình chỉ chỗ xem chuẩn nha 😄',
    ],
  },
  {
    id: 'howareyou',
    patterns: [/\b(khoe khong|on khong|sao roi|hom nay sao|co vui khong)\b/],
    replies: [
      'Mình vẫn chạy ổn áp 😎 Còn bạn, hôm nay thế nào?',
      'Trạng thái hiện tại: sẵn sàng tám chuyện 😄 Bạn ổn không nè?',
      'Mình ngon lành! Mong hôm nay của bạn cũng nhẹ nhàng nha ✨',
    ],
  },
  {
    id: 'website',
    patterns: [/\b(website|web|trang web|link web|duong dan|truy cap)\b/],
    replies: [
      'Bạn xem trên website của tụi mình ở đây nha: {website}',
      'Link website nè bạn 👉 {website}',
    ],
  },
  {
    id: 'appointment',
    patterns: [/\b(lich hen|lich dat|dat lich|booking|appointment|xem lich|hom nay co lich)\b/],
    replies: [
      'Bạn muốn xem lịch hẹn đúng không? Vào {website} để kiểm tra thông tin mới nhất nhé 📅',
      'Mình chưa đọc trực tiếp được dữ liệu lịch hẹn trong chat này đâu. Bạn mở {website} để xem cho chính xác nha 🙌',
    ],
  },
  {
    id: 'cancel',
    patterns: [/\b(huy lich|xoa lich|doi lich|chinh lich|sua lich|dung lich)\b/],
    replies: [
      'Để tránh thao tác nhầm, bạn vào {website} để sửa hoặc hủy lịch trực tiếp nhé. Mình chưa thể làm thay trong chat này 😄',
      'Cái này cần thao tác trên website nha bạn 👉 {website}. Mình không tự ý xóa lịch đâu.',
    ],
  },
  {
    id: 'time',
    patterns: [/\b(may gio|gio may|bay gio|gio hien tai)\b/],
    dynamic: ({ now, timeZone }) => `Bây giờ là ${new Intl.DateTimeFormat('vi-VN', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)} rồi nha ⏰`,
  },
  {
    id: 'date',
    patterns: [/\b(hom nay ngay|ngay may|thu may|hom nay thu|ngay hien tai)\b/],
    dynamic: ({ now, timeZone }) => `Hôm nay là ${new Intl.DateTimeFormat('vi-VN', { timeZone, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now)} nè 📅`,
  },
  {
    id: 'joke',
    patterns: [/\b(ke chuyen|chuyen vui|hai huoc|ke joke|cho vui|cuoi cai|tro dua)\b/],
    replies: [
      'Tại sao dân lập trình thích trời mưa? Vì có nhiều “cloud” 😆',
      'Hỏi vui nè: Vì sao lịch hẹn không biết nói dối? Vì mọi chuyện đều có… thời gian rõ ràng 😂',
      'Mình định kể chuyện cười siêu dài, mà sợ mọi người phải đặt lịch để nghe hết 😅',
    ],
  },
  {
    id: 'encourage',
    patterns: [/\b(met qua|chan qua|buon qua|stress|dong vien|co gang|het nang luong|ap luc)\b/],
    replies: [
      'Hôm nay mệt thì nghỉ một xíu cũng được mà. Làm từng việc nhỏ thôi, mình cổ vũ bạn 💪',
      'Có những ngày không cần phải giỏi xuất sắc đâu. Cứ từ từ rồi ổn nè 🌱',
      'Uống miếng nước, duỗi vai chút nhé. Bạn đã cố gắng nhiều rồi đó ✨',
    ],
  },
  {
    id: 'food',
    patterns: [/\b(an gi|doi bung|mon gi|trua nay an|toi nay an|di an)\b/],
    replies: [
      'Mình vote cơm tấm! Nhưng nếu ăn rồi thì đổi qua bún bò cũng rất có lý 😋',
      'Đang phân vân hả? Chọn món gần nhất, ngon nhất, khỏi nghĩ nhiều 😂',
      'Một phiếu cho món nước nóng nóng. Ăn xong rồi tính chuyện lớn sau 😄',
    ],
  },
  {
    id: 'sleep',
    patterns: [/\b(buon ngu|mat ngu|khong ngu duoc|di ngu|ngu som)\b/],
    replies: [
      'Buồn ngủ thì cho bản thân nghỉ ngơi thôi bạn, deadline mai tính tiếp 😴',
      'Tắt bớt màn hình, thư giãn chút nha. Chúc bạn ngủ ngon 🌙',
    ],
  },
  {
    id: 'love',
    patterns: [/\b(yeu khong|thuong khong|co nguoi yeu|tinh yeu|crush)\b/],
    replies: [
      'Mình là bot nên yêu bằng… thuật toán thôi 😆 Còn chuyện của bạn thì kể nghe thử?',
      'Chuyện tình cảm khó giải hơn bug đó nha 😅 Nhưng mình có thể nghe bạn kể.',
    ],
  },
  {
    id: 'compliment',
    patterns: [/\b(gioi qua|de thuong|hay qua|dinh qua|xin qua)\b/],
    replies: [
      'Ui cảm ơn bạn, mình hơi nở mũi rồi đó 😂',
      'Được khen cái là CPU mình chạy vui hơn hẳn 😎',
    ],
  },
  {
    id: 'error',
    patterns: [/\b(loi roi|hong roi|khong chay|bug|bi loi|khong duoc)\b/],
    replies: [
      'Nghe có vẻ đang lỗi gì đó 😅 Bạn mô tả cụ thể giúp mình nhé. Mình sẽ gợi ý cách kiểm tra.',
      'Bạn gửi thêm thông báo lỗi hoặc bước gây lỗi nha. Đừng gửi token hay mật khẩu lên nhóm nhé 🔐',
    ],
  },
];

const supportedIntents = rules.map(({ id }) => id);

/**
 * Returns a reply or null. Does not verify mentions; the webhook MUST do that.
 *
 * @param {string} text Message text with the @mention already removed.
 * @param {{websiteUrl?: string, now?: Date, timeZone?: string, random?: () => number}} options
 */
function getBotReply(text, options = {}) {
  const input = normalize(text);
  if (!input) return 'Mình đây 😄 Bạn muốn hỏi gì nè? Gõ “help” để xem mình làm được gì nhé.';

  const websiteUrl = options.websiteUrl || DEFAULT_WEBSITE;
  const website = websiteUrl || 'website quản lý lịch hẹn (chưa cấu hình đường dẫn)';
  const ctx = {
    now: options.now || new Date(),
    timeZone: options.timeZone || 'Asia/Ho_Chi_Minh',
  };
  const rand = typeof options.random === 'function' ? options.random : Math.random;

  // Explicit priority: cancellation before appointment and date/time before general greeting.
  const priority = ['cancel', 'time', 'date', 'appointment', 'website', 'help', 'identity', 'joke', 'encourage', 'error'];
  const rank = (id) => (priority.indexOf(id) < 0 ? 999 : priority.indexOf(id));
  const ordered = [...rules].sort((a, b) => rank(a.id) - rank(b.id));
  for (const rule of ordered) {
    if (!rule.patterns.some((pattern) => pattern.test(input))) continue;
    if (rule.dynamic) return rule.dynamic(ctx);
    const pick = Math.floor(Math.max(0, Math.min(0.999999, rand())) * rule.replies.length);
    return rule.replies[Math.min(rule.replies.length - 1, pick)].replaceAll('{website}', website);
  }
  const fallback = [
    'Mình nghe nè 😄 Bạn nói rõ hơn một chút được không?',
    'Câu này mình chưa bắt đúng ý rồi 😅 Bạn thử hỏi ngắn hơn, hoặc gõ “help” nha.',
    'Để mình hiểu cho chuẩn, bạn nói thêm một chút nhé 👀',
  ];
  return fallback[Math.floor(Math.max(0, Math.min(0.999999, rand())) * fallback.length)];
}

module.exports = { botPersonality, stripBotMention, getBotReply, supportedIntents };
