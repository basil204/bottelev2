import { sendMenu, ensureUser, sendOrderCredentials, sendOrderHistory, sendUserInfo, buildMainKeyboard, sendPurchaseMenu, sendUtilityMenu, sendTrackedMenu } from './handle/handleUser.js';
import { startDepositFlow, handleDepositAmount, cancelQr, reloadQr } from './handle/handleDeposit.js';
import { sendProductList, sendCategoryList, handlePurchase, handleManualOrderInput, handleProductQuantityInput } from './handle/handleBuy.js';
import { handleBuyGmailEdu, showGmailEduInfo, handleGmailEduQuantityInput } from './handle/handleGmailEdu.js';
import { showCapCutMenu, startCapCutFlow, startCapCutBuyFlow, handleCapCutInput } from './handle/handleCapCutSimple.js';
import { startDownloadFlow, handleDownloadInput, handleDownloadSelection } from './handle/handleDownload.js';
import { handleCheckLiveCommand } from './handle/handleCheckLive.js';
import { startLocketFlow, handleLocketInput } from './handle/handleLocket.js';

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
/start - Khởi động và xem hướng dẫn
/menu - Mở menu chính
/info - Xem tài khoản và số dư
/gmail - Mua Gmail EDU
/buymail gmail <số lượng> - Mua Gmail nhanh
/history - Xem lịch sử mua hôm nay
/getlink - Tải video, ảnh hoặc audio
/checklive - Kiểm tra Facebook, Instagram, TikTok
/lang - Đổi ngôn ngữ`;

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
    messageText += PUBLIC_COMMANDS_TEXT;
    if (config.ADMIN_IDS.includes(msg.from.id)) {
      messageText += `\n/admin - Mở bảng điều khiển Admin\n/kmnap - Quản lý khuyến mãi nạp`;
    }

    const opts = {
      parse_mode: 'Markdown',
      reply_markup: buildMainKeyboard(t, lang)
    };

    await sendTrackedMenu(bot, msg.chat.id, messageText, opts);
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

  // Command /gmail để mua Gmail EDU
  bot.onText(/^\/gmail/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await showGmailEduInfo(bot, msg.chat.id, user);
  });

  bot.onText(/^\/getlink(?:@\w+)?$/i, async (msg) => {
    await ensureUser(bot, msg);
    await startDownloadFlow(bot, msg.chat.id, msg.from.id);
  });

  bot.onText(/^\/checklive(?:@\w+)?(?:\s+([\s\S]+))?$/i, async (msg, match) => {
    await ensureUser(bot, msg);
    await handleCheckLiveCommand(bot, msg, match?.[1] || '');
  });

  // Lịch sử được ẩn khỏi bàn phím chính nhưng vẫn truy cập được bằng lệnh.
  bot.onText(/^\/(history|orders)(?:@\w+)?$/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendOrderHistory(bot, msg.chat.id, user.id, 1, config.PAGE_SIZE);
  });

  bot.onText(/^\/capcut/i, async (msg) => {
    await ensureUser(bot, msg);
    await showCapCutMenu(bot, msg.chat.id);
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
      const cleanTxt = txt.trim();
      return (
        cleanTxt.startsWith('/') ||
        cleanTxt === '❌ Huỷ' || cleanTxt === '❌ Hủy' || cleanTxt === '❌ Cancel' || cleanTxt === '❌ 取消' || isMatchButton(cleanTxt, 'cancel', userLang) ||
        cleanTxt === '➕ Nạp tiền' || cleanTxt === 'Nạp tiền' || cleanTxt === '➕ Deposit' || cleanTxt === 'Deposit' || cleanTxt === '➕ 充值' || cleanTxt === '充值' || isMatchButton(cleanTxt, 'btn_deposit', userLang) || isMatchButton(cleanTxt, 'deposit', userLang) ||
        cleanTxt === '🛒 Mua hàng' || cleanTxt === 'Mua hàng' || cleanTxt === '🛒 Mua sản phẩm' || cleanTxt === 'Mua sản phẩm' || cleanTxt === '🛒 Mua tài khoản' || cleanTxt === 'Mua tài khoản' || cleanTxt === '🛒 Buy Products' || cleanTxt === 'Buy Products' || cleanTxt === '🛒 Buy' || cleanTxt === '🛒 购买产品' || cleanTxt === '购买产品' || isMatchButton(cleanTxt, 'btn_buy_menu', userLang) || isMatchButton(cleanTxt, 'buy_product', userLang) || isMatchButton(cleanTxt, 'product_list', userLang) || isMatchButton(cleanTxt, 'btn_buy_accounts', userLang) ||
        cleanTxt === '📆 Điểm danh' || cleanTxt === 'Điểm danh' || cleanTxt === '📆 Check-in' || cleanTxt === 'Check-in' || cleanTxt === '📆 签到' || cleanTxt === '签到' || isMatchButton(cleanTxt, 'btn_checkin', userLang) ||
        cleanTxt === '🛟 Hỗ trợ / Bảo hành' || cleanTxt === 'Hỗ trợ / Bảo hành' || cleanTxt === '🛟 Support / Warranty' || cleanTxt === 'Support / Warranty' || cleanTxt === '🛟 客服 / 保修' || cleanTxt === '客服 / 保修' || isMatchButton(cleanTxt, 'btn_support', userLang) ||
        cleanTxt === 'Tiện ích' || cleanTxt === 'Utilities' || cleanTxt === '工具箱' || isMatchButton(cleanTxt, 'btn_utilities', userLang) ||
        cleanTxt === '🌐 Ngôn ngữ' || cleanTxt === 'Ngôn ngữ' || cleanTxt === '🌐 Language' || cleanTxt === 'Language' || cleanTxt === '🌐 语言' || cleanTxt === '语言' || isMatchButton(cleanTxt, 'btn_change_language', userLang) ||
        cleanTxt === '🧾 Lịch sử mua' || cleanTxt === 'Lịch sử mua' || cleanTxt === '🧾 History' || cleanTxt === 'History' || cleanTxt === '🧾 购买记录' || cleanTxt === '购买记录' || isMatchButton(cleanTxt, 'btn_order_history', userLang) ||
        cleanTxt === '↩️ Menu chính' || cleanTxt === 'Menu chính' || cleanTxt === '↩️ Main Menu' || cleanTxt === 'Main Menu' || cleanTxt === '↩️ 主菜单' || cleanTxt === '主菜单' || isMatchButton(cleanTxt, 'btn_main_menu', userLang) ||
        cleanTxt === '📧 Gmail EDU' || cleanTxt === 'Gmail EDU' || cleanTxt === '📧 Mua Gmail EDU' || cleanTxt === 'Mua Gmail EDU' || isMatchButton(cleanTxt, 'btn_buy_gmail_edu', userLang) ||
        cleanTxt === '🎬 CapCut Workspace' || cleanTxt === 'CapCut Workspace' ||
        cleanTxt === '🔎 Check Live' || cleanTxt === 'Check Live' || isMatchButton(cleanTxt, 'btn_check_live', userLang) ||
        cleanTxt === '⬇️ Download All' || cleanTxt === 'Download All' || isMatchButton(cleanTxt, 'btn_download_all', userLang) ||
        cleanTxt === '🔐 Locket' || cleanTxt === 'Locket' || isMatchButton(cleanTxt, 'btn_locket', userLang) ||
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
      delCache(`gmail_edu_waiting_${msg.from.id}`);
      delCache(`capcut_flow_${msg.from.id}`);
      delCache(`waiting_trc20_amount_${msg.from.id}`);
      delCache(`waiting_trc20_hash_${msg.from.id}`);
      delCache(`trc20_amount_${msg.from.id}`);
      delCache(`waiting_payment_proof_${msg.from.id}`);
      delCache(`download_all_waiting_${msg.from.id}`);
      delCache(`locket_lookup_waiting_${msg.from.id}`);
      delCache(`waiting_support_request_${msg.from.id}`);

      if (text === '❌ Huỷ' || text === '❌ Hủy' || text === '❌ Cancel' || text === '❌ 取消' || isMatchButton(text, 'cancel', userLang)) {
        const { cancelUploadState } = await import('./handle/handleDeposit.js');
        return cancelUploadState(bot, msg.chat.id, msg.from.id, config);
      }

      if (isMatchButton(text, 'btn_deposit', userLang) || isMatchButton(text, 'deposit', userLang) || text === '➕ Nạp tiền' || text === 'Nạp tiền' || text === '➕ Deposit' || text === 'Deposit' || text === '➕ 充值' || text === '充值') return startDepositFlow(bot, msg, user, config);
      if (isMatchButton(text, 'product_list', userLang) || isMatchButton(text, 'btn_buy_accounts', userLang) || text === '🛒 Mua sản phẩm' || text === 'Mua sản phẩm' || text === '🛒 Buy Products' || text === 'Buy Products' || text === '🛒 购买产品' || text === '购买产品') return sendCategoryList(bot, msg.chat.id, user);
      if (isMatchButton(text, 'btn_buy_menu', userLang) || isMatchButton(text, 'buy_product', userLang) || text === '🛒 Mua hàng' || text === 'Mua hàng' || text === '🛒 Mua hàng Gmail') return sendPurchaseMenu(bot, msg.chat.id, user);
      if (isMatchButton(text, 'btn_buy_accounts', userLang) || text === '🛒 Mua tài khoản' || text === 'Mua tài khoản') return sendCategoryList(bot, msg.chat.id, user);
      if (isMatchButton(text, 'btn_buy_gmail_edu', userLang) || text === '📧 Gmail EDU' || text === 'Gmail EDU' || text === '📧 Mua Gmail EDU' || text === 'Mua Gmail EDU') return showGmailEduInfo(bot, msg.chat.id, user);
      if (isMatchButton(text, 'btn_utilities', userLang) || text === 'Tiện ích' || text === 'Utilities' || text === '工具箱') return sendUtilityMenu(bot, msg.chat.id, user);
      if (isMatchButton(text, 'btn_check_live', userLang) || text === '🔎 Check Live' || text === 'Check Live') return handleCheckLiveCommand(bot, msg, '');
      if (isMatchButton(text, 'btn_download_all', userLang) || text === '⬇️ Download All' || text === 'Download All') return startDownloadFlow(bot, msg.chat.id, msg.from.id);
      if (isMatchButton(text, 'btn_locket', userLang) || text === '🔐 Locket' || text === 'Locket') return startLocketFlow(bot, msg.chat.id, msg.from.id);
      if (isMatchButton(text, 'btn_main_menu', userLang) || text === '↩️ Menu chính' || text === 'Menu chính') return sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
      if (text === '🎬 CapCut Workspace' || text === 'CapCut Workspace') return showCapCutMenu(bot, msg.chat.id);
      if (isMatchButton(text, 'btn_order_history', userLang) || text === '🧾 Lịch sử mua' || text === 'Lịch sử mua' || text === '🧾 History' || text === 'History' || text === '🧾 购买记录' || text === '购买记录') return sendOrderHistory(bot, msg.chat.id, user.id, 1, config.PAGE_SIZE);

      if (isMatchButton(text, 'btn_checkin', userLang) || text === '📆 Điểm danh' || text === 'Điểm danh' || text === '/checkin') {
        const checkinModule = await import('../modules/commands/checkin.js');
        return checkinModule.default.handler(bot, msg);
      }

      if (isMatchButton(text, 'btn_support', userLang) || text === '🛟 Hỗ trợ / Bảo hành' || text === 'Hỗ trợ / Bảo hành' || text === '/support') {
        setCache(`waiting_support_request_${msg.from.id}`, true, 10 * 60 * 1000);
        return bot.sendMessage(msg.chat.id, t('msg_support_guide', userLang));
      }

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

    // Kiểm tra state mua Gmail EDU (số lượng / mật khẩu)
    const handledGmailEdu = await handleGmailEduQuantityInput(bot, msg, config);
    if (handledGmailEdu) return;

    // Nếu không phải input quantity cho Gmail/Mail, xử lý như deposit amount
    const handledDeposit = await handleDepositAmount(bot, msg, user, config);
    if (handledDeposit) return;

    // Tự động lưu tin nhắn từ khách hàng vào Hệ thống Trò chuyện / Hỗ trợ (Realtime Live Chat)
    if (text && !text.startsWith('/')) {
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
      const data = JSON.parse(query.data);
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

            await sendTrackedMenu(bot, chatId, welcomeText, {
              parse_mode: 'Markdown',
              reply_markup: buildMainKeyboard(t, selectedLang)
            });

            return;
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
            await sendTrackedMenu(bot, chatId, t('menu_title', newLang), {
              parse_mode: 'Markdown',
              reply_markup: buildMainKeyboard(t, newLang)
            });
            return;
          }

        case 'gmail_pw_auto':
          {
            const { handleBuyGmailEdu } = await import('./handle/handleGmailEdu.js');
            await handleBuyGmailEdu(bot, query.message, user, data.qty || 1, user.language || 'vi', null, config);
            await bot.answerCallbackQuery(query.id);
            return;
          }
        case 'gmail_pw_custom':
          {
            const { setCache } = await import('../lib/cache/index.js');
            setCache(`gmail_edu_waiting_${query.from.id}`, {
              waitingPassword: true,
              quantity: data.qty || 1,
              lang: user.language || 'vi'
            }, 10 * 60 * 1000);
            const pwdMsg = user.language === 'en'
              ? '✏️ **Please enter your desired password** (at least 8 characters, containing uppercase, lowercase, numbers, and special symbols):'
              : '✏️ **Vui lòng nhập mật khẩu bạn muốn đặt** (tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt):';
            await bot.sendMessage(chatId, pwdMsg, { parse_mode: 'Markdown' });
            await bot.answerCallbackQuery(query.id);
            return;
          }
        case 'gmail_pw_cancel':
        case 'gmail_deposit_cancel':
          {
            const { delCache } = await import('../lib/cache/index.js');
            delCache(`gmail_edu_waiting_${query.from.id}`);
            delCache(`gmail_edu_purchase_${query.from.id}`);
            const cancelMsg = user.language === 'en' ? '❌ Cancelled Gmail EDU purchase.' : '❌ Đã hủy giao dịch mua Gmail EDU.';
            await bot.sendMessage(chatId, cancelMsg);
            await bot.answerCallbackQuery(query.id);
            return;
          }
        case 'gmail_buy_again':
          {
            const { showGmailEduInfo } = await import('./handle/handleGmailEdu.js');
            await showGmailEduInfo(bot, chatId, user);
            await bot.answerCallbackQuery(query.id);
            return;
          }
        case 'gmail_deposit_bank':
          {
            const { promptForBankDeposit } = await import('./handle/handleDeposit.js');
            await promptForBankDeposit(bot, chatId, query.from.id, config);
            await bot.answerCallbackQuery(query.id);
            return;
          }
        case 'gmail_deposit_usdt':
          {
            const { showUsdtOptions } = await import('./handle/handleDeposit.js');
            await showUsdtOptions(bot, chatId, config);
            await bot.answerCallbackQuery(query.id);
            return;
          }

        case 'products':
          // Need to fetch user to get language for pagination callback too?
          // If ensureUser wasn't called here (it was called above), we can pass it.
          // user variable in 'callback_query' listener: const user = await ensureUser(...)
          return sendProductList(bot, chatId, data.page || 1, config.PAGE_SIZE, user, data.catId);
        case 'category_products':
          return sendProductList(bot, chatId, 1, config.PAGE_SIZE, user, data.catId);
        case 'back_to_categories':
          return sendCategoryList(bot, chatId, user);
        case 'view_product':
          const { showProductDetail } = await import('./handle/handleBuy.js');
          return showProductDetail(bot, chatId, data.productId, query.from.id);
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

        case 'gmail_buy_again':
          return showGmailEduInfo(bot, chatId, user);

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

