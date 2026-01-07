import { getGiftcodeByCode, hasUserRedeemed, redeemGiftcode } from '../controllers/giftcodeController.js';
import { updateBalance } from '../controllers/userController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { formatCurrency } from '../../utils/index.js';
import { query } from '../database/index.js';

// User nhập giftcode
export const handleRedeemGiftcode = async (bot, msg, user, code) => {
  if (!code || code.trim().length === 0) {
    return bot.sendMessage(msg.chat.id, 'Vui lòng nhập mã giftcode.\n\nSử dụng: /giftcode <mã_code>\nVí dụ: /giftcode GIFT100');
  }

  const giftcodeStr = code.trim().toUpperCase();
  
  try {
    // Lấy giftcode
    const giftcode = await getGiftcodeByCode(giftcodeStr);
    if (!giftcode) {
      return bot.sendMessage(msg.chat.id, `❌ Giftcode "${giftcodeStr}" không tồn tại.`);
    }

    // Kiểm tra hết hạn
    if (giftcode.expires_at && new Date(giftcode.expires_at) < new Date()) {
      return bot.sendMessage(msg.chat.id, `❌ Giftcode "${giftcodeStr}" đã hết hạn.`);
    }

    // Kiểm tra đã dùng hết chưa
    if (giftcode.used_count >= giftcode.max_uses) {
      return bot.sendMessage(msg.chat.id, `❌ Giftcode "${giftcodeStr}" đã được sử dụng hết.`);
    }

    // Kiểm tra user đã sử dụng chưa (nếu max_uses = 1 thì chỉ cho dùng 1 lần)
    const hasRedeemed = await hasUserRedeemed(giftcode.id, user.id);
    if (hasRedeemed) {
      return bot.sendMessage(msg.chat.id, `❌ Bạn đã sử dụng giftcode "${giftcodeStr}" rồi.`);
    }

    // Redeem giftcode
    await redeemGiftcode(giftcode.id, user.id);

    // Cộng tiền cho user
    await updateBalance(user.id, giftcode.amount);
    
    // Thêm balance log
    await addBalanceLog({
      userId: user.id,
      amount: giftcode.amount,
      reason: `giftcode_redeem_${giftcodeStr}`,
      adminId: null
    });

    // Lấy lại user để có số dư chính xác
    const { getUserById } = await import('../controllers/userController.js');
    const updatedUser = await getUserById(user.id);
    const finalBalance = Number(updatedUser.balance);

    const message = `✅ **Nhập giftcode thành công!**\n\n` +
                   `🎁 Code: ${giftcodeStr}\n` +
                   `💰 Nhận được: ${formatCurrency(giftcode.amount)}\n` +
                   `💵 Số dư mới: ${formatCurrency(finalBalance)}`;
    
    await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('[REDEEM_GIFTCODE] Lỗi:', error);
    
    // Kiểm tra lỗi duplicate (user đã redeem)
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('unique_redemption')) {
      return bot.sendMessage(msg.chat.id, `❌ Bạn đã sử dụng giftcode "${giftcodeStr}" rồi.`);
    }
    
    await bot.sendMessage(msg.chat.id, `❌ Lỗi khi nhập giftcode: ${error.message}`);
  }
};

