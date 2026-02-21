import { sendMenu, ensureUser, sendOrderHistory, sendUserInfo } from './handle/handleUser.js';
import { startDepositFlow, handleDepositAmount, cancelQr } from './handle/handleDeposit.js';
import { sendProductList, handlePurchase, handleManualOrderInput, handleProductQuantityInput } from './handle/handleBuy.js';
import { handleBuyGmailEdu, showGmailEduInfo, handleGmailEduQuantityInput } from './handle/handleGmailEdu.js';
import { showChatGPTInfo, handleChatGPTEmailInput } from './handle/handleChatGPT.js';

import {
  adminMenu,
  requireAdmin,
  adminProducts,
  adminAddProduct,
  adminParseAddProduct,
  adminEditProductPrompt,
  adminUpdateProduct,
  adminDeleteProduct,
  adminListAccounts,
  adminAddAccount,
  adminParseAddAccount,
  adminParseUploadAccounts,
  adminListUsers,
  adminAdjustBalance,
  adminParseAdjustBalance,
  adminUserOrders,
  adminUserBalances,
  adminListManualOrders,
  adminCompleteManualOrder,
  adminDeleteAccount,
  adminDeleteAccountsByStatus
} from './handle/handleAdmin.js';
import { listPendingDeposits, approveDeposit, rejectDeposit, checkDepositStatus, listDepositHistory } from './handle/handleDeposit.js';
import { addBalanceLog } from './controllers/balanceLogController.js';
import { createCallbackData, formatCurrency } from '../utils/index.js';
import { query } from './database/index.js';

// Lưu config ở module level để có thể truy cập từ các callback
export let globalConfig = {};

export const registerListeners = (bot, config) => {
  globalConfig = config;
  bot.onText(/^\/start(.*)/i, async (msg, match) => {
    const user = await ensureUser(bot, msg);
    const { t } = await import('./helpers/langHelper.js');
    const { createCallbackData } = await import('../utils/index.js');

    // Kiểm tra nếu user chưa chọn ngôn ngữ (lần đầu /start)
    if (!user.language) {
      const selectLangText = t('select_language', 'vi');
      await bot.sendMessage(msg.chat.id, selectLangText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🇻🇳 Tiếng Việt', callback_data: createCallbackData({ action: 'select_lang', lang: 'vi' }) },
              { text: '🇺🇸 English', callback_data: createCallbackData({ action: 'select_lang', lang: 'en' }) },
              { text: '🇨🇳 中文', callback_data: createCallbackData({ action: 'select_lang', lang: 'zh' }) }
            ]
          ]
        }
      });
      return;
    }

    // User đã có ngôn ngữ - hiển thị menu bình thường
    const lang = user.language || 'vi';

    // Lấy tỷ giá để quy đổi USDT
    let exchangeRate = 26000;
    try {
      const rateRows = await query("SELECT `value` FROM settings WHERE `key` = 'exchange_rate'");
      if (rateRows && rateRows[0]?.value) {
        exchangeRate = Number(rateRows[0].value) || 26000;
      }
    } catch (e) {
      console.error('[START] Error fetching exchange rate:', e);
    }
    const balanceVnd = Number(user.balance) || 0;
    const balanceUsdt = (balanceVnd / exchangeRate).toFixed(2);

    let messageText = '';
    messageText += t('welcome', lang) + '\n\n';
    messageText += t('user_info', lang, { id: user.telegram_id, balance: formatCurrency(balanceVnd), usdt: balanceUsdt }) + '\n\n';
    messageText += t('guide', lang) + '\n\n';

    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: t('deposit', lang) }, { text: t('buy_product', lang) }],
          [{ text: lang === 'en' ? '📧 Gmail EDU' : '📧 Gmail EDU' }, { text: lang === 'en' ? '🤖 ChatGPT Pro' : '🤖 ChatGPT Pro' }],
          [{ text: t('history', lang) }, { text: t('admin_group', lang) }],
          [{ text: t('change_language', lang) }]
        ],
        resize_keyboard: true
      }
    };

    await bot.sendMessage(msg.chat.id, messageText, opts);
    await sendProductList(bot, msg.chat.id, 1, config.PAGE_SIZE, user);
  });

  bot.onText(/^\/menu/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
  });

  bot.onText(/^\/info/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendUserInfo(bot, msg.chat.id, user);
  });

  bot.onText(/^\/admin/i, async (msg) => {
    if (!await requireAdmin(config.ADMIN_IDS, msg.from.id)) return bot.sendMessage(msg.chat.id, 'Không có quyền.');
    await adminMenu(bot, msg.chat.id);
  });

  bot.onText(/^\/lang/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    const { updateLanguage } = await import('./controllers/userController.js');
    const { t } = await import('./helpers/langHelper.js');
    const { sendMenu } = await import('./handle/handleUser.js');

    // Cycle language: vi -> en -> zh -> vi
    const langCycle = { 'vi': 'en', 'en': 'zh', 'zh': 'vi' };
    const newLang = langCycle[user.language] || 'en';
    await updateLanguage(user.id, newLang);
    user.language = newLang; // update for sendMenu

    await bot.sendMessage(msg.chat.id, await t('lang_switched', newLang));
    await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
  });

  bot.onText(/^\/user\s+(.+)/i, async (msg, match) => {
    if (!await requireAdmin(config.ADMIN_IDS, msg.from.id)) return bot.sendMessage(msg.chat.id, 'Không có quyền.');
    const { handleUserCommand } = await import('./handle/handleAdmin.js');
    const args = match[1].trim().split(/\s+/);
    await handleUserCommand(bot, msg, args);
  });

  bot.onText(/^\/kmnap/i, async (msg) => {
    if (!await requireAdmin(config.ADMIN_IDS, msg.from.id)) return bot.sendMessage(msg.chat.id, 'Không có quyền.');
    const { adminParseKmnap, adminListPromotions, adminDeletePromotion } = await import('./handle/handleAdmin.js');
    const text = msg.text.trim();
    const parts = text.split(/\s+/);

    // Nếu là lệnh xóa: /kmnap delete <id>
    if (parts.length === 3 && parts[1].toLowerCase() === 'delete') {
      const promotionId = parseInt(parts[2]);
      if (isNaN(promotionId)) {
        return bot.sendMessage(msg.chat.id, '❌ ID khuyến mại không hợp lệ.');
      }
      return adminDeletePromotion(bot, msg.chat.id, promotionId);
    }

    // Nếu có tham số thì parse, không thì hiển thị danh sách
    if (text === '/kmnap' || text === '/kmnap list') {
      await adminListPromotions(bot, msg.chat.id);
    } else {
      await adminParseKmnap(bot, msg);
    }
  });





  // Command /gmail để mua Gmail EDU
  bot.onText(/^\/gmail/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await showGmailEduInfo(bot, msg.chat.id, user);
  });

  // Command /chatgpt để mua slot ChatGPT Team
  bot.onText(/^\/chatgpt/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await showChatGPTInfo(bot, msg.chat.id, user);
  });

  // Command /buymail gmail <số lượng> để mua Gmail nhanh
  bot.onText(/^\/buymail\s+gmail(?:\s+(\d+))?/i, async (msg, match) => {
    const user = await ensureUser(bot, msg);
    const lang = user.language || 'vi';
    const quantity = match[1] ? parseInt(match[1], 10) : null;

    if (!quantity) {
      // Nếu không có số lượng, hiện thông tin và chờ input
      await showGmailEduInfo(bot, msg.chat.id, user);
      return;
    }

    // Validate số lượng
    if (quantity < 1 || quantity > 10) {
      const errorMsg = lang === 'en'
        ? '❌ Quantity must be between 1 and 10.'
        : '❌ Số lượng phải từ 1 đến 10.';
      return bot.sendMessage(msg.chat.id, errorMsg);
    }

    // Import và gọi trực tiếp handleBuyGmailEdu
    const { handleBuyGmailEdu } = await import('./handle/handleGmailEdu.js');
    await handleBuyGmailEdu(bot, msg, user, quantity, lang, null, config);
  });

  // Message listener for text flows
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();

    // Log incoming message
    console.log(`[CHAT] User ${msg.from.id} (${msg.from.username || msg.from.first_name}): ${text}`);

    // Ignore commands handled by onText
    if (text.startsWith('/')) return;

    const user = await ensureUser(bot, msg);

    // Xử lý nút Huỷ (ưu tiên cao)
    if (text === '❌ Huỷ' || text === '❌ Hủy' || text === '❌ Cancel' || text === '❌ 取消') {
      const { cancelUploadState } = await import('./handle/handleDeposit.js');
      // Clear ALL waiting states
      const { delCache } = await import('../lib/cache/index.js');
      delCache(`waiting_usdt_amount_${msg.from.id}`);
      delCache(`chatgpt_waiting_${msg.from.id}`);
      delCache(`gmail_edu_waiting_${msg.from.id}`);
      delCache(`waiting_trc20_amount_${msg.from.id}`);
      delCache(`waiting_trc20_hash_${msg.from.id}`);
      delCache(`trc20_amount_${msg.from.id}`);
      delCache(`waiting_payment_proof_${msg.from.id}`);
      return cancelUploadState(bot, msg.chat.id, msg.from.id, config);
    }

    // Check USDT amount input (new step for Bybit flow)
    const { handleUsdtAmountInput, handleTrc20AmountInput, handleTrc20HashInput } = await import('./handle/handleDeposit.js');
    const handledUsdt = await handleUsdtAmountInput(bot, msg, user, config);
    if (handledUsdt) return;

    // Check TRC20 amount input
    const handledTrc20Amount = await handleTrc20AmountInput(bot, msg, user);
    if (handledTrc20Amount) return;

    // Check TRC20 hash input
    const handledTrc20Hash = await handleTrc20HashInput(bot, msg, user);
    if (handledTrc20Hash) return;

    // Kiểm tra input số lượng cho sản phẩm trước (ưu tiên cao nhất)
    const handledProduct = await handleProductQuantityInput(bot, msg, text, config);
    if (handledProduct) return; // Đã xử lý input số lượng sản phẩm

    // Kiểm tra input số lượng Gmail EDU
    const handledGmailEdu = await handleGmailEduQuantityInput(bot, msg, config);
    if (handledGmailEdu) return; // Đã xử lý input số lượng Gmail EDU

    // Kiểm tra input email ChatGPT
    const handledChatGPT = await handleChatGPTEmailInput(bot, msg, config);
    if (handledChatGPT) return; // Đã xử lý input email ChatGPT

    // Kiểm tra manual order input (email/note)
    const handledManual = await handleManualOrderInput(bot, msg, user.telegram_id, config.ADMIN_IDS);
    if (handledManual) return; // Đã xử lý manual order input

    if (text === '➕ Nạp tiền' || text === '➕ Deposit' || text === '➕ 充值') return startDepositFlow(bot, msg, user, config);
    if (text === '🛒 Mua sản phẩm' || text === '🛒 Buy Products' || text === '🛒 购买产品') return sendProductList(bot, msg.chat.id, 1, config.PAGE_SIZE, user);
    if (text === '📧 Gmail EDU') return showGmailEduInfo(bot, msg.chat.id, user);
    if (text === '🤖 ChatGPT Pro') return showChatGPTInfo(bot, msg.chat.id, user);
    if (text === '🧾 Lịch sử mua' || text === '🧾 History' || text === '🧾 购买记录') return sendOrderHistory(bot, msg.chat.id, user.id, 1, config.PAGE_SIZE);

    // Xử lý nút đổi ngôn ngữ
    if (text === '🌐 Ngôn ngữ' || text === '🌐 Language' || text === '🌐 语言') {
      const { t } = await import('./helpers/langHelper.js');
      const { createCallbackData } = await import('../utils/index.js');
      await bot.sendMessage(msg.chat.id, t('select_language', user.language || 'vi'), {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🇻🇳 Tiếng Việt', callback_data: createCallbackData({ action: 'change_lang', lang: 'vi' }) },
              { text: '🇺🇸 English', callback_data: createCallbackData({ action: 'change_lang', lang: 'en' }) },
              { text: '🇨🇳 中文', callback_data: createCallbackData({ action: 'change_lang', lang: 'zh' }) }
            ]
          ]
        }
      });
      return;
    }

    // Xử lý nút Nhóm
    if (text === '👥 Nhóm' || text === '👥 Group' || text === '👥 群组') {
      const { t } = await import('./helpers/langHelper.js');
      const lang = user.language || 'vi';

      // Lấy link nhóm từ settings hoặc config
      let groupLink = config.TELEGRAM_GROUP_LINK || '';
      try {
        const rows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_group_link'");
        if (rows && rows[0]?.value) {
          groupLink = rows[0].value;
        }
      } catch (e) {
        console.error('[GROUP_LINK] Error fetching group link:', e);
      }

      if (!groupLink) {
        const noLinkMsgs = { en: '❌ Support group link not configured yet.', zh: '❌ 支持群组链接尚未配置。' };
        const noLinkMsg = noLinkMsgs[lang] || '❌ Link nhóm hỗ trợ chưa được cấu hình.';
        return bot.sendMessage(msg.chat.id, noLinkMsg);
      }

      const groupMsg = t('join_group_msg', lang);
      await bot.sendMessage(msg.chat.id, groupMsg, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: { en: '👥 Join Group', zh: '👥 加入群组' }[lang] || '👥 Tham gia nhóm', url: groupLink }]
          ]
        }
      });
      return;
    }

    // Check if it's Admin approving deposit
    if (config.ADMIN_IDS.includes(msg.from.id)) {
      const { getCache, delCache } = await import('../lib/cache/index.js');
      const approvingState = getCache(`admin_approving_deposit_${msg.from.id}`);
      if (approvingState) {
        const amount = parseInt(text.replace(/\D/g, ''));
        if (!isNaN(amount) && amount > 0) {
          const { updateDepositStatus, getDeposit } = await import('./controllers/depositController.js');
          const { updateBalance, getUserById } = await import('./controllers/userController.js');
          const { addBalanceLog } = await import('./controllers/balanceLogController.js');

          const deposit = await getDeposit(approvingState.depositId);
          if (!deposit || deposit.status !== 'pending') {
            delCache(`admin_approving_deposit_${msg.from.id}`);
            return bot.sendMessage(msg.chat.id, 'Giao dịch không tồn tại hoặc đã được xử lý.');
          }

          // Approve logic
          // Update amount first (since we inserted 0)
          const { query } = await import('./database/index.js'); // quick fix to update amount
          await query('UPDATE deposits SET amount = ? WHERE id = ?', [amount, deposit.id]);

          await updateDepositStatus(deposit.id, 'approved');
          await updateBalance(deposit.user_id, amount);
          await addBalanceLog({
            userId: deposit.user_id,
            amount: amount,
            reason: 'deposit_usdt',
            adminId: msg.from.id
          });

          delCache(`admin_approving_deposit_${msg.from.id}`);

          const u = await getUserById(deposit.user_id);
          const newBalance = Number(u.balance);

          await bot.sendMessage(msg.chat.id, `✅ Đã duyệt nạp #${deposit.id}.\n💰 Số tiền: ${formatCurrency(amount)}\n💵 Số dư mới người dùng: ${formatCurrency(newBalance)}`);

          // Notify user
          if (u) {
            await bot.sendMessage(u.telegram_id, `✅ Nạp tiền thành công!\n\n💰 Số tiền: ${formatCurrency(amount)}\n💵 Số dư hiện tại: ${formatCurrency(newBalance)}\n📝 Mã giao dịch: #${deposit.id}`);
          }
          return;
        } else {
          return bot.sendMessage(msg.chat.id, '❌ Số tiền không hợp lệ. Vui lòng nhập lại số nguyên.');
        }
      }
    }

    // Nếu không phải input quantity cho Gmail/Mail, xử lý như deposit amount
    return handleDepositAmount(bot, msg, user, config);
  });

  // Handle Photo Messages (Receipt Upload)
  bot.on('photo', async (msg) => {
    const { getCache, delCache } = await import('../lib/cache/index.js');
    const user = await ensureUser(bot, msg);

    const isWaiting = getCache(`waiting_payment_proof_${msg.from.id}`);

    if (isWaiting) {
      const adminIds = config.ADMIN_IDS;
      if (adminIds && adminIds.length > 0) {
        try {
          // Get cached USDT amount
          const usdtAmount = getCache(`usdt_amount_${msg.from.id}`) || 0;

          // Create deposit record first
          const { createUsdtDeposit } = await import('./controllers/depositController.js');
          const depositId = await createUsdtDeposit(user.id, 'BYBIT_PROOF');

          // Update deposit with USDT amount (store in content or separate field)
          // For now, store usdtAmount in cache for approval handler
          const { setCache } = await import('../lib/cache/index.js');
          setCache(`usdt_deposit_amount_${depositId}`, usdtAmount, 60 * 60 * 1000); // 1 hour

          const photoId = msg.photo[msg.photo.length - 1].file_id;
          const caption = `📸 **Bằng chứng thanh toán USDT**\n\n` +
            `👤 User: ${user.username || user.telegram_id} (ID: ${user.telegram_id})\n` +
            `💵 Số tiền: **${usdtAmount} USDT**\n` +
            `🔢 Deposit ID: #${depositId}\n` +
            `🕒 Thời gian: ${new Date().toLocaleString('vi-VN')}`;

          for (const adminId of adminIds) {
            await bot.sendPhoto(adminId, photoId, {
              caption,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ Duyệt', callback_data: createCallbackData({ action: 'approve_usdt_deposit', id: depositId }) },
                    { text: '❌ Từ chối', callback_data: createCallbackData({ action: 'reject_usdt_deposit', id: depositId }) }
                  ]
                ]
              }
            });
          }

          // Notify user
          await bot.sendMessage(msg.chat.id, '✅ Đã gửi ảnh xác nhận cho Admin. Mã yêu cầu: #' + depositId);

          // Clear state
          delCache(`waiting_payment_proof_${msg.from.id}`);

          // Return to menu
          const { sendMenu } = await import('./handle/handleUser.js');
          await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);

        } catch (err) {
          console.error('Error forwarding photo:', err);
          await bot.sendMessage(msg.chat.id, '❌ Có lỗi khi gửi ảnh. Vui lòng thử lại.');
        }
      } else {
        await bot.sendMessage(msg.chat.id, '⚠️ Hệ thống chưa cấu hình Admin để nhận ảnh.');
      }
    }
  });

  // Callback query listener
  bot.on('callback_query', async (query) => {
    try {
      const data = JSON.parse(query.data);
      const chatId = query.message.chat.id;
      const user = await ensureUser(bot, { ...query.message, from: query.from, text: query.data });

      console.log(`[CALLBACK] User ${query.from.id}: ${query.data}`);

      // Normalize action field (support both 'action' and 'a' for backward compatibility)
      // Map action names ngắn về đầy đủ
      const actionMap = {
        'acc': 'admin_accounts',
        'del_acc': 'admin_delete_account',
        'del_all': 'admin_delete_accounts_by_status',
        'add_acc': 'admin_add_account',
        'up_acc': 'admin_upload_account'
      };

      let action = data.action || data.a;
      // Nếu action là format ngắn, chuyển về format đầy đủ
      if (action && actionMap[action]) {
        action = actionMap[action];
      }

      switch (action) {
        case 'select_lang':
          // Xử lý chọn ngôn ngữ lần đầu
          {
            const { updateLanguage } = await import('./controllers/userController.js');
            const { t } = await import('./helpers/langHelper.js');
            const selectedLang = data.lang;

            await updateLanguage(user.id, selectedLang);
            user.language = selectedLang;

            // Thông báo đã chọn ngôn ngữ
            await bot.sendMessage(chatId, t('lang_switched', selectedLang), { parse_mode: 'Markdown' });

            // Lấy tỷ giá để quy đổi USDT
            let exchangeRate = 26000;
            try {
              const rateRows = await query("SELECT `value` FROM settings WHERE `key` = 'exchange_rate'");
              if (rateRows && rateRows[0]?.value) {
                exchangeRate = Number(rateRows[0].value) || 26000;
              }
            } catch (e) { }
            const balanceVnd = Number(user.balance) || 0;
            const balanceUsdt = (balanceVnd / exchangeRate).toFixed(2);

            // Hiển thị welcome message và menu
            let welcomeText = '';
            welcomeText += t('welcome', selectedLang) + '\n\n';
            welcomeText += t('user_info', selectedLang, { id: user.telegram_id, balance: formatCurrency(balanceVnd), usdt: balanceUsdt }) + '\n\n';
            welcomeText += t('guide', selectedLang) + '\n\n';

            await bot.sendMessage(chatId, welcomeText, {
              parse_mode: 'Markdown',
              reply_markup: {
                keyboard: [
                  [{ text: t('deposit', selectedLang) }, { text: t('buy_product', selectedLang) }],
                  [{ text: '📧 Gmail EDU' }, { text: '🤖 ChatGPT Pro' }],
                  [{ text: t('history', selectedLang) }, { text: t('admin_group', selectedLang) }],
                  [{ text: t('change_language', selectedLang) }]
                ],
                resize_keyboard: true
              }
            });

            // Hiển thị danh sách sản phẩm
            return sendProductList(bot, chatId, 1, config.PAGE_SIZE, user);
          }

        case 'change_lang':
          // Xử lý đổi ngôn ngữ từ menu
          {
            const { updateLanguage } = await import('./controllers/userController.js');
            const { t } = await import('./helpers/langHelper.js');
            const newLang = data.lang;

            await updateLanguage(user.id, newLang);
            user.language = newLang;

            // Thông báo đã đổi ngôn ngữ
            await bot.sendMessage(chatId, t('lang_switched', newLang), { parse_mode: 'Markdown' });

            // Cập nhật menu keyboard theo ngôn ngữ mới
            await bot.sendMessage(chatId, t('menu_title', newLang), {
              parse_mode: 'Markdown',
              reply_markup: {
                keyboard: [
                  [{ text: t('deposit', newLang) }, { text: t('buy_product', newLang) }],
                  [{ text: '📧 Gmail EDU' }, { text: '🤖 ChatGPT Pro' }],
                  [{ text: t('history', newLang) }, { text: t('admin_group', newLang) }],
                  [{ text: t('change_language', newLang) }]
                ],
                resize_keyboard: true
              }
            });
            return;
          }

        case 'products':
          // Need to fetch user to get language for pagination callback too?
          // If ensureUser wasn't called here (it was called above), we can pass it.
          // user variable in 'callback_query' listener: const user = await ensureUser(...)
          // Lấy messageId từ message để edit thay vì gửi mới
          return sendProductList(bot, chatId, data.page || 1, config.PAGE_SIZE, user, query.message.message_id);
        case 'view_product':
          const { showProductDetail } = await import('./handle/handleBuy.js');
          return showProductDetail(bot, chatId, data.productId, query.from.id);
        case 'buy_product':
          return handlePurchase(bot, query.message, data.productId, query.from, config);

        case 'deposit_select_bank':
          const { promptForBankDeposit } = await import('./handle/handleDeposit.js');
          return promptForBankDeposit(bot, chatId, query.from.id, config);

        case 'deposit_select_usdt':
          const { showUsdtOptions } = await import('./handle/handleDeposit.js');
          return showUsdtOptions(bot, chatId, config);

        case 'deposit_usdt_wallet':
          const { showUsdtInfo } = await import('./handle/handleDeposit.js');
          return showUsdtInfo(bot, chatId, config);

        case 'deposit_usdt_bybit':
          const { showUsdtBybitInfo } = await import('./handle/handleDeposit.js');
          return showUsdtBybitInfo(bot, chatId, query.from.id, config);

        case 'deposit_usdt_trc20':
          const { showTrc20DepositFlow } = await import('./handle/handleDeposit.js');
          return showTrc20DepositFlow(bot, chatId, query.from.id, config);

        case 'check_payment':
          const { checkPaymentForUser } = await import('./services/autoDeposit.js');
          const result = await checkPaymentForUser(bot, query.from.id, config);
          return bot.sendMessage(chatId, result.message);
        case 'cancel_qr':
          return cancelQr(bot, chatId, query.from);
        case 'user_orders':
          return sendOrderHistory(bot, chatId, user.id, data.page || 1, config.PAGE_SIZE);
        case 'back_to_menu':
          return sendMenu(bot, chatId, user, globalConfig.TELEGRAM_GROUP_LINKS);

        case 'admin_products':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminProducts(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'admin_add_product':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          bot.once('message', (m) => adminParseAddProduct(bot, m));
          return adminAddProduct(bot, chatId);
        case 'admin_delete_product':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminDeleteProduct(bot, chatId, data.id);
        case 'admin_edit_product':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          bot.once('message', (m) => adminUpdateProduct(bot, m, data.id));
          return adminEditProductPrompt(bot, chatId, data.id);
        case 'admin_accounts':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          // Hỗ trợ cả format đầy đủ và format ngắn
          const productId = data.productId || data.p;
          const page = data.page || data.pg || 1;
          const status = data.status || data.s || null;
          // Hardcode 10 tài khoản mỗi trang
          return adminListAccounts(bot, chatId, productId, page, 10, status);
        case 'admin_add_account':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          // Hỗ trợ cả format đầy đủ và format ngắn
          const addProductId = data.productId || data.p;
          if (!addProductId) {
            return bot.sendMessage(chatId, '❌ Lỗi: Không tìm thấy ID sản phẩm. Vui lòng thử lại.');
          }
          bot.once('message', (m) => adminParseAddAccount(bot, m, addProductId));
          return adminAddAccount(bot, chatId, addProductId);
        case 'admin_upload_account':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          // Hỗ trợ cả format đầy đủ và format ngắn
          const uploadProductId = data.productId || data.p;
          if (!uploadProductId) {
            return bot.sendMessage(chatId, '❌ Lỗi: Không tìm thấy ID sản phẩm. Vui lòng thử lại.');
          }
          await bot.sendMessage(chatId, 'Gửi file .txt hoặc dán nội dung username|password mỗi dòng.');
          bot.once('message', (m) => adminParseUploadAccounts(bot, m, uploadProductId));
          return;
        case 'admin_delete_account':
        case 'del_acc': // Hỗ trợ format ngắn
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          // Hỗ trợ cả format đầy đủ và format ngắn
          const accountId = data.accountId || data.ac;
          const delProductId = data.productId || data.p;
          const delPage = data.page || data.pg || 1;
          const delStatus = data.status || data.s || null;
          return adminDeleteAccount(bot, chatId, accountId, delProductId, delPage, delStatus);
        case 'admin_delete_accounts_by_status':
        case 'del_all': // Hỗ trợ format ngắn
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          // Hỗ trợ cả format đầy đủ và format ngắn
          const delByStatusProductId = data.productId || data.p;
          const delStatusValue = data.status || data.s;
          const delByStatusPage = data.page || data.pg || 1;
          return adminDeleteAccountsByStatus(bot, chatId, delByStatusProductId, delStatusValue, delByStatusPage);
        case 'admin_accounts_pick':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminProducts(bot, chatId, 1, config.PAGE_SIZE);
        case 'admin_deposits':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return listPendingDeposits(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'admin_deposit_history':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return listDepositHistory(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'check_deposit':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return checkDepositStatus(bot, chatId, data.id, query.from.id);
        case 'approve_deposit':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return approveDeposit(bot, chatId, data.id, query.from);
        case 'reject_deposit':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return rejectDeposit(bot, chatId, data.id, query.from);
        case 'admin_users':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminListUsers(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'admin_adjust_balance':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          bot.once('message', (m) => adminParseAdjustBalance(bot, m, addBalanceLog));
          return adminAdjustBalance(bot, chatId);
        case 'admin_user_orders':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminUserOrders(bot, chatId, data.userId, data.page || 1, config.PAGE_SIZE);
        case 'admin_user_logs':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminUserBalances(bot, chatId, data.userId, data.page || 1, config.PAGE_SIZE);
        case 'admin_manual_orders':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminListManualOrders(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'admin_complete_order':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminCompleteManualOrder(bot, chatId, data.orderId, query.from);

        // Gmail EDU deposit options
        case 'gmail_deposit_bank':
          {
            const { getCache, setCache } = await import('../lib/cache/index.js');
            const { handleDepositAmount } = await import('./handle/handleDeposit.js');

            const amount = data.amount || 5000;

            // Set bank key cho Viettel Money
            const bankKey = `bank_${query.from.id}`;
            setCache(bankKey, 'viettel', 10 * 60 * 1000);

            // Tạo fake message để gọi handleDepositAmount
            const fakeMsg = {
              chat: { id: chatId },
              from: query.from,
              text: amount.toString()
            };

            await bot.sendMessage(chatId, `🏦 Đang tạo QR nạp ${formatCurrency(amount)}...`);
            await handleDepositAmount(bot, fakeMsg, user, config);
          }
          return;

        case 'gmail_deposit_usdt':
          {
            const { showUsdtOptions } = await import('./handle/handleDeposit.js');
            await bot.sendMessage(chatId, `💵 Vui lòng nạp ít nhất ${data.amount || 1} USDT để hoàn tất mua Gmail EDU.`);
            await showUsdtOptions(bot, chatId, config);
          }
          return;

        case 'gmail_deposit_cancel':
          {
            const { delCache } = await import('../lib/cache/index.js');
            const purchaseKey = `gmail_edu_purchase_${query.from.id}`;
            delCache(purchaseKey);
            await bot.sendMessage(chatId, '❌ Đã huỷ giao dịch mua Gmail EDU.');
          }
          return;

        // Gmail password options
        case 'gmail_pw_auto':
          {
            // Mua Gmail với password tự động
            await handleBuyGmailEdu(bot, { chat: { id: chatId }, from: query.from }, user, data.qty, user.language || 'vi', null);
          }
          return;

        case 'gmail_pw_custom':
          {
            // Lưu state chờ input password
            const { setCache } = await import('../lib/cache/index.js');
            const gmailEduCacheKey = (telegramId) => `gmail_edu_waiting_${telegramId}`;

            setCache(gmailEduCacheKey(query.from.id), {
              waiting: true,
              waitingPassword: true,
              quantity: data.qty,
              lang: user.language || 'vi'
            }, 10 * 60 * 1000);

            const message = (user.language === 'en')
              ? '✏️ Please enter your desired password (at least 8 characters):'
              : '✏️ Vui lòng nhập mật khẩu bạn muốn đặt (ít nhất 8 ký tự):';
            await bot.sendMessage(chatId, message);
          }
          return;

        case 'gmail_pw_cancel':
          {
            await bot.sendMessage(chatId, '❌ Đã huỷ mua Gmail EDU.');
          }
          return;

        case 'admin_delete_promotion':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          const { adminDeletePromotion } = await import('./handle/handleAdmin.js');
          return adminDeletePromotion(bot, chatId, data.id);

        case 'approve_usdt_deposit':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          {
            const { getCache, delCache } = await import('../lib/cache/index.js');
            const { updateDepositStatus, getDeposit } = await import('./controllers/depositController.js');
            const { updateBalance, getUserById } = await import('./controllers/userController.js');
            const { addBalanceLog } = await import('./controllers/balanceLogController.js');
            const { query: dbQuery } = await import('./database/index.js');

            const deposit = await getDeposit(data.id);
            if (!deposit || deposit.status !== 'pending') {
              return bot.sendMessage(chatId, 'Giao dịch không tồn tại hoặc đã được xử lý.');
            }

            // Get cached USDT amount
            const usdtAmount = getCache(`usdt_deposit_amount_${data.id}`) || 0;
            if (usdtAmount <= 0) {
              return bot.sendMessage(chatId, '❌ Không tìm thấy số tiền USDT. Có thể đã hết hạn cache.');
            }

            // Get exchange rate from settings
            const [rateRows] = await dbQuery("SELECT `value` FROM settings WHERE `key` = 'exchange_rate'");
            const exchangeRate = Number(rateRows?.[0]?.value) || 26000;

            // Calculate VND amount
            const vndAmount = Math.floor(usdtAmount * exchangeRate);

            // Update deposit
            await dbQuery('UPDATE deposits SET amount = ? WHERE id = ?', [vndAmount, data.id]);
            await updateDepositStatus(data.id, 'approved');
            await updateBalance(deposit.user_id, vndAmount);
            await addBalanceLog({
              userId: deposit.user_id,
              amount: vndAmount,
              reason: `deposit_usdt_${usdtAmount}`,
              adminId: query.from.id
            });

            // Clear cache
            delCache(`usdt_deposit_amount_${data.id}`);

            const u = await getUserById(deposit.user_id);
            const newBalance = Number(u.balance);

            await bot.sendMessage(chatId,
              `✅ Đã duyệt nạp #${data.id}.\n` +
              `💵 ${usdtAmount} USDT × ${formatCurrency(exchangeRate)} = ${formatCurrency(vndAmount)}\n` +
              `💰 Số dư mới người dùng: ${formatCurrency(newBalance)}`
            );

            // Notify user
            if (u) {
              await bot.sendMessage(u.telegram_id,
                `✅ Nạp tiền thành công!\n\n` +
                `💵 Số tiền: ${usdtAmount} USDT = ${formatCurrency(vndAmount)}\n` +
                `💰 Số dư hiện tại: ${formatCurrency(newBalance)}\n` +
                `📝 Mã giao dịch: #${data.id}`
              );
            }
          }
          return;

        case 'reject_usdt_deposit':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          const { updateDepositStatus } = await import('./controllers/depositController.js');
          const { getDeposit } = await import('./controllers/depositController.js');

          const depositToReject = await getDeposit(data.id);
          if (!depositToReject || depositToReject.status !== 'pending') {
            return bot.sendMessage(chatId, 'Giao dịch không tồn tại hoặc đã được xử lý.');
          }

          await updateDepositStatus(data.id, 'rejected');
          await bot.sendMessage(chatId, `❌ Đã từ chối giao dịch #${data.id}.`);

          // Notify user
          try {
            const userToNotify = await getUserCache(depositToReject.user_id); // we need to user controller to get cached user or db user.
            // ensureUser caches but key is username/id? 
            // Let's use getDeposit -> user_id -> getUserById
            const { getUserById } = await import('./controllers/userController.js');
            const u = await getUserById(depositToReject.user_id);
            if (u) {
              await bot.sendMessage(u.telegram_id, `❌ Yêu cầu nạp tiền #${data.id} của bạn đã bị từ chối.`);
            }
          } catch (e) { console.error(e); }
          return;

        default:
          return;
      }
    } catch (err) {
      // Error handling without logging
    }
  });
};

