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
    const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('vietqr_bank_code', 'vietqr_account_no', 'vietqr_account_name', 'viettel_account')");
    const dbConfig = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        if (r.key === 'vietqr_bank_code') dbConfig.bankCode = r.value;
        if (r.key === 'vietqr_account_no') dbConfig.accountNo = r.value;
        if (r.key === 'vietqr_account_name') dbConfig.accountName = r.value;
        if (r.key === 'viettel_account') dbConfig.viettelAccount = r.value;
      });
    }
    // Ưu tiên viettel_account nếu có
    return {
      bankCode: dbConfig.bankCode || defaultConfig.VIETQR_BANK_CODE || 'MB',
      accountNo: dbConfig.viettelAccount || dbConfig.accountNo || defaultConfig.VIETQR_ACCOUNT_NO,
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
  const { t } = await import('../helpers/langHelper.js');
  const lang = user?.language || 'vi';

  const bankLabel = lang === 'en' ? '🏦 Bank Transfer' : '🏦 Ngân hàng (Bank)';
  const usdtLabel = '💲 USDT';

  const inline_keyboard = [
    [{ text: bankLabel, callback_data: createCallbackData({ action: 'deposit_select_bank' }) }],
    [{ text: usdtLabel, callback_data: createCallbackData({ action: 'deposit_select_usdt' }) }]
  ];

  const title = t('deposit_menu_title', lang);

  await bot.sendMessage(msg.chat.id, title, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard }
  });
};

export const promptForBankDeposit = async (bot, chatId, userId, config) => {
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const user = await getUserByTelegram(userId);
  const lang = user?.language || 'vi';

  // Check existing QR
  const existing = getCache(qrKey(userId));
  if (existing) {
    if (existing.expiresAt && existing.expiresAt < Date.now()) {
      await deleteQrMessage(bot, existing);
      delCache(qrKey(userId));
      if (existing.token) delCache(contentKey(existing.token));
      const expiredMsg = lang === 'en'
        ? 'Old QR has expired. You can create a new deposit.'
        : 'QR cũ đã hết hạn. Bạn có thể tạo nạp mới.';
      await bot.sendMessage(chatId, expiredMsg);
    } else {
      const ttlSec = Math.ceil((existing.expiresAt - Date.now()) / 1000);
      const waitingMsg = lang === 'en'
        ? `You have a pending QR (${ttlSec}s left). Amount: ${formatCurrency(existing.amount)}`
        : `Bạn đã có QR đang chờ (còn ${ttlSec}s). Số tiền: ${formatCurrency(existing.amount)}`;
      return bot.sendMessage(chatId, waitingMsg);
    }
  }

  // Set default selection to sepay (or whatever bank integration is used)
  setCache(`bank_selection_${userId}`, 'sepay', 5 * 60 * 1000);

  // Ask for amount
  const promptMsg = lang === 'en'
    ? 'Enter deposit amount (VND).'
    : 'Nhập số tiền cần nạp (VNĐ).';
  await bot.sendMessage(chatId, promptMsg);
};

const getUsdtConfig = async (defaultConfig) => {
  try {
    const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('usdt_wallet_address', 'usdt_network')");
    const dbConfig = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        if (r.key === 'usdt_wallet_address') dbConfig.walletAddress = r.value;
        if (r.key === 'usdt_network') dbConfig.network = r.value;
      });
    }
    return {
      walletAddress: dbConfig.walletAddress || 'Chưa cập nhật',
      network: dbConfig.network || 'BEP20'
    };
  } catch (e) {
    return {
      walletAddress: 'Chưa cập nhật',
      network: 'BEP20'
    };
  }
};

export const showUsdtOptions = async (bot, chatId, config) => {
  const { t } = await import('../helpers/langHelper.js');
  const { getUserByTelegram } = await import('../controllers/userController.js');
  // Fetch user language, assuming chatId is telegramId for 1-1 chats
  const user = await getUserByTelegram(chatId);
  const lang = user ? user.language : 'vi';

  // Only TRC20 option now
  const inline_keyboard = [
    [{ text: '💎 Ví TRC20 (Tự động)', callback_data: createCallbackData({ action: 'deposit_usdt_trc20' }) }]
  ];

  const menuTitle = lang === 'en'
    ? '💲 **USDT Deposit**\n\nChoose deposit method:'
    : '💲 **Nạp tiền USDT**\n\nChọn phương thức:';

  await bot.sendMessage(chatId, menuTitle, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard }
  });
};

export const showUsdtBybitInfo = async (bot, chatId, userId, config) => {
  const { t } = await import('../helpers/langHelper.js');
  const { query } = await import('../database/index.js');
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const user = await getUserByTelegram(userId);
  const lang = user ? user.language : 'vi';

  if (user) {
    const pending = await query(
      "SELECT count(*) as count FROM deposits WHERE user_id = ? AND status = 'pending' AND type = 'usdt'",
      [user.id]
    );
    if (pending[0].count > 0) {
      return bot.sendMessage(chatId, await t('pending_warning', lang));
    }
  }

  // Step 1: Ask for USDT amount
  setCache(`waiting_usdt_amount_${userId}`, true, 5 * 60 * 1000);

  const promptMsg = lang === 'en'
    ? '💲 **Enter USDT amount** (minimum 1$):'
    : '💲 **Nhập số tiền USDT** (tối thiểu 1$):';

  await bot.sendMessage(chatId, promptMsg, {
    parse_mode: 'Markdown',
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [{ text: await t('cancel', lang) }]
      ]
    }
  });
};

// Handler for USDT amount input (called from listen.js message handler)
export const handleUsdtAmountInput = async (bot, msg, user, config) => {
  const userId = msg.from.id;
  const isWaiting = getCache(`waiting_usdt_amount_${userId}`);
  if (!isWaiting) return false;

  const { t } = await import('../helpers/langHelper.js');
  const lang = user.language || 'vi';

  const text = msg.text.trim();
  const amount = parseFloat(text.replace(',', '.'));

  if (isNaN(amount) || amount < 1) {
    const errorMsg = lang === 'en'
      ? '❌ Invalid amount. Please enter at least 1 USDT.'
      : '❌ Số tiền không hợp lệ. Vui lòng nhập ít nhất 1 USDT.';
    await bot.sendMessage(msg.chat.id, errorMsg);
    return true;
  }

  delCache(`waiting_usdt_amount_${userId}`);

  // Step 2: Show Bybit info with note
  const link = 'https://i.bybit.com/ab186yqr';
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const note = `${userId}_${dd}${mm}${yyyy}`;

  // Store amount in cache for photo handler
  setCache(`usdt_amount_${userId}`, amount, 15 * 60 * 1000);
  setCache(`waiting_payment_proof_${userId}`, true, 15 * 60 * 1000);

  const message = `📈 **Bybit**\n\n` +
    `💵 **Số tiền:** ${amount} USDT\n\n` +
    await t('bybit_link', lang, { link }) + `\n\n` +
    await t('bybit_note_label', lang, { note }) + `\n\n` +
    await t('bybit_upload_guide', lang);

  await bot.sendMessage(msg.chat.id, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [{ text: await t('cancel', lang) }]
      ]
    }
  });

  return true;
};

export const cancelUploadState = async (bot, chatId, userId, config) => {
  delCache(`waiting_payment_proof_${userId}`);
  const { t } = await import('../helpers/langHelper.js');
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const user = await getUserByTelegram(userId); // Assuming userId here is telegram id based on usage

  try {
    const { sendMenu } = await import('../handle/handleUser.js');
    await bot.sendMessage(chatId, await t('canceled', user?.language), { reply_markup: { remove_keyboard: true } });
    await sendMenu(bot, chatId, { telegram_id: userId, language: user?.language }, config.TELEGRAM_GROUP_LINKS);
  } catch (e) {
    await bot.sendMessage(chatId, '❌ Canceled.', { reply_markup: { remove_keyboard: true } });
  }
};

export const showUsdtInfo = async (bot, chatId, config) => {
  const usdtConfig = await getUsdtConfig(config);

  const width = '<code>';
  const widthEnd = '</code>';

  const message = `💲 **Nạp tiền qua Ví USDT**\n\n` +
    `🌐 Mạng lưới (Network): **${usdtConfig.network}**\n` +
    `💼 Địa chỉ ví:\n\`${usdtConfig.walletAddress}\`\n(Click để copy)\n\n` +
    `⚠️ **Lưu ý:**\n` +
    `• Vui lòng chuyển đúng mạng lưới **${usdtConfig.network}**.\n` +
    `• Sau khi chuyển xong, vui lòng chụp ảnh hoá đơn và liên hệ Admin để được cộng tiền.`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};

// ========== TRC20 USDT DEPOSIT FLOW ==========

// Get TRC20 wallet address from settings
const getTrc20WalletAddress = async () => {
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'usdt_trc20_wallet'");
    return rows?.[0]?.value || '';
  } catch (e) {
    return '';
  }
};

// Get exchange rate from settings
const getExchangeRate = async () => {
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'exchange_rate'");
    return Number(rows?.[0]?.value) || 26000;
  } catch (e) {
    return 26000;
  }
};

// Start TRC20 deposit flow - show wallet and ask for amount
export const showTrc20DepositFlow = async (bot, chatId, userId, config) => {
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const user = await getUserByTelegram(userId);
  const lang = user?.language || 'vi';

  const walletAddress = await getTrc20WalletAddress();

  if (!walletAddress) {
    const errorMsg = lang === 'en'
      ? '❌ TRC20 wallet address not configured. Please contact admin.'
      : '❌ Chưa cấu hình địa chỉ ví TRC20. Vui lòng liên hệ Admin.';
    return bot.sendMessage(chatId, errorMsg);
  }

  // Store state: waiting for amount
  setCache(`waiting_trc20_amount_${userId}`, true, 10 * 60 * 1000);

  const message = lang === 'en'
    ? `💎 **USDT TRC20 Deposit**\n\n` +
    `📍 **Wallet Address:**\n\`${walletAddress}\`\n(Click to copy)\n\n` +
    `🌐 **Network:** TRC20 (TRON)\n\n` +
    `💲 **Enter USDT amount** (minimum 1 USDT):`
    : `💎 **Nạp tiền USDT TRC20**\n\n` +
    `📍 **Địa chỉ ví:**\n\`${walletAddress}\`\n(Click để copy)\n\n` +
    `🌐 **Mạng:** TRC20 (TRON)\n\n` +
    `💲 **Nhập số tiền USDT** (tối thiểu 1 USDT):`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      resize_keyboard: true,
      keyboard: [[{ text: lang === 'en' ? '❌ Cancel' : '❌ Hủy' }]]
    }
  });
};

// Handle TRC20 amount input
export const handleTrc20AmountInput = async (bot, msg, user) => {
  const userId = msg.from.id;
  const isWaiting = getCache(`waiting_trc20_amount_${userId}`);
  if (!isWaiting) return false;

  const lang = user?.language || 'vi';
  const text = msg.text.trim();

  // Check cancel
  if (text === '❌ Hủy' || text === '❌ Cancel') {
    delCache(`waiting_trc20_amount_${userId}`);
    await bot.sendMessage(msg.chat.id, lang === 'en' ? '❌ Cancelled.' : '❌ Đã hủy.', {
      reply_markup: { remove_keyboard: true }
    });
    return true;
  }

  const amount = parseFloat(text.replace(',', '.'));

  if (isNaN(amount) || amount < 1) {
    const errorMsg = lang === 'en'
      ? '❌ Invalid amount. Please enter at least 1 USDT.'
      : '❌ Số tiền không hợp lệ. Vui lòng nhập ít nhất 1 USDT.';
    await bot.sendMessage(msg.chat.id, errorMsg);
    return true;
  }

  delCache(`waiting_trc20_amount_${userId}`);

  // Store amount and wait for hash
  setCache(`trc20_amount_${userId}`, amount, 15 * 60 * 1000);
  setCache(`waiting_trc20_hash_${userId}`, true, 15 * 60 * 1000);

  const promptMsg = lang === 'en'
    ? `💵 **Amount:** ${amount} USDT\n\n` +
    `📝 **Enter your transaction hash (TxID):**\n\n` +
    `⚠️ **Important:** Enter the EXACT amount received (after network fees).\n` +
    `See the image below for how to find your TxID.`
    : `💵 **Số tiền:** ${amount} USDT\n\n` +
    `📝 **Nhập mã giao dịch (Hash/TxID):**\n\n` +
    `⚠️ **Lưu ý:** Nhập ĐÚNG số tiền thực nhận (sau khi trừ phí mạng).\n` +
    `Xem ảnh bên dưới để biết cách tìm TxID.`;

  // Send text message first
  await bot.sendMessage(msg.chat.id, promptMsg, {
    parse_mode: 'Markdown',
    reply_markup: {
      resize_keyboard: true,
      keyboard: [[{ text: lang === 'en' ? '❌ Cancel' : '❌ Hủy' }]]
    }
  });

  // Send guide image
  try {
    const path = await import('path');
    const fs = await import('fs');
    const imagePath = path.join(process.cwd(), 'img', '0a08ecfdf6045f969d46dc695ce902c9.png');
    if (fs.existsSync(imagePath)) {
      await bot.sendPhoto(msg.chat.id, imagePath, {
        caption: lang === 'en' ? '👆 How to find your TxID' : '👆 Cách tìm mã TxID'
      });
    }
  } catch (e) {
    console.error('[TRC20] Error sending guide image:', e);
  }

  return true;
};

// Handle TRC20 hash input and verify via Tronscan API
export const handleTrc20HashInput = async (bot, msg, user) => {
  const userId = msg.from.id;
  const isWaiting = getCache(`waiting_trc20_hash_${userId}`);
  if (!isWaiting) return false;

  const lang = user?.language || 'vi';
  const text = msg.text.trim();

  // Check cancel
  if (text === '❌ Hủy' || text === '❌ Cancel') {
    delCache(`waiting_trc20_hash_${userId}`);
    delCache(`trc20_amount_${userId}`);
    await bot.sendMessage(msg.chat.id, lang === 'en' ? '❌ Cancelled.' : '❌ Đã hủy.', {
      reply_markup: { remove_keyboard: true }
    });
    return true;
  }

  const txHash = text;
  const expectedAmount = getCache(`trc20_amount_${userId}`);

  if (!expectedAmount) {
    delCache(`waiting_trc20_hash_${userId}`);
    const errorMsg = lang === 'en' ? '❌ Session expired. Please start again.' : '❌ Phiên đã hết hạn. Vui lòng thực hiện lại.';
    await bot.sendMessage(msg.chat.id, errorMsg, { reply_markup: { remove_keyboard: true } });
    return true;
  }

  // Show processing message
  const processingMsg = await bot.sendMessage(msg.chat.id, lang === 'en' ? '⏳ Verifying transaction...' : '⏳ Đang xác minh giao dịch...');

  try {
    // Check if hash already used
    const { findDepositByTxHash, createTrc20Deposit } = await import('../controllers/depositController.js');
    const existingDeposit = await findDepositByTxHash(txHash);

    if (existingDeposit) {
      delCache(`waiting_trc20_hash_${userId}`);
      delCache(`trc20_amount_${userId}`);
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = lang === 'en'
        ? '❌ This transaction hash has already been used.'
        : '❌ Mã giao dịch này đã được sử dụng.';
      await bot.sendMessage(msg.chat.id, errorMsg, { reply_markup: { remove_keyboard: true } });
      return true;
    }

    // Verify via Tronscan API
    const response = await fetch(`https://apilist.tronscan.org/api/transaction-info?hash=${txHash}`);
    const data = await response.json();

    // Check if transaction exists and is confirmed
    if (!data || !data.confirmed) {
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = lang === 'en'
        ? '❌ Transaction not found or not confirmed yet. Please wait and try again.'
        : '❌ Không tìm thấy giao dịch hoặc chưa được xác nhận. Vui lòng đợi và thử lại.';
      await bot.sendMessage(msg.chat.id, errorMsg);
      return true;
    }

    // Check TRC20 transfer info
    const trc20Info = data.trc20TransferInfo?.[0];
    if (!trc20Info || trc20Info.symbol !== 'USDT') {
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = lang === 'en'
        ? '❌ This is not a USDT TRC20 transaction.'
        : '❌ Đây không phải là giao dịch USDT TRC20.';
      await bot.sendMessage(msg.chat.id, errorMsg);
      return true;
    }

    // Verify recipient address matches our wallet
    const ourWallet = await getTrc20WalletAddress();
    if (trc20Info.to_address.toLowerCase() !== ourWallet.toLowerCase()) {
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = lang === 'en'
        ? '❌ The recipient address does not match our wallet.'
        : '❌ Địa chỉ nhận không khớp với ví của chúng tôi.';
      await bot.sendMessage(msg.chat.id, errorMsg);
      return true;
    }

    // Calculate USDT amount (divide by 10^6 for 6 decimals)
    const usdtAmount = Number(trc20Info.amount_str) / 1000000;

    // Verify amount matches expected amount exactly (user should enter amount after fees)
    if (Math.abs(usdtAmount - expectedAmount) > 0.01) {
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = lang === 'en'
        ? `❌ Amount mismatch!\n\n` +
        `📝 You entered: ${expectedAmount} USDT\n` +
        `💰 Actual received: ${usdtAmount} USDT\n\n` +
        `⚠️ Please enter the EXACT amount shown in your transaction (after network fees).`
        : `❌ Số tiền không khớp!\n\n` +
        `📝 Bạn đã nhập: ${expectedAmount} USDT\n` +
        `💰 Thực nhận: ${usdtAmount} USDT\n\n` +
        `⚠️ Vui lòng nhập ĐÚNG số tiền hiển thị trong giao dịch (số tiền sau khi trừ phí mạng).`;
      await bot.sendMessage(msg.chat.id, errorMsg);
      return true;
    }

    // Convert to VND
    const exchangeRate = await getExchangeRate();
    const amountVnd = Math.round(usdtAmount * exchangeRate);

    // Clear waiting states
    delCache(`waiting_trc20_hash_${userId}`);
    delCache(`trc20_amount_${userId}`);

    // Create deposit and credit balance
    const { updateBalance, getUserByTelegram } = await import('../controllers/userController.js');
    const { addBalanceLog } = await import('../controllers/balanceLogController.js');

    const dbUser = await getUserByTelegram(userId);
    if (!dbUser) {
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      await bot.sendMessage(msg.chat.id, lang === 'en' ? '❌ User not found.' : '❌ Không tìm thấy người dùng.', {
        reply_markup: { remove_keyboard: true }
      });
      return true;
    }

    // Create deposit record
    const depositId = await createTrc20Deposit(dbUser.id, usdtAmount, amountVnd, txHash);

    // Update balance
    await updateBalance(dbUser.id, amountVnd);

    // Log balance change
    await addBalanceLog({
      userId: dbUser.id,
      amount: amountVnd,
      reason: `usdt_trc20_${usdtAmount}`,
      adminId: null
    });

    // Get new balance
    const updatedUser = await getUserByTelegram(userId);
    const newBalance = Number(updatedUser.balance) || 0;

    await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });

    const successMsg = lang === 'en'
      ? `✅ **Deposit Successful!**\n\n` +
      `💎 USDT: ${usdtAmount} USDT\n` +
      `💵 VND: ${formatCurrency(amountVnd)}\n` +
      `📝 TxID: \`${txHash.substring(0, 20)}...\`\n\n` +
      `💰 New Balance: ${formatCurrency(newBalance)}`
      : `✅ **Nạp tiền thành công!**\n\n` +
      `💎 USDT: ${usdtAmount} USDT\n` +
      `💵 VND: ${formatCurrency(amountVnd)}\n` +
      `📝 TxID: \`${txHash.substring(0, 20)}...\`\n\n` +
      `💰 Số dư mới: ${formatCurrency(newBalance)}`;

    await bot.sendMessage(msg.chat.id, successMsg, {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });

    // Notify admin
    try {
      const { notifyAdminAboutDeposit, getAdminIds } = await import('./handleNotify.js');
      const adminIds = await getAdminIds([]);
      if (adminIds.length > 0) {
        await notifyAdminAboutDeposit(bot, adminIds, {
          depositId,
          username: dbUser.username,
          telegramId: userId,
          originalAmount: amountVnd,
          bonusAmount: 0,
          bonusPercentage: 0,
          finalAmount: amountVnd,
          finalBalance: newBalance,
          note: `TRC20: ${usdtAmount} USDT`
        });
      }
    } catch (e) {
      console.error('[TRC20_DEPOSIT] Error notifying admin:', e);
    }

    return true;

  } catch (error) {
    console.error('[TRC20_DEPOSIT] Error verifying hash:', error);
    await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
    const errorMsg = lang === 'en'
      ? '❌ Error verifying transaction. Please try again later.'
      : '❌ Lỗi xác minh giao dịch. Vui lòng thử lại sau.';
    await bot.sendMessage(msg.chat.id, errorMsg);
    return true;
  }
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
  const lang = user?.language || 'vi';
  const existing = getCache(qrKey(msg.from.id));
  if (existing) {
    const waitMsg = lang === 'en' ? 'Old QR not expired yet, please wait.' : 'QR cũ chưa hết hạn, vui lòng chờ.';
    return bot.sendMessage(msg.chat.id, waitMsg);
  }

  // Get selected bank
  let selectedBank = getCache(`bank_selection_${msg.from.id}`);
  if (!selectedBank) {
    // If not selected, try to auto-select if only one is enabled, or default to sepay
    selectedBank = 'sepay';
  }

  const amount = Number(msg.text.replace(/\D/g, ''));
  if (!amount || amount <= 0) {
    const invalidMsg = lang === 'en' ? 'Invalid amount.' : 'Số tiền không hợp lệ.';
    return bot.sendMessage(msg.chat.id, invalidMsg);
  }

  const purchaseKey = `purchase_${msg.from.id}`;
  const pendingPurchase = getCache(purchaseKey);

  const MIN_DEPOSIT_AMOUNT = await getMinDepositAmount();
  if (!pendingPurchase && amount < MIN_DEPOSIT_AMOUNT) {
    const minMsg = lang === 'en'
      ? `❌ Minimum deposit is ${formatCurrency(MIN_DEPOSIT_AMOUNT)}.\n\n` +
      `💰 You entered: ${formatCurrency(amount)}\n` +
      `💡 Please enter at least ${formatCurrency(MIN_DEPOSIT_AMOUNT)}.`
      : `❌ Số tiền nạp tối thiểu là ${formatCurrency(MIN_DEPOSIT_AMOUNT)}.\n\n` +
      `💰 Bạn đã nhập: ${formatCurrency(amount)}\n` +
      `💡 Vui lòng nhập số tiền từ ${formatCurrency(MIN_DEPOSIT_AMOUNT)} trở lên.`;
    return bot.sendMessage(msg.chat.id, minMsg);
  }

  if (pendingPurchase) {
    const missingAmount = pendingPurchase.totalPrice - (Number(user.balance) || 0);
    if (amount < missingAmount) {
      const notEnoughMsg = lang === 'en'
        ? `❌ Deposit amount not enough for purchase.\n\n` +
        `💰 Need: ${formatCurrency(missingAmount)}\n` +
        `💰 You entered: ${formatCurrency(amount)}\n` +
        `💡 Please deposit at least ${formatCurrency(missingAmount)} to complete purchase.`
        : `❌ Số tiền nạp không đủ để mua sản phẩm.\n\n` +
        `💰 Cần nạp: ${formatCurrency(missingAmount)}\n` +
        `💰 Bạn đã nhập: ${formatCurrency(amount)}\n` +
        `💡 Vui lòng nạp ít nhất ${formatCurrency(missingAmount)} để hoàn tất mua hàng.`;
      return bot.sendMessage(msg.chat.id, notEnoughMsg);
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

  let caption = lang === 'en'
    ? `Deposit request created: ${formatCurrency(amount)}.\n\n` +
    `🏦 Bank: **${bankDisplayName}**\n` +
    `💳 Account: \`${accountNo}\` (Click to copy)\n` +
    `📝 Content: \`${content}\` (Click to copy)\n\n` +
    `⚠️ **NOTE:** Please enter the exact transfer content for auto-credit. QR expires in 5 minutes.`
    : `Đã tạo yêu cầu nạp ${formatCurrency(amount)}.\n\n` +
    `🏦 Ngân hàng: **${bankDisplayName}**\n` +
    `💳 Số TK: \`${accountNo}\` (Click để copy)\n` +
    `📝 Nội dung: \`${content}\` (Click để copy)\n\n` +
    `⚠️ **LƯU Ý:** Vui lòng nhập đúng nội dung chuyển khoản để được cộng tiền tự động. QR hết hạn sau 5 phút.`;

  if (promotionResult.bonusAmount > 0) {
    if (lang === 'en') {
      caption += `\n\n🎁 **PROMOTION:** Deposit ${formatCurrency(amount)} get extra ${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)`;
      caption += `\n💵 **Total received: ${formatCurrency(promotionResult.finalAmount)}**`;
    } else {
      caption += `\n\n🎁 **KHUYẾN MẠI:** Nạp ${formatCurrency(amount)} nhận thêm ${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)`;
      caption += `\n💵 **Tổng thực nhận: ${formatCurrency(promotionResult.finalAmount)}**`;
    }
  }

  const confirmBtn = lang === 'en' ? '✅ I have transferred' : '✅ Tôi đã chuyển khoản';
  const cancelBtn = lang === 'en' ? '❌ Cancel QR' : '❌ Huỷ QR';

  const qrMessage = await bot.sendPhoto(msg.chat.id, qrUrl, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: confirmBtn, callback_data: createCallbackData({ action: 'check_payment' }) }],
        [{ text: cancelBtn, callback_data: createCallbackData({ action: 'cancel_qr' }) }]
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

  const { notifyAdminAboutDeposit, getAdminIds } = await import('./handleNotify.js');
  const adminIds = await getAdminIds([]);
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
