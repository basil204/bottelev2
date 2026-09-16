import { sendMenu, ensureUser, sendOrderCredentials, sendOrderHistory, sendUserInfo, buildMainKeyboard, sendPurchaseMenu, sendUtilityMenu, sendTrackedMenu, sendWalletMenu, sendSupportMenu, sendApiMenu, sendWarrantyMenu } from './handle/handleUser.js';
import { startDepositFlow, handleDepositAmount, cancelQr, reloadQr } from './handle/handleDeposit.js';
import { sendProductList, sendCategoryList, handlePurchase, handleManualOrderInput, handleProductQuantityInput } from './handle/handleBuy.js';
import { startDownloadFlow, handleDownloadInput, handleDownloadSelection } from './handle/handleDownload.js';
import { handleCheckLiveCommand } from './handle/handleCheckLive.js';

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
import { getCache, setCache, delCache } from '../lib/cache/index.js';

// Lưu config ở module level để có thể truy cập từ các callback
export let globalConfig = {};

const PUBLIC_COMMANDS_TEXT = `📋 CÁC LỆNH CỦA BOT
/start - Khởi động và mở menu chính
/menu - Mở menu chính
/products - Xem danh sách sản phẩm
/wallet - Xem ví và nạp tiền
/api - Xem thông tin kết nối API
/warranty - Trung tâm bảo hành đơn hàng
/support - Hỗ trợ trực tuyến / CSKH
/history - Xem lịch sử mua hôm nay
/lang - Đổi ngôn ngữ
/id - Lấy UID người dùng, ID nhóm (Box) & Kênh`;

const BUTTON_COLOR_PATCHED = Symbol.for('bottele.inline-button-colors');

const inferButtonStyle = (button) => {
  if (button.style) return button.style;
  const text = String(button.text || '').toLowerCase();
  let action = '';
  if (button.callback_data) {
    try {
      const data = JSON.parse(button.callback_data);
      action = String(data.action || data.a || '').toLowerCase();
    } catch {}
  }
  const intent = `${text} ${action}`;
  if (/(hủy|huỷ|xóa|xoá|từ chối|reject|delete|cancel|disable|tắt|stop)/i.test(intent)) return 'danger';
  if (/(mua|buy|duyệt|approve|xác nhận|confirm|hoàn thành|complete|thêm|add|upload|bắt đầu|start|join|mời|invite|available|bật|enable|success|check_payment)/i.test(intent)) return 'success';
  return 'primary';
};

const colorizeReplyMarkup = (options) => {
  const markup = options?.reply_markup;
  if (!markup) return;

  const inlineKeyboard = markup.inline_keyboard;
  if (Array.isArray(inlineKeyboard)) {
    for (const row of inlineKeyboard) {
      if (!Array.isArray(row)) continue;
      for (const button of row) {
        if (button && typeof button === 'object') button.style = inferButtonStyle(button);
      }
    }
  }

  // Reply keyboard is the bot's main menu: green by default. Destructive
  // actions such as cancel remain red.
  const menuKeyboard = markup.keyboard;
  if (Array.isArray(menuKeyboard)) {
    for (const row of menuKeyboard) {
      if (!Array.isArray(row)) continue;
      for (const button of row) {
        if (!button || typeof button !== 'object' || button.style) continue;
        const text = String(button.text || '');
        button.style = /(hủy|huỷ|cancel|từ chối|reject|xóa|xoá|delete)/i.test(text)
          ? 'danger'
          : 'success';
      }
    }
  }
};

const installButtonColors = (bot) => {
  if (bot[BUTTON_COLOR_PATCHED]) return;
  // Disabled auto button colors per user preference
  bot[BUTTON_COLOR_PATCHED] = true;
};

export const registerListeners = (bot, config) => {
  globalConfig = config;
  installButtonColors(bot);

  bot.onText(/^\/start(.*)/i, async (msg, match) => {
    const user = await ensureUser(bot, msg);
    if (user?.is_banned) {
      return bot.sendMessage(
        msg.chat.id,
        '🚫 **TÀI KHOẢN CỦA BẠN ĐÃ BỊ KHÓA!**\n\n⚠️ Bạn đã bị Admin khóa quyền truy cập hệ thống. Vui lòng liên hệ Admin để biết thêm chi tiết.',
        { parse_mode: 'Markdown' }
      );
    }
    const { t } = await import('./helpers/langHelper.js');
    const { createCallbackData } = await import('../utils/index.js');

    const startParam = match[1] ? match[1].trim() : '';

    // Kiểm tra nếu user chưa chọn ngôn ngữ (lần đầu /start)
    if (!user.language) {
      const selectLangText = `${t('select_language', 'vi')}\n\n${PUBLIC_COMMANDS_TEXT}`;
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

    if (startParam && startParam.startsWith('buy_')) {
      const productId = parseInt(startParam.replace('buy_', ''), 10);
      if (!isNaN(productId)) {
        const { showProductDetail } = await import('./handle/handleBuy.js');
        return showProductDetail(bot, msg.chat.id, productId, msg.from.id);
      }
    }

    // User đã có ngôn ngữ - hiển thị menu tùy chỉnh /start
    return sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
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





  // Command /broadcast để Admin gửi thông báo hàng loạt
  bot.onText(/^\/broadcast(?:\s+([\s\S]+))?$/i, async (msg) => {
    const { handleBroadcastCommand } = await import('./handle/handleAdmin.js');
    const { getAdminIds } = await import('./handle/handleNotify.js');
    const adminIds = await getAdminIds(config?.ADMIN_IDS || []);
    await handleBroadcastCommand(bot, msg, adminIds);
  });

  bot.onText(/^\/(products|shop|sanpham)(?:@\w+)?$/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendCategoryList(bot, msg.chat.id, user);
  });

  bot.onText(/^\/(wallet|vi|balance)(?:@\w+)?$/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendWalletMenu(bot, msg.chat.id, user, config);
  });

  bot.onText(/^\/api(?:@\w+)?$/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendApiMenu(bot, msg.chat.id, user);
  });

  bot.onText(/^\/(warranty|baohanh)(?:@\w+)?$/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendWarrantyMenu(bot, msg.chat.id, user);
  });

  bot.onText(/^\/(support|hotro)(?:@\w+)?$/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendSupportMenu(bot, msg.chat.id, user);
  });

  bot.onText(/^\/getlink(?:@\w+)?$/i, async (msg) => {
    await ensureUser(bot, msg);
    await startDownloadFlow(bot, msg.chat.id, msg.from.id);
  });

  bot.onText(/^\/checklive(?:@\w+)?(?:\s+([\s\S]+))?$/i, async (msg, match) => {
    await ensureUser(bot, msg);
    await handleCheckLiveCommand(bot, msg, match?.[1] || '');
  });

  // Lệnh lấy ID / UID người dùng, ID nhóm (Box), Kênh
  bot.onText(/^\/(id|uid|myid|chatid|boxid|getid|groupid|channelid)(?:@\w+)?(?:\s+.*)?$/i, async (msg) => {
    const { handleGetId } = await import('./handle/handleId.js');
    await handleGetId(bot, msg);
  });

  // Hỗ trợ lấy ID khi đăng lệnh trong Kênh Telegram (Channel Post)
  bot.on('channel_post', async (msg) => {
    if (msg.text && /^\/(id|uid|chatid|channelid|getid)(?:@\w+)?/i.test(msg.text.trim())) {
      const { handleGetId } = await import('./handle/handleId.js');
      await handleGetId(bot, msg);
    }
  });

  // Lịch sử đơn hàng
  bot.onText(/^\/(history|orders)(?:@\w+)?$/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendOrderHistory(bot, msg.chat.id, user.id, 1, config.PAGE_SIZE);
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
    if (user?.is_banned) {
      return bot.sendMessage(
        msg.chat.id,
        '🚫 **TÀI KHOẢN CỦA BẠN ĐÃ BỊ KHÓA!**\n\n⚠️ Bạn đã bị Admin khóa quyền truy cập hệ thống. Vui lòng liên hệ Admin để biết thêm chi tiết.',
        { parse_mode: 'Markdown' }
      );
    }

    const { t, isMatchButton } = await import('./helpers/langHelper.js');
    const userLang = user?.language || 'vi';

    // Helper kiểm tra xem tin nhắn gửi lên có phải là Nút Bấm Menu / Lệnh điều hướng hay không
    const isNavMenuButton = (txt) => {
      const cleanTxt = (txt || '').replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?\d+\}/gi, '').trim();
      return (
        cleanTxt.startsWith('/') ||
        cleanTxt === '❌ Huỷ' || cleanTxt === '❌ Hủy' || cleanTxt === '❌ Cancel' || cleanTxt === '❌ 取消' || isMatchButton(cleanTxt, 'cancel', userLang) ||
        cleanTxt === '🛍️ Sản phẩm' || cleanTxt === '🛍 Sản phẩm' || cleanTxt === 'Sản phẩm' || cleanTxt === '🛒 Mua hàng' || cleanTxt === 'Mua hàng' || cleanTxt === '🛒 Mua sản phẩm' || cleanTxt === 'Mua sản phẩm' || cleanTxt === '🛒 Mua tài khoản' || cleanTxt === 'Mua tài khoản' || cleanTxt === '🛒 Buy Products' || cleanTxt === 'Buy Products' || cleanTxt === '产品' || cleanTxt === '🛍️ 产品' || isMatchButton(cleanTxt, 'btn_buy_menu', userLang) || isMatchButton(cleanTxt, 'buy_product', userLang) || isMatchButton(cleanTxt, 'product_list', userLang) || isMatchButton(cleanTxt, 'btn_buy_accounts', userLang) ||
        cleanTxt === '💬 Hỗ trợ' || cleanTxt === 'Hỗ trợ' || cleanTxt === '💬 Support' || cleanTxt === 'Support' || cleanTxt === '客服支持' || cleanTxt === '💬 客服支持' || cleanTxt === '🛟 Hỗ trợ / Bảo hành' || cleanTxt === 'Hỗ trợ / Bảo hành' || isMatchButton(cleanTxt, 'btn_support', userLang) ||
        cleanTxt === '👛 Ví' || cleanTxt === 'Ví' || cleanTxt === '👛 Wallet' || cleanTxt === 'Wallet' || cleanTxt === '钱包' || cleanTxt === '👛 钱包' || cleanTxt === '➕ Nạp tiền' || cleanTxt === 'Nạp tiền' || cleanTxt === '➕ Deposit' || cleanTxt === 'Deposit' || cleanTxt === '充值' || isMatchButton(cleanTxt, 'btn_deposit', userLang) || isMatchButton(cleanTxt, 'deposit', userLang) ||
        cleanTxt === '🔗 API' || cleanTxt === 'API' || cleanTxt === '🔗 Tích hợp API' ||
        cleanTxt === '🛡️ Bảo hành' || cleanTxt === '🛡 Bảo hành' || cleanTxt === 'Bảo hành' || cleanTxt === '🛡️ Warranty' || cleanTxt === 'Warranty' || cleanTxt === '售后保修' || cleanTxt === '🛡️ 售后保修' ||
        cleanTxt === '↩️ Menu chính' || cleanTxt === 'Menu chính' || cleanTxt === '↩️ Main Menu' || cleanTxt === 'Main Menu' || cleanTxt === '主菜单' || isMatchButton(cleanTxt, 'btn_main_menu', userLang) ||
        cleanTxt === '🧾 Lịch sử mua' || cleanTxt === 'Lịch sử mua' || cleanTxt === '🧾 History' || cleanTxt === 'History' || cleanTxt === '购买记录' || isMatchButton(cleanTxt, 'btn_order_history', userLang) ||
        cleanTxt === '🌐 Ngôn ngữ' || cleanTxt === 'Ngôn ngữ' || cleanTxt === '🌐 Language' || cleanTxt === 'Language' || cleanTxt === '语言' || cleanTxt === '语言切换' || isMatchButton(cleanTxt, 'btn_change_language', userLang) ||
        cleanTxt === '🎁 Điểm danh' || cleanTxt === 'Điểm danh' || cleanTxt === 'Check-in' || cleanTxt === '每日签到' ||
        cleanTxt === '🔎 Check Live' || cleanTxt === 'Check Live' || isMatchButton(cleanTxt, 'btn_check_live', userLang) ||
        cleanTxt === '⬇️ Download All' || cleanTxt === 'Download All' || isMatchButton(cleanTxt, 'btn_download_all', userLang) ||
        cleanTxt === '👥 Nhóm' || cleanTxt === '👥 Group' || cleanTxt === '👥 群组'
      );
    };

    // Nếu người dùng bấm bất kỳ Nút Menu nào -> Tự động xoá tất cả trạng thái chờ trước đó và xử lý Menu ngay
    if (isNavMenuButton(text)) {
      const { delCache } = await import('../lib/cache/index.js');
      const { manualOrderState, waitingForProductQuantity, waitingForCouponState } = await import('./handle/handleBuy.js');
      manualOrderState?.delete(String(msg.from.id));
      waitingForProductQuantity?.delete(String(msg.from.id));
      waitingForCouponState?.delete(String(msg.from.id));
      delCache(`waiting_usdt_amount_${msg.from.id}`);
      delCache(`chatgpt_waiting_${msg.from.id}`);
      delCache(`waiting_trc20_amount_${msg.from.id}`);
      delCache(`waiting_trc20_hash_${msg.from.id}`);
      delCache(`trc20_amount_${msg.from.id}`);
      delCache(`waiting_payment_proof_${msg.from.id}`);
      delCache(`download_all_waiting_${msg.from.id}`);
      delCache(`waiting_support_request_${msg.from.id}`);

      if (text === '❌ Huỷ' || text === '❌ Hủy' || text === '❌ Cancel' || text === '❌ 取消' || isMatchButton(text, 'cancel', userLang)) {
        const { cancelUploadState } = await import('./handle/handleDeposit.js');
        return cancelUploadState(bot, msg.chat.id, msg.from.id, config);
      }

      // Kiểm tra nút động cấu hình từ Web Admin
      try {
        const { getMainKeyboardConfig } = await import('./handle/handleUser.js');
        const customButtons = await getMainKeyboardConfig();
        const cleanMsgText = (text || '').replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?\d+\}/gi, '').replace(/^[^\p{L}\p{N}]+/gu, '').trim().toLowerCase();
        const matchedBtn = Array.isArray(customButtons) ? customButtons.find((b) => {
          if (b.is_active === false) return false;
          const candidates = [b.text, b.text_vi, b.text_en, b.text_zh].filter(Boolean);
          if (candidates.includes(text)) return true;
          return candidates.some((c) => {
            const cleanC = (c || '').replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?\d+\}/gi, '').replace(/^[^\p{L}\p{N}]+/gu, '').trim().toLowerCase();
            return cleanC && cleanMsgText && (cleanC === cleanMsgText);
          });
        }) : null;

        if (matchedBtn) {
          switch (matchedBtn.action) {
            case 'products':
              return sendCategoryList(bot, msg.chat.id, user);
            case 'support':
              return sendSupportMenu(bot, msg.chat.id, user);
            case 'wallet':
              return sendWalletMenu(bot, msg.chat.id, user, config);
            case 'deposit':
              return startDepositFlow(bot, msg, user, config);
            case 'api':
              return sendApiMenu(bot, msg.chat.id, user);
            case 'warranty':
              return sendWarrantyMenu(bot, msg.chat.id, user);
            case 'history':
              return sendOrderHistory(bot, msg.chat.id, user.id, 1, config.PAGE_SIZE);
            case 'start':
              return sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
            case 'checkin':
              {
                const { getBotTemplate, renderBotTemplate } = await import('./helpers/templateHelper.js');
                const rawTemplate = await getBotTemplate('template_checkin_info', userLang);
                const text = renderBotTemplate(rawTemplate, {
                  customer_name: user?.username ? `@${user.username}` : (user?.first_name || 'bạn'),
                  bonus: '1.000'
                });
                return bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
              }
            case 'lang':
              {
                const { createCallbackData } = await import('../utils/index.js');
                return bot.sendMessage(msg.chat.id, t('select_language', user.language || 'vi'), {
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
              }
            case 'custom_text':
              let customText = matchedBtn.custom_text_vi || matchedBtn.custom_text || '';
              if (userLang === 'en') customText = matchedBtn.custom_text_en || customText;
              else if (userLang === 'zh') customText = matchedBtn.custom_text_zh || customText;
              if (customText) {
                const { renderBotTemplate } = await import('./helpers/templateHelper.js');
                const { markdownToTelegramHtml } = await import('./helpers/telegramFormatHelper.js');
                const rendered = renderBotTemplate(customText, {
                  name: user?.username ? `@${user.username}` : (user?.first_name || 'bạn'),
                  username: user?.username ? `@${user.username}` : '',
                  id: String(user?.telegram_id || msg.chat.id),
                  balance: formatCurrency(user?.balance || 0),
                  credit: String(user?.credit || 0)
                });
                return bot.sendMessage(msg.chat.id, markdownToTelegramHtml(rendered), { parse_mode: 'HTML' });
              }
              break;
          }
        }
      } catch (err) {
        console.error('[listen.js] Dynamic button check error:', err.message);
      }

      // 1. Nút 🛍️ Sản phẩm
      if (
        text === '🛍️ Sản phẩm' || text === '🛍 Sản phẩm' || text === 'Sản phẩm' ||
        text === '🛒 Mua sản phẩm' || text === 'Mua sản phẩm' || text === '🛒 Mua tài khoản' || text === 'Mua tài khoản' ||
        text === '🛒 Mua hàng' || text === 'Mua hàng' || text === '🛒 Buy Products' || text === 'Buy Products' ||
        isMatchButton(text, 'btn_buy_menu', userLang) || isMatchButton(text, 'buy_product', userLang) || isMatchButton(text, 'product_list', userLang) || isMatchButton(text, 'btn_buy_accounts', userLang)
      ) {
        return sendCategoryList(bot, msg.chat.id, user);
      }

      // 2. Nút 💬 Hỗ trợ
      if (
        text === '💬 Hỗ trợ' || text === 'Hỗ trợ' ||
        text === '💬 Support' || text === 'Support' ||
        text === '🛟 Hỗ trợ / Bảo hành' || text === 'Hỗ trợ / Bảo hành' ||
        isMatchButton(text, 'btn_support', userLang) || text === '/support'
      ) {
        return sendSupportMenu(bot, msg.chat.id, user);
      }

      // 3. Nút 👛 Ví
      if (
        text === '👛 Ví' || text === 'Ví' || text === '👛 Wallet' || text === 'Wallet' ||
        text === '➕ Nạp tiền' || text === 'Nạp tiền' || text === '➕ Deposit' || text === 'Deposit' ||
        isMatchButton(text, 'btn_deposit', userLang) || isMatchButton(text, 'deposit', userLang) || text === '/wallet' || text === '/info'
      ) {
        return sendWalletMenu(bot, msg.chat.id, user, config);
      }

      // 4. Nút 🔗 API
      if (
        text === '🔗 API' || text === 'API' || text === '🔗 Tích hợp API' || text === '/api'
      ) {
        return sendApiMenu(bot, msg.chat.id, user);
      }

      // 5. Nút 🛡️ Bảo hành
      if (
        text === '🛡️ Bảo hành' || text === '🛡 Bảo hành' || text === 'Bảo hành' ||
        text === '🛡️ Warranty' || text === 'Warranty' || text === '/warranty'
      ) {
        return sendWarrantyMenu(bot, msg.chat.id, user);
      }

      if (isMatchButton(text, 'btn_main_menu', userLang) || text === '↩️ Menu chính' || text === 'Menu chính') {
        return sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
      }

      if (isMatchButton(text, 'btn_order_history', userLang) || text === '🧾 Lịch sử mua' || text === 'Lịch sử mua' || text === '🧾 History' || text === 'History') {
        return sendOrderHistory(bot, msg.chat.id, user.id, 1, config.PAGE_SIZE);
      }

      if (isMatchButton(text, 'btn_check_live', userLang) || text === '🔎 Check Live' || text === 'Check Live') return handleCheckLiveCommand(bot, msg, '');
      if (isMatchButton(text, 'btn_download_all', userLang) || text === '⬇️ Download All' || text === 'Download All') return startDownloadFlow(bot, msg.chat.id, msg.from.id);

      if (isMatchButton(text, 'btn_change_language', userLang) || text === '🌐 Ngôn ngữ' || text === 'Ngôn ngữ' || text === '🌐 Language' || text === '🌐 语言') {
        const { t } = await import('./helpers/langHelper.js');
        const { createCallbackData } = await import('../utils/index.js');
        return bot.sendMessage(msg.chat.id, t('select_language', user.language || 'vi'), {
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
      }

      if (text === '👥 Nhóm' || text === '👥 Group' || text === '👥 群组') {
        const { t } = await import('./helpers/langHelper.js');
        const lang = user.language || 'vi';
        let groupLink = config.TELEGRAM_GROUP_LINK || '';
        try {
          const rows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_group_link'");
          if (rows && rows[0]?.value) groupLink = rows[0].value;
        } catch (e) {}

        if (!groupLink) {
          const noLinkMsg = lang === 'en' ? '❌ Support group link not configured yet.' : '❌ Link nhóm hỗ trợ chưa được cấu hình.';
          return bot.sendMessage(msg.chat.id, noLinkMsg);
        }

        const groupMsg = t('join_group_msg', lang);
        return bot.sendMessage(msg.chat.id, groupMsg, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '👥 Tham gia nhóm', url: groupLink }]] }
        });
      }
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
          const { query } = await import('./database/index.js');
          const { getActivePromotion, calculatePromotedAmount } = await import('./controllers/depositPromotionController.js');
          
          const promo = await getActivePromotion(deposit.user_id);
          const { bonusAmount, finalAmount } = calculatePromotedAmount(amount, promo);

          await query('UPDATE deposits SET amount = ? WHERE id = ?', [finalAmount, deposit.id]);

          await updateDepositStatus(deposit.id, 'approved');
          await updateBalance(deposit.user_id, finalAmount);
          await addBalanceLog({
            userId: deposit.user_id,
            amount: finalAmount,
            reason: bonusAmount > 0 ? `deposit_promotion_bonus_${promo?.bonus_percentage || 0}%` : 'deposit_usdt',
            adminId: msg.from.id
          });

          delCache(`admin_approving_deposit_${msg.from.id}`);

          const u = await getUserById(deposit.user_id);
          const newBalance = Number(u.balance);

          let bonusNote = bonusAmount > 0 ? ` (bao gồm +${formatCurrency(bonusAmount)} khuyến mại)` : '';
          await bot.sendMessage(msg.chat.id, `✅ Đã duyệt nạp #${deposit.id}.\n💰 Số tiền nạp: ${formatCurrency(amount)}${bonusNote}\n💵 Tổng cộng vào ví: ${formatCurrency(finalAmount)}\n💵 Số dư mới người dùng: ${formatCurrency(newBalance)}`);

          // Notify user
          if (u) {
            await bot.sendMessage(u.telegram_id, `✅ Nạp tiền thành công!\n\n💰 Số tiền nhận: ${formatCurrency(finalAmount)}${bonusNote}\n💵 Số dư hiện tại: ${formatCurrency(newBalance)}\n📝 Mã giao dịch: #${deposit.id}`);
          }
          return;
        } else {
          return bot.sendMessage(msg.chat.id, '❌ Số tiền không hợp lệ. Vui lòng nhập lại số nguyên.');
        }
      }
    }



    // Xử lý nạp tiền USDT TRC20 (Nhập số tiền hoặc nhập mã TxID / Hash kiểm tra qua Binance)
    const { handleTrc20AmountInput, handleTrc20HashInput, handleUsdtAmountInput } = await import('./handle/handleDeposit.js');
    if (await handleTrc20AmountInput(bot, msg, user)) return;
    if (await handleTrc20HashInput(bot, msg, user)) return;
    if (await handleUsdtAmountInput(bot, msg, user, config)) return;

    // Nếu không phải input quantity cho Gmail/Mail, xử lý như deposit amount
    const handledDeposit = await handleDepositAmount(bot, msg, user, config);
    if (handledDeposit) return;

    // Chỉ lưu và phản hồi tin nhắn Hỗ trợ khi người dùng ĐÃ BẤM NÚT "Hỗ trợ / Bảo hành" trước đó
    const { getCache, delCache } = await import('../lib/cache/index.js');
    const isWaitingSupport = getCache(`waiting_support_request_${msg.from.id}`);

    if (isWaitingSupport && text && !text.startsWith('/')) {
      delCache(`waiting_support_request_${msg.from.id}`);
      try {
        const { query } = await import('./database/index.js');
        await query(
          'INSERT INTO support_requests (user_id, telegram_id, request_type, status, customer_message, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [user.id, msg.from.id, 'SUPPORT', 'processing', text]
        );
        const { getBotTemplate, renderBotTemplate } = await import('./helpers/templateHelper.js');
        const templateStr = await getBotTemplate('msg_support_received');
        const receivedMsg = renderBotTemplate(templateStr, {
          customer_name: user?.first_name || user?.username || 'Khách hàng',
          username: user?.username || '',
          telegram_id: msg.from.id,
          message_text: text,
          time: new Date().toLocaleString('vi-VN')
        });
        return bot.sendMessage(msg.chat.id, receivedMsg, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('[CHAT] Error saving customer message:', e);
      }
    }
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
      let data = {};
      try {
        data = JSON.parse(query.data);
      } catch {
        if (typeof query.data === 'string') {
          if (query.data.startsWith('category_products:')) {
            data = { action: 'category_products', catId: Number(query.data.split(':')[1]) };
          } else if (query.data.startsWith('view_product:')) {
            data = { action: 'view_product', productId: Number(query.data.split(':')[1]) };
          } else if (query.data === 'list_categories') {
            data = { action: 'back_to_categories' };
          } else {
            data = { action: query.data };
          }
        }
      }
      const chatId = query.message.chat.id;

      // Giữ QR khi user chỉ kiểm tra; reload/cancel tự xóa trong handler.
      if (data.action !== 'check_payment' && !['dl', 'dla'].includes(data.a)) {
        try {
          await bot.deleteMessage(chatId, query.message.message_id);
        } catch (e) {}
      }

      const user = await ensureUser(bot, { ...query.message, from: query.from, text: query.data });
      if (user?.is_banned) {
        return bot.answerCallbackQuery(query.id, {
          text: '🚫 Tài khoản của bạn đã bị khóa! Vui lòng liên hệ Admin.',
          show_alert: true
        });
      }

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
        case 'dl':
          return handleDownloadSelection(bot, query, 'download_one', data.i);
        case 'dla':
          return handleDownloadSelection(bot, query, 'download_all');
        case 'dlc':
          return handleDownloadSelection(bot, query, 'download_cancel');
        case 'capcut_buy_start':
          return startCapCutBuyFlow(bot, chatId, query.from.id);
        case 'capcut_start':
          return startCapCutFlow(bot, chatId, query.from.id);
        case 'netflix_info':
          return showNetflixMenu(bot, chatId, query.from.id);
        case 'netflix_start':
          return startNetflixFlow(bot, chatId, query.from.id);
        case 'apply_coupon_prompt':
          {
            const { waitingForCouponState } = await import('./handle/handleBuy.js');
            waitingForCouponState.set(String(query.from.id), { productId: data.productId });
            await bot.sendMessage(
              chatId,
              '🎟️ **VUI LÒNG GỬI MÃ GIẢM GIÁ (COUPON CODE) CỦA BẠN VÀO KHUNG CHAT:**\n\n*(Ví dụ: SALEOFF50)*',
              { parse_mode: 'Markdown' }
            );
            await bot.answerCallbackQuery(query.id);
            return;
          }
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
            return sendMenu(bot, chatId, user, config.TELEGRAM_GROUP_LINKS);
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

            // Cập nhật menu chính & keyboard theo ngôn ngữ mới
            return sendMenu(bot, chatId, user, config.TELEGRAM_GROUP_LINKS);
          }

        case 'wallet_info':
          await sendWalletMenu(bot, chatId, user, config);
          await bot.answerCallbackQuery(query.id);
          return;

        case 'start_deposit':
          {
            const { startDepositFlow } = await import('./handle/handleDeposit.js');
            await startDepositFlow(bot, query.message, user, config);
            await bot.answerCallbackQuery(query.id);
            return;
          }

        case 'deposit_history':
          {
            const { getBotTemplate, renderBotTemplate } = await import('./helpers/templateHelper.js');
            const deposits = await query(
              'SELECT id, amount, status, created_at FROM deposits WHERE user_id = ? ORDER BY id DESC LIMIT 10',
              [user.id]
            );
            const userLang = user?.language || 'vi';
            const statusMap = {
              approved: userLang === 'en' ? '✅ Approved' : (userLang === 'zh' ? '✅ 成功' : '✅ Thành công'),
              pending: userLang === 'en' ? '⏳ Pending' : (userLang === 'zh' ? '⏳ 待审核' : '⏳ Đang chờ duyệt'),
              rejected: userLang === 'en' ? '❌ Rejected' : (userLang === 'zh' ? '❌ 拒绝' : '❌ Thất bại')
            };
            let depositListStr = '';
            if (!deposits || deposits.length === 0) {
              depositListStr = userLang === 'en' ? '• No deposit history found.' : (userLang === 'zh' ? '• 暂无充值记录。' : '• Bạn chưa có lịch sử nạp tiền nào.');
            } else {
              depositListStr = deposits.map((d) => {
                const timeStr = d.created_at ? new Date(d.created_at).toLocaleString(userLang === 'zh' ? 'zh-CN' : (userLang === 'en' ? 'en-US' : 'vi-VN')) : '';
                return `• **#${d.id}** | ${formatCurrency(d.amount)} | ${statusMap[d.status] || d.status} | ${timeStr}`;
              }).join('\n');
            }
            const rawTemplate = await getBotTemplate('template_deposit_history', userLang);
            const text = renderBotTemplate(rawTemplate, {
              deposit_list: depositListStr
            });
            await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
            await bot.answerCallbackQuery(query.id);
            return;
          }

        case 'api_info':
          await sendApiMenu(bot, chatId, user);
          await bot.answerCallbackQuery(query.id);
          return;

        case 'regenerate_api_key':
          {
            const crypto = await import('crypto');
            const newKey = `sk_${crypto.randomBytes(16).toString('hex')}`;
            await query('UPDATE user_api_keys SET api_key = ? WHERE user_id = ?', [newKey, user.id]);
            await bot.sendMessage(chatId, `✅ **Đã tạo API Key mới thành công!**\n\`${newKey}\``, { parse_mode: 'Markdown' });
            await sendApiMenu(bot, chatId, user);
            await bot.answerCallbackQuery(query.id);
            return;
          }

        case 'warranty_info':
          await sendWarrantyMenu(bot, chatId, user);
          await bot.answerCallbackQuery(query.id);
          return;

        case 'start_warranty':
          await sendSupportMenu(bot, chatId, user);
          await bot.answerCallbackQuery(query.id);
          return;

        case 'support_info':
          await sendSupportMenu(bot, chatId, user);
          await bot.answerCallbackQuery(query.id);
          return;

        case 'order_history':
          await sendOrderHistory(bot, chatId, user.id, 1, config.PAGE_SIZE);
          await bot.answerCallbackQuery(query.id);
          return;

        case 'products':
          return sendProductList(bot, chatId, data.page || 1, config.PAGE_SIZE, user, data.catId, query.message?.message_id);
        case 'category_products':
          return sendProductList(bot, chatId, 1, config.PAGE_SIZE, user, data.catId, query.message?.message_id);
        case 'list_categories':
        case 'back_to_categories':
          return sendCategoryList(bot, chatId, user, query.message?.message_id);
        case 'view_product':
          try { await bot.answerCallbackQuery(query.id); } catch (e) {}
          const { showProductDetail } = await import('./handle/handleBuy.js');
          return showProductDetail(bot, chatId, data.productId, query.from.id, query.message?.message_id);
        case 'buy_product':
          return handlePurchase(bot, query.message, data.productId, query.from, config);

        case 'deposit_select_bank':
          const { promptForBankDeposit } = await import('./handle/handleDeposit.js');
          return promptForBankDeposit(bot, chatId, query.from.id, config);

        case 'select_bank_method':
          {
            const { selectBankMethod } = await import('./handle/handleDeposit.js');
            return selectBankMethod(bot, chatId, query.from.id, data.bank);
          }

        case 'back_to_deposit_options':
          {
            const { startDepositFlow } = await import('./handle/handleDeposit.js');
            return startDepositFlow(bot, query.message, user, config);
          }

        case 'deposit_select_usdt':
          const { showUsdtOptions } = await import('./handle/handleDeposit.js');
          return showUsdtOptions(bot, chatId, config);

        case 'deposit_usdt_wallet':
          const { showUsdtInfo } = await import('./handle/handleDeposit.js');
          return showUsdtInfo(bot, chatId, config);

        case 'deposit_select_binance':
          {
            try { await bot.answerCallbackQuery(query.id); } catch (e) {}
            const { showBinanceDepositInfo } = await import('./handle/handleDeposit.js');
            return showBinanceDepositInfo(bot, chatId, query.from.id, config, query.message?.message_id);
          }

        case 'check_binance_payment':
          {
            const { checkBinancePaymentForUser } = await import('./handle/handleDeposit.js');
            return checkBinancePaymentForUser(bot, chatId, query.from.id, config);
          }

        case 'deposit_usdt_trc20':
          const { showTrc20DepositFlow } = await import('./handle/handleDeposit.js');
          return showTrc20DepositFlow(bot, chatId, query.from.id, config, query.message?.message_id);

        case 'check_recent_trc20':
          const { checkRecentTrc20DepositForUser } = await import('./handle/handleDeposit.js');
          return checkRecentTrc20DepositForUser(bot, chatId, query.from.id, config);

        case 'check_payment':
          const { checkPaymentForUser } = await import('./services/autoDeposit.js');
          const result = await checkPaymentForUser(bot, query.from.id, config);
          return bot.sendMessage(chatId, result.message);
        case 'cancel_qr':
          return cancelQr(bot, chatId, query.from);
        case 'reload_qr':
          return reloadQr(bot, chatId, query.from);
        case 'user_orders':
          return sendOrderHistory(bot, chatId, user.id, data.page || 1, config.PAGE_SIZE);
        case 'user_order_detail':
          return sendOrderCredentials(bot, chatId, user.id, data.orderId);
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
          break;
      }
    } catch (err) {
      console.error('[CALLBACK_QUERY_ERROR]', err);
    } finally {
      await bot.answerCallbackQuery(query.id).catch(() => {});
    }
  });
};

