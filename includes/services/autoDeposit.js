import axios from 'axios';
import { getUserById, updateBalance } from '../controllers/userController.js';
import {
  createDepositWithStatus,
  updateDepositStatus,
  findDepositByRef,
  findLatestPendingByUser
} from '../controllers/depositController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { getActivePromotion, calculatePromotedAmount } from '../controllers/depositPromotionController.js';
import { formatCurrency } from '../../utils/index.js';
import { getCache, setCache, delCache, getAllKeys } from '../../lib/cache/index.js';
import { deleteQrMessage } from '../handle/handleDeposit.js';

const processedKey = (ref) => `tx_${ref}`;
const qrKey = (telegramId) => `qr_${telegramId}`;
const contentKey = (token) => `content_${token}`;

// Helper: Check MBBank transaction
const checkMBTransaction = async (bot, config, cached, user, promotion) => {
  try {
    const { data } = await axios.get(config.MB_API_URL, { timeout: 15000 });
    const list = data?.transactionHistoryList || [];
    for (const tx of list) {
      const note = `${tx.description || ''} ${tx.addDescription || ''}`;
      const token = extractToken(note);
      if (!token) continue;

      if (token === cached.token) {
        const success = await processMBTransaction(bot, tx, cached, user, promotion);
        if (success) return true;
      }
    }
  } catch (err) {
    console.error('[CHECK_PAYMENT] MB Error:', err.message);
  }
  return false;
};

// Helper: Check Timo transaction
const checkTimoTransaction = async (bot, config, cached, user, promotion) => {
  try {
    const { data } = await axios.get(config.TIMO_API_URL, { timeout: 15000 });
    const items = data?.data?.data?.items || [];
    for (const item of items) {
      if (!item.item || !Array.isArray(item.item)) continue;
      const tx = item.item[0];
      if (!tx) continue;

      const note = tx.txnNarrative || tx.txnDesc || '';
      const token = extractToken(note);
      if (!token) continue;

      if (token === cached.token) {
        const success = await processTimoTransaction(bot, item, cached, user, promotion);
        if (success) return true;
      }
    }
  } catch (err) {
    console.error('[CHECK_PAYMENT] Timo Error:', err.message);
  }
  return false;
};

// Exported function for manual check
export const checkPaymentForUser = async (bot, userId, config) => {
  const qrCache = getCache(qrKey(userId));
  if (!qrCache) return { success: false, message: 'Không tìm thấy giao dịch chờ.' };

  const { token } = qrCache;
  const cached = getCache(contentKey(token));
  if (!cached) return { success: false, message: 'Giao dịch đã hết hạn hoặc không tồn tại.' };

  const user = await getUserById(cached.userId);
  if (!user) return { success: false, message: 'Lỗi thông tin user.' };

  const promotion = await getActivePromotion();

  // Ưu tiên check bank đã chọn, nếu không thì check cả 2 (hoặc check theo bank config)
  let success = false;

  // Check MB
  if (config.MB_API_URL && (!cached.bank || cached.bank === 'mbbank')) {
    success = await checkMBTransaction(bot, config, cached, user, promotion);
  }

  // Check Timo if not found in MB
  if (!success && config.TIMO_API_URL && (!cached.bank || cached.bank === 'timo')) {
    success = await checkTimoTransaction(bot, config, cached, user, promotion);
  }

  if (success) {
    return { success: true, message: 'Đã nhận được tiền! Cảm ơn bạn.' };
  } else {
    return { success: false, message: 'Chưa nhận được tiền. Vui lòng chờ thêm chút nhé!' };
  }
};


// Extract token from content like "ABCD1234" (4 chữ + 4 số)
const extractToken = (text) => {
  if (!text) return null;
  const match = text.toUpperCase().match(/([A-Z]{4}[0-9]{4})/);
  return match ? match[1] : null;
};

// Kiểm tra và xóa QR hết hạn
export const checkExpiredQrs = async (bot) => {
  try {
    const qrKeys = getAllKeys('qr_');
    for (const key of qrKeys) {
      const cache = getCache(key);
      if (cache && cache.expiresAt && cache.expiresAt < Date.now()) {
        // QR đã hết hạn, xóa message
        await deleteQrMessage(bot, cache);
        delCache(key);
        if (cache.token) delCache(contentKey(cache.token));
      }
    }
  } catch (err) {
    // Error handling without logging
  }
};

// Start QR expiration checker (runs independently)
export const startQrExpirationChecker = (bot) => {
  const checkInterval = 30 * 1000; // Check every 30 seconds
  setInterval(() => checkExpiredQrs(bot), checkInterval);
  checkExpiredQrs(bot); // Initial check
};

// Xử lý giao dịch từ MBBank
const processMBTransaction = async (bot, tx, cached, user, promotion) => {
  const credit = Number(tx.creditAmount || 0);
  if (!credit || credit <= 0) return false;

  const note = `${tx.description || ''} ${tx.addDescription || ''}`;
  const token = extractToken(note);
  if (!token) return false;

  const ref = tx.refNo || `${tx.accountNo}-${tx.transactionDate}-${credit}`;
  if (getCache(processedKey(ref))) return false;

  if (!cached) {
    setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);
    return false;
  }

  if (!user) {
    setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);
    return false;
  }

  const existingRef = await findDepositByRef(ref);
  if (existingRef && existingRef.status === 'approved') {
    setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);
    return false;
  }

  const originalAmount = Number(cached.amount || credit);
  const promotionResult = calculatePromotedAmount(originalAmount, promotion);

  if (cached.depositId) {
    await updateDepositStatus(cached.depositId, 'approved', ref);
  } else {
    await createDepositWithStatus(user.id, originalAmount, 'approved', ref);
  }

  await updateBalance(user.id, promotionResult.finalAmount);
  await addBalanceLog({
    userId: user.id,
    amount: promotionResult.finalAmount,
    reason: promotionResult.bonusAmount > 0 ? `auto_deposit+promo_${promotion.id}:${ref}` : `auto_deposit:${ref}`,
    adminId: null
  });

  // Lấy số dư mới sau khi cộng tiền
  const updatedUser = await getUserById(user.id);
  const finalBalance = Number(updatedUser.balance);

  // Thu hồi QR đang chờ
  const qrCache = getCache(qrKey(user.telegram_id));
  if (qrCache) {
    await deleteQrMessage(bot, qrCache);
    delCache(qrKey(user.telegram_id));
  }
  if (token) {
    const tokenCache = getCache(contentKey(token));
    if (tokenCache) {
      await deleteQrMessage(bot, tokenCache);
      delCache(contentKey(token));
    }
  }
  setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);

  // Kiểm tra và hoàn tất purchase nếu có
  try {
    const { completePurchaseAfterDeposit } = await import('../handle/handleBuy.js');
    const purchaseCompleted = await completePurchaseAfterDeposit(bot, user.id, user.telegram_id, user.telegram_id);

    if (purchaseCompleted) {
      // Purchase đã được hoàn tất, không cần gửi thông báo nạp tiền riêng
      return true;
    }
  } catch (err) {
    console.error('[AUTO_DEPOSIT] Lỗi khi hoàn tất purchase:', err);
  }

  try {
    let message = `✅ **Nạp tiền tự động thành công!**\n\n` +
      `💰 Số tiền gốc: ${formatCurrency(promotionResult.originalAmount)}`;
    if (promotionResult.bonusAmount > 0) {
      message += `\n🎁 **Khuyến mại: +${formatCurrency(promotionResult.bonusAmount)}** (${promotion.bonus_percentage}%)`;
    }
    message += `\n💵 **Số tiền được cộng: ${formatCurrency(promotionResult.finalAmount)}**` +
      `\n💳 **Số dư cuối: ${formatCurrency(finalBalance)}**` +
      `\n📝 Ref: ${ref}`;
    await bot.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
  } catch (err) {
    // Error handling without logging
  }
  return true;
};

// Xử lý giao dịch từ Timo
const processTimoTransaction = async (bot, item, cached, user, promotion) => {
  const tx = item.item?.[0];
  if (!tx || tx.txnType !== 'IncomingTransfer') return false;

  const credit = Number(tx.txnAmount || 0);
  if (!credit || credit <= 0) return false;

  const note = tx.txnNarrative || tx.txnDesc || '';
  const token = extractToken(note);
  if (!token) return false;

  const ref = tx.refNo || tx.bankXID || `${tx.transactionTime}-${credit}`;
  if (getCache(processedKey(ref))) return false;

  if (!cached) {
    setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);
    return false;
  }

  if (!user) {
    setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);
    return false;
  }

  const existingRef = await findDepositByRef(ref);
  if (existingRef && existingRef.status === 'approved') {
    setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);
    return false;
  }

  const originalAmount = Number(cached.amount || credit);
  const promotionResult = calculatePromotedAmount(originalAmount, promotion);

  if (cached.depositId) {
    await updateDepositStatus(cached.depositId, 'approved', ref);
  } else {
    await createDepositWithStatus(user.id, originalAmount, 'approved', ref);
  }

  await updateBalance(user.id, promotionResult.finalAmount);
  await addBalanceLog({
    userId: user.id,
    amount: promotionResult.finalAmount,
    reason: promotionResult.bonusAmount > 0 ? `auto_deposit+promo_${promotion.id}:${ref}` : `auto_deposit:${ref}`,
    adminId: null
  });

  // Lấy số dư mới sau khi cộng tiền
  const updatedUser = await getUserById(user.id);
  const finalBalance = Number(updatedUser.balance);

  // Thu hồi QR đang chờ
  const qrCache = getCache(qrKey(user.telegram_id));
  if (qrCache) {
    await deleteQrMessage(bot, qrCache);
    delCache(qrKey(user.telegram_id));
  }
  if (token) {
    const tokenCache = getCache(contentKey(token));
    if (tokenCache) {
      await deleteQrMessage(bot, tokenCache);
      delCache(contentKey(token));
    }
  }
  setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);

  // Kiểm tra và hoàn tất purchase nếu có
  try {
    const { completePurchaseAfterDeposit } = await import('../handle/handleBuy.js');
    const purchaseCompleted = await completePurchaseAfterDeposit(bot, user.id, user.telegram_id, user.telegram_id);

    if (purchaseCompleted) {
      // Purchase đã được hoàn tất, không cần gửi thông báo nạp tiền riêng
      return true;
    }
  } catch (err) {
    console.error('[AUTO_DEPOSIT] Lỗi khi hoàn tất purchase:', err);
  }

  try {
    let message = `✅ **Nạp tiền tự động thành công!**\n\n` +
      `💰 Số tiền gốc: ${formatCurrency(promotionResult.originalAmount)}`;
    if (promotionResult.bonusAmount > 0) {
      message += `\n🎁 **Khuyến mại: +${formatCurrency(promotionResult.bonusAmount)}** (${promotion.bonus_percentage}%)`;
    }
    message += `\n💵 **Số tiền được cộng: ${formatCurrency(promotionResult.finalAmount)}**` +
      `\n💳 **Số dư cuối: ${formatCurrency(finalBalance)}**` +
      `\n📝 Ref: ${ref}`;
    await bot.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
  } catch (err) {
    // Error handling without logging
  }
  return true;
};

export const startAutoDepositWatcher = (bot, config) => {
  const intervalMs = Number(config.MB_CHECK_INTERVAL || 20000);
  const hasMB = !!config.MB_API_URL;
  const hasTimo = !!config.TIMO_API_URL;

  if (!hasMB && !hasTimo) {
    return;
  }

  const tick = async () => {
    try {
      const promotion = await getActivePromotion();

      // Kiểm tra MBBank
      if (hasMB) {
        try {
          const { data } = await axios.get(config.MB_API_URL, { timeout: 15000 });
          const list = data?.transactionHistoryList || [];
          for (const tx of list) {
            const note = `${tx.description || ''} ${tx.addDescription || ''}`;
            const token = extractToken(note);
            if (!token) continue;

            const cached = getCache(contentKey(token));
            if (!cached) continue;

            const user = await getUserById(cached.userId);
            if (!user) continue;

            await processMBTransaction(bot, tx, cached, user, promotion);
          }
        } catch (err) {
          // Error handling without logging
        }
      }

      // Kiểm tra Timo
      if (hasTimo) {
        try {
          const { data } = await axios.get(config.TIMO_API_URL, { timeout: 15000 });
          // Parse Timo response structure
          const items = data?.data?.data?.items || [];
          for (const item of items) {
            if (!item.item || !Array.isArray(item.item)) continue;

            const tx = item.item[0];
            if (!tx) continue;

            const note = tx.txnNarrative || tx.txnDesc || '';
            const token = extractToken(note);
            if (!token) continue;

            const cached = getCache(contentKey(token));
            if (!cached) continue;

            const user = await getUserById(cached.userId);
            if (!user) continue;

            await processTimoTransaction(bot, item, cached, user, promotion);
          }
        } catch (err) {
          // Error handling without logging
        }
      }
    } catch (err) {
      // Error handling without logging
    }
  };

  tick(); // initial
  setInterval(tick, intervalMs);
};


