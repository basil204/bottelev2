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

export const getDepositButtonsConfig = async () => {
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'deposit_menu_buttons_config' LIMIT 1");
    if (rows && rows.length > 0 && rows[0].value) {
      const parsed = JSON.parse(rows[0].value);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [
    { id: 'btn_dep_bank', text: '🏦 Ngân hàng (Bank)', text_vi: '🏦 Ngân hàng (Bank)', text_en: '🏦 Bank Transfer', text_zh: '🏦 银行转账', type: 'callback', callback_data: 'deposit_select_bank', row: 1, is_active: true },
    { id: 'btn_dep_binance', text: '🟡 Binance Pay (Tự động)', text_vi: '🟡 Binance Pay (Tự động)', text_en: '🟡 Binance Pay (Auto)', text_zh: '🟡 币安支付 (自动)', type: 'callback', callback_data: 'deposit_select_binance', row: 2, is_active: true },
    { id: 'btn_dep_usdt', text: '💲 USDT TRC20', text_vi: '💲 USDT TRC20', text_en: '💲 USDT TRC20', text_zh: '💲 USDT TRC20', type: 'callback', callback_data: 'deposit_select_usdt', row: 3, is_active: true }
  ];
};

export const startDepositFlow = async (bot, msg, user, config) => {
  const { t } = await import('../helpers/langHelper.js');
  const { formatReplyMarkup } = await import('../helpers/telegramFormatHelper.js');
  const lang = user?.language || 'vi';

  const buttons = await getDepositButtonsConfig();
  const activeButtons = buttons.filter(b => b.is_active !== false);
  const rowsMap = {};
  activeButtons.forEach(btn => {
    const r = Number(btn.row) || 1;
    if (!rowsMap[r]) rowsMap[r] = [];
    const label = (lang === 'en' && btn.text_en) || (lang === 'zh' && btn.text_zh) || btn.text_vi || btn.text;
    if (btn.type === 'url' && btn.url) {
      rowsMap[r].push({ text: label, url: btn.url });
    } else {
      const cb = btn.callback_data || 'deposit_select_bank';
      const cbData = cb.startsWith('{') ? cb : createCallbackData({ action: cb });
      rowsMap[r].push({ text: label, callback_data: cbData });
    }
  });

  const inline_keyboard = Object.keys(rowsMap)
    .sort((a, b) => Number(a) - Number(b))
    .map(r => rowsMap[r]);

  const defaultFallback = [
    [{ text: L(lang, 'Ngân hàng (Bank)', 'Bank Transfer', '银行转账'), callback_data: createCallbackData({ action: 'deposit_select_bank' }) }],
    [{ text: 'Binance Pay (Tự động)', callback_data: createCallbackData({ action: 'deposit_select_binance' }) }],
    [{ text: 'USDT TRC20', callback_data: createCallbackData({ action: 'deposit_select_usdt' }) }]
  ];

  const title = t('deposit_menu_title', lang);

  await bot.sendMessage(msg.chat.id, title, {
    parse_mode: 'Markdown',
    reply_markup: formatReplyMarkup({
      inline_keyboard: inline_keyboard.length > 0 ? inline_keyboard : defaultFallback
    })
  });
};

export const showBinanceDepositInfo = async (bot, chatId, userId, config, messageId = null) => {
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const { getBinanceConfig } = await import('../services/binanceService.js');
  const { markdownToTelegramHtml, formatReplyMarkup } = await import('../helpers/telegramFormatHelper.js');
  const user = await getUserByTelegram(userId);
  const lang = user ? user.language : 'vi';

  const binanceConf = await getBinanceConfig();
  const payId = binanceConf?.payId || '464811318';
  const exchangeRate = binanceConf?.exchangeRate || 26000;
  const minDeposit = binanceConf?.minDeposit || 1;
  const memoCode = `NAP ${userId}`;

  const { getBotTemplate, renderBotTemplate } = await import('../helpers/templateHelper.js');
  const rawTemplate = await getBotTemplate('template_binance_pay', lang);

  const rawMessage = renderBotTemplate(rawTemplate, {
    userId,
    exchangeRate: Number(exchangeRate).toLocaleString('vi-VN'),
    minDeposit,
    payId,
    memoCode
  });

  const htmlMessage = markdownToTelegramHtml(rawMessage);

  const reply_markup = formatReplyMarkup({
    inline_keyboard: [
      [{ text: 'Kiểm tra thanh toán ngay', callback_data: createCallbackData({ action: 'check_binance_payment' }) }],
      [{ text: 'Quay lại Menu Nạp', callback_data: createCallbackData({ action: 'back_to_deposit_options' }) }]
    ]
  });

  if (messageId) {
    try {
      return await bot.editMessageText(htmlMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup
      });
    } catch (e) {}
  }

  await bot.sendMessage(chatId, htmlMessage, {
    parse_mode: 'HTML',
    reply_markup
  });
};

export const checkBinancePaymentForUser = async (bot, chatId, userId, config) => {
  const { fetchBinancePayTransactions, processBinancePayTransaction, getBinanceConfig } = await import('../services/binanceService.js');
  
  const binanceConf = await getBinanceConfig();
  if (!binanceConf || !binanceConf.apiKey || !binanceConf.secretKey) {
    return bot.sendMessage(chatId, '⚠️ Hệ thống chưa kích hoạt API Key Binance. Vui lòng liên hệ Admin hỗ trợ.');
  }

  await bot.sendMessage(chatId, '🔍 Đang kiểm tra giao dịch Binance Pay của bạn...');

  try {
    const startTime = Date.now() - 24 * 60 * 60 * 1000;
    const transactions = await fetchBinancePayTransactions(binanceConf, startTime);
    let matched = 0;

    if (Array.isArray(transactions) && transactions.length > 0) {
      for (const tx of transactions) {
        const result = await processBinancePayTransaction(tx, bot);
        if (result && String(result.telegramId) === String(userId)) {
          matched++;
        }
      }
    }

    if (matched === 0) {
      await bot.sendMessage(
        chatId,
        `⏳ **Chưa tìm thấy giao dịch nạp mới của bạn.**\n\n` +
        `👉 Vui lòng đảm bảo bạn đã chuyển đến Binance Pay ID: \`${binanceConf.payId}\` và nhập đúng ghi chú: \`NAP ${userId}\`.\n` +
        `Nếu bạn vừa chuyển, vui lòng chờ 10-30 giây rồi bấm kiểm tra lại.`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (err) {
    console.error('[CHECK_BINANCE_PAYMENT] Error:', err.message);
    await bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi kiểm tra giao dịch. Vui lòng thử lại sau giây lát.');
  }
};

export const showUsdtOptions = async (bot, chatId, config) => {
  const { t } = await import('../helpers/langHelper.js');
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const user = await getUserByTelegram(chatId);
  const lang = user ? user.language : 'vi';

  const inline_keyboard = [
    [{ text: '🟡 Binance Pay (Tự động)', callback_data: createCallbackData({ action: 'deposit_select_binance' }) }],
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

// ========== TRC20 USDT DEPOSIT FLOW (CHECK QUA BINANCE) ==========

// Get TRC20 wallet address from settings or Binance API
const getTrc20WalletAddress = async () => {
  try {
    const { getBinanceDepositAddress } = await import('../services/binanceService.js');
    const res = await getBinanceDepositAddress('USDT', 'TRX');
    if (res?.address) return res.address;

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

// Start TRC20 deposit flow - show wallet and prompt for TxID or Amount
export const showTrc20DepositFlow = async (bot, chatId, userId, config, messageId = null) => {
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const { markdownToTelegramHtml, formatReplyMarkup } = await import('../helpers/telegramFormatHelper.js');
  const user = await getUserByTelegram(userId);
  const lang = user?.language || 'vi';

  const walletAddress = await getTrc20WalletAddress();

  if (!walletAddress) {
    const errorMsg = L(lang,
      '❌ Chưa cấu hình địa chỉ ví USDT TRC20. Vui lòng cấu hình API Key Binance hoặc ví TRC20 trong Web Admin.',
      '❌ USDT TRC20 wallet not configured. Please configure Binance API Key or TRC20 wallet in Web Admin.',
      '❌ 未配置 USDT TRC20 钱包地址。请在 Web 管理后台配置 Binance API 或 TRC20 钱包。'
    );
    return bot.sendMessage(chatId, errorMsg);
  }

  // Set cache waiting for TxID / Hash directly or Amount
  setCache(`waiting_trc20_hash_${userId}`, true, 30 * 60 * 1000);

  const exchangeRate = await getExchangeRate();
  const { getBotTemplate, renderBotTemplate } = await import('../helpers/templateHelper.js');
  const rawTemplate = await getBotTemplate('template_usdt_deposit', lang);
  const rawMessage = renderBotTemplate(rawTemplate, {
    walletAddress,
    exchangeRate: Number(exchangeRate).toLocaleString('vi-VN')
  });

  const inline_keyboard = [
    [{ text: '🔍 Kiểm tra giao dịch vừa nạp', callback_data: createCallbackData({ action: 'check_recent_trc20' }) }],
    [{ text: '↩️ Quay lại Menu Nạp', callback_data: createCallbackData({ action: 'back_to_deposit_options' }) }]
  ];

  const htmlMessage = markdownToTelegramHtml(rawMessage) + 
    `\n\n👉 <i>Sau khi chuyển tiền xong, bạn chỉ cần copy <b>Mã giao dịch (TxID / Hash)</b> gửi trực tiếp vào tin nhắn này để hệ thống kiểm tra và tự động cộng tiền ngay!</i>`;

  if (messageId) {
    try {
      return await bot.editMessageText(htmlMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: formatReplyMarkup({ inline_keyboard })
      });
    } catch (e) {}
  }

  await bot.sendMessage(chatId, htmlMessage, {
    parse_mode: 'HTML',
    reply_markup: formatReplyMarkup({
      inline_keyboard,
      resize_keyboard: true,
      keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
    })
  });
};

// Handle TRC20 amount input (optional amount pre-check)
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
  setCache(`trc20_amount_${userId}`, amount, 30 * 60 * 1000);
  setCache(`waiting_trc20_hash_${userId}`, true, 30 * 60 * 1000);

  const promptMsg = L(lang,
    `💵 **Số tiền dự kiến:** ${amount} USDT\n\n📝 **Vui lòng gửi Mã giao dịch (Hash / TxID) của bạn vào đây:**\n\n⚠️ Hệ thống Binance sẽ quét blockchain và tự động cộng tiền ngay sau khi xác nhận.`,
    `💵 **Expected Amount:** ${amount} USDT\n\n📝 **Please send your Transaction Hash (TxID) here:**\n\n⚠️ Binance will verify on-chain and credit balance automatically.`,
    `💵 **预计金额：** ${amount} USDT\n\n📝 **请在此发送您的交易哈希（TxID）：**\n\n⚠️ Binance 系统将在区块链确认后自动为您充值。`
  );

  await bot.sendMessage(msg.chat.id, promptMsg, {
    parse_mode: 'Markdown',
    reply_markup: {
      resize_keyboard: true,
      keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
    }
  });

  return true;
};

// Handle TRC20 hash input and verify via Binance API (with Tronscan fallback)
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

  // Bỏ qua nếu tin nhắn là một lệnh bot
  if (text.startsWith('/')) return false;

  const txHash = text;
  const expectedAmount = getCache(`trc20_amount_${userId}`) || null;

  // Show processing message
  const processingMsg = await bot.sendMessage(msg.chat.id, L(lang,
    '⏳ **Đang kết nối Binance & kiểm tra giao dịch On-Chain TRC20 của bạn...**',
    '⏳ **Connecting to Binance & verifying your TRC20 On-Chain transaction...**',
    '⏳ **正在连接 Binance 验证您的 TRC20 链上交易...**'
  ), { parse_mode: 'Markdown' });

  try {
    const { verifyBinanceTrc20Deposit } = await import('../services/binanceService.js');
    const result = await verifyBinanceTrc20Deposit(txHash, user, expectedAmount, bot);

    await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => {});

    if (result.success) {
      delCache(`waiting_trc20_hash_${userId}`);
      delCache(`trc20_amount_${userId}`);

      const { sendMenu } = await import('./handleUser.js');
      await sendMenu(bot, msg.chat.id, user, globalConfig?.TELEGRAM_GROUP_LINKS);
      return true;
    } else {
      await bot.sendMessage(msg.chat.id, result.message || '❌ Giao dịch không hợp lệ hoặc chưa được xác nhận.', {
        parse_mode: 'Markdown',
        reply_markup: {
          resize_keyboard: true,
          keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
        }
      });
      return true;
    }
  } catch (error) {
    console.error('[TRC20_DEPOSIT] Error in handleTrc20HashInput:', error);
    await bot.deleteMessage(msg.chat.id, processingMsg.message_id).catch(() => {});
    await bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra khi xác minh giao dịch. Vui lòng thử lại hoặc liên hệ Admin.', {
      reply_markup: {
        resize_keyboard: true,
        keyboard: [[{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]]
      }
    });
    return true;
  }
};

// Check recent uncredited Binance Onchain TRC20 deposits for user
export const checkRecentTrc20DepositForUser = async (bot, chatId, userId, config) => {
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const { getBinanceConfig, fetchBinanceOnchainDeposits, processBinanceOnchainDeposit } = await import('../services/binanceService.js');

  const user = await getUserByTelegram(userId);
  if (!user) return;

  const binanceConf = await getBinanceConfig();
  if (!binanceConf || !binanceConf.apiKey || !binanceConf.secretKey) {
    return bot.sendMessage(chatId, '⚠️ Hệ thống chưa kích hoạt API Key Binance. Vui lòng gửi trực tiếp mã TxID để hệ thống kiểm tra.');
  }

  await bot.sendMessage(chatId, '🔍 Đang quét các giao dịch USDT TRC20 gần nhất trên Binance...');

  try {
    const startTime = Date.now() - 24 * 60 * 60 * 1000; // 24 giờ qua
    const deposits = await fetchBinanceOnchainDeposits(binanceConf, 'USDT', startTime);

    if (!Array.isArray(deposits) || deposits.length === 0) {
      return bot.sendMessage(chatId, '⏳ **Chưa tìm thấy giao dịch nạp USDT mới nào trên Binance.**\n\n👉 Nếu bạn vừa nạp, vui lòng đợi 1-2 phút cho blockchain xác nhận rồi bấm kiểm tra lại, hoặc dán mã **TxID** trực tiếp vào đây.', { parse_mode: 'Markdown' });
    }

    // Lọc các giao dịch TRC20 thành công
    const trc20Success = deposits.filter(d => (d.network === 'TRX' || d.coin === 'USDT') && d.status === 1);

    if (trc20Success.length === 0) {
      return bot.sendMessage(chatId, '⏳ Các giao dịch gần nhất đang trong quá trình xác nhận từ Binance. Vui lòng đợi 1-2 phút hoặc gửi mã **TxID** của bạn.', { parse_mode: 'Markdown' });
    }

    // Hiển thị hướng dẫn nhập TxID để đối soát chính xác
    await bot.sendMessage(chatId, '📝 **Hệ thống tìm thấy giao dịch trên Binance.**\n👉 Vui lòng **copy và gửi mã TxID / Transaction Hash** của bạn vào đây để hệ thống cộng tiền chính xác vào tài khoản của bạn.', {
      parse_mode: 'Markdown',
      reply_markup: {
        resize_keyboard: true,
        keyboard: [[{ text: '❌ Hủy' }]]
      }
    });
    setCache(`waiting_trc20_hash_${userId}`, true, 30 * 60 * 1000);
  } catch (err) {
    console.error('[CHECK_RECENT_TRC20] Error:', err.message);
    await bot.sendMessage(chatId, '❌ Lỗi khi kiểm tra Binance Onchain. Vui lòng dán trực tiếp mã TxID vào tin nhắn.');
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

export const promptForBankDeposit = async (bot, chatId, userId, config) => {
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const user = await getUserByTelegram(userId);
  const lang = user?.language || 'vi';

  const MIN_DEPOSIT_AMOUNT = await getMinDepositAmount();
  setCache(`waiting_deposit_amount_${userId}`, true, 15 * 60 * 1000);
  setCache(`bank_selection_${userId}`, 'vietqr', 15 * 60 * 1000);

  const promptMsg = L(lang,
    `🏦 **NẠP TIỀN QUA NGÂN HÀNG (VIETQR / BANK TRANSFER)**\n\n` +
    `👉 **Vui lòng nhập số tiền VNĐ bạn muốn nạp vào ví:**\n` +
    `*(Tối thiểu: ${formatCurrency(MIN_DEPOSIT_AMOUNT)})*`,
    `🏦 **BANK TRANSFER DEPOSIT (VIETQR)**\n\n` +
    `👉 **Please enter the amount in VND you wish to deposit:**\n` +
    `*(Minimum: ${formatCurrency(MIN_DEPOSIT_AMOUNT)})*`,
    `🏦 **银行转账充值 (VIETQR)**\n\n` +
    `👉 **请输入您想要充值的越南盾金额：**\n` +
    `*(最低充值: ${formatCurrency(MIN_DEPOSIT_AMOUNT)})*`
  );

  return bot.sendMessage(chatId, promptMsg, {
    parse_mode: 'Markdown',
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [{ text: L(lang, '❌ Hủy', '❌ Cancel', '❌ 取消') }]
      ]
    }
  });
};

export const selectBankMethod = async (bot, chatId, userId, bank = 'vietqr') => {
  setCache(`bank_selection_${userId}`, bank, 15 * 60 * 1000);
  return promptForBankDeposit(bot, chatId, userId);
};

export const handleDepositAmount = async (bot, msg, user, config) => {
  // Chỉ xử lý nếu người dùng thực sự đang trong trạng thái chờ nhập số tiền nạp
  const isWaiting = getCache(`waiting_deposit_amount_${msg.from.id}`);
  if (!isWaiting) return false;

  const lang = user?.language || 'vi';
  const text = msg.text ? msg.text.trim() : '';

  // Kiểm tra nếu bấm hủy
  if (text === '❌ Hủy' || text === '❌ Cancel' || text === '❌ 取消' || text === '/cancel') {
    delCache(`waiting_deposit_amount_${msg.from.id}`);
    delCache(`bank_selection_${msg.from.id}`);
    const { sendMenu } = await import('./handleUser.js');
    await bot.sendMessage(msg.chat.id, L(lang, '❌ Đã hủy nạp tiền.', '❌ Deposit cancelled.', '❌ 已取消充值。'), {
      reply_markup: { remove_keyboard: true }
    });
    await sendMenu(bot, msg.chat.id, user, globalConfig?.TELEGRAM_GROUP_LINKS);
    return true;
  }

  // Bỏ qua nếu là lệnh bot khác
  if (text.startsWith('/')) return false;

  delCache(`waiting_deposit_amount_${msg.from.id}`);
  let selectedBank = getCache(`bank_selection_${msg.from.id}`) || 'vietqr';

  const existing = getCache(qrKey(msg.from.id));
  if (existing) {
    const waitMsg = L(lang,
      'QR cũ chưa hết hạn, vui lòng chờ.',
      'Old QR not expired yet, please wait.',
      'QR 尚未过期，请等待。'
    );
    await bot.sendMessage(msg.chat.id, waitMsg);
    return true;
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

  const promotion = await getActivePromotion(user.id);
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

  const { getBotTemplate, renderBotTemplate } = await import('../helpers/templateHelper.js');
  const rawTemplate = await getBotTemplate('template_bank_deposit', lang);
  let caption = renderBotTemplate(rawTemplate, {
    amount: formatCurrency(amount),
    bankName: bankDisplayName,
    bankCode,
    accountNo,
    accountName,
    content
  });

  if (promotionResult.bonusAmount > 0) {
    caption += `\n\n🎁 **KHUYẾN MẠI:** Nạp ${formatCurrency(amount)} nhận thêm ${formatCurrency(promotionResult.bonusAmount)} (${promotion.bonus_percentage}%)\n💵 **Tổng thực nhận: ${formatCurrency(promotionResult.finalAmount)}**`;
  }

  const confirmBtn = L(lang, 'Tôi đã chuyển khoản', 'I have transferred', '我已转账');
  const cancelBtn = L(lang, 'Huỷ QR', 'Cancel QR', '取消 QR');
  const reloadBtn = L(lang, 'Tải lại QR (1 lần)', 'Reload QR Code (1x)', '重新加载二维码 (1次)');

  const qrMessage = await bot.sendPhoto(msg.chat.id, qrUrl, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: confirmBtn, callback_data: createCallbackData({ action: 'check_payment' }) }],
        [{ text: reloadBtn, callback_data: createCallbackData({ action: 'reload_qr' }) }],
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

  const promotion = await getActivePromotion(deposit.user_id);
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
