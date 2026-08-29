import axios from 'axios';
import crypto from 'crypto';
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
import { notifyAdminAboutDeposit, notifyAdminAboutIncomingTransfer, getAdminIds } from '../handle/handleNotify.js';
import { globalConfig } from '../listen.js';


import { query } from '../database/index.js';
import { t } from '../helpers/langHelper.js';

const processedKey = (ref) => `tx_${ref}`;
const qrKey = (telegramId) => `qr_${telegramId}`;
const contentKey = (token) => `content_${token}`;

const getBankToken = async (bank) => {
  try {
    const key = `${bank}_token`;
    const rows = await query("SELECT `value` FROM settings WHERE `key` = ?", [key]);
    if (rows?.[0]?.value) return rows[0].value;
    return '';
  } catch (e) {
    return '';
  }
};

const getBankUrl = (bank, token) => {
  switch (bank) {
    case 'viettel':
      return `https://api.sieuthicode.net/historyapiviettel/${token}`;
    case 'vcb':
      return `https://api.sieuthicode.net/historyapivcb/${token}`;
    case 'tpb':
      return `https://api.sieuthicode.net/historyapitpbank/${token}`;
    case 'mb':
      return `https://api.sieuthicode.net/historyapimb/${token}`;
    case 'acb':
      return `https://api.sieuthicode.net/historyapiacb/${token}`;
    case 'tcb':
      return `https://api.sieuthicode.net/historyapitcb/${token}`;
    case 'vp':
      return `https://api.sieuthicode.net/historyapivpbank/${token}`;
    case 'timo':
      return `https://api.sieuthicode.net/historyapitimo/${token}`;
    default:
      return '';
  }
};

const normalizeTransaction = (rawTx, bank) => {
  if (bank === 'viettel') {
    const rawAmt = rawTx.amount || rawTx.transAmount || '0';
    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/\./g, '')) || 0;
    return {
      id: rawTx.bankTransId || rawTx.id || rawTx.transactionId || rawTx.requestId || '',
      amount: parsedAmount,
      description: rawTx.msgContent || rawTx.description || rawTx.transDesc || '',
      transDate: rawTx.transDate || rawTx.requestDate || '',
      paymentType: rawTx.paymentType || (rawTx.spendMoneyTransaction === true ? 'DEBIT' : 'CREDIT'),
      bank: 'VIETTEL'
    };
  }
  
  if (bank === 'vcb') {
    const rawAmt = rawTx.Amount || '0';
    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
    return {
      id: rawTx.Reference || rawTx.SeqNo || '',
      amount: parsedAmount,
      description: rawTx.Description || rawTx.Remark || '',
      transDate: rawTx.tranDate || rawTx.TransactionDate || '',
      paymentType: (rawTx.CD === '+' || rawTx.DorCCode === 'C') ? 'CREDIT' : 'DEBIT',
      bank: 'VCB'
    };
  }

  if (bank === 'tpb') {
    const rawAmt = rawTx.amount || '0';
    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
    return {
      id: rawTx.id || '',
      amount: parsedAmount,
      description: rawTx.description || '',
      transDate: rawTx.bookingDate || '',
      paymentType: rawTx.creditDebitIndicator === 'CRDT' ? 'CREDIT' : 'DEBIT',
      bank: 'TPB'
    };
  }

  if (bank === 'mb') {
    const rawAmt = rawTx.creditAmount || '0';
    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
    return {
      id: rawTx.tranId || rawTx.refNo || '',
      amount: parsedAmount,
      description: rawTx.description || rawTx.addDescription || '',
      transDate: rawTx.postingDate || rawTx.transactionDate || '',
      paymentType: parsedAmount > 0 ? 'CREDIT' : 'DEBIT',
      bank: 'MB'
    };
  }

  if (bank === 'acb') {
    const rawAmt = rawTx.amount || 0;
    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
    let transDate = '';
    if (rawTx.postingDate) {
      try {
        transDate = new Date(rawTx.postingDate).toLocaleString('vi-VN');
      } catch {}
    }
    return {
      id: rawTx.transactionNumber ? rawTx.transactionNumber.toString() : '',
      amount: parsedAmount,
      description: rawTx.description || '',
      transDate: transDate,
      paymentType: rawTx.type === 'IN' ? 'CREDIT' : 'DEBIT',
      bank: 'ACB'
    };
  }

  if (bank === 'tcb') {
    const rawAmt = rawTx.amount || 0;
    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawTx.toString().replace(/,/g, '')) || 0;
    return {
      id: rawTx.transactionID || '',
      amount: parsedAmount,
      description: rawTx.description || '',
      transDate: rawTx.date || '',
      paymentType: parsedAmount >= 0 ? 'CREDIT' : 'DEBIT',
      bank: 'TCB'
    };
  }

  if (bank === 'vp') {
    const rawAmt = rawTx.amount || 0;
    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawTx.toString().replace(/,/g, '')) || 0;
    return {
      id: rawTx.transId || '',
      amount: parsedAmount,
      description: rawTx.description || '',
      transDate: rawTx.date || '',
      paymentType: parsedAmount >= 0 ? 'CREDIT' : 'DEBIT',
      bank: 'VP'
    };
  }

  if (bank === 'timo') {
    const rawAmt = rawTx.amount || 0;
    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawTx.toString().replace(/,/g, '')) || 0;
    return {
      id: rawTx.transId || '',
      amount: parsedAmount,
      description: rawTx.description || '',
      transDate: rawTx.date || '',
      paymentType: parsedAmount >= 0 ? 'CREDIT' : 'DEBIT',
      bank: 'TIMO'
    };
  }

  return null;
};

// Check Bank Transaction Unified
const checkBankTransaction = async (bot, bank, token, cached, user, promotion) => {
  try {
    if (!token) return false;

    const url = getBankUrl(bank, token);
    if (!url) return false;

    const response = await axios.get(url);
    const data = response.data;

    let rawTransactions = [];
    if (bank === 'viettel') {
      if (!data || data.status?.code !== '00' || !data.data) return false;
      rawTransactions = data.data.content || data.data.trans || [];
    } else if (bank === 'vcb') {
      if (!data || data.code !== '00' && data.status?.code !== '00' || !data.transactions) return false;
      rawTransactions = data.transactions || [];
    } else if (bank === 'tpb') {
      if (!data || !data.transactionInfos) return false;
      rawTransactions = data.transactionInfos || [];
    } else if (bank === 'mb') {
      if (!data || data.status !== 'success' || !data.TranList) return false;
      rawTransactions = data.TranList || [];
    } else if (bank === 'acb') {
      if (!data || !data.data) return false;
      rawTransactions = data.data || [];
    } else if (bank === 'tcb') {
      if (!data || data.status !== 'success' || !data.transactions) return false;
      rawTransactions = data.transactions || [];
    } else if (bank === 'vp' || bank === 'timo') {
      if (!data || data.status !== 'success' || !data.data) return false;
      rawTransactions = data.data || [];
    }

    for (const rawTx of rawTransactions) {
      const tx = normalizeTransaction(rawTx, bank);
      if (!tx) continue;

      // Check for CREDIT (income) transactions
      if (tx.paymentType && tx.paymentType !== 'CREDIT') continue;

      const note = tx.description || '';
      const amount = tx.amount;
      const txToken = extractToken(note);

      if (!txToken) continue;

      if (txToken === cached.token) {
        // Verify Amount
        const requestedAmount = Number(cached.amount);
        if (amount < requestedAmount) {
          console.log(`[${bank.toUpperCase()}] Underpayment ${tx.id}: ${amount} < ${requestedAmount}`);
          return false;
        }

        await processDepositTransaction(bot, {
          amount_in: amount,
          id: tx.id,
          transaction_content: note,
          ref_prefix: bank.toUpperCase()
        }, cached, user, promotion);

        return true;
      }
    }
  } catch (err) {
    console.error(`[CHECK_PAYMENT] ${bank.toUpperCase()} Error:`, err.message);
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
  // Resolve per-user rank at processing time; the caller-level promotion is only a fallback.
  const userPromotion = await getActivePromotion(user.id);
  promotion = userPromotion || promotion;
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

  const finalBalance = await updateBalance(user.id, promotionResult.finalAmount);
  setCache(processedKey(ref), true, 86400000);

  // Add Log
  await addBalanceLog({
    userId: user.id,
    amount: promotionResult.finalAmount,
    reason: promotionResult.bonusAmount > 0 ? `deposit+promo_${promotion.id}:${ref}` : `deposit:${ref}`,
    adminId: null
  });

  try {
    const lang = user.language || 'vi';

    const bonusLine = promotionResult.bonusAmount > 0
      ? t('deposit_bonus_line', lang, {
          percent: promotion?.bonus_percentage || 0,
          bonus: formatCurrency(promotionResult.bonusAmount)
        })
      : '';

    const successMsg = t('deposit_success_user', lang, {
      amount: formatCurrency(originalAmount),
      bonusLine,
      finalBalance: formatCurrency(finalBalance)
    });

    if (cached.messageId) {
      await bot.sendMessage(user.telegram_id, successMsg, { parse_mode: 'Markdown' });
      await deleteQrMessage(bot, cached);
    } else {
      await bot.sendMessage(user.telegram_id, successMsg, { parse_mode: 'Markdown' });
    }

    // Notify admins
    const { getAdminIds } = await import('../handle/handleNotify.js');
    const adminIds = await getAdminIds(globalConfig?.ADMIN_IDS || []);
    if (adminIds.length > 0) {
      await notifyAdminAboutDeposit(bot, adminIds, {
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

// Simple stub stubs if required by external imports
export const getViettelSettings = async () => ({ token: await getBankToken('viettel') });
export const getVcbSettings = async () => ({ token: await getBankToken('vcb') });

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
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const dbUser = await getUserByTelegram(userId);
  const lang = dbUser?.language || 'vi';

  const L = (l, vi, en, zh) => ({ en, zh }[l] || vi);

  const qrCache = getCache(qrKey(userId));
  if (!qrCache) return { success: false, message: L(lang, 'Không tìm thấy giao dịch chờ.', 'No pending transaction found.', '未找到待处理的交易。') };

  const { token, bank } = qrCache;
  const cached = getCache(contentKey(token));
  if (!cached) return { success: false, message: L(lang, 'Giao dịch đã hết hạn hoặc không tồn tại.', 'Transaction expired or not found.', '交易已过期或不存在。') };

  const user = await getUserById(cached.userId);
  if (!user) return { success: false, message: L(lang, 'Lỗi thông tin user.', 'User info error.', '用户信息错误。') };

  const promotion = await getActivePromotion(user.id);

  let success = false;
  const bankToken = await getBankToken(bank);
  if (bankToken) {
    success = await checkBankTransaction(bot, bank, bankToken, cached, user, promotion);
  }

  if (success) {
    return { success: true, message: L(lang, 'Đã nhận được tiền! Cảm ơn bạn.', 'Payment received! Thank you.', '已收到付款！谢谢您。') };
  } else {
    return { success: false, message: L(lang, 'Chưa nhận được tiền. Vui lòng chờ thêm chút nhé!', 'Payment not received yet. Please wait a moment!', '尚未收到付款，请稍等！') };
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
        const telegramId = Number(key.slice(3));
        if (Number.isFinite(telegramId)) {
          const paymentResult = await checkPaymentForUser(bot, telegramId, globalConfig);
          if (paymentResult.success) continue;
        }
        if (cache.depositId) await updateDepositStatus(cache.depositId, 'rejected');
        await deleteQrMessage(bot, cache);
        delCache(key);
        if (cache.token) delCache(contentKey(cache.token));
        if (Number.isFinite(telegramId)) {
          await bot.sendMessage(telegramId, '⌛ QR đã hết hạn và chưa nhận được thanh toán. Yêu cầu nạp tiền đã được hủy.').catch(() => {});
        }
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

  let schemaReady = false;
  let tickRunning = false;
  const ensureNotificationSchema = async () => {
    if (schemaReady) return;
    await query(`
      CREATE TABLE IF NOT EXISTS bank_incoming_transactions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        bank VARCHAR(20) NOT NULL,
        transaction_ref VARCHAR(191) NOT NULL,
        amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        description TEXT NULL,
        transaction_date VARCHAR(100) NULL,
        notification_sent TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_bank_transaction (bank, transaction_ref),
        INDEX idx_notification_sent (notification_sent)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS bank_notification_state (
        bank VARCHAR(20) PRIMARY KEY,
        initialized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    schemaReady = true;
  };

  const transactionReference = (tx, bank) => {
    if (tx.id) return String(tx.id).slice(0, 191);
    return crypto.createHash('sha256')
      .update(`${bank}|${tx.amount}|${tx.transDate}|${tx.description}`)
      .digest('hex');
  };

  const extractTransactions = (data, bank) => {
    if (bank === 'viettel' && data?.status?.code === '00' && data.data) {
      return data.data.content || data.data.trans || [];
    }
    if (bank === 'vcb' && (data?.code === '00' || data?.status?.code === '00')) return data.transactions || [];
    if (bank === 'tpb') return data?.transactionInfos || [];
    if (bank === 'mb' && data?.status === 'success') return data.TranList || [];
    if (bank === 'acb') return data?.data || [];
    if (bank === 'tcb' && data?.status === 'success') return data.transactions || [];
    if ((bank === 'vp' || bank === 'timo') && data?.status === 'success') return data.data || [];
    return [];
  };

  const tick = async () => {
    if (tickRunning) return;
    tickRunning = true;
    try {
      await ensureNotificationSchema();
      const pendingKeys = getAllKeys('qr_');

      // Group pending keys by bank
      const pendingByBank = {};
      (pendingKeys || []).forEach(key => {
        const qr = getCache(key);
        if (qr && qr.bank) {
          if (!pendingByBank[qr.bank]) pendingByBank[qr.bank] = [];
          pendingByBank[qr.bank].push(qr);
        }
      });

      // Luôn theo dõi ngân hàng đang bật, kể cả khi không có QR chờ.
      const activeBankRows = await query("SELECT `value` FROM settings WHERE `key` = 'active_bank' LIMIT 1");
      const configuredBank = String(activeBankRows?.[0]?.value || 'viettel').toLowerCase();
      const activeBanks = [...new Set([...Object.keys(pendingByBank), configuredBank])]
        .filter((bank) => getBankUrl(bank, 'token'));
      if (activeBanks.length === 0) return;

      const promotion = await getActivePromotion();
      const adminIds = await getAdminIds(config?.ADMIN_IDS || []);

      for (const bank of activeBanks) {
        const token = await getBankToken(bank);
        if (!token) continue;

        const url = getBankUrl(bank, token);
        if (!url) continue;

        try {
          const response = await axios.get(url);
          const data = response.data;

          const rawTransactions = extractTransactions(data, bank);
          const [state] = await query('SELECT bank FROM bank_notification_state WHERE bank = ? LIMIT 1', [bank]);
          const isInitialSnapshot = !state;

          for (const rawTx of rawTransactions) {
            const tx = normalizeTransaction(rawTx, bank);
            if (!tx) continue;

            if (tx.paymentType && tx.paymentType !== 'CREDIT') continue;
            if (!(Number(tx.amount) > 0)) continue;

            const reference = transactionReference(tx, bank);
            await query(
              `INSERT IGNORE INTO bank_incoming_transactions
               (bank, transaction_ref, amount, description, transaction_date, notification_sent)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [bank.toUpperCase(), reference, tx.amount, tx.description || '', tx.transDate || '', isInitialSnapshot ? 1 : 0]
            );
            const note = tx.description || '';
            const amount = tx.amount;
            const txToken = extractToken(note);
            let depositProcessed = false;

            if (txToken) {
              const cached = getCache(contentKey(txToken));
              if (cached && cached.bank === bank) {
                const user = await getUserById(cached.userId);
                const requestedAmount = Number(cached.amount);
                if (user && amount >= requestedAmount) {
                  console.log(`[AUTO_${bank.toUpperCase()}] Found matching transaction: Token=${txToken}, Amount=${amount}`);
                  depositProcessed = await processDepositTransaction(bot, {
                    amount_in: amount,
                    id: tx.id || reference,
                    transaction_content: note,
                    ref_prefix: bank.toUpperCase()
                  }, cached, user, promotion);
                } else if (user) {
                  console.log(`[AUTO_${bank.toUpperCase()}] Underpayment for ${txToken}: ${amount} < ${requestedAmount}`);
                }
              }
            }

            if (depositProcessed) {
              await query(
                'UPDATE bank_incoming_transactions SET notification_sent = 1 WHERE bank = ? AND transaction_ref = ?',
                [bank.toUpperCase(), reference]
              );
            } else if (!isInitialSnapshot && adminIds.length > 0) {
              const [notificationRow] = await query(
                'SELECT notification_sent FROM bank_incoming_transactions WHERE bank = ? AND transaction_ref = ? LIMIT 1',
                [bank.toUpperCase(), reference]
              );
              if (Number(notificationRow?.notification_sent || 0) === 0) {
                const notified = await notifyAdminAboutIncomingTransfer(bot, adminIds, {
                  bank: tx.bank || bank.toUpperCase(),
                  amount,
                  description: note,
                  reference,
                  transDate: tx.transDate
                });
                if (notified) {
                  await query(
                    'UPDATE bank_incoming_transactions SET notification_sent = 1 WHERE bank = ? AND transaction_ref = ?',
                    [bank.toUpperCase(), reference]
                  );
                }
              }
            }
          }

          if (isInitialSnapshot) {
            await query('INSERT IGNORE INTO bank_notification_state (bank) VALUES (?)', [bank]);
            console.log(`[AUTO_${bank.toUpperCase()}] Đã tạo mốc ban đầu, không thông báo giao dịch cũ.`);
          }
        } catch (err) {
          console.error(`[AUTO_${bank.toUpperCase()}] Polling Error:`, err.message);
        }
      }
    } catch (err) {
      console.error('[AUTO_WATCHER] General Error:', err.message);
    } finally {
      tickRunning = false;
    }
  };

  setInterval(tick, CHECK_INTERVAL);
  tick();
};
