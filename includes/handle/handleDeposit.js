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
import { getCache, setCache, delCache } from '../../lib/cache/index.js';
import { globalConfig } from '../listen.js';
import { query } from '../database/index.js';

const qrKey = (telegramId) => `qr_${telegramId}`;
const qrCancelKey = (telegramId) => `qr_cancel_${telegramId}`;
const contentKey = (token) => `content_${token}`;

const buildQrUrl = (bankCode, accountNo, amount, content, accountName = null) => {
  let url = `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(content)}`;
  if (accountName) {
    url += `&accountName=${encodeURIComponent(accountName)}`;
  }
  return url;
};

// Helper to get Bank Settings for QR
const getBankConfig = async (defaultConfig) => {
  try {
    const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('vietqr_bank_code', 'vietqr_account_no', 'vietqr_account_name')");
    const dbConfig = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        if (r.key === 'vietqr_bank_code') dbConfig.bankCode = r.value;
        if (r.key === 'vietqr_account_no') dbConfig.accountNo = r.value;
        if (r.key === 'vietqr_account_name') dbConfig.accountName = r.value;
      });
    }
    return {
      bankCode: dbConfig.bankCode || defaultConfig.VIETQR_BANK_CODE || 'MB',
      accountNo: dbConfig.accountNo || defaultConfig.VIETQR_ACCOUNT_NO,
      accountName: dbConfig.accountName || defaultConfig.VIETQR_ACCOUNT_NAME
    };
  } catch (e) {
    return {
      bankCode: defaultConfig.VIETQR_BANK_CODE || 'MB',
      accountNo: defaultConfig.VIETQR_ACCOUNT_NO,
      accountName: defaultConfig.VIETQR_ACCOUNT_NAME
    };
  }
}

export const startDepositFlow = async (bot, msg, user, config) => {
  // Check existing QR
  const existing = getCache(qrKey(msg.from.id));
  if (existing) {
    if (existing.expiresAt && existing.expiresAt < Date.now()) {
      await deleteQrMessage(bot, existing);
      delCache(qrKey(msg.from.id));
      if (existing.token) delCache(contentKey(existing.token));
      await bot.sendMessage(msg.chat.id, 'QR cũ đã hết hạn. Bạn có thể tạo nạp mới.');
    } else {
      const ttlSec = Math.ceil((existing.expiresAt - Date.now()) / 1000);
      return bot.sendMessage(
        msg.chat.id,
        `Bạn đã có QR đang chờ (còn ${ttlSec}s). Số tiền: ${formatCurrency(existing.amount)}`
      );
    }
  }

  // Ask for amount directly
  await bot.sendMessage(msg.chat.id, 'Nhập số tiền cần nạp (VNĐ).');
};

// No longer needs handleBankSelection as we skip it

// Helper to get Min Deposit
const getMinDepositAmount = async () => {
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'min_deposit'");
    return rows?.[0]?.value ? Number(rows[0].value) : 50000;
  } catch (e) {
    return 50000;
  }
};

export const handleDepositAmount = async (bot, msg, user, config) => {
  const existing = getCache(qrKey(msg.from.id));
  if (existing) return bot.sendMessage(msg.chat.id, 'QR cũ chưa hết hạn, vui lòng chờ.');

  // Get selected bank
  let selectedBank = getCache(`bank_selection_${msg.from.id}`);
  if (!selectedBank) {
    // If not selected, try to auto-select if only one is enabled, or default to sepay
    selectedBank = 'sepay';
  }

  const amount = Number(msg.text.replace(/\D/g, ''));
  if (!amount || amount <= 0) return bot.sendMessage(msg.chat.id, 'Số tiền không hợp lệ.');

  const purchaseKey = `purchase_${msg.from.id}`;
  const pendingPurchase = getCache(purchaseKey);

  const MIN_DEPOSIT_AMOUNT = await getMinDepositAmount();
  if (!pendingPurchase && amount < MIN_DEPOSIT_AMOUNT) {
    return bot.sendMessage(
      msg.chat.id,
      `❌ Số tiền nạp tối thiểu là ${formatCurrency(MIN_DEPOSIT_AMOUNT)}.\n\n` +
      `💰 Bạn đã nhập: ${formatCurrency(amount)}\n` +
      `💡 Vui lòng nhập số tiền từ ${formatCurrency(MIN_DEPOSIT_AMOUNT)} trở lên.`
    );
  }

  if (pendingPurchase) {
    const missingAmount = pendingPurchase.totalPrice - (Number(user.balance) || 0);
    if (amount < missingAmount) {
      return bot.sendMessage(
        msg.chat.id,
        `❌ Số tiền nạp không đủ để mua sản phẩm.\n\n` +
        `💰 Cần nạp: ${formatCurrency(missingAmount)}\n` +
        `💰 Bạn đã nhập: ${formatCurrency(amount)}\n` +
        `💡 Vui lòng nạp ít nhất ${formatCurrency(missingAmount)} để hoàn tất mua hàng.`
      );
    }
  }

  const promotion = await getActivePromotion();
  const promotionResult = calculatePromotedAmount(amount, promotion);

  const randomLetters = Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  const randomDigits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');
  const token = `${randomLetters}${randomDigits}`;
  const content = token;

  // Create VietQR
  const bankConfig = await getBankConfig(config);
  const bankCode = bankConfig.bankCode;
  const accountNo = bankConfig.accountNo;
  const accountName = bankConfig.accountName;

  const qrUrl = buildQrUrl(bankCode, accountNo, amount, content, accountName);
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const depositId = await createDeposit(user.id, amount, content);

  // Use Sepay bank code as display name
  // Use bank code as display name
  const bankDisplayName = bankCode;

  let caption = `Đã tạo yêu cầu nạp ${formatCurrency(amount)}.\n\n` +
    `🏦 Ngân hàng: **${bankDisplayName}**\n` +
    `💳 Số TK: \`${accountNo}\` (Click để copy)\n` +
    `📝 Nội dung: \`${content}\` (Click để copy)\n\n` +
    `⚠️ **LƯU Ý:** Vui lòng nhập đúng nội dung chuyển khoản để được cộng tiền tự động. QR hết hạn sau 5 phút.`;

  if (promotionResult.bonusAmount > 0) {
    caption += `\n\n🎁 **KHUYẾN MẠI:** Nạp ${formatCurrency(amount)} nhận thêm ${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)`;
    caption += `\n💵 **Tổng thực nhận: ${formatCurrency(promotionResult.finalAmount)}**`;
  }

  const qrMessage = await bot.sendPhoto(msg.chat.id, qrUrl, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Tôi đã chuyển khoản', callback_data: createCallbackData({ action: 'check_payment' }) }],
        [{ text: '❌ Huỷ QR', callback_data: createCallbackData({ action: 'cancel_qr' }) }]
      ]
    }
  });

  setCache(qrKey(msg.from.id), { depositId, amount, qrUrl, expiresAt, content, token, bank: selectedBank, messageId: qrMessage.message_id, chatId: msg.chat.id }, 5 * 60 * 1000);
  setCache(contentKey(token), { userId: user.id, depositId, amount, expiresAt, bank: selectedBank, messageId: qrMessage.message_id, chatId: msg.chat.id }, 5 * 60 * 1000);
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
          { text: `🔄 Check`, callback_data: createCallbackData({ action: 'check_deposit', id: d.id }) },
          { text: `✅ ${d.id}`, callback_data: createCallbackData({ action: 'approve_deposit', id: d.id }) },
          { text: `❌ ${d.id}`, callback_data: createCallbackData({ action: 'reject_deposit', id: d.id }) }
        ]),
        [{ text: '📜 Lịch sử', callback_data: createCallbackData({ action: 'admin_deposit_history', page: 1 }) }]
      ]
    }
  });
};

export const checkDepositStatus = async (bot, chatId, depositId, adminId) => {
  const deposit = await getDeposit(depositId);
  if (!deposit) return bot.sendMessage(chatId, 'Không tìm thấy yêu cầu nạp.');
  if (deposit.status !== 'pending') return bot.sendMessage(chatId, `Yêu cầu này đang ở trạng thái: ${deposit.status}`);

  const { checkPaymentForUser } = await import('../services/autoDeposit.js');
  const user = await getUserById(deposit.user_id);
  if (!user) return bot.sendMessage(chatId, 'User không tồn tại.');

  const result = await checkPaymentForUser(bot, user.id, globalConfig);

  if (result.success) {
    await bot.sendMessage(chatId, `✅ Đã check thành công: ${result.message}`);
  } else {
    await bot.sendMessage(chatId, `⚠️ Check thất bại: ${result.message}\n(Có thể QR đã hết hạn cache hoặc chưa có giao dịch khớp)`);
  }
};

export const listDepositHistory = async (bot, chatId, page, pageSize) => {
  const offset = (page - 1) * pageSize;
  const { query } = await import('../database/index.js');
  const [rows] = await query(
    'SELECT d.*, u.telegram_id FROM deposits d JOIN users u ON u.id = d.user_id WHERE d.status != "pending" ORDER BY d.id DESC LIMIT ? OFFSET ?',
    [pageSize, offset]
  );
  const [{ total }] = await query('SELECT COUNT(*) as total FROM deposits WHERE status != "pending"');

  if (!rows.length) return bot.sendMessage(chatId, 'Không có lịch sử nạp tiền.');
  const lines = rows.map((d) => {
    const statusEmoji = d.status === 'approved' ? '✅' : '❌';
    return `${statusEmoji} #${d.id} | ${d.telegram_id} | ${formatCurrency(d.amount)} | ${d.tx_ref || 'N/A'} | ${d.created_at}`;
  });

  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;

  await bot.sendMessage(chatId, lines.join('\n'), {
    reply_markup: {
      inline_keyboard: [
        ...buildPaginationKeyboard({ action: 'admin_deposit_history', page }, page, hasPrev, hasNext),
        [{ text: '⬅️ Quay lại DS chờ', callback_data: createCallbackData({ action: 'admin_deposits' }) }]
      ]
    }
  });
};

export const approveDeposit = async (bot, chatId, depositId, admin) => {
  const deposit = await getDeposit(depositId);
  if (!deposit || deposit.status !== 'pending') return bot.sendMessage(chatId, 'Không hợp lệ.');

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

  const user = await getUserById(deposit.user_id);
  const finalBalance = Number(user.balance);

  let adminMessage = `✅ Đã duyệt nạp #${depositId}.\n💰 Số tiền gốc: ${formatCurrency(promotionResult.originalAmount)}`;
  if (promotionResult.bonusAmount > 0) {
    adminMessage += `\n🎁 Khuyến mại: +${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)`;
  }
  adminMessage += `\n💵 Tổng nhận: ${formatCurrency(promotionResult.finalAmount)}\n💵 Số dư mới của user: ${formatCurrency(finalBalance)}`;
  await bot.sendMessage(chatId, adminMessage);

  const { notifyAdminAboutDeposit } = await import('./handleNotify.js');
  const adminIds = globalConfig?.ADMIN_IDS || [];
  if (adminIds.length > 0) {
    await notifyAdminAboutDeposit(bot, adminIds, {
      depositId: depositId,
      username: user.username,
      telegramId: user.telegram_id,
      originalAmount: promotionResult.originalAmount,
      bonusAmount: promotionResult.bonusAmount,
      bonusPercentage: promotion?.bonus_percentage || 0,
      finalAmount: promotionResult.finalAmount,
      finalBalance: finalBalance
    });
  }

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
  await bot.sendMessage(chatId, `Đã từ chối nạp #${depositId}.`);
};

export const cancelQr = async (bot, chatId, from) => {
  const cancelCount = getCache(qrCancelKey(from.id)) || 0;
  if (cancelCount >= 3) return bot.sendMessage(chatId, 'Bạn huỷ quá nhiều, chờ 1 phút rồi thử lại.');

  const cache = getCache(qrKey(from.id));
  if (!cache) return bot.sendMessage(chatId, 'Không có QR đang chờ.');

  await deleteQrMessage(bot, cache);

  setCache(qrCancelKey(from.id), cancelCount + 1, 60 * 1000);
  delCache(qrKey(from.id));
  if (cache.token) delCache(contentKey(cache.token));
  // delCache(bankKey(from.id)); // No longer used
  if (cache.depositId) await updateDepositStatus(cache.depositId, 'rejected');
  await bot.sendMessage(chatId, 'Đã huỷ QR. Bạn có thể tạo lại sau ít phút.');
};

export const deleteQrMessage = async (bot, cache) => {
  if (cache && cache.messageId && cache.chatId) {
    try {
      await bot.deleteMessage(cache.chatId, cache.messageId);
    } catch (err) {
    }
  }
};
