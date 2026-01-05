import {
  createDeposit,
  listDeposits,
  updateDepositStatus,
  getDeposit
} from '../controllers/depositController.js';
import { updateBalance, getUserById } from '../controllers/userController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { getActivePromotion, calculatePromotedAmount } from '../controllers/depositPromotionController.js';
import { formatCurrency, buildPaginationKeyboard, createCallbackData } from '../../utils/index.js';
import { logEvent } from '../../utils/log.js';
import { getCache, setCache, delCache } from '../../lib/cache/index.js';

const qrKey = (telegramId) => `qr_${telegramId}`;
const qrCancelKey = (telegramId) => `qr_cancel_${telegramId}`;
const contentKey = (token) => `content_${token}`;
const bankKey = (telegramId) => `bank_${telegramId}`;

const buildQrUrl = (bankCode, accountNo, amount, content, accountName = null) => {
  let url = `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(content)}`;
  if (accountName) {
    url += `&accountName=${encodeURIComponent(accountName)}`;
  }
  return url;
};

export const startDepositFlow = async (bot, msg, user, config) => {
  const existing = getCache(qrKey(msg.from.id));
  if (existing) {
    // Kiểm tra nếu QR đã hết hạn (dựa trên expiresAt)
    if (existing.expiresAt && existing.expiresAt < Date.now()) {
      await deleteQrMessage(bot, existing);
      delCache(qrKey(msg.from.id));
      if (existing.token) delCache(contentKey(existing.token));
      await bot.sendMessage(msg.chat.id, 'QR cũ đã hết hạn. Bạn có thể tạo QR mới.');
    } else {
    const ttlSec = Math.ceil((existing.expiresAt - Date.now()) / 1000);
    return bot.sendMessage(
      msg.chat.id,
      `Bạn đã có QR đang chờ (còn ${ttlSec}s). Số tiền: ${formatCurrency(existing.amount)}`
    );
    }
  }
  
  // Hiển thị menu chọn ngân hàng
  await bot.sendMessage(msg.chat.id, 'Chọn ngân hàng để nạp tiền:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏦 MBBank', callback_data: createCallbackData({ action: 'select_bank', bank: 'mbbank' }) }],
        [{ text: '🏦 Timo Bank', callback_data: createCallbackData({ action: 'select_bank', bank: 'timo' }) }]
      ]
    }
  });
};

export const handleBankSelection = async (bot, chatId, userId, bank) => {
  // Lưu lựa chọn ngân hàng vào cache
  setCache(bankKey(userId), bank, 10 * 60 * 1000); // 10 phút
  
  const bankName = bank === 'mbbank' ? 'MBBank' : 'Timo Bank';
  await bot.sendMessage(chatId, `Đã chọn ${bankName}. Nhập số tiền cần nạp (VNĐ).`);
};

export const handleDepositAmount = async (bot, msg, user, config) => {
  const existing = getCache(qrKey(msg.from.id));
  if (existing) return bot.sendMessage(msg.chat.id, 'QR cũ chưa hết hạn, vui lòng chờ.');

  // Kiểm tra xem đã chọn ngân hàng chưa
  const selectedBank = getCache(bankKey(msg.from.id));
  if (!selectedBank) {
    return bot.sendMessage(msg.chat.id, 'Vui lòng chọn ngân hàng trước. Nhấn /nap để chọn lại.');
  }

  const amount = Number(msg.text.replace(/\D/g, ''));
  if (!amount || amount <= 0) return bot.sendMessage(msg.chat.id, 'Số tiền không hợp lệ.');
  
  // Kiểm tra khuyến mại đang active
  const promotion = await getActivePromotion();
  const promotionResult = calculatePromotedAmount(amount, promotion);
  
  const randomLetters = Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  const randomDigits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');
  const token = `${randomLetters}${randomDigits}`;
  const content = token;
  
  // Sử dụng thông tin ngân hàng đã chọn
  let bankCode, accountNo, accountName;
  if (selectedBank === 'timo') {
    bankCode = config.TIMO_BANK_CODE || 'TIMO';
    accountNo = config.TIMO_ACCOUNT_NO || config.VIETQR_ACCOUNT_NO;
    accountName = config.TIMO_ACCOUNT_NAME || null;
  } else {
    bankCode = config.VIETQR_BANK_CODE;
    accountNo = config.VIETQR_ACCOUNT_NO;
    accountName = null;
  }
  
  const qrUrl = buildQrUrl(bankCode, accountNo, amount, content, accountName);
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const depositId = await createDeposit(user.id, amount);
  logEvent('deposit_created', { userId: user.id, amount, bank: selectedBank, promotionId: promotion?.id || null });

  const bankName = selectedBank === 'mbbank' ? 'MBBank' : 'Timo Bank';
  let caption = `Đã tạo yêu cầu nạp ${formatCurrency(amount)}.\n🏦 Ngân hàng: ${bankName}\nNội dung: ${content}\nQR hết hạn sau 5 phút.`;
  if (promotionResult.bonusAmount > 0) {
    caption += `\n\n🎁 **KHUYẾN MẠI:** Nạp ${formatCurrency(amount)} sẽ nhận thêm ${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)`;
    caption += `\n💵 **Tổng nhận: ${formatCurrency(promotionResult.finalAmount)}**`;
  }

  const qrMessage = await bot.sendPhoto(msg.chat.id, qrUrl, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '❌ Huỷ QR', callback_data: createCallbackData({ action: 'cancel_qr' }) }]]
    }
  });

  setCache(qrKey(msg.from.id), { depositId, amount, qrUrl, expiresAt, content, token, bank: selectedBank, messageId: qrMessage.message_id, chatId: msg.chat.id }, 5 * 60 * 1000);
  setCache(contentKey(token), { userId: user.id, depositId, amount, expiresAt, bank: selectedBank, messageId: qrMessage.message_id, chatId: msg.chat.id }, 5 * 60 * 1000);
  
  // Xóa cache bank selection sau khi đã tạo QR
  delCache(bankKey(msg.from.id));
};

export const listPendingDeposits = async (bot, chatId, page, pageSize) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listDeposits('pending', offset, pageSize);
  if (!rows.length) return bot.sendMessage(chatId, 'Không có yêu cầu chờ duyệt.');
  const lines = rows.map((d) => `#${d.id} | ${d.telegram_id} | ${formatCurrency(d.amount)} | ${d.created_at}`);
  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  await bot.sendMessage(chatId, lines.join('\n'), {
    reply_markup: {
      inline_keyboard: [
        ...buildPaginationKeyboard({ action: 'admin_deposits', page }, page, hasPrev, hasNext),
        ...rows.map((d) => [
          { text: `✅ ${d.id}`, callback_data: createCallbackData({ action: 'approve_deposit', id: d.id }) },
          { text: `❌ ${d.id}`, callback_data: createCallbackData({ action: 'reject_deposit', id: d.id }) }
        ])
      ]
    }
  });
};

export const approveDeposit = async (bot, chatId, depositId, admin) => {
  const deposit = await getDeposit(depositId);
  if (!deposit || deposit.status !== 'pending') return bot.sendMessage(chatId, 'Không hợp lệ.');
  
  // Kiểm tra khuyến mại đang active
  const promotion = await getActivePromotion();
  const promotionResult = calculatePromotedAmount(Number(deposit.amount), promotion);
  
  await updateDepositStatus(depositId, 'approved');
  await updateBalance(deposit.user_id, promotionResult.finalAmount);
  await addBalanceLog({ 
    userId: deposit.user_id, 
    amount: promotionResult.finalAmount, 
    reason: promotionResult.bonusAmount > 0 ? `deposit+promo_${promotion.id}` : 'deposit', 
    adminId: admin.id 
  });
  logEvent('deposit_approved', { 
    depositId, 
    admin: admin.id, 
    originalAmount: promotionResult.originalAmount,
    bonusAmount: promotionResult.bonusAmount,
    finalAmount: promotionResult.finalAmount,
    promotionId: promotion?.id || null
  });
  
  // Lấy thông tin user để có số dư mới và telegram_id
  const user = await getUserById(deposit.user_id);
  const finalBalance = Number(user.balance);
  
  // Thông báo cho admin
  let adminMessage = `✅ Đã duyệt nạp #${depositId}.\n💰 Số tiền gốc: ${formatCurrency(promotionResult.originalAmount)}`;
  if (promotionResult.bonusAmount > 0) {
    adminMessage += `\n🎁 Khuyến mại: +${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)`;
  }
  adminMessage += `\n💵 Tổng nhận: ${formatCurrency(promotionResult.finalAmount)}\n💵 Số dư mới của user: ${formatCurrency(finalBalance)}`;
  await bot.sendMessage(chatId, adminMessage);
  
  // Thông báo cho user
  try {
    let userMessage = `✅ **Nạp tiền thành công!**\n\n` +
                     `💰 Số tiền gốc: ${formatCurrency(promotionResult.originalAmount)}`;
    if (promotionResult.bonusAmount > 0) {
      userMessage += `\n🎁 **Khuyến mại: +${formatCurrency(promotionResult.bonusAmount)}** (${promotion.bonus_percentage}%)`;
    }
    userMessage += `\n💵 **Tổng nhận: ${formatCurrency(promotionResult.finalAmount)}**\n` +
                   `💵 Số dư mới: ${formatCurrency(finalBalance)}\n` +
                   `📝 Mã giao dịch: #${depositId}`;
    await bot.sendMessage(Number(user.telegram_id), userMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(`[APPROVE_DEPOSIT] Không thể gửi thông báo cho user ${user.telegram_id}:`, error.message);
  }
};

export const rejectDeposit = async (bot, chatId, depositId, admin) => {
  const deposit = await getDeposit(depositId);
  if (!deposit || deposit.status !== 'pending') return bot.sendMessage(chatId, 'Không hợp lệ.');
  await updateDepositStatus(depositId, 'rejected');
  logEvent('deposit_rejected', { depositId, admin: admin.id });
  await bot.sendMessage(chatId, `Đã từ chối nạp #${depositId}.`);
};

export const cancelQr = async (bot, chatId, from) => {
  const cancelCount = getCache(qrCancelKey(from.id)) || 0;
  if (cancelCount >= 3) return bot.sendMessage(chatId, 'Bạn huỷ quá nhiều, chờ 1 phút rồi thử lại.');

  const cache = getCache(qrKey(from.id));
  if (!cache) return bot.sendMessage(chatId, 'Không có QR đang chờ.');

  // Xóa ảnh QR
  await deleteQrMessage(bot, cache);

  setCache(qrCancelKey(from.id), cancelCount + 1, 60 * 1000);
  delCache(qrKey(from.id));
  if (cache.token) delCache(contentKey(cache.token));
  delCache(bankKey(from.id)); // Xóa cache bank selection
  if (cache.depositId) await updateDepositStatus(cache.depositId, 'rejected');
  await bot.sendMessage(chatId, 'Đã huỷ QR. Bạn có thể tạo lại sau ít phút.');
};

// Helper function để xóa QR message
export const deleteQrMessage = async (bot, cache) => {
  if (cache && cache.messageId && cache.chatId) {
    try {
      await bot.deleteMessage(cache.chatId, cache.messageId);
    } catch (err) {
      // Ignore error if message already deleted
    }
  }
};

