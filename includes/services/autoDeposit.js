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
import { logEvent, logError } from '../../utils/log.js';
import { deleteQrMessage } from '../handle/handleDeposit.js';

const processedKey = (ref) => `tx_${ref}`;
const qrKey = (telegramId) => `qr_${telegramId}`;
const contentKey = (token) => `content_${token}`;

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
        logEvent('qr_expired_cleaned', { key });
      }
    }
  } catch (err) {
    logError({ context: 'check_expired_qrs', message: err.message });
  }
};

// Start QR expiration checker (runs independently)
export const startQrExpirationChecker = (bot) => {
  const checkInterval = 30 * 1000; // Check every 30 seconds
  setInterval(() => checkExpiredQrs(bot), checkInterval);
  checkExpiredQrs(bot); // Initial check
  logEvent('qr_expiration_checker_started');
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
    logEvent('auto_deposit_token_not_found', { ref, token, bank: 'mbbank' });
    return false;
  }

  if (!user) {
    setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);
    logEvent('auto_deposit_user_not_found', { ref, token, bank: 'mbbank' });
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
    logError(err);
  }
  logEvent('auto_deposit_approved', { 
    ref, 
    token, 
    bank: 'mbbank',
    originalAmount: promotionResult.originalAmount,
    bonusAmount: promotionResult.bonusAmount,
    finalAmount: promotionResult.finalAmount,
    promotionId: promotion?.id || null
  });
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
    logEvent('auto_deposit_token_not_found', { ref, token, bank: 'timo' });
    return false;
  }

  if (!user) {
    setCache(processedKey(ref), true, 24 * 60 * 60 * 1000);
    logEvent('auto_deposit_user_not_found', { ref, token, bank: 'timo' });
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
    logError(err);
  }
  logEvent('auto_deposit_approved', { 
    ref, 
    token, 
    bank: 'timo',
    originalAmount: promotionResult.originalAmount,
    bonusAmount: promotionResult.bonusAmount,
    finalAmount: promotionResult.finalAmount,
    promotionId: promotion?.id || null
  });
  return true;
};

export const startAutoDepositWatcher = (bot, config) => {
  const intervalMs = Number(config.MB_CHECK_INTERVAL || 20000);
  const hasMB = !!config.MB_API_URL;
  const hasTimo = !!config.TIMO_API_URL;

  if (!hasMB && !hasTimo) {
    logEvent('auto_deposit_disabled');
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
          logError({
            context: 'auto_deposit_mb_tick',
            message: err.message,
            stack: err.stack,
            responseStatus: err.response?.status,
            responseData: err.response?.data
          });
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
          logError({
            context: 'auto_deposit_timo_tick',
            message: err.message,
            stack: err.stack,
            responseStatus: err.response?.status,
            responseData: err.response?.data
          });
        }
      }
    } catch (err) {
      logError({
        context: 'auto_deposit_tick',
        message: err.message,
        stack: err.stack
      });
    }
  };

  tick(); // initial
  setInterval(tick, intervalMs);
  logEvent('auto_deposit_started', { intervalMs, hasMB, hasTimo });
};


