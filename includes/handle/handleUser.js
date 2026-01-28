import { findOrCreateUser, getUserByTelegram } from '../controllers/userController.js';
import { listOrdersByUser } from '../controllers/orderController.js';
import { formatCurrency, buildPaginationKeyboard } from '../../utils/index.js';
import { query } from '../database/index.js';

export const ensureUser = async (bot, msg) => {
  const user = await findOrCreateUser(msg.from.id, msg.from.username);
  return user;
};

export const sendMenu = async (bot, chatId, user, groupLinks = []) => {
  const { t } = await import('../helpers/langHelper.js');

  // Chỉ hiển thị tiêu đề menu
  const text = await t('menu_title', user.language);
  const opts = {
    reply_markup: {
      keyboard: [
        [{ text: await t('deposit', user.language) }, { text: await t('buy_product', user.language) }],
        [{ text: await t('history', user.language) }]
      ],
      resize_keyboard: true
    }
  };
  await bot.sendMessage(chatId, text, opts);
};

export const sendOrderHistory = async (bot, chatId, userId, page, pageSize) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listOrdersByUser(userId, offset, pageSize);
  if (!rows.length) {
    return bot.sendMessage(chatId, 'Chưa có đơn hàng.');
  }
  const lines = rows.map((o) => `#${o.id} - ${o.name} - ${formatCurrency(o.price)} - ${o.created_at}`);
  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  await bot.sendMessage(chatId, lines.join('\n'), {
    reply_markup: {
      inline_keyboard: buildPaginationKeyboard({ action: 'user_orders', page }, page, hasPrev, hasNext)
    }
  });
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

    const username = user.username ? `@${user.username}` : 'Chưa có';
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

    const infoText = `📊 **THÔNG TIN TÀI KHOẢN**

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
    await bot.sendMessage(chatId, 'Có lỗi xảy ra khi lấy thông tin. Vui lòng thử lại sau.');
  }
};
