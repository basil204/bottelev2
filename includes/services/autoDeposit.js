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
import { notifyAdminAboutDeposit } from '../handle/handleNotify.js';


import { query } from '../database/index.js';

const processedKey = (ref) => `tx_${ref}`;
const qrKey = (telegramId) => `qr_${telegramId}`;
const contentKey = (token) => `content_${token}`;

// Check Viettel Transaction
const checkViettelTransaction = async (bot, token, cached, user, promotion) => {
  try {
    if (!token) return false;

    // Call Viettel API
    const response = await axios.get(`https://api.sieuthicode.net/historyapiviettel/${token}`);
    const data = response.data;

    if (!data || data.status.code !== '00' || !data.data || !data.data.content) return false;

    const transactions = data.data.content;

    for (const tx of transactions) {
      // Check for CREDIT (income) transactions
      if (tx.paymentType !== 'CREDIT') continue;

      const note = tx.msgContent || tx.description || '';
      const amount = Number(tx.amount) || 0;
      const txToken = extractToken(note);

      if (!txToken) continue;

      if (txToken === cached.token) {
        // Verify Amount
        const requestedAmount = Number(cached.amount);
        if (amount < requestedAmount) {
          console.log(`[VIETTEL] Underpayment ${tx.bankTransId}: ${amount} < ${requestedAmount}`);
          return false;
        }

        await processDepositTransaction(bot, {
          amount_in: amount,
          id: tx.bankTransId, // Unique ID
          transaction_content: note,
          ref_prefix: 'VIETTEL'
        }, cached, user, promotion);

        return true;
      }
    }
  } catch (err) {
    console.error('[CHECK_PAYMENT] Viettel Error:', err.message);
  }
  return false;
};

// Unified processor
const processDepositTransaction = async (bot, txRaw, cached, user, promotion) => {
  const credit = Number(txRaw.amount_in || 0);
  const ref = `${txRaw.ref_prefix}-${txRaw.id}`;

  if (getCache(processedKey(ref))) return false;

  if (!cached || !user) {
    setCache(processedKey(ref), true, 86400000);
    return false;
  }

  const existingRef = await findDepositByRef(ref);
  if (existingRef && existingRef.status === 'approved') {
    setCache(processedKey(ref), true, 86400000);
    return false;
  }

  const originalAmount = typeof cached.amount !== 'undefined' ? Number(cached.amount) : credit;
  const promotionResult = calculatePromotedAmount(originalAmount, promotion);

  // Log promotion application
  if (promotion) {
    console.log(`[DEPOSIT] Promotion applied: ${promotion.bonus_percentage}% bonus on ${originalAmount} => +${promotionResult.bonusAmount} => Final: ${promotionResult.finalAmount}`);
  } else {
    console.log(`[DEPOSIT] No active promotion. Amount: ${originalAmount}`);
  }

  if (cached.depositId) {
    await updateDepositStatus(cached.depositId, 'approved', ref);
  } else {
    await createDepositWithStatus(user.id, originalAmount, 'approved', ref);
  }

  await updateBalance(user.id, promotionResult.finalAmount);
  await addBalanceLog({
    userId: user.id,
    amount: promotionResult.finalAmount,
    reason: promotionResult.bonusAmount > 0 ? `deposit+promo_${promotion.id}:${ref}` : `deposit:${ref}`,
    adminId: null
  });

  const updatedUser = await getUserById(user.id);
  const finalBalance = Number(updatedUser.balance);

  const qrCache = getCache(qrKey(user.telegram_id));
  const token = cached.token;

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
  setCache(processedKey(ref), true, 86400000);

  try {
    const { completePurchaseAfterDeposit } = await import('../handle/handleBuy.js');
    await completePurchaseAfterDeposit(bot, user.id, user.telegram_id, user.telegram_id);
  } catch (e) { }

  // Hoàn tất mua Gmail EDU nếu có pending purchase
  try {
    const { completeGmailEduPurchaseAfterDeposit } = await import('../handle/handleGmailEdu.js');
    await completeGmailEduPurchaseAfterDeposit(bot, user.telegram_id);
  } catch (e) { }

  try {
    let message = `✅ **Nạp tiền thành công!**\n\n` +
      `💰 Số tiền gốc: ${formatCurrency(promotionResult.originalAmount)}`;
    if (promotionResult.bonusAmount > 0) {
      message += `\n🎁 **Khuyến mại: +${formatCurrency(promotionResult.bonusAmount)}** (${promotion.bonus_percentage}%)`;
    }
    message += `\n💵 **Số tiền được cộng: ${formatCurrency(promotionResult.finalAmount)}**` +
      `\n💳 **Số dư cuối: ${formatCurrency(finalBalance)}**` +
      `\n📝 Ref: ${ref}`;
    await bot.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });

    // Notify admins - fetch from database
    const { getAdminIds } = await import('../handle/handleNotify.js');
    const adminIds = await getAdminIds(globalConfig?.ADMIN_IDS || []);
    if (adminIds.length > 0) {
      notifyAdminAboutDeposit(bot, adminIds, {
        depositId: cached.depositId || ref,
        username: user.username,
        telegramId: user.telegram_id,
        originalAmount: promotionResult.originalAmount,
        bonusAmount: promotionResult.bonusAmount,
        bonusPercentage: promotion?.bonus_percentage || 0,
        finalAmount: promotionResult.finalAmount,
        finalBalance: finalBalance,
        transactionRef: ref
      });
    }
  } catch (err) { }
  return true;
};

// Get Viettel settings from DB
const getViettelSettings = async () => {
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'viettel_token'");
    return { token: rows?.[0]?.value || '' };
  } catch (error) {
    console.error('Error fetching Viettel settings:', error);
    return { token: '' };
  }
};

const getAdminSettings = async () => {
  try {
    const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('admin_username', 'admin_password')");
    let username = '';
    let password = '';
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        if (r.key === 'admin_username') username = r.value;
        if (r.key === 'admin_password') password = r.value;
      });
    }
    return { username, password };
  } catch (e) { return { username: '', password: '' }; }
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

  // Check Viettel
  let success = false;
  const viettelConfig = await getViettelSettings();
  if (viettelConfig.token) {
    success = await checkViettelTransaction(bot, viettelConfig.token, cached, user, promotion);
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
  // Clean text: remove " mb" suffix commonly found in VTLMONEY transactions
  const cleanText = text.replace(/\s+mb$/i, '').trim();
  const match = cleanText.toUpperCase().match(/([A-Z]{4}[0-9]{4})/);
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

export const startAutoDepositWatcher = (bot, config) => {
  const CHECK_INTERVAL = 5000; // Check every 5 seconds

  const tick = async () => {
    try {
      // Only check if there are pending QRs waiting for payment
      const pendingKeys = getAllKeys('qr_');
      if (!pendingKeys || pendingKeys.length === 0) return;

      const viettelConfig = await getViettelSettings();
      if (!viettelConfig.token) return;

      const promotion = await getActivePromotion();

      // Call Viettel API
      const response = await axios.get(`https://api.sieuthicode.net/historyapiviettel/${viettelConfig.token}`);
      const data = response.data;

      if (!data || data.status.code !== '00' || !data.data || !data.data.content) return;

      const transactions = data.data.content;

      for (const tx of transactions) {
        // Only process CREDIT (incoming) transactions
        if (tx.paymentType !== 'CREDIT') continue;

        const note = tx.msgContent || tx.description || '';
        const amount = Number(tx.amount) || 0;
        const txToken = extractToken(note);

        if (!txToken) continue;

        // Check if this token matches any pending deposit
        const cached = getCache(contentKey(txToken));
        if (!cached) continue;

        const user = await getUserById(cached.userId);
        if (!user) continue;

        // Verify amount (must be >= requested amount)
        const requestedAmount = Number(cached.amount);
        if (amount < requestedAmount) {
          console.log(`[AUTO_VIETTEL] Underpayment for ${txToken}: ${amount} < ${requestedAmount}`);
          continue;
        }

        // Process deposit
        console.log(`[AUTO_VIETTEL] Found matching transaction: Token=${txToken}, Amount=${amount}`);
        await processDepositTransaction(bot, {
          amount_in: amount,
          id: tx.bankTransId,
          transaction_content: note,
          ref_prefix: 'VIETTEL'
        }, cached, user, promotion);
      }
    } catch (err) {
      console.error('[AUTO_VIETTEL] Error:', err.message);
    }
  };

  // Start polling
  setInterval(tick, CHECK_INTERVAL);
  tick(); // Initial run

  // Also start QR expiration checker
  startQrExpirationChecker(bot);
};
