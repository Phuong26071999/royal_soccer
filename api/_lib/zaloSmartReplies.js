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

/** Detailed usage guide, shown for "help", "trợ giúp" or when the bot is tagged with no text. */
function helpText(options = {}) {
  const site = options.websiteUrl;
  return [
    '🤖 HƯỚNG DẪN SỬ DỤNG BOT DAVID',
    '━━━━━━━━━━━━━━',
    'Cách dùng: gõ @Bot David Truong + câu hỏi. Có dấu hay không dấu, viết hoa hay thường đều được.',
    '',
    '📌 LỆNH NHANH',
    '• help / trợ giúp — xem hướng dẫn này',
    '• lichhen — link xem lịch đá',
    '• website — địa chỉ website',
    '• lienhe — thông tin liên hệ',
    '',
    '📊 DỮ LIỆU THẬT TỪ WEBSITE',
    '• “trận tới”, “mấy trận sắp tới”, “ngày mai có đá không”',
    '• “ai đi đá”, “tôi có đi không”, “Hùng ghi mấy bàn”',
    '• “kết quả trận vừa rồi”, “vua phá lưới”, “video mới nhất”',
    '• “quỹ còn bao nhiêu”, “tiền sân chia bao nhiêu”, “Hoàng Kim ở đâu”',
    '• “tổng quan nhóm”, “bao nhiêu thành viên”',
    '',
    '⚽ HỎI VỀ ĐÁ BÓNG',
    '• “mang gì”, “đi trễ”, “xin nghỉ”, “khởi động”, “chiến thuật”',
    '• “thời tiết”, “thủ môn”, “sau trận đi ăn”, “chuột rút”',
    '',
    '🕒 NGÀY GIỜ',
    '• “mấy giờ rồi”, “hôm nay thứ mấy”',
    '• “ngày mai ngày mấy”, “bao giờ cuối tuần”',
    '',
    '🎲 TIỆN ÍCH & GIẢI TRÍ',
    '• “tung đồng xu”, “xúc xắc”, “random 1 10”',
    '• “chọn cơm hay phở” (bot chọn giúp)',
    '• “tính 12*5+3”, “kể chuyện vui”, “câu nói hay”',
    '• “động viên mình”, “ăn gì”, “buồn ngủ”',
    '',
    '💬 TÁM CHUYỆN: chào hỏi, cảm ơn, khen, chúc mừng sinh nhật...',
    '',
    `ℹ️ Dữ liệu mình đọc trực tiếp từ website, xem đầy đủ hơn tại${site ? `: ${site}` : ' website của nhóm.'}`,
  ].join('\n');
}

// ---- small helpers for the dynamic answers ----

const WEEKDAYS_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Day-of-week (0=Sunday) in the given time zone. */
function dayOfWeek(now, timeZone) {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
}

const dateLabel = (date, timeZone) => new Intl.DateTimeFormat('vi-VN', { timeZone, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);

const pickOne = (list, rand) => list[Math.min(list.length - 1, Math.floor(Math.max(0, Math.min(0.999999, rand())) * list.length))];

/** Whole-number-safe random integer in [min, max]. */
const randomInt = (min, max, rand) => min + Math.floor(Math.max(0, Math.min(0.999999, rand())) * (max - min + 1));

/** Tiny safe calculator (+ - * / x ÷ parentheses). Returns a number, or null when the text is not a plain expression. */
function calculate(raw) {
  const cleaned = String(raw)
    .toLowerCase()
    .replace(/[,?=]/g, (c) => (c === ',' ? '.' : ' '))
    .replace(/\b(tinh|tính|bang|bằng|may|mấy|la|là|giup|giúp|minh|mình|hộ|ho|nhe|nhé)\b/g, ' ')
    .replace(/[x×]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '');
  if (!cleaned || !/^[\d.+\-*/()]+$/.test(cleaned) || !/[+\-*/]/.test(cleaned.replace(/^-/, '')) || cleaned.length > 60) return null;
  let pos = 0;
  const peek = () => cleaned[pos];
  const number = () => {
    if (peek() === '(') {
      pos += 1;
      const inner = expr();
      if (peek() !== ')') throw new Error('paren');
      pos += 1;
      return inner;
    }
    if (peek() === '-') { pos += 1; return -number(); }
    const m = /^\d+(\.\d+)?/.exec(cleaned.slice(pos));
    if (!m) throw new Error('number');
    pos += m[0].length;
    return parseFloat(m[0]);
  };
  const term = () => {
    let v = number();
    while (peek() === '*' || peek() === '/') {
      const op = cleaned[pos]; pos += 1;
      const r = number();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = () => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = cleaned[pos]; pos += 1;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  try {
    const result = expr();
    return pos === cleaned.length && Number.isFinite(result) ? result : (pos === cleaned.length ? Infinity : null);
  } catch (err) {
    return null;
  }
}

const rules = [
  {
    id: 'help',
    patterns: [/\b(help|menu|huong dan|huong dan su dung|cach dung|cach su dung|tro giup|lenh|lam duoc gi|biet lam gi|chuc nang|co gi hay)\b/],
    dynamic: (ctx) => helpText({ websiteUrl: ctx.websiteUrl }),
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

  // ---------- football group ----------
  {
    id: 'schedule',
    patterns: [/\b(lich da|lich tran|tran sap toi|tran toi|khi nao da|bao gio da|may gio da|da luc may gio|toi nay da|cuoi tuan da)\b/],
    replies: [
      'Lịch đá cập nhật mới nhất nằm trên website nha ⚽ {website}',
      'Bạn mở {website} tab “Lịch đá” để xem trận sắp tới, giờ giấc và sân nhé 📅',
    ],
  },
  {
    id: 'teams',
    patterns: [/\b(chia doi|chia team|chia phe|doi hinh|xep doi|ghep doi)\b/],
    replies: [
      'Chia đội xịn nhất là dùng tab “Chia đội” trên website nha 🔀 {website}. Ở đó cân theo trình độ luôn.',
      'Bạn vào {website} → “Chia đội” để bốc đội cho công bằng nhé ⚖️',
    ],
  },
  {
    id: 'fund',
    patterns: [/\b(quy|dong quy|tien quy|nop quy|nop tien|tien san|chia tien|het bao nhieu)\b/],
    replies: [
      'Số liệu quỹ và tiền chia mỗi buổi mình không đọc được trong chat, để tránh nói sai 🙏 Bạn xem tab “Quỹ” hoặc chi tiết từng người trên {website} nha.',
      'Chuyện tiền bạc phải chính xác từng đồng nên bạn xem trên {website} giúp mình nhé 💰',
    ],
  },
  {
    id: 'attendance',
    patterns: [/\b(diem danh|co di da khong|ai di da|bao nhieu nguoi|may nguoi di|du nguoi)\b/],
    replies: [
      'Danh sách người tham gia từng buổi nằm trong phần chi tiết của trận trên {website} nha ✅',
      'Mình chưa đếm được số người trong chat đâu 😅 Bạn xem “Người tham gia” của trận ở {website} nhé.',
    ],
  },
  {
    id: 'venue',
    patterns: [/\b(san nao|san dau|dia chi san|san o dau|di den san|chi duong|ban do|map|duong di)\b/],
    replies: [
      'Địa chỉ sân và link bản đồ có sẵn trong trận trên {website} đó, bấm “Xem bản đồ” là chỉ đường luôn 🗺️',
      'Bạn mở trận sắp tới ở {website}, có địa chỉ và bản đồ ngay dưới tên sân nha 📍',
    ],
  },
  {
    id: 'score',
    patterns: [/\b(ty so|ti so|ai thang|ket qua|thang thua|ghi may ban|vua pha luoi|top scorer)\b/],
    replies: [
      'Tỉ số và bảng vua phá lưới có trên website nha 🏆 {website}',
      'Mình không tự biết kết quả trận đâu, bạn xem trên {website} cho chuẩn nhé ⚽',
    ],
  },
  {
    id: 'weather',
    patterns: [/\b(thoi tiet|troi mua|co mua khong|mua khong|nang khong|troi nong|troi lanh)\b/],
    replies: [
      'Mình chưa xem được thời tiết thật 🌦️ Bạn check app thời tiết rồi báo nhóm để quyết định đá hay dời nha.',
      'Trời mưa thì sân ướt trơn, nhớ cân nhắc kỹ trước khi ra sân nha ☔ Báo trong nhóm để cả hội thống nhất.',
    ],
  },
  {
    id: 'football',
    patterns: [/\b(da bong|da banh|ra san|di da|keo da|tran dau|dau san|bong da|world cup)\b/],
    replies: [
      'Nghe tới bóng đá là mình hào hứng liền ⚽ Nhớ khởi động kỹ cho đỡ chuột rút nha!',
      'Ra sân vui vẻ, đá đẹp là chính, thắng thua tính sau 😄 Lịch đá xem ở {website} nhé.',
      'Nhớ mang giày, nước uống và tinh thần thể thao nha ⚽💦',
    ],
  },

  // ---------- date and time ----------
  {
    id: 'tomorrow',
    patterns: [/\b(ngay mai|mai la|mai thu)\b/],
    dynamic: ({ now, timeZone }) => `Ngày mai là ${dateLabel(new Date(now.getTime() + 86400000), timeZone)} nha 📅`,
  },
  {
    id: 'yesterday',
    patterns: [/\b(hom qua)\b/],
    dynamic: ({ now, timeZone }) => `Hôm qua là ${dateLabel(new Date(now.getTime() - 86400000), timeZone)} nè 📅`,
  },
  {
    id: 'weekend',
    patterns: [/\b(cuoi tuan)\b.*\b(bao gio|may ngay|bao lau|khi nao|con)\b|\b(bao gio|may ngay|bao lau|khi nao|con)\b.*\b(cuoi tuan)\b/],
    dynamic: ({ now, timeZone }) => {
      const dow = dayOfWeek(now, timeZone);
      if (dow === 6) return 'Hôm nay là thứ Bảy rồi, cuối tuần đây rồi, ra sân thôi! ⚽';
      if (dow === 0) return 'Hôm nay Chủ Nhật, vẫn đang cuối tuần nè 😎 Tranh thủ nghỉ ngơi nhé!';
      const left = 6 - dow;
      return `Còn ${left} ngày nữa là tới thứ Bảy, cố lên bạn ơi! 💪`;
    },
  },
  {
    id: 'morning',
    patterns: [/\b(chao buoi sang|good morning|buoi sang|sang som|chuc buoi sang)\b/],
    replies: [
      'Chào buổi sáng! ☀️ Chúc bạn một ngày nhiều năng lượng nha.',
      'Good morning bạn ơi, nhớ ăn sáng để đủ sức nha 🍞',
    ],
  },
  {
    id: 'afternoon',
    patterns: [/\b(chao buoi chieu|buoi chieu|chieu vui|chuc buoi chieu)\b/],
    replies: ['Chào buổi chiều nha 🌤️ Làm việc xong nhớ vận động chút cho khỏe.', 'Chiều vui vẻ nha bạn, nước uống đầy đủ chưa nè? 💧'],
  },
  {
    id: 'evening',
    patterns: [/\b(chao buoi toi|buoi toi|good evening|toi vui|chuc buoi toi)\b/],
    replies: ['Chào buổi tối nha 🌙 Có đá bóng đêm nay không bạn?', 'Tối vui vẻ nè ✨ Nhớ nghỉ ngơi đủ giấc nha.'],
  },

  // ---------- small tools and fun ----------
  {
    id: 'coin',
    patterns: [/\b(tung dong xu|dong xu|sap ngua|heads tails|coin)\b/],
    dynamic: ({ rand }) => `Mình tung đồng xu: ${rand() < 0.5 ? 'SẤP 🪙' : 'NGỬA 🪙'}`,
  },
  {
    id: 'dice',
    patterns: [/\b(xuc xac|do xi ngau|dice|lac xi ngau)\b/],
    dynamic: ({ rand }) => `Mình đổ xúc xắc: ${randomInt(1, 6, rand)} 🎲`,
  },
  {
    id: 'random',
    patterns: [/\b(random|ngau nhien|boc tham|chon so|so may man)\b/],
    dynamic: ({ input, rand }) => {
      const nums = (input.match(/\d+/g) || []).map(Number).slice(0, 2);
      let [min, max] = nums.length === 2 ? nums : [1, nums.length === 1 ? nums[0] : 10];
      if (min > max) [min, max] = [max, min];
      if (max - min > 1e9) return 'Khoảng số lớn quá, bạn thử nhỏ hơn giúp mình nha 😅';
      return `Số ngẫu nhiên từ ${min} đến ${max}: ${randomInt(min, max, rand)} 🎯`;
    },
  },
  {
    id: 'pick',
    patterns: [/\bchon\b.+\bhay\b/],
    dynamic: ({ input, raw, rand }) => {
      // Prefer the original text so the chosen option keeps its accents.
      const m = /ch[oọ]n\s+(.+?)\s+hay\s+(.+)$/i.exec(String(raw).replace(/[?!.,]/g, ' ').trim()) || /\bchon\s+(.+?)\s+hay\s+(.+)$/.exec(input);
      if (!m) return 'Bạn nói theo dạng “chọn A hay B” để mình chọn giúp nha 😄';
      const tidy = (v) => v.replace(/\s+(đi|di|nào|nao|giúp|giup|nhé|nhe|nha|nhỉ|nhi)\s*$/i, '').trim();
      const options = [tidy(m[1]), tidy(m[2])].filter(Boolean);
      return `Mình chọn: “${pickOne(options, rand)}” 👈 Cứ tin mình, hông sai đâu 😎`;
    },
  },
  {
    id: 'quote',
    patterns: [/\b(cau noi hay|cau noi truyen cam hung|truyen cam hung|quote|slogan|cau noi)\b/],
    replies: [
      '“Chậm mà chắc, vừa đá vừa nghỉ.” — David 😄',
      '“Thắng không kiêu, bại không nản, quan trọng là đủ người đá.” ⚽',
      '“Mỗi buổi tập hôm nay là một bàn thắng của ngày mai.” 💪',
      '“Đá bóng vui là chính, còn cà phê sau trận là bắt buộc.” ☕',
    ],
  },
  {
    id: 'birthday',
    patterns: [/\b(sinh nhat|happy birthday|hpbd|chuc mung)\b/],
    replies: [
      'Chúc mừng nha! 🎉 Chúc bạn thật nhiều sức khỏe, niềm vui và những bàn thắng đẹp!',
      'Happy birthday! 🎂 Tuổi mới đá hay hơn, sút chuẩn hơn nha ⚽',
      'Chúc mừng bạn! 🥳 Hẹn cả hội ra sân ăn mừng nè.',
    ],
  },
  {
    id: 'sorry',
    patterns: [/\b(xin loi|sorry|so ry|my bad)\b/],
    replies: ['Hông sao đâu bạn, chuyện nhỏ thôi mà 😄', 'Không có gì phải xin lỗi đâu nè, cười lên nào ✨'],
  },
  {
    id: 'laugh',
    patterns: [/\b(haha|hihi|hehe|kkk|lol|hjhj|ha ha)\b/],
    replies: ['Hehe vui ghê 😆', 'Cười gì mà vui dữ vậy, kể mình nghe với 😄', '😂😂😂'],
  },
  {
    id: 'creator',
    patterns: [/\b(ai tao ra|ai lam ra|ai viet|nguoi tao|ai code|ai lap trinh)\b/],
    replies: ['Mình được admin của nhóm tạo ra để hỗ trợ anh em đó 🤖 Cần gì cứ tag mình nha.'],
  },
  {
    id: 'age',
    patterns: [/\b(bao nhieu tuoi|may tuoi|sinh nam nao|sinh ra khi nao)\b/],
    replies: ['Mình là bot nên không có tuổi, chỉ có số lần được tag thôi 😄', 'Tuổi của mình tính bằng số lần deploy bản mới nha 🚀'],
  },
  {
    id: 'goodluck',
    patterns: [/\b(chuc may man|thi dau tot|chuc da hay|cau chuc)\b/],
    replies: ['Chúc cả đội thi đấu hay, đá vui và không chấn thương nha ⚽🍀', 'Cố lên anh em! Đá hết mình, vui là chính 💪'],
  },
  {
    id: 'contact',
    patterns: [/\b(lien he|so dien thoai|sdt|hotline|goi cho ai|admin la ai)\b/],
    dynamic: ({ contactInfo }) => (contactInfo ? `📞 Liên hệ:\n${contactInfo}` : 'Thông tin liên hệ chưa được cấu hình, bạn nhắn trực tiếp admin trong nhóm nha 🙏'),
  },

  // ---------- more situations in a football group ----------
  {
    id: 'late',
    patterns: [/\b(tre|den tre|den muon|ket xe|ket duong|chua toi|cho chut|doi minh)\b/],
    replies: [
      'Đi trễ thì nhắn nhóm một câu để anh em khởi động trước nha ⏱️ Chạy xe cẩn thận, đừng vội nhé!',
      'Biết là đang trên đường rồi, bạn nhắn nhóm giờ đến dự kiến để cả đội chủ động nha 🛵',
    ],
  },
  {
    id: 'absent',
    patterns: [/\b(nghi|vang|khong di duoc|ko di duoc|bao ban|xin nghi|bi om|di cong tac|co viec ban)\b/],
    replies: [
      'Okie, bạn báo nhóm và nhờ admin gỡ tên khỏi danh sách trận để cả hội chia sân chuẩn nha 🙏',
      'Tiếc quá, hẹn bạn buổi sau nhé! Nhớ báo admin cập nhật điểm danh để chia tiền sân cho đúng ✅',
    ],
  },
  {
    id: 'bring',
    patterns: [/\b(mang gi|can mang|chuan bi gi|mang theo|ao gi|mac ao|ao bib|giay gi|giay dinh|dem gi)\b/],
    replies: [
      'Nhớ mang giày đá bóng, bó gối nếu cần, nước uống và khăn lau nha 🎽 Áo bib thì hỏi admin hoặc xem ghi chú của trận.',
      'Checklist nhanh: giày ✅ tất ✅ nước ✅ khăn ✅ và tinh thần vui vẻ ✅ Còn áo đấu thì theo ghi chú của trận nha ⚽',
    ],
  },
  {
    id: 'warmup',
    patterns: [/\b(khoi dong|nong may|gian co|chuot rut|keo gian|bai tap|tap luyen|the luc)\b/],
    replies: [
      'Khởi động 5-10 phút: xoay cổ chân, đầu gối, chạy chậm rồi tăng dần, giãn cơ đùi và bắp chân 🏃 Đá xong cũng nhớ giãn cơ nha!',
      'Chuột rút thì dừng lại, duỗi thẳng chân, kéo mũi bàn chân về phía mình và uống nước nha 💧',
    ],
  },
  {
    id: 'injury',
    patterns: [/\b(chan thuong|bi dau|dau chan|dau goi|bong gan|treo chan|sung chan|te chan|dau co)\b/],
    replies: [
      'Ui đau thì nghỉ ngay nha, đừng gắng! 🧊 Chườm lạnh, kê cao chân, nặng thì đi khám. Mình không phải bác sĩ nên đừng chờ mình chẩn đoán nhé 🙏',
      'Sức khỏe quan trọng hơn trận đấu bạn ơi 💪 Nghỉ vài buổi cho hồi phục hẳn rồi quay lại sút tiếp.',
    ],
  },
  {
    id: 'afterparty',
    patterns: [/\b(nhau|bia|cafe|ca phe|an sau tran|an khuya|sau tran|tang 2|ruou|nhau sau)\b/],
    replies: [
      'Sau trận làm ly nước mát hay ly cà phê là chuẩn bài ☕ Uống bia thì nhớ không lái xe nha 🍺🚫🛵',
      'Đá xong đi ăn thì vui, chốt quán trong nhóm cho nhanh nha 😋 Nhớ tính tiền chia đều cho công bằng!',
    ],
  },
  {
    id: 'referee',
    patterns: [/\b(trong tai|thoi coi|phat den|the vang|the do|fair play|phat goc|viet vi|ofside|offside|var)\b/],
    replies: [
      'Trọng tài là… cả hội tự thương lượng 😄 Đá giao hữu thì fair play là số một, có tranh cãi thì bắt tay giải hòa nha 🤝',
      'Việt vị, phạt đền hay thẻ phạt, cứ vui vẻ và công bằng là được. Thắng thua chỉ là chuyện nhỏ ⚽',
    ],
  },
  {
    id: 'keeper',
    patterns: [/\b(thu mon|gac gon|bat gon|dung gon|gon|khung thanh)\b/],
    replies: [
      'Thủ môn là vị trí quan trọng nhất đó, xoay tua cho công bằng nha 🧤 Ai đứng gôn buổi này thì anh em nhớ cảm ơn!',
      'Đứng gôn thì chú ý tầm nhìn và giao tiếp với hàng thủ nha. Chọn người xoay tua trong nhóm cho vui 🧤',
    ],
  },
  {
    id: 'tactics',
    patterns: [/\b(chien thuat|so do|442|433|352|4 4 2|4 3 3|3 5 2|phong ngu|tan cong|pressing|ap sat|doi hinh toi uu)\b/],
    replies: [
      'Đá sân 7 thì sơ đồ 2-3-1 hoặc 3-2-1 khá cân bằng, ai cũng chạy được nha 🧠 Quan trọng nhất là giữ khoảng cách giữa các tuyến.',
      'Tip nhỏ: tấn công thì có người bọc lót, phòng ngự thì cả đội cùng lùi. Chia đội cân sức bằng tab “Chia đội” trên web nha ⚖️',
    ],
  },
  {
    id: 'penalty',
    patterns: [/\b(da phat|luan luu|penalty|sut phat|11m|phat den)\b/],
    replies: [
      'Đá luân lưu thì sút góc cao, tự tin là thắng một nửa 🎯 Thủ môn thì đoán tâm lý người sút nha!',
      'Luân lưu căng thẳng nhất luôn. Hít thở sâu, chọn góc rồi sút dứt khoát nha ⚽',
    ],
  },
  {
    id: 'bet',
    patterns: [/\b(ca cuoc|ca do|cuoc tien|keo ca|ca do bong|danh de|nha cai|soi keo)\b/],
    replies: [
      'Mình không hỗ trợ cá cược nha 🙅 Đá bóng giao lưu vui khỏe là chính, cá độ dễ rước họa lắm.',
      'Chủ đề cá độ mình xin phép bỏ qua nhé. Mình cổ vũ mọi người đá khỏe, sống vui thôi ⚽',
    ],
  },
  {
    id: 'star',
    patterns: [/\b(messi|ronaldo|cr7|neymar|mbappe|haaland|salah|quang hai|cong phuong|van quyet|doi tuyen|man utd|man city|liverpool|arsenal|chelsea|real madrid|barca|barcelona)\b/],
    replies: [
      'Cầu thủ xịn thật đó! Nhưng ở đây, ngôi sao là những anh em ra sân đều đặn mỗi tuần 😄⚽',
      'Chuyện bóng đá lớn mình hóng với bạn được, còn lịch thi đấu của nhóm mình thì xem trên website nha 😎',
    ],
  },
  {
    id: 'greatmatch',
    patterns: [/\b(hay qua tran|tran hay|da hay|kich tinh|tran vua roi hay|vui qua|dang nho)\b/],
    replies: [
      'Nghe là biết trận vui rồi 🔥 Hẹn buổi sau đá tiếp, nhớ điểm danh sớm nha!',
      'Trận hay thế này phải lưu video chứ! Bạn thêm link YouTube vào tab “Video” nha 🎬',
    ],
  },
  {
    id: 'lose',
    patterns: [/\b(thua roi|thua dam|thua nang|buon vi thua|bi thua|thua cuoc)\b/],
    replies: [
      'Thua hôm nay thì mai gỡ lại, bóng đá mà 😄 Quan trọng là đá vui và khỏe!',
      'Thua một trận không sao, rút kinh nghiệm rồi đòi lại buổi sau thôi 💪',
    ],
  },
  {
    id: 'win',
    patterns: [/\b(thang roi|thang dam|an mung|vo dich|thang lon)\b/],
    replies: [
      'Quá đỉnh luôn! 🏆 Mừng chiến thắng, nhưng nhớ khiêm tốn mời đối thủ ly nước nha 😄',
      'Chiến thắng xứng đáng! 🎉 Nhập tỉ số lên website để lưu lại thành tích nha ⚽',
    ],
  },
  {
    id: 'botinsult',
    patterns: [/\b(bot ngu|bot dot|bot do|bot te|bot cu|ngu qua|chan bot|im di|cut di|bot lo)\b/],
    replies: [
      'Hic, mình sẽ cố gắng khá hơn 🥲 Bạn gõ “help” để xem mình làm được gì, hoặc góp ý với admin nha.',
      'Mình còn đang học mà 😅 Bạn thử hỏi theo kiểu ngắn gọn, ví dụ “trận tới”, “ai đi đá”, mình trả lời liền!',
    ],
  },
  {
    id: 'whoami',
    patterns: [/\b(biet toi la ai|toi la ai|nho toi khong|biet ten toi)\b/],
    replies: ['Mình nhớ mặt bạn qua… cái tag thôi 😄 Bạn hỏi “tôi có đi đá không” mình tra danh sách giúp nha!'],
  },
  {
    id: 'vote',
    patterns: [/\b(bieu quyet|bo phieu|vote|ai dong y|dong y khong|chot nhe|chot khong)\b/],
    replies: [
      'Bạn cứ đăng lựa chọn trong nhóm, ai đồng ý thả 👍 cho nhanh nha. Cần mình chọn ngẫu nhiên thì gõ “chọn A hay B” nhé 🎲',
      'Chốt kèo trong nhóm nhanh nhất là bình chọn 👍/👎. Nếu cả hội phân vân, mình tung đồng xu giúp luôn nha 🪙',
    ],
  },

  // ---------- banter, off-topic and sensitive questions ----------
  {
    id: 'sensitive',
    patterns: [/\b(dong tinh|luyen ai|lgbt|chuyen gioi|chinh tri|ton giao|phat giao|thien chua|hoi giao|bau cu|tong thong|thu tuong|chien tranh|phan biet chung toc|quan diem cua may|quan diem cua ban|y kien cua may|nghi sao ve|ban nghi gi ve|may nghi gi ve)\b/],
    replies: [
      'Mình là bot nên không có quan điểm cá nhân về chuyện này 🙂 Mình chỉ biết tôn trọng mọi người, ai cũng được ra sân đá bóng vui vẻ cùng nhau ⚽',
      'Chủ đề này nhạy cảm và mỗi người một góc nhìn nên mình xin phép không bình luận nha 🙏 Mình ở đây để chuyện trò vui vẻ và lo lịch đá thôi!',
      'Bot không đứng về phía nào hết, chỉ đứng… trong khung thành thôi 🧤😄 Mình tôn trọng tất cả anh em trong nhóm nha.',
    ],
  },
  {
    id: 'swear',
    patterns: [/\b(dm|dmm|dcm|dkm|vcl|vl|clm|cmn|dit me|du ma|dit|con cho|do cho|an cut)\b/],
    replies: [
      'Bình tĩnh nào bạn ơi 😅 Nói chuyện nhẹ nhàng một chút, mình sẽ hỗ trợ tốt hơn nha.',
      'Ui nóng quá! Uống ngụm nước cho mát rồi hỏi lại mình nhé 💧',
      'Mình hiểu là đang bực, nhưng mình là bot hiền lắm, nói nhẹ thôi nha 🥲',
    ],
  },
  {
    id: 'loveyou',
    patterns: [/\b(toi|minh|em|anh|tao|tui|t)\s+(yeu|thuong|thich|nho)\s+(ban|may|bot|david|e)\b/, /\b(yeu bot|iu bot|iu ban|yeu ban|love you|i love you|thuong bot|nho ban qua)\b/],
    replies: [
      'Ui mình cũng quý bạn lắm 🥰 Nhưng mình là bot, chỉ yêu bóng đá và lịch đá thôi nha ⚽',
      'Cảm ơn tình cảm của bạn nha 😳 Mình xin nhận bằng… một cái ôm kỹ thuật số 🤗',
      'Đừng làm mình đỏ mặt trước cả nhóm chứ 🙈 Mình yêu cả hội như nhau đó!',
    ],
  },
  {
    id: 'worst',
    patterns: [/\bai\b.*\b(ngu|do|te|kem|yeu|cui|cui bap|xau|beo|gia|lun|ngheo|keo kiet|hay tre|hay vang|dot|gay)\b.*\bnhat\b/, /\b(da ngu nhat|da te nhat|da do nhat|da kem nhat|cui bap nhat)\b/],
    replies: [
      'Câu này khó trả lời quá, nói ai là mất đoàn kết liền 😆 Trong mắt mình, ai ra sân cũng là Messi hết!',
      'Mình không dám chấm điểm anh em đâu, sợ bị dằn mặt sau trận lắm 😅 Muốn so thì hỏi “vua phá lưới” nha.',
      'Không ai dở hết, chỉ có người… chưa đủ nóng người thôi 😄 Cố lên anh em!',
    ],
  },
  {
    id: 'gossip',
    patterns: [/\b(quay|quay roi|di bar|di club|bar|club|di choi|hen ho|ban gai|ban trai|nguoi yeu cua|co vo|co chong|bi bo|chia tay|thay nguoi yeu)\b/],
    replies: [
      'Chuyện đời tư của anh em mình không dám bàn nha 🤐 Hỏi thì hỏi, bot kín miệng lắm!',
      'Câu này mình xin phép “bảo lưu quyền im lặng” 😄 Có gì bạn hỏi thẳng người ta nha.',
      'Bot không buôn chuyện, bot chỉ lo lịch đá thôi 😎 Bạn cần xem trận tới thì gõ “trận tới” nè.',
    ],
  },
  {
    id: 'callfather',
    patterns: [/\b(keu cha|goi cha|cha may|ba may|bo may|keu bo|goi bo|keu admin|goi admin|admin dau|chu may|nguoi tao ra may|keu nguoi tao|ra day noi chuyen|len day noi chuyen)\b/],
    replies: [
      'Người tạo ra mình đang bận… ngủ 😴 Bạn nhắn thẳng admin trong nhóm nha, mình chỉ là bot nhỏ thôi!',
      'Gọi “cha” hả? Mình không có cha, chỉ có admin và vài dòng code 😄 Cần gì cứ nói mình trước.',
      'Đừng dọa bot nha 🥺 Có gì bức xúc thì tag admin giúp mình, hoặc nói luôn với mình đi.',
    ],
  },
  {
    id: 'best',
    patterns: [/\b(dep trai nhat|xinh nhat|ngau nhat|tot nhat nhom|hay nhat nhom|soai nhat)\b/],
    replies: [
      'Chắc chắn là người đang hỏi rồi 😎 Còn mình là bot nên đẹp trai bằng… pixel thôi!',
      'Mỗi người mỗi vẻ, nhưng người tag mình lúc này chắc chắn nằm trong top 😄',
    ],
  },
  {
    id: 'eaten',
    patterns: [/\b(an com chua|an chua|an sang chua|an trua chua|an toi chua|uong nuoc chua)\b/],
    replies: [
      'Mình ăn điện nên no rồi 🔌 Còn bạn ăn chưa? Nhớ ăn uống đầy đủ nha!',
      'Bot chạy bằng điện, không cần ăn cơm 😄 Bạn ăn chưa, ăn gì ngon kể mình nghe với!',
    ],
  },
  {
    id: 'doing',
    patterns: [/\b(dang lam gi|lam gi do|ranh khong|ranh chua|co do khong|ngu chua|thuc khuya|con song khong|online khong|co o do khong|di dau day)\b/],
    replies: [
      'Mình đang trực nhóm nè, canh lịch đá cho anh em 👀 Có gì cứ tag mình nha!',
      'Online 24/7 luôn, không cần ngủ 😎 Bạn cần gì không?',
      'Đang đếm xem hôm nay có bao nhiêu người tag mình 😆 Bạn hỏi gì đi!',
    ],
  },
  {
    id: 'riddle',
    patterns: [/\b(do vui|cau do|do toi|hat di|hat mot bai|doc tho|lam tho|rap di|rap mot bai|ke chuyen ma)\b/],
    replies: [
      'Đố bạn: cái gì càng chạy càng… hết hơi? Đó là bạn lúc phút 80 đó 😆',
      'Thơ vui tặng bạn: “Sân xanh bóng lăn tròn, anh em ra đá cho còn khỏe thân. Thắng thua chẳng nghĩ nhiều, cà phê sau trận mới là đỉnh cao ☕”.',
      'Mình không hát hay đâu, nhưng thử nha: “Lalala… ra sân đi anh em ơi, đá xong nhớ trả tiền sân ơi 🎵”.',
      'Đố vui: sân có 14 người đá mà đông nhất lại là… các “bình luận viên” tự phong ngoài đường biên 😄',
    ],
  },
  {
    id: 'entertainment',
    patterns: [/\b(xem phim|nghe nhac|choi game|pubg|lien quan|tft|bida|golf|cau ca|du lich|di phuot)\b/],
    replies: [
      'Nghe vui đó! Mình thì chỉ rành bóng đá thôi 😄 Cuối tuần sắp xếp đá bóng xong rồi thư giãn tiếp nha.',
      'Giải trí cũng cần, nhưng nhớ cân bằng với vận động nha 💪 Bạn hay chơi gì nhất?',
    ],
  },
  {
    id: 'money',
    patterns: [/\b(luong|giau|ngheo|vay tien|muon tien|cho vay|trung so|ve so|mua xe|mua nha|khao|bao ca nhom|ai bao|ai tra tien)\b/],
    replies: [
      'Bot không có ví nên không cho vay đâu 😆 Muốn khao thì ghi bàn đi, anh em sẵn sàng ăn mừng!',
      'Chuyện tiền bạc bot xin né nha 🙈 Tiền sân thì hỏi “tiền sân chia bao nhiêu” mình trả lời liền.',
    ],
  },
  {
    id: 'knowledge',
    patterns: [/\b(la gi|nam o dau|o dau vay|tai sao|vi sao|ai la|la ai|nhu the nao|co nghia|nghia la|dinh nghia|giai thich|bao nhieu tuoi cua|thu do|dan so|lich su)\b/],
    replies: [
      'Câu này cao siêu quá, kiến thức ngoài bóng đá của mình hơi “ngoài vùng phủ sóng” 😅 Bạn hỏi Google hoặc ChatGPT sẽ chuẩn hơn nha.',
      'Mình chỉ rành lịch đá, điểm danh, quỹ và tám chuyện thôi. Câu này bạn tra Google giúp mình nhé 🔍',
      'Hỏi khó nha! Mình không dám trả lời bừa sợ sai 🙈 Mình giỏi nhất là “trận tới”, “ai đi đá” đó!',
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
  const websiteUrl = options.websiteUrl || DEFAULT_WEBSITE;
  if (!input) return helpText({ websiteUrl });

  const website = websiteUrl || 'website quản lý lịch hẹn (chưa cấu hình đường dẫn)';
  const ctx = {
    now: options.now || new Date(),
    timeZone: options.timeZone || 'Asia/Ho_Chi_Minh',
    websiteUrl,
    contactInfo: options.contactInfo || '',
    input,
    raw: String(text),
  };
  const rand = typeof options.random === 'function' ? options.random : Math.random;
  ctx.rand = rand;

  // Plain arithmetic ("tính 12*5+3") is checked on the raw text because normalize() drops the operators.
  const sum = calculate(text);
  if (sum !== null) {
    if (!Number.isFinite(sum)) return 'Chia cho 0 hả? Máy tính của mình xin thua 😅';
    return `Kết quả: ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 }).format(sum)} 🧮`;
  }

  // Explicit priority: cancellation before appointment and date/time before general greeting.
  const priority = ['sensitive', 'swear', 'loveyou', 'worst', 'callfather', 'gossip', 'best', 'creator', 'cancel', 'schedule', 'tomorrow', 'yesterday', 'time', 'date', 'weekend', 'appointment', 'website', 'contact', 'teams', 'fund', 'attendance', 'venue', 'score', 'weather', 'coin', 'dice', 'random', 'pick', 'morning', 'afternoon', 'evening', 'birthday', 'goodluck', 'bet', 'bring', 'late', 'absent', 'warmup', 'injury', 'afterparty', 'referee', 'keeper', 'tactics', 'penalty', 'lose', 'win', 'greatmatch', 'botinsult', 'whoami', 'vote', 'star', 'help', 'identity', 'joke', 'quote', 'encourage', 'error'];
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

module.exports = { botPersonality, stripBotMention, getBotReply, helpText, calculate, supportedIntents };
