import { getUserByTelegram, updateBalance } from '../controllers/userController.js';
import { createVipPackage, getActiveVipPackage, getUserVipPackages } from '../controllers/vipPackageController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { formatCurrency, buildPaginationKeyboard, createCallbackData } from '../../utils/index.js';

const VIP_PACKAGE_PRICE = 200000; // 200k
const VIP_PACKAGE_GMAIL_COUNT = 400;
const VIP_PACKAGE_DURATION_DAYS = 30; // 1 tháng

// Hiển thị menu mua gói VIP
export const showVipMenu = async (bot, chatId, user) => {
  // Kiểm tra gói VIP đang active
  const activePackage = await getActiveVipPackage(user.id);
  
  let packageInfo = '';
  if (activePackage) {
    const remaining = activePackage.total_gmail - activePackage.used_gmail;
    const expiresAt = new Date(activePackage.expires_at);
    const daysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
    
    packageInfo = `\n\n✅ **Gói VIP hiện tại:**\n` +
                 `📧 Đã dùng: ${activePackage.used_gmail}/${activePackage.total_gmail} Gmail\n` +
                 `📊 Còn lại: ${remaining} Gmail\n` +
                 `⏰ Hết hạn sau: ${daysLeft} ngày`;
  } else {
    packageInfo = `\n\n❌ Chưa có gói VIP đang active`;
  }
  
  const menuText = `⭐ **GÓI VIP**\n\n` +
                   `💰 Giá: ${formatCurrency(VIP_PACKAGE_PRICE)}\n` +
                   `📧 Bao gồm: ${VIP_PACKAGE_GMAIL_COUNT} Gmail accounts\n` +
                   `⏰ Hạn sử dụng: ${VIP_PACKAGE_DURATION_DAYS} ngày\n\n` +
                   `💡 Khi mua gói VIP, bạn có thể tạo ${VIP_PACKAGE_GMAIL_COUNT} Gmail accounts miễn phí trong ${VIP_PACKAGE_DURATION_DAYS} ngày.` +
                   packageInfo;

  const keyboard = {
    inline_keyboard: [
      activePackage ? [] : [{ text: '💳 Mua gói VIP', callback_data: createCallbackData({ action: 'buy_vip' }) }],
      [{ text: '📋 Lịch sử gói', callback_data: createCallbackData({ action: 'vip_history', page: 1 }) }],
      [{ text: '⬅️ Quay lại', callback_data: createCallbackData({ action: 'back_to_menu' }) }]
    ]
  };

  await bot.sendMessage(chatId, menuText, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
};

// Mua gói VIP
export const buyVipPackage = async (bot, msg, user) => {
  try {
    // Kiểm tra user có tồn tại không
    if (!user) {
      return bot.sendMessage(msg.chat.id, 'Vui lòng /start để tạo tài khoản.');
    }

    // Kiểm tra đã có gói VIP active chưa
    const activePackage = await getActiveVipPackage(user.id);
    if (activePackage) {
      const remaining = activePackage.total_gmail - activePackage.used_gmail;
      const expiresAt = new Date(activePackage.expires_at);
      const daysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
      
      return bot.sendMessage(
        msg.chat.id,
        `❌ Bạn đã có gói VIP đang active!\n\n` +
        `📧 Đã dùng: ${activePackage.used_gmail}/${activePackage.total_gmail} Gmail\n` +
        `📊 Còn lại: ${remaining} Gmail\n` +
        `⏰ Hết hạn sau: ${daysLeft} ngày`,
        { parse_mode: 'Markdown' }
      );
    }

    // Kiểm tra số dư
    if (Number(user.balance) < VIP_PACKAGE_PRICE) {
      return bot.sendMessage(
        msg.chat.id,
        `Số dư không đủ. Cần ${formatCurrency(VIP_PACKAGE_PRICE)}, bạn có ${formatCurrency(user.balance)}.`
      );
    }

    // Tạo gói VIP
    const vipPackage = await createVipPackage({
      userId: user.id,
      totalGmail: VIP_PACKAGE_GMAIL_COUNT,
      expiresInDays: VIP_PACKAGE_DURATION_DAYS
    });

    // Trừ tiền
    await updateBalance(user.id, -VIP_PACKAGE_PRICE);
    
    // Thêm balance log
    await addBalanceLog({
      userId: user.id,
      amount: -VIP_PACKAGE_PRICE,
      reason: 'buy_vip_package',
      adminId: null
    });

    // Lấy lại user để có số dư chính xác
    const updatedUser = await getUserByTelegram(user.telegram_id);
    if (!updatedUser) {
      return bot.sendMessage(msg.chat.id, '❌ Lỗi: Không thể lấy thông tin user.');
    }
    const finalBalance = Number(updatedUser.balance);

    const expiresAt = new Date(vipPackage.expires_at);
    const message = `✅ **Mua gói VIP thành công!**\n\n` +
                   `💰 Đã thanh toán: ${formatCurrency(VIP_PACKAGE_PRICE)}\n` +
                   `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n` +
                   `📧 Gói VIP:\n` +
                   `• Số lượng: ${VIP_PACKAGE_GMAIL_COUNT} Gmail accounts\n` +
                   `• Hạn sử dụng: ${expiresAt.toLocaleDateString('vi-VN')}\n` +
                   `• Trạng thái: Active\n\n` +
                   `💡 Bây giờ bạn có thể mua Gmail mà không cần trả tiền (tối đa ${VIP_PACKAGE_GMAIL_COUNT} accounts).`;

    await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

  } catch (error) {
    await bot.sendMessage(msg.chat.id, `❌ Lỗi khi mua gói VIP: ${error.message}`);
  }
};

// Hiển thị lịch sử gói VIP
export const showVipHistory = async (bot, chatId, userId, page, pageSize) => {
  const { rows, total } = await getUserVipPackages(userId, (page - 1) * pageSize, pageSize);
  const hasPrev = page > 1;
  const hasNext = (page - 1) * pageSize + rows.length < total;

  if (!rows.length) {
    return bot.sendMessage(chatId, 'Chưa có gói VIP nào.');
  }

  const lines = rows.map((pkg) => {
    const purchasedAt = new Date(pkg.purchased_at);
    const expiresAt = new Date(pkg.expires_at);
    const statusEmoji = pkg.status === 'active' ? '✅' : pkg.status === 'expired' ? '⏰' : '✅';
    const statusText = pkg.status === 'active' ? 'Đang dùng' : pkg.status === 'expired' ? 'Hết hạn' : 'Đã dùng hết';
    return `${statusEmoji} #${pkg.id} | ${pkg.used_gmail}/${pkg.total_gmail} | ${statusText} | Hết hạn: ${expiresAt.toLocaleDateString('vi-VN')}`;
  });

  await bot.sendMessage(chatId, lines.join('\n'), {
    reply_markup: {
      inline_keyboard: [
        ...buildPaginationKeyboard({ action: 'vip_history', page }, page, hasPrev, hasNext),
        [{ text: '⬅️ Quay lại', callback_data: createCallbackData({ action: 'back_to_menu' }) }]
      ]
    }
  });
};

