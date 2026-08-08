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
const QR_DURATION_MS = 5 * 60 * 1000;
const QR_CACHE_TTL_MS = 6 * 60 * 1000;

// Helper for 3-lang text
const L = (lang, vi, en, zh) => ({ en, zh }[lang] || vi);

const bankNotConfiguredMessage = (lang) => L(
  lang,
  'Hiện tại admin chưa cài đặt thông tin ngân hàng. Vui lòng quay lại sau hoặc liên hệ admin để được hỗ trợ.',
  'Bank transfer is not configured by the admin yet. Please try again later or contact the admin for support.',
  '管理员尚未配置银行转账信息。请稍后再试或联系管理员。'
);

const isBankConfigured = (bankConfig) => Boolean(
  String(bankConfig?.bankCode || '').trim() &&
  String(bankConfig?.accountNo || '').trim()
);

const buildQrUrl = (bankCode, accountNo, amount, content, accountName = null) => {
  let url = `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(content)}`;
  if (accountName) {
    url += `&accountName=${encodeURIComponent(accountName)}`;
  }
  return url;
};

// Helper to get Bank Settings for QR
const getBankConfig = async (defaultConfig, bank) => {
  try {
    const keys = [
      'vietqr_account_name',
      'viettel_account',
      'vcb_account',
      'vietqr_account_no',
      'tpb_account',
      'mb_account',
      'acb_account',
      'tcb_account',
      'vp_account',
      'timo_account',
      'vietqr_bank_code'
    ];
    const rows = await query(`SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (${keys.map(k => `'${k}'`).join(',')})`);
    const dbConfig = {};
    if (Array.isArray(rows)) {
      rows.forEach(r => {
        dbConfig[r.key] = r.value;
      });
    }

    const accountName = dbConfig.vietqr_account_name || defaultConfig.VIETQR_ACCOUNT_NAME || '';

    if (bank === 'viettel') {
      return {
        bankCode: 'VIETTELMONEY',
        accountNo: dbConfig.viettel_account || dbConfig.vietqr_account_no || '',
        accountName
      };
    }

    let bankCode = 'VCB';
    let accountNo = '';

    if (bank === 'vcb') {
      bankCode = 'VCB';
      accountNo = dbConfig.vcb_account || dbConfig.vietqr_account_no || '';
    } else if (bank === 'tpb') {
      bankCode = 'TPB';
      accountNo = dbConfig.tpb_account || dbConfig.vietqr_account_no || '';
    } else if (bank === 'mb') {
      bankCode = 'MB';
      accountNo = dbConfig.mb_account || dbConfig.vietqr_account_no || '';
    } else if (bank === 'acb') {
      bankCode = 'ACB';
      accountNo = dbConfig.acb_account || dbConfig.vietqr_account_no || '';
    } else if (bank === 'tcb') {
      bankCode = 'TCB';
      accountNo = dbConfig.tcb_account || dbConfig.vietqr_account_no || '';
    } else if (bank === 'vp') {
      bankCode = 'VPB';
      accountNo = dbConfig.vp_account || dbConfig.vietqr_account_no || '';
    } else if (bank === 'timo') {
      bankCode = 'TIMO';
      accountNo = dbConfig.timo_account || dbConfig.vietqr_account_no || '';
    } else {
      bankCode = dbConfig.vietqr_bank_code || 'VCB';
      accountNo = dbConfig.vietqr_account_no || '';
    }

    return { bankCode, accountNo, accountName };
  } catch (e) {
    return {
      bankCode: bank === 'vp' ? 'VPB' : bank.toUpperCase(),
      accountNo: '',
      accountName: defaultConfig.VIETQR_ACCOUNT_NAME || ''
    };
  }
}

export const startDepositFlow = async (bot, msg, user, config) => {
  const { t } = await import('../helpers/langHelper.js');
  const lang = user?.language || 'vi';

  const bankLabel = L(lang, '🏦 Ngân hàng (Bank)', '🏦 Bank Transfer', '🏦 银行转账');
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
      if (existing.depositId) await updateDepositStatus(existing.depositId, 'rejected');
      delCache(qrKey(userId));
      if (existing.token) delCache(contentKey(existing.token));
      const expiredMsg = L(lang,
        'QR cũ đã hết hạn. Bạn có thể tạo nạp mới.',
        'Old QR has expired. You can create a new deposit.',
        'QR 已过期，您可以创建新的充值。'
      );
      await bot.sendMessage(chatId, expiredMsg);
    } else {
      const ttlSec = Math.ceil((existing.expiresAt - Date.now()) / 1000);
      const waitingMsg = L(lang,
        `Bạn đã có QR đang chờ (còn ${ttlSec}s). Số tiền: ${formatCurrency(existing.amount)}`,
        `You have a pending QR (${ttlSec}s left). Amount: ${formatCurrency(existing.amount)}`,
        `您已有待处理的 QR（剩余 ${ttlSec}秒）。金额: ${formatCurrency(existing.amount)}`
      );
      return bot.sendMessage(chatId, waitingMsg);
    }
  }

  // Load active_bank from database setting
  let activeBank = 'viettel';
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'active_bank'");
    if (rows?.[0]?.value) {
      activeBank = rows[0].value;
    }
  } catch (e) {
    console.error('Error fetching active_bank setting:', e);
  }

  const bankConfig = await getBankConfig(config, activeBank);
  if (!isBankConfigured(bankConfig)) {
    return bot.sendMessage(chatId, bankNotConfiguredMessage(lang));
  }

  setCache(`bank_selection_${userId}`, activeBank, 15 * 60 * 1000);

  // Directly ask for amount
  const promptMsg = L(lang,
    'Nhập số tiền cần nạp (VNĐ):',
    'Enter deposit amount (VND):',
    '请输入充值金额（越南盾）：'
  );
  await bot.sendMessage(chatId, promptMsg);
};

export const selectBankMethod = async (bot, chatId, userId, bank) => {
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const user = await getUserByTelegram(userId);
  const lang = user?.language || 'vi';

  const bankConfig = await getBankConfig(globalConfig, bank);
  if (!isBankConfigured(bankConfig)) {
    return bot.sendMessage(chatId, bankNotConfiguredMessage(lang));
  }

  setCache(`bank_selection_${userId}`, bank, 15 * 60 * 1000);

  const promptMsg = L(lang,
    'Nhập số tiền cần nạp (VNĐ):',
    'Enter deposit amount (VND):',
    '请输入充值金额（越南盾）：'
  );
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
  const user = await getUserByTelegram(chatId);
  const lang = user ? user.language : 'vi';

  // Only TRC20 option now
  const inline_keyboard = [
    [{ text: L(lang, '💎 Ví TRC20 (Tự động)', '💎 TRC20 Wallet (Auto)', '💎 TRC20 钱包（自动）'), callback_data: createCallbackData({ action: 'deposit_usdt_trc20' }) }]
  ];

  const menuTitle = L(lang,
    '💲 **Nạp tiền USDT**\n\nChọn phương thức:',
    '💲 **USDT Deposit**\n\nChoose deposit method:',
    '💲 **USDT 充值**\n\n选择充值方式：'
  );

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
  setCache(`waiting_usdt_amount_${userId}`, true, 15 * 60 * 1000);

  const promptMsg = L(lang,
    '💲 **Nhập số tiền USDT** (tối thiểu 1$):',
    '💲 **Enter USDT amount** (minimum 1$):',
    '💲 **输入 USDT 金额**（最低 1$）：'
  );

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
    const errorMsg = L(lang,
      '❌ Số tiền không hợp lệ. Vui lòng nhập ít nhất 1 USDT.',
      '❌ Invalid amount. Please enter at least 1 USDT.',
      '❌ 金额无效，请输入至少 1 USDT。'
    );
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
    `💵 **${L(lang, 'Số tiền', 'Amount', '金额')}:** ${amount} USDT\n\n` +
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
  const user = await getUserByTelegram(userId);

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
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const user = await getUserByTelegram(chatId);
  const lang = user?.language || 'vi';

  const message = L(lang,
    `💲 **Nạp tiền qua Ví USDT**\n\n🌐 Mạng lưới (Network): **${usdtConfig.network}**\n💼 Địa chỉ ví:\n\`${usdtConfig.walletAddress}\`\n(Click để copy)\n\n⚠️ **Lưu ý:**\n• Vui lòng chuyển đúng mạng lưới **${usdtConfig.network}**.\n• Sau khi chuyển xong, vui lòng chụp ảnh hoá đơn và liên hệ Admin để được cộng tiền.`,
    `💲 **Deposit via USDT Wallet**\n\n🌐 Network: **${usdtConfig.network}**\n💼 Wallet Address:\n\`${usdtConfig.walletAddress}\`\n(Click to copy)\n\n⚠️ **Note:**\n• Please use the correct network **${usdtConfig.network}**.\n• After transfer, please screenshot the receipt and contact Admin for credit.`,
    `💲 **通过 USDT 钱包充值**\n\n🌐 网络: **${usdtConfig.network}**\n💼 钱包地址:\n\`${usdtConfig.walletAddress}\`\n(点击复制)\n\n⚠️ **注意：**\n• 请使用正确的网络 **${usdtConfig.network}**。\n• 转账完成后，请截图收据并联系管理员充值。`
  );

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
    const errorMsg = L(lang,
      '❌ Chưa cấu hình địa chỉ ví TRC20. Vui lòng liên hệ Admin.',
      '❌ TRC20 wallet address not configured. Please contact admin.',
      '❌ TRC20 钱包地址未配置，请联系管理员。'
    );
    return bot.sendMessage(chatId, errorMsg);
  }

  // Store state: waiting for amount
  setCache(`waiting_trc20_amount_${userId}`, true, 15 * 60 * 1000);

  const message = L(lang,
    `💎 **Nạp tiền USDT TRC20**\n\n📍 **Địa chỉ ví:**\n\`${walletAddress}\`\n(Click để copy)\n\n🌐 **Mạng:** TRC20 (TRON)\n\n⚠️ **LƯU Ý QUAN TRỌNG:**\n• Hệ thống đang sử dụng **OKX** để xử lý nạp tiền tự động.\n• Nếu bạn dùng **OKX** để nạp, vui lòng liên hệ admin @tlshop25 để duyệt.\n• Ví khác: Hoàn toàn tự động (không cần duyệt).\n\n💲 **Nhập số tiền USDT** (tối thiểu 1 USDT):`,
    `� **USDT TRC20 Deposit**\n\n�📍 **Wallet Address:**\n\`${walletAddress}\`\n(Click to copy)\n\n🌐 **Network:** TRC20 (TRON)\n\n⚠️ **IMPORTANT NOTICE:**\n• Our system uses **OKX** for automatic deposit processing.\n• If you are using **OKX** to deposit, please contact admin @tlshop25 for approval.\n• Other wallets: Fully automatic (no approval needed).\n\n💲 **Enter USDT amount** (minimum 1 USDT):`,
    `💎 **USDT TRC20 充值**\n\n📍 **钱包地址：**\n\`${walletAddress}\`\n(点击复制)\n\n🌐 **网络：** TRC20 (TRON)\n\n⚠️ **重要提示：**\n• 系统使用 **OKX** 自动处理充值。\n• 如果您使用 **OKX** 充值，请联系管理员 @tlshop25 审核。\n• 其他钱包：完全自动（无需审核）。\n\n💲 **输入 USDT 金额**（最低 1 USDT）：`
  );

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      resize_keyboard: true,
      keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
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
  if (text === '❌ Hủy' || text === '❌ Cancel' || text === '❌ 取消') {
    delCache(`waiting_trc20_amount_${userId}`);
    await bot.sendMessage(msg.chat.id, L(lang, '❌ Đã hủy.', '❌ Cancelled.', '❌ 已取消。'), {
      reply_markup: { remove_keyboard: true }
    });
    return true;
  }

  const amount = parseFloat(text.replace(',', '.'));

  if (isNaN(amount) || amount < 1) {
    const errorMsg = L(lang,
      '❌ Số tiền không hợp lệ. Vui lòng nhập ít nhất 1 USDT.',
      '❌ Invalid amount. Please enter at least 1 USDT.',
      '❌ 金额无效，请输入至少 1 USDT。'
    );
    await bot.sendMessage(msg.chat.id, errorMsg);
    return true;
  }

  delCache(`waiting_trc20_amount_${userId}`);

  // Store amount and wait for hash
  setCache(`trc20_amount_${userId}`, amount, 15 * 60 * 1000);
  setCache(`waiting_trc20_hash_${userId}`, true, 15 * 60 * 1000);

  const promptMsg = L(lang,
    `💵 **Số tiền:** ${amount} USDT\n\n📝 **Nhập mã giao dịch (Hash/TxID):**\n\n⚠️ **Lưu ý:** Nhập ĐÚNG số tiền thực nhận (sau khi trừ phí mạng).\nXem ảnh bên dưới để biết cách tìm TxID.`,
    `💵 **Amount:** ${amount} USDT\n\n📝 **Enter your transaction hash (TxID):**\n\n⚠️ **Important:** Enter the EXACT amount received (after network fees).\nSee the image below for how to find your TxID.`,
    `💵 **金额：** ${amount} USDT\n\n📝 **输入交易哈希（TxID）：**\n\n⚠️ **注意：** 请输入实际收到的准确金额（扣除网络手续费后）。\n查看下方图片了解如何找到 TxID。`
  );

  // Send text message first
  await bot.sendMessage(msg.chat.id, promptMsg, {
    parse_mode: 'Markdown',
    reply_markup: {
      resize_keyboard: true,
      keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
    }
  });

  // Send guide image
  try {
    const path = await import('path');
    const fs = await import('fs');
    const imagePath = path.join(process.cwd(), 'img', '0a08ecfdf6045f969d46dc695ce902c9.png');
    if (fs.existsSync(imagePath)) {
      await bot.sendPhoto(msg.chat.id, imagePath, {
        caption: L(lang, '👆 Cách tìm mã TxID', '👆 How to find your TxID', '👆 如何找到 TxID')
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
  if (text === '❌ Hủy' || text === '❌ Cancel' || text === '❌ 取消') {
    delCache(`waiting_trc20_hash_${userId}`);
    delCache(`trc20_amount_${userId}`);
    await bot.sendMessage(msg.chat.id, L(lang, '❌ Đã hủy.', '❌ Cancelled.', '❌ 已取消。'), {
      reply_markup: { remove_keyboard: true }
    });
    return true;
  }

  const txHash = text;
  const expectedAmount = getCache(`trc20_amount_${userId}`);

  if (!expectedAmount) {
    delCache(`waiting_trc20_hash_${userId}`);
    const errorMsg = L(lang,
      '❌ Phiên đã hết hạn. Vui lòng thực hiện lại.',
      '❌ Session expired. Please start again.',
      '❌ 会话已过期，请重新开始。'
    );
    await bot.sendMessage(msg.chat.id, errorMsg, { reply_markup: { remove_keyboard: true } });
    return true;
  }

  // Show processing message
  const processingMsg = await bot.sendMessage(msg.chat.id, L(lang,
    '⏳ Đang xác minh giao dịch...',
    '⏳ Verifying transaction...',
    '⏳ 正在验证交易...'
  ));

  try {
    // Check if hash already used
    const { findDepositByTxHash, createTrc20Deposit } = await import('../controllers/depositController.js');
    const existingDeposit = await findDepositByTxHash(txHash);

    if (existingDeposit) {
      delCache(`waiting_trc20_hash_${userId}`);
      delCache(`trc20_amount_${userId}`);
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = L(lang,
        '❌ Mã giao dịch này đã được sử dụng.',
        '❌ This transaction hash has already been used.',
        '❌ 此交易哈希已被使用。'
      );
      await bot.sendMessage(msg.chat.id, errorMsg, { reply_markup: { remove_keyboard: true } });
      return true;
    }

    // Verify via Tronscan API
    const response = await fetch(`https://apilist.tronscan.org/api/transaction-info?hash=${txHash}`);
    const data = await response.json();

    // Check if transaction exists and is confirmed
    if (!data || !data.confirmed) {
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = L(lang,
        '❌ Không tìm thấy giao dịch hoặc chưa được xác nhận. Vui lòng đợi và thử lại.',
        '❌ Transaction not found or not confirmed yet. Please wait and try again.',
        '❌ 未找到交易或尚未确认，请等待并重试。'
      );
      await bot.sendMessage(msg.chat.id, errorMsg, {
        reply_markup: {
          resize_keyboard: true,
          keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
        }
      });
      return true;
    }

    // Check TRC20 transfer info
    const trc20Info = data.trc20TransferInfo?.[0];
    if (!trc20Info || trc20Info.symbol !== 'USDT') {
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = L(lang,
        '❌ Đây không phải là giao dịch USDT TRC20.',
        '❌ This is not a USDT TRC20 transaction.',
        '❌ 这不是 USDT TRC20 交易。'
      );
      await bot.sendMessage(msg.chat.id, errorMsg, {
        reply_markup: {
          resize_keyboard: true,
          keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
        }
      });
      return true;
    }

    // Verify recipient address matches our wallet
    const ourWallet = await getTrc20WalletAddress();
    if (trc20Info.to_address.toLowerCase() !== ourWallet.toLowerCase()) {
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = L(lang,
        '❌ Địa chỉ nhận không khớp với ví của chúng tôi.',
        '❌ The recipient address does not match our wallet.',
        '❌ 收款地址与我们的钱包不匹配。'
      );
      await bot.sendMessage(msg.chat.id, errorMsg, {
        reply_markup: {
          resize_keyboard: true,
          keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
        }
      });
      return true;
    }

    // Calculate USDT amount (divide by 10^6 for 6 decimals)
    const usdtAmount = Number(trc20Info.amount_str) / 1000000;

    // Verify amount matches expected amount exactly (user should enter amount after fees)
    if (Math.abs(usdtAmount - expectedAmount) > 0.01) {
      await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => { });
      const errorMsg = L(lang,
        `❌ Số tiền không khớp!\n\n📝 Bạn đã nhập: ${expectedAmount} USDT\n💰 Thực nhận: ${usdtAmount} USDT\n\n⚠️ Vui lòng nhập ĐÚNG số tiền hiển thị trong giao dịch (số tiền sau khi trừ phí mạng).`,
        `❌ Amount mismatch!\n\n📝 You entered: ${expectedAmount} USDT\n💰 Actual received: ${usdtAmount} USDT\n\n⚠️ Please enter the EXACT amount shown in your transaction (after network fees).`,
        `❌ 金额不匹配！\n\n📝 您输入: ${expectedAmount} USDT\n💰 实际收到: ${usdtAmount} USDT\n\n⚠️ 请输入交易中显示的准确金额（扣除网络手续费后）。`
      );
      await bot.sendMessage(msg.chat.id, errorMsg, {
        reply_markup: {
          resize_keyboard: true,
          keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
        }
      });
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
      await bot.sendMessage(msg.chat.id, L(lang, '❌ Không tìm thấy người dùng.', '❌ User not found.', '❌ 未找到用户。'), {
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

    const successMsg = L(lang,
      `✅ **Nạp tiền thành công!**\n\n💎 USDT: ${usdtAmount} USDT\n💵 VND: ${formatCurrency(amountVnd)}\n📝 TxID: \`${txHash.substring(0, 20)}...\`\n\n💰 Số dư mới: ${formatCurrency(newBalance)}`,
      `✅ **Deposit Successful!**\n\n💎 USDT: ${usdtAmount} USDT\n💵 VND: ${formatCurrency(amountVnd)}\n📝 TxID: \`${txHash.substring(0, 20)}...\`\n\n💰 New Balance: ${formatCurrency(newBalance)}`,
      `✅ **充值成功！**\n\n💎 USDT: ${usdtAmount} USDT\n💵 VND: ${formatCurrency(amountVnd)}\n📝 TxID: \`${txHash.substring(0, 20)}...\`\n\n💰 新余额: ${formatCurrency(newBalance)}`
    );

    await bot.sendMessage(msg.chat.id, successMsg, {
      parse_mode: 'Markdown',
      reply_markup: { remove_keyboard: true }
    });

    // Notify admin
    try {
      const { notifyAdminAboutDeposit, getAdminIds } = await import('./handleNotify.js');
      const adminIds = await getAdminIds(globalConfig?.ADMIN_IDS || []);
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
    const errorMsg = L(lang,
      '❌ Lỗi xác minh giao dịch. Vui lòng thử lại sau.',
      '❌ Error verifying transaction. Please try again later.',
      '❌ 验证交易出错，请稍后再试。'
    );
    await bot.sendMessage(msg.chat.id, errorMsg, {
      reply_markup: {
        resize_keyboard: true,
        keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
      }
    });
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
    const waitMsg = L(lang,
      'QR cũ chưa hết hạn, vui lòng chờ.',
      'Old QR not expired yet, please wait.',
      'QR 尚未过期，请等待。'
    );
    return bot.sendMessage(msg.chat.id, waitMsg);
  }

  // Get selected bank
  let selectedBank = getCache(`bank_selection_${msg.from.id}`);
  if (!selectedBank) {
    try {
      const rows = await query("SELECT `value` FROM settings WHERE `key` = 'active_bank'");
      if (rows?.[0]?.value) {
        selectedBank = rows[0].value;
      }
    } catch (e) {
      console.error('Error fetching active_bank setting:', e);
    }
    if (!selectedBank) {
      selectedBank = 'viettel';
    }
    setCache(`bank_selection_${msg.from.id}`, selectedBank, 15 * 60 * 1000);
  }

  const amount = Number(msg.text.replace(/\D/g, ''));
  if (!amount || amount <= 0) {
    const invalidMsg = L(lang, 'Số tiền không hợp lệ.', 'Invalid amount.', '金额无效。');
    return bot.sendMessage(msg.chat.id, invalidMsg);
  }

  const purchaseKey = `purchase_${msg.from.id}`;
  const pendingPurchase = getCache(purchaseKey);

  const MIN_DEPOSIT_AMOUNT = await getMinDepositAmount();
  if (!pendingPurchase && amount < MIN_DEPOSIT_AMOUNT) {
    const minMsg = L(lang,
      `❌ Số tiền nạp tối thiểu là ${formatCurrency(MIN_DEPOSIT_AMOUNT)}.\n\n💰 Bạn đã nhập: ${formatCurrency(amount)}\n💡 Vui lòng nhập số tiền từ ${formatCurrency(MIN_DEPOSIT_AMOUNT)} trở lên.`,
      `❌ Minimum deposit is ${formatCurrency(MIN_DEPOSIT_AMOUNT)}.\n\n💰 You entered: ${formatCurrency(amount)}\n💡 Please enter at least ${formatCurrency(MIN_DEPOSIT_AMOUNT)}.`,
      `❌ 最低充值金额为 ${formatCurrency(MIN_DEPOSIT_AMOUNT)}。\n\n💰 您输入: ${formatCurrency(amount)}\n💡 请输入至少 ${formatCurrency(MIN_DEPOSIT_AMOUNT)}。`
    );
    return bot.sendMessage(msg.chat.id, minMsg);
  }

  if (pendingPurchase) {
    const missingAmount = pendingPurchase.totalPrice - (Number(user.balance) || 0);
    if (amount < missingAmount) {
      const notEnoughMsg = L(lang,
        `❌ Số tiền nạp không đủ để mua sản phẩm.\n\n💰 Cần nạp: ${formatCurrency(missingAmount)}\n💰 Bạn đã nhập: ${formatCurrency(amount)}\n💡 Vui lòng nạp ít nhất ${formatCurrency(missingAmount)} để hoàn tất mua hàng.`,
        `❌ Deposit amount not enough for purchase.\n\n💰 Need: ${formatCurrency(missingAmount)}\n💰 You entered: ${formatCurrency(amount)}\n💡 Please deposit at least ${formatCurrency(missingAmount)} to complete purchase.`,
        `❌ 充值金额不足以购买。\n\n💰 需要: ${formatCurrency(missingAmount)}\n💰 您输入: ${formatCurrency(amount)}\n💡 请至少充值 ${formatCurrency(missingAmount)} 以完成购买。`
      );
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
  const bankConfig = await getBankConfig(config, selectedBank);
  if (!isBankConfigured(bankConfig)) {
    delCache(`bank_selection_${msg.from.id}`);
    return bot.sendMessage(msg.chat.id, bankNotConfiguredMessage(lang));
  }
  const bankCode = bankConfig.bankCode;
  const accountNo = bankConfig.accountNo;
  const accountName = bankConfig.accountName;

  const qrUrl = buildQrUrl(bankCode, accountNo, amount, content, accountName);
  const expiresAt = Date.now() + QR_DURATION_MS;
  const depositId = await createDeposit(user.id, amount, content);

  const bankNames = {
    viettel: 'ViettelPay',
    vcb: 'Vietcombank',
    tpb: 'TPBank',
    mb: 'MBBank',
    acb: 'ACB',
    tcb: 'Techcombank',
    vp: 'VPBank',
    timo: 'Timo'
  };
  const bankDisplayName = bankNames[selectedBank] || selectedBank.toUpperCase();

  let caption = L(lang,
    `Đã tạo yêu cầu nạp ${formatCurrency(amount)}.\n\n🏦 Ngân hàng: **${bankDisplayName}**\n💳 Số TK: \`${accountNo}\` (Click để copy)\n📝 Nội dung: \`${content}\` (Click để copy)\n\n⚠️ **LƯU Ý:** Vui lòng nhập đúng nội dung chuyển khoản để được cộng tiền tự động. QR hết hạn sau 5 phút.`,
    `Deposit request created: ${formatCurrency(amount)}.\n\n🏦 Bank: **${bankDisplayName}**\n💳 Account: \`${accountNo}\` (Click to copy)\n📝 Content: \`${content}\` (Click to copy)\n\n⚠️ **NOTE:** Please enter the exact transfer content for auto-credit. QR expires in 5 minutes.`,
    `已创建充值请求: ${formatCurrency(amount)}。\n\n🏦 银行: **${bankDisplayName}**\n💳 账号: \`${accountNo}\` (点击复制)\n📝 内容: \`${content}\` (点击复制)\n\n⚠️ **注意：** 请输入正确的转账内容以自动到账。QR 将在5分钟后过期。`
  );

  if (promotionResult.bonusAmount > 0) {
    caption += L(lang,
      `\n\n🎁 **KHUYẾN MẠI:** Nạp ${formatCurrency(amount)} nhận thêm ${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)\n💵 **Tổng thực nhận: ${formatCurrency(promotionResult.finalAmount)}**`,
      `\n\n🎁 **PROMOTION:** Deposit ${formatCurrency(amount)} get extra ${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)\n💵 **Total received: ${formatCurrency(promotionResult.finalAmount)}**`,
      `\n\n🎁 **优惠活动：** 充值 ${formatCurrency(amount)} 额外获得 ${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)\n💵 **总计获得: ${formatCurrency(promotionResult.finalAmount)}**`
    );
  }

  const confirmBtn = L(lang, '✅ Tôi đã chuyển khoản', '✅ I have transferred', '✅ 我已转账');
  const cancelBtn = L(lang, '❌ Huỷ QR', '❌ Cancel QR', '❌ 取消 QR');

  const qrMessage = await bot.sendPhoto(msg.chat.id, qrUrl, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: confirmBtn, callback_data: createCallbackData({ action: 'check_payment' }) }],
        [{ text: '🔄 Tải lại QR (1 lần)', callback_data: createCallbackData({ action: 'reload_qr' }) }],
        [{ text: cancelBtn, callback_data: createCallbackData({ action: 'cancel_qr' }) }]
      ]
    }
  });

  const qrState = { userId: user.id, depositId, amount, qrUrl, expiresAt, content, token, bank: selectedBank, messageId: qrMessage.message_id, chatId: msg.chat.id, reloadUsed: false };
  setCache(qrKey(msg.from.id), qrState, QR_CACHE_TTL_MS);
  setCache(contentKey(token), qrState, QR_CACHE_TTL_MS);
};

// Admin functions (Vietnamese-only, admin-facing)
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
  const lang = user?.language || 'vi';
  const finalBalance = Number(user.balance);

  let adminMessage = `✅ Đã duyệt nạp #${depositId}.\n💰 Số tiền gốc: ${formatCurrency(promotionResult.originalAmount)}`;
  if (promotionResult.bonusAmount > 0) {
    adminMessage += `\n🎁 Khuyến mại: +${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)`;
  }
  adminMessage += `\n💵 Tổng nhận: ${formatCurrency(promotionResult.finalAmount)}\n💵 Số dư mới của user: ${formatCurrency(finalBalance)}`;
  await bot.sendMessage(chatId, adminMessage);

  const { notifyAdminAboutDeposit, getAdminIds } = await import('./handleNotify.js');
  const adminIds = await getAdminIds(globalConfig?.ADMIN_IDS || []);
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
    let userMessage = L(lang,
      `✅ **Nạp tiền thành công!**\n\n💰 Số tiền gốc: ${formatCurrency(promotionResult.originalAmount)}`,
      `✅ **Deposit Successful!**\n\n💰 Original amount: ${formatCurrency(promotionResult.originalAmount)}`,
      `✅ **充值成功！**\n\n💰 原始金额: ${formatCurrency(promotionResult.originalAmount)}`
    );
    if (promotionResult.bonusAmount > 0) {
      userMessage += L(lang,
        `\n🎁 **Khuyến mại: +${formatCurrency(promotionResult.bonusAmount)}** (${promotion.bonus_percentage}%)`,
        `\n🎁 **Bonus: +${formatCurrency(promotionResult.bonusAmount)}** (${promotion.bonus_percentage}%)`,
        `\n🎁 **优惠: +${formatCurrency(promotionResult.bonusAmount)}** (${promotion.bonus_percentage}%)`
      );
    }
    userMessage += L(lang,
      `\n💵 **Tổng nhận: ${formatCurrency(promotionResult.finalAmount)}**\n💵 Số dư mới: ${formatCurrency(finalBalance)}\n📝 Mã giao dịch: #${depositId}`,
      `\n💵 **Total received: ${formatCurrency(promotionResult.finalAmount)}**\n💵 New balance: ${formatCurrency(finalBalance)}\n📝 Transaction ID: #${depositId}`,
      `\n� **总计获得: ${formatCurrency(promotionResult.finalAmount)}**\n💵 新余额: ${formatCurrency(finalBalance)}\n📝 交易编号: #${depositId}`
    );
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

export const reloadQr = async (bot, chatId, from) => {
  const cache = getCache(qrKey(from.id));
  if (!cache) return bot.sendMessage(chatId, 'QR đã hết hạn hoặc không còn tồn tại.');
  if (cache.reloadUsed) return bot.sendMessage(chatId, 'Bạn đã dùng lượt tải lại QR. Vui lòng thanh toán trước khi QR hết hạn.');

  const deposit = cache.depositId ? await getDeposit(cache.depositId) : null;
  if (!deposit || deposit.status !== 'pending' || cache.expiresAt < Date.now()) {
    if (deposit?.status === 'pending') await updateDepositStatus(cache.depositId, 'rejected');
    await deleteQrMessage(bot, cache);
    delCache(qrKey(from.id));
    if (cache.token) delCache(contentKey(cache.token));
    return bot.sendMessage(chatId, 'QR đã hết hạn và yêu cầu nạp đã được hủy.');
  }

  // Khóa lượt reload ngay để hai lần bấm liên tiếp không tạo hai QR.
  const locked = { ...cache, reloadUsed: true };
  setCache(qrKey(from.id), locked, QR_CACHE_TTL_MS);
  setCache(contentKey(cache.token), locked, QR_CACHE_TTL_MS);
  await deleteQrMessage(bot, cache);
  const expiresAt = Date.now() + QR_DURATION_MS;
  const qrMessage = await bot.sendPhoto(chatId, cache.qrUrl, {
    caption: `🔄 **QR ĐÃ ĐƯỢC TẢI LẠI**\n\n💰 Số tiền: ${formatCurrency(cache.amount)}\n📝 Nội dung: \`${cache.content}\`\n\n⏱ QR có hiệu lực thêm 5 phút. Đây là lượt tải lại duy nhất.`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Tôi đã chuyển khoản', callback_data: createCallbackData({ action: 'check_payment' }) }],
        [{ text: '❌ Hủy QR', callback_data: createCallbackData({ action: 'cancel_qr' }) }]
      ]
    }
  });

  const refreshed = { ...cache, expiresAt, reloadUsed: true, messageId: qrMessage.message_id, chatId };
  setCache(qrKey(from.id), refreshed, QR_CACHE_TTL_MS);
  setCache(contentKey(cache.token), refreshed, QR_CACHE_TTL_MS);
};

export const cancelQr = async (bot, chatId, from) => {
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const dbUser = await getUserByTelegram(from.id);
  const lang = dbUser?.language || 'vi';
  const cancelCount = getCache(qrCancelKey(from.id)) || 0;
  if (cancelCount >= 3) return bot.sendMessage(chatId, L(lang, 'Bạn huỷ quá nhiều, chờ 1 phút rồi thử lại.', 'Too many cancellations, wait 1 minute.', '取消次数过多，请等待1分钟。'));

  const cache = getCache(qrKey(from.id));
  if (!cache) return bot.sendMessage(chatId, L(lang, 'Không có QR đang chờ.', 'No pending QR.', '没有待处理的 QR。'));

  await deleteQrMessage(bot, cache);

  setCache(qrCancelKey(from.id), cancelCount + 1, 60 * 1000);
  delCache(qrKey(from.id));
  if (cache.token) delCache(contentKey(cache.token));
  if (cache.depositId) await updateDepositStatus(cache.depositId, 'rejected');
  await bot.sendMessage(chatId, L(lang, 'Đã huỷ QR. Bạn có thể tạo lại sau ít phút.', 'QR cancelled. You can create a new one shortly.', 'QR 已取消。您稍后可以重新创建。'));

  // Re-send menu
  try {
    const { sendMenu } = await import('./handleUser.js');
    await sendMenu(bot, chatId, dbUser || { telegram_id: from.id, language: 'vi' });
  } catch (e) { }
};

export const deleteQrMessage = async (bot, cache) => {
  if (cache && cache.messageId && cache.chatId) {
    try {
      await bot.deleteMessage(cache.chatId, cache.messageId);
    } catch (err) {
    }
  }
};
