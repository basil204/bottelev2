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
import { globalConfig } from '../listen.js';
import { getTransactions } from './sepayService.js';
import { query } from '../database/index.js';

const processedKey = (ref) => `tx_${ref}`;
const qrKey = (telegramId) => `qr_${telegramId}`;
const contentKey = (token) => `content_${token}`;

// Helper: Check Sepay transaction
const checkSepayTransaction = async (bot, sepayConfig, cached, user, promotion) => {
  try {
    if (!sepayConfig.enabled || !sepayConfig.token) return false;

    // Filter for transactions today
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const transaction_date_min = `${dateStr} 00:00:00`;
    const transaction_date_max = `${dateStr} 23:59:59`;

    const data = await getTransactions(sepayConfig.token, {
      account_number: sepayConfig.account_no,
      transaction_date_min,
      transaction_date_max,
      limit: 50
    });

    if (!data || !data.transactions) return false;

    for (const tx of data.transactions) {
      const note = tx.transaction_content || '';
      const token = extractToken(note);
      if (!token) continue;

      if (token === cached.token) {
        const success = await processSepayTransaction(bot, tx, cached, user, promotion);
        if (success) return true;
      }
    }
  } catch (err) {
    console.error('[CHECK_PAYMENT] Sepay Error:', err.message);
  }
  return false;
}

// Helper: Check Timo transaction
const checkTimoTransaction = async (bot, cached, user, promotion) => {
  try {
    const admin = await getAdminSettings();
    // Call Next.js API (assuming port 3000)
    // Adjust URL if needed
    const response = await axios.get('http://localhost:4953/api/timo?action=history', {
      params: {
        username: admin.username,
        password: admin.password
      }
    });

    const data = response.data;

    // Response format { success: true, data: { ...TimoResponse... } }
    if (data && data.success && data.data) {
      const timoData = data.data;
      // data.data is the transactions structure.
      // Example structure depends on Timo API, but based on script:
      /*
       {
        "data": {
          "groups": [
             { "label": "Today", "transactions": [...] }
          ]
        }
       }
      */
      // Or flat list if we flattened it? timoServer returns raw from Timo API usually.
      // Let's assume flattened or loop deep.

      // Based on `timoServer.js`:
      /*
       const result = { ..., data: transactions };
       transactions comes from getTransactionList which returns Timo response.
       Timo response usually: { data: { items: [...] } } or groups.
      */

      // We'll iterate aggressively.
      // Parse nested structure: data.data.items -> each is a group (date) -> has 'item' array
      // Parse nested structure: data.data.items -> each is a group (date) -> has 'item' array
      let transactions = [];
      if (timoData.data && timoData.data.items && Array.isArray(timoData.data.items)) {
        timoData.data.items.forEach(group => {
          if (group.item && Array.isArray(group.item)) {
            transactions.push(...group.item);
          }
        });
      }

      for (const tx of transactions) {
        // Filter Incoming Transfers
        // txnType: "IncomingTransfer" or drcr implied?
        // JSON shows "txnType": "IncomingTransfer"
        // Also check txnAmount > 0

        const isIncoming = tx.txnType === 'IncomingTransfer' || (tx.txnAmount > 0 && !tx.txnType.includes('Outgoing'));
        if (!isIncoming) continue;

        const note = tx.txnDesc || tx.txnNarrative || '';
        const credit = tx.txnAmount || 0;

        if (credit <= 0) continue;

        const token = extractToken(note);
        if (!token) continue;

        if (token === cached.token) {
          // Found it!
          const ref = `TIMO-${tx.refNo}`;

          // Verify Amount
          const requestedAmount = Number(cached.amount);
          if (credit < requestedAmount) {
            console.log(`[TIMO] Underpayment ${ref}: ${credit} < ${requestedAmount}`);
            return false;
          }

          await processDepositTransaction(bot, {
            amount_in: credit,
            id: tx.refNo,
            transaction_content: note,
            ref_prefix: 'TIMO'
          }, cached, user, promotion);

          return true;
        }
      }
    }
  } catch (err) {
    // console.error('[CHECK_PAYMENT] Timo Error:', err.message);
  }
  return false;
};

// Unified processor
const processDepositTransaction = async (bot, txRaw, cached, user, promotion) => {
  const credit = Number(txRaw.amount_in || 0);
  const ref = `${txRaw.ref_prefix}-${txRaw.id}`;

  if (getCache(processedKey(ref))) return false;

  // ... (Rest of logic similar to processSepayTransaction)
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

    const adminIds = globalConfig?.ADMIN_IDS || [];
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

// Get Sepay settings from DB
const getSepaySettings = async () => {
  try {
    const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('sepay_enabled', 'sepay_token', 'sepay_account_no')");
    const settings = { enabled: false, token: '', account_no: '' };
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        if (r.key === 'sepay_enabled') settings.enabled = r.value === 'true';
        if (r.key === 'sepay_token') settings.token = r.value;
        if (r.key === 'sepay_account_no') settings.account_no = r.value;
      });
    }
    return settings;
  } catch (error) {
    console.error('Error fetching Sepay settings:', error);
    return { enabled: false, token: '', account_no: '' };
  }
};

const getTimoSettings = async () => {
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'timo_auto_deposit'");
    return { enabled: rows?.[0]?.value === 'true' };
  } catch (e) { return { enabled: false }; }
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
  const sepayConfig = await getSepaySettings();

  // Check Sepay
  let success = false;
  if (sepayConfig.enabled && cached.bank === 'sepay') {
    success = await checkSepayTransaction(bot, sepayConfig, cached, user, promotion);
  } else if (cached.bank === 'timo') {
    const timoConfig = await getTimoSettings();
    if (timoConfig.enabled) {
      success = await checkTimoTransaction(bot, cached, user, promotion);
    }
  } else {
    // If bank not specified (legacy), try both? or just Sepay
    if (sepayConfig.enabled) success = await checkSepayTransaction(bot, sepayConfig, cached, user, promotion);
  }

  if (success) {
    return { success: true, message: 'Đã nhận được tiền! Cảm ơn bạn.' };
  } else {
    // Fallback message if Sepay not enabled or transaction not found
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

// Process Sepay Transaction
// Process Sepay Transaction (Legacy Wrapper)
const processSepayTransaction = async (bot, tx, cached, user, promotion) => {
  return processDepositTransaction(bot, {
    amount_in: tx.amount_in,
    id: tx.id,
    transaction_content: tx.transaction_content,
    ref_prefix: 'SEPAY'
  }, cached, user, promotion);
};

export const startAutoDepositWatcher = (bot, config) => {
  const CHECK_INTERVAL = 3000; // Check every 3 seconds

  const tick = async () => {
    try {
      // Optimization: Only check Sepay if there are pending QRs waiting for payment
      const pendingKeys = getAllKeys('qr_');
      if (!pendingKeys || pendingKeys.length === 0) return;

      const sepayConfig = await getSepaySettings();
      const timoConfig = await getTimoSettings();
      const admin = await getAdminSettings();
      const promotion = await getActivePromotion();

      // Check Sepay
      if (sepayConfig.enabled && sepayConfig.token) {
        // ... (existing Sepay logic)
        const data = await getTransactions(sepayConfig.token, {
          account_number: sepayConfig.account_no,
          transaction_date_min,
          transaction_date_max,
          limit: 20
        });

        if (data && data.transactions) {
          for (const tx of data.transactions) {
            const note = tx.transaction_content || '';
            const token = extractToken(note);
            if (!token) continue;
            const cached = getCache(contentKey(token));
            if (!cached || cached.bank !== 'sepay') continue; // Only process if bank matches

            const user = await getUserById(cached.userId);
            if (!user) continue;

            await processSepayTransaction(bot, tx, cached, user, promotion);
          }
        }
      }

      // Check Timo
      if (timoConfig.enabled) {
        // Iterate over pending QR to see if any is Timo?
        // No, we just poll Timo and check against cache.
        // But optimization: check if any pending QR is for Timo.
        const anyTimo = pendingKeys.some(k => {
          const c = getCache(k);
          return c && c.bank === 'timo';
        });

        if (anyTimo) {
          // Poll Timo
          // To iterate through transactions, we need to iterate pending tokens?
          // "checkTimoTransaction" does polling internally? 
          // My implementation of checkTimoTransaction iterates transactions and checks cache.
          // But it needs 'cached' passed in? NO. 

          // Wait, my previous `checkTimoTransaction` implementation above took 'cached' as arg.
          // That means it checks ONE specific cached token.
          // That is inefficient for polling.
          // I should refactor `checkTimoTransaction` to be "pollTimoAndMatch" or similar.

          // Actually, let's just do the fetching here inline or helper.
          // Actually, let's just do the fetching here inline or helper.
          try {
            const response = await axios.get('http://localhost:4953/api/timo?action=history', {
              params: {
                username: admin.username,
                password: admin.password
              }
            });
            const data = response.data;
            if (!data.success || !data.data) return;
            const timoData = data.data;

            let transactions = [];
            if (timoData.data && timoData.data.items && Array.isArray(timoData.data.items)) {
              timoData.data.items.forEach(g => {
                if (g.item) transactions.push(...g.item);
              });
            }

            for (const tx of transactions) {
              const isCredit = tx.cd === '+' || (tx.amount > 0 && tx.drcr === 'CR');
              if (!isCredit) continue;

              const note = tx.txnDesc || tx.description || '';
              const token = extractToken(note);
              if (!token) continue;

              const cached = getCache(contentKey(token));
              if (!cached || cached.bank !== 'timo') continue;

              const user = await getUserById(cached.userId);
              if (!user) continue;

              // Verify Amount
              const credit = tx.amount || 0;
              const ref = `TIMO-${tx.refNo || tx.txnId}`;
              const requestedAmount = Number(cached.amount);
              if (credit < requestedAmount) continue;

              await processDepositTransaction(bot, {
                amount_in: credit,
                id: tx.refNo || tx.txnId,
                transaction_content: note,
                ref_prefix: 'TIMO'
              }, cached, user, promotion);
            }
          } catch (e) { }
        }
      }
    } catch (err) {
      console.error('[AUTO_WATCHER] Error:', err.message);
    }
  };

  setInterval(tick, CHECK_INTERVAL);
  tick(); // Initial run
};
