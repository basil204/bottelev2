import { findOrCreateUser, getUserByTelegram } from '../controllers/userController.js';
import { getOrderByIdForUser, listTodayOrdersByUser } from '../controllers/orderController.js';
import { formatCurrency } from '../../utils/index.js';
import { query } from '../database/index.js';
import { getCache, setCache, delCache } from '../../lib/cache/index.js';

const menuMessageKey = (chatId) => `active_menu_message_${chatId}`;

export const sendTrackedMenu = async (bot, chatId, text, options = {}) => {
  const previousMessageId = getCache(menuMessageKey(chatId));
  if (previousMessageId) {
    try {
      await bot.deleteMessage(chatId, previousMessageId);
    } catch {}
    delCache(menuMessageKey(chatId));
  }
  const sent = await bot.sendMessage(chatId, text, options);
  if (sent?.message_id) setCache(menuMessageKey(chatId), sent.message_id, 24 * 60 * 60 * 1000);
  return sent;
};

export const ensureUser = async (bot, msg) => {
  const user = await findOrCreateUser(msg.from.id, msg.from.username);
  return user;
};

export const buildMainKeyboard = (t, lang) => ({
  keyboard: [
    [{ text: t('deposit', lang) }, { text: '🛒 Mua hàng' }],
    [{ text: '📆 Điểm danh' }, { text: '🛟 Hỗ trợ / Bảo hành' }],
    [{ text: '🧰 Tiện ích' }, { text: t('change_language', lang) }]
  ],
  resize_keyboard: true
});

export const sendMenu = async (bot, chatId, user, groupLinks = []) => {
  if (user?.is_banned) {
    return bot.sendMessage(
      chatId,
      '🚫 **TÀI KHOẢN CỦA BẠN ĐÃ BỊ KHÓA!**\n\n⚠️ Bạn đã bị Admin khóa quyền truy cập hệ thống. Vui lòng liên hệ Admin để biết thêm chi tiết.',
      { parse_mode: 'Markdown' }
    );
  }
  const { t } = await import('../helpers/langHelper.js');
  const lang = user.language || 'vi';
  await sendTrackedMenu(bot, chatId, t('menu_title', lang), {
    reply_markup: buildMainKeyboard(t, lang)
  });
};

export const sendPurchaseMenu = async (bot, chatId, user) => {
  const { t } = await import('../helpers/langHelper.js');
  const lang = user.language || 'vi';
  return sendTrackedMenu(bot, chatId, '🛒 MUA HÀNG\n\nChọn loại sản phẩm hoặc xem lại lịch sử:', {
    reply_markup: {
      keyboard: [
        [{ text: '🛒 Mua tài khoản' }],
        [{ text: '📧 Mua Gmail EDU' }],
        [{ text: t('history', lang) }],
        [{ text: '↩️ Menu chính' }]
      ],
      resize_keyboard: true
    }
  });
};

export const sendUtilityMenu = async (bot, chatId) => sendTrackedMenu(bot, chatId, '🧰 TIỆN ÍCH\n\nChọn tiện ích cần sử dụng:', {
  reply_markup: {
    keyboard: [
      [{ text: '🔎 Check Live' }, { text: '⬇️ Download All' }],
      [{ text: '🔐 Locket' }],
      [{ text: '↩️ Menu chính' }]
    ],
    resize_keyboard: true
  }
});

export const sendOrderHistory = async (bot, chatId, userId) => {
  const { getUserById } = await import('../controllers/userController.js');
  const user = await getUserById(userId);
  const lang = user?.language || 'vi';

  const { rows } = await listOrdersByUser(userId, 0, 10);
  if (!rows || !rows.length) {
    const emptyMessages = {
      en: 'You have no order history yet.',
      zh: '您暂无购买记录。'
    };
    return bot.sendMessage(chatId, emptyMessages[lang] || 'Bạn chưa có lịch sử giao dịch mua hàng nào.');
  }

  const orderBlocks = rows.map((order) => {
    const purchased = String(order.email || '').split(/\r?\n/).filter((line) => line.includes('|'));
    const credentials = purchased.map((line, index) => {
      const [username = '', password = '', ...extra] = line.split('|');
      let result = `  TK ${index + 1}: ${username}\n  MK ${index + 1}: ${password}`;
      if (extra.length) result += `\n  Thông tin thêm: ${extra.join(' | ')}`;
      return result;
    }).join('\n');
    const time = order.created_at ? new Date(order.created_at).toLocaleString('vi-VN') : '';
    return `#${order.id} · ${order.name}\nGiá: ${formatCurrency(order.price)}\nThời gian: ${time}${credentials ? `\n${credentials}` : '\nKhông có TK/MK tự động'}`;
  });

  const chunks = [];
  let current = `🧾 10 GIAO DỊCH GẦN NHẤT HÔM NAY\n\n`;
  for (const block of orderBlocks) {
    if ((current + block).length > 3900) {
      chunks.push(current.trim());
      current = `${block}\n\n`;
    } else {
      current += `${block}\n\n`;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  for (const chunk of chunks) await bot.sendMessage(chatId, chunk);
};

export const sendOrderCredentials = async (bot, chatId, userId, orderId) => {
  const order = await getOrderByIdForUser(orderId, userId);
  if (!order) return bot.sendMessage(chatId, '❌ Không tìm thấy đơn hàng này.');
  if (!order.email || !String(order.email).includes('|')) {
    return bot.sendMessage(chatId, 'Đơn hàng này không có tài khoản tự động để xem lại.');
  }

  const accounts = String(order.email).split(/\r?\n/).filter(Boolean);
  const details = accounts.map((line, index) => {
    const [username = '', password = '', ...extra] = line.split('|');
    let item = `Tài khoản ${index + 1}:\nTK: ${username}\nMK: ${password}`;
    if (extra.length) item += `\nThông tin thêm: ${extra.join(' | ')}`;
    return item;
  }).join('\n\n');

  return bot.sendMessage(chatId, `🔐 THÔNG TIN ĐÃ MUA\n\nĐơn: #${order.id}\nSản phẩm: ${order.name}\n\n${details}`);
};

export const getUserCache = async (telegramId) => {
  return await getUserByTelegram(telegramId);
};

export const sendUserInfo = async (bot, chatId, user) => {
  try {
    // Lấy thống kê đơn hàng
    const orderStats = await query(
      `SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(price), 0) as total_spent
       FROM orders 
       WHERE user_id = ?`,
      [user.id]
    );
    const { total_orders, total_spent } = orderStats[0] || { total_orders: 0, total_spent: 0 };

    // Lấy thống kê nạp tiền
    const depositStats = await query(
      `SELECT 
        COUNT(*) as total_deposits,
        COALESCE(SUM(amount), 0) as total_deposited
       FROM deposits 
       WHERE user_id = ? AND status = 'approved'`,
      [user.id]
    );
    const { total_deposits, total_deposited } = depositStats[0] || { total_deposits: 0, total_deposited: 0 };

    // Format ngày tạo tài khoản
    const createdDate = user.created_at
      ? new Date(user.created_at).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
      : 'N/A';

    const lang = user.language || 'vi';
    const noUsername = { en: 'Not set', zh: '未设置' };
    const username = user.username ? `@${user.username}` : (noUsername[lang] || 'Chưa có');
    const credit = user.credit || 0;

    // Lấy thống kê check-in
    const checkinStats = await query(
      `SELECT COUNT(*) as total_checkins FROM checkins WHERE user_id = ?`,
      [user.id]
    );
    const total_checkins = checkinStats[0]?.total_checkins || 0;

    // Lấy thống kê referral
    const referralStats = await query(
      `SELECT 
        COUNT(*) as total_referrals,
        SUM(credit_rewarded) as total_credits_earned
       FROM referrals 
       WHERE referrer_id = ?`,
      [user.id]
    );
    const { total_referrals, total_credits_earned } = referralStats[0] || { total_referrals: 0, total_credits_earned: 0 };

    const infoTexts = {
      en: `📊 **ACCOUNT INFORMATION**

👤 **Personal Info:**
• ID: \`${user.telegram_id}\`
• Username: ${username}
• Created: ${createdDate}

💰 **Balance:**
• Current balance: ${formatCurrency(user.balance)}
• Credit: ${credit}

🎁 **Credit Stats:**
• Total check-ins: ${total_checkins}
• Total referrals: ${total_referrals}
• Credits from referrals: ${total_credits_earned || 0}

📦 **Order Stats:**
• Total orders: ${total_orders}
• Total spent: ${formatCurrency(total_spent)}

💵 **Deposit Stats:**
• Total deposits: ${total_deposits}
• Total deposited: ${formatCurrency(total_deposited)}`,
      zh: `📊 **账户信息**

👤 **个人信息：**
• ID: \`${user.telegram_id}\`
• 用户名: ${username}
• 创建日期: ${createdDate}

💰 **余额：**
• 当前余额: ${formatCurrency(user.balance)}
• 积分: ${credit}

🎁 **积分统计：**
• 签到次数: ${total_checkins}
• 推荐人数: ${total_referrals}
• 推荐积分: ${total_credits_earned || 0}

📦 **订单统计：**
• 总订单: ${total_orders}
• 总消费: ${formatCurrency(total_spent)}

💵 **充值统计：**
• 充值次数: ${total_deposits}
• 充值总额: ${formatCurrency(total_deposited)}`
    };

    const infoText = infoTexts[lang] || `📊 **THÔNG TIN TÀI KHOẢN**

👤 **Thông tin cá nhân:**
• ID: \`${user.telegram_id}\`
• Username: ${username}
• Ngày tạo: ${createdDate}

💰 **Số dư:**
• Số dư hiện tại: ${formatCurrency(user.balance)}
• Credit: ${credit}

🎁 **Thống kê Credit:**
• Tổng lần check-in: ${total_checkins}
• Tổng người giới thiệu: ${total_referrals}
• Credit từ giới thiệu: ${total_credits_earned || 0}

📦 **Thống kê đơn hàng:**
• Tổng đơn hàng: ${total_orders}
• Tổng đã chi: ${formatCurrency(total_spent)}

💵 **Thống kê nạp tiền:**
• Tổng lần nạp: ${total_deposits}
• Tổng đã nạp: ${formatCurrency(total_deposited)}`;

    await bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('[SEND_USER_INFO] Error:', error);
    const errorMsgs = { en: 'Error loading info. Please try again.', zh: '加载信息出错，请重试。' };
    await bot.sendMessage(chatId, errorMsgs[user?.language] || 'Có lỗi xảy ra khi lấy thông tin. Vui lòng thử lại sau.');
  }
};
