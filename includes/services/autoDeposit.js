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
    const L = (l, vi, en, zh) => ({ en, zh }[l] || vi);
    const lang = user.language || 'vi';

    let successMsg = L(lang,
      `✅ **Nạp tiền thành công!**\n\n💰 Số tiền nạp: \`+${formatCurrency(originalAmount)}\``,
      `✅ **Deposit successful!**\n\n💰 Amount credited: \`+${formatCurrency(originalAmount)}\``,
      `✅ **充值成功！**\n\n💰 充值金额: \`+${formatCurrency(originalAmount)}\``
    );

    if (promotionResult.bonusAmount > 0) {
      successMsg += L(lang,
        `\n🎁 Khuyến mãi (+${promotion?.bonus_percentage || 0}%): \`+${formatCurrency(promotionResult.bonusAmount)}\``,
        `\n🎁 Promotion (+${promotion?.bonus_percentage || 0}%): \`+${formatCurrency(promotionResult.bonusAmount)}\``,
        `\n🎁 促销红利 (+${promotion?.bonus_percentage || 0}%): \`+${formatCurrency(promotionResult.bonusAmount)}\``
      );
    }

    successMsg += L(lang,
      `\n💳 Số dư mới: \`${formatCurrency(finalBalance)}\``,
      `\n💳 New balance: \`${formatCurrency(finalBalance)}\``,
      `\n💳 新余额: \`${formatCurrency(finalBalance)}\``
    );

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

  const promotion = await getActivePromotion();

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
      const pendingKeys = getAllKeys('qr_');
      if (!pendingKeys || pendingKeys.length === 0) return;

      // Group pending keys by bank
      const pendingByBank = {};
      pendingKeys.forEach(key => {
        const qr = getCache(key);
        if (qr && qr.bank) {
          if (!pendingByBank[qr.bank]) pendingByBank[qr.bank] = [];
          pendingByBank[qr.bank].push(qr);
        }
      });

      const activeBanks = Object.keys(pendingByBank);
      if (activeBanks.length === 0) return;

      const promotion = await getActivePromotion();

      for (const bank of activeBanks) {
        const token = await getBankToken(bank);
        if (!token) continue;

        const url = getBankUrl(bank, token);
        if (!url) continue;

        try {
          const response = await axios.get(url);
          const data = response.data;

          let rawTransactions = [];
          if (bank === 'viettel') {
            if (data && data.status?.code === '00' && data.data) {
              rawTransactions = data.data.content || data.data.trans || [];
            }
          } else if (bank === 'vcb') {
            if (data && (data.code === '00' || data.status?.code === '00') && data.transactions) {
              rawTransactions = data.transactions || [];
            }
          } else if (bank === 'tpb') {
            if (data && data.transactionInfos) {
              rawTransactions = data.transactionInfos || [];
            }
          } else if (bank === 'mb') {
            if (data && data.status === 'success' && data.TranList) {
              rawTransactions = data.TranList || [];
            }
          } else if (bank === 'acb') {
            if (data && data.data) {
              rawTransactions = data.data || [];
            }
          } else if (bank === 'tcb') {
            if (data && data.status === 'success' && data.transactions) {
              rawTransactions = data.transactions || [];
            }
          } else if (bank === 'vp' || bank === 'timo') {
            if (data && data.status === 'success' && data.data) {
              rawTransactions = data.data || [];
            }
          }

          for (const rawTx of rawTransactions) {
            const tx = normalizeTransaction(rawTx, bank);
            if (!tx) continue;

            if (tx.paymentType && tx.paymentType !== 'CREDIT') continue;

            const note = tx.description || '';
            const amount = tx.amount;
            const txToken = extractToken(note);

            if (!txToken) continue;

            const cached = getCache(contentKey(txToken));
            if (!cached || cached.bank !== bank) continue;

            const user = await getUserById(cached.userId);
            if (!user) continue;

            const requestedAmount = Number(cached.amount);
            if (amount < requestedAmount) {
              console.log(`[AUTO_${bank.toUpperCase()}] Underpayment for ${txToken}: ${amount} < ${requestedAmount}`);
              continue;
            }

            console.log(`[AUTO_${bank.toUpperCase()}] Found matching transaction: Token=${txToken}, Amount=${amount}`);
            await processDepositTransaction(bot, {
              amount_in: amount,
              id: tx.id,
              transaction_content: note,
              ref_prefix: bank.toUpperCase()
            }, cached, user, promotion);
          }
        } catch (err) {
          console.error(`[AUTO_${bank.toUpperCase()}] Polling Error:`, err.message);
        }
      }
    } catch (err) {
      console.error('[AUTO_WATCHER] General Error:', err.message);
    }
  };

  setInterval(tick, CHECK_INTERVAL);
  tick();

  startQrExpirationChecker(bot);
};
