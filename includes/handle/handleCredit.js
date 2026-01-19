import { getUserCredit, deductCredit } from '../controllers/creditController.js';
import { getAvailableAccount, markAccountSold } from '../controllers/gmailAccountController.js';
import { createOrder } from '../controllers/orderController.js';
import { formatCurrency, createCallbackData } from '../../utils/index.js';
import { notifyAdminAboutExchange } from './handleNotify.js';
import { globalConfig } from '../listen.js';
import { checkAccountLoginStatus, scheduleAccountDeletion } from '../services/gmailAutoDelete.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hiển thị menu đổi credit
export const showCreditExchangeMenu = async (bot, chatId, user) => {
  const credit = await getUserCredit(user.id);

  const message = `💎 **Đổi Credit**\n\n` +
    `💰 Credit hiện tại: **${credit}**\n\n` +
    `📋 **Bảng giá:**\n` +
    `• 🎓 Gmail Edu 1 giờ: **2 Credit**\n` +
    `• 🌐 Gmail Non 1 ngày: **10 Credit**\n\n` +
    `💡 Chọn loại bạn muốn đổi:`;

  // Sử dụng format ngắn để tránh vượt quá 64 bytes
  const inline_keyboard = [
    [
      {
        text: '🎓 Gmail Edu 1h (2 Credit)',
        callback_data: JSON.stringify({ a: 'ex_cr', t: 'edu', d: 's', c: 2 })
      }
    ],
    [
      {
        text: '🌐 Gmail Non 1 ngày (10 Credit)',
        callback_data: JSON.stringify({ a: 'ex_cr', t: 'non', d: 'd', c: 10 })
      }
    ]
  ];

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard }
  });
};

// Xử lý đổi credit lấy gmail
export const exchangeCreditForGmail = async (bot, msg, user, type, duration, cost) => {
  try {
    const credit = await getUserCredit(user.id);

    if (credit < cost) {
      return bot.sendMessage(
        msg.chat.id,
        `❌ **Không đủ credit!**\n\n` +
        `💰 Credit hiện tại: **${credit}**\n` +
        `💎 Cần: **${cost} Credit**\n\n` +
        `💡 Sử dụng /checkin để nhận thêm credit!`,
        { parse_mode: 'Markdown' }
      );
    }

    // Kiểm tra có account available không
    const account = await getAvailableAccount(type);
    if (!account) {
      return bot.sendMessage(
        msg.chat.id,
        `❌ Hiện tại không có ${type === 'edu' ? 'Gmail Edu' : 'Gmail Non'} available.\n\nVui lòng thử lại sau.`
      );
    }

    // Trừ credit
    const deductResult = await deductCredit(user.id, cost);
    if (!deductResult.success) {
      return bot.sendMessage(msg.chat.id, `❌ ${deductResult.error}`);
    }

    // Đánh dấu account đã bán
    await markAccountSold(account.id);

    // Không tạo order cho credit exchange vì không có product_id
    // Credit exchange là giao dịch đổi credit, không phải mua sản phẩm

    // Schedule deletion dựa trên duration
    if (duration === 'single') {
      // Single: xóa sau 1 giờ
      await scheduleAccountDeletion(account.email, account.type, 1 * 60 * 60 * 1000);
    } else if (duration === 'daily') {
      // Daily: xóa sau 24 giờ
      await scheduleAccountDeletion(account.email, account.type, 24 * 60 * 60 * 1000);
    }

    // Gửi thông tin account
    const accountInfo = `✅ **Đổi credit thành công!**\n\n` +
      `🎁 Loại: ${type === 'edu' ? 'Gmail Edu' : 'Gmail Non'}\n` +
      `⏰ Thời hạn: ${duration === 'single' ? '1 giờ' : '1 ngày'}\n` +
      `💎 Đã trừ: ${cost} Credit\n` +
      `💰 Credit còn lại: ${deductResult.remainingCredit}\n\n` +
      `📧 **Thông tin tài khoản:**\n` +
      `Email: \`${account.email}\`\n` +
      `Password: \`${account.password}\``;

    await bot.sendMessage(msg.chat.id, accountInfo, { parse_mode: 'Markdown' });

    // Notify admins
    const adminIds = globalConfig?.ADMIN_IDS || [];
    if (adminIds.length > 0) {
      notifyAdminAboutExchange(bot, adminIds, {
        productName: `Gmail ${type === 'edu' ? 'Edu' : 'Non'} (${duration === 'single' ? '1h' : '1 ngày'})`,
        username: user.username,
        telegramId: user.telegram_id,
        cost: cost,
        remainingCredit: deductResult.remainingCredit
      });
    }

    // Gửi file text nếu cần
    try {
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `gmail_${account.id}_${Date.now()}.txt`);
      const fileContent = `Email: ${account.email}\nPassword: ${account.password}\nType: ${type}\nDuration: ${duration}`;
      fs.writeFileSync(tempFilePath, fileContent);

      await bot.sendDocument(msg.chat.id, tempFilePath, {
        caption: `📧 Thông tin tài khoản ${type === 'edu' ? 'Gmail Edu' : 'Gmail Non'}`
      });

      // Xóa file tạm
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (fileError) {
      // Không throw error, chỉ log để không ảnh hưởng đến việc gửi file
    }

  } catch (error) {
    console.error('[EXCHANGE_CREDIT] Error:', error);
    await bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra khi đổi credit. Vui lòng thử lại sau.');
  }
};

