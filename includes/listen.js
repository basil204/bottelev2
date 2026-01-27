import { sendMenu, ensureUser, sendOrderHistory, sendUserInfo } from './handle/handleUser.js';
import { startDepositFlow, handleDepositAmount, cancelQr } from './handle/handleDeposit.js';
import { sendProductList, handlePurchase, handleManualOrderInput, handleProductQuantityInput } from './handle/handleBuy.js';




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

// Lưu config ở module level để có thể truy cập từ các callback
export let globalConfig = {};

export const registerListeners = (bot, config) => {
  globalConfig = config;
  bot.onText(/^\/start(.*)/i, async (msg, match) => {
    const user = await ensureUser(bot, msg);





    // Tạo nội dung tin nhắn gộp
    const groupLinks = config.TELEGRAM_GROUP_LINKS || [];
    const credit = user.credit || 0;

    let messageText = '';

    // Thêm phần chào mừng/ referral
    messageText += `🎉 **Chào mừng bạn đến với bot!**\n\n`;
    messageText += `👋 Xin chào! Chúng tôi rất vui được phục vụ bạn.\n\n`;

    // Thông tin tài khoản
    messageText += `👤 **Thông tin tài khoản:**\n`;
    messageText += `• ID: ${user.telegram_id}\n`;
    messageText += `• Số dư: ${formatCurrency(user.balance)}\n\n`;

    // Hướng dẫn sử dụng
    messageText += `💡 **Hướng dẫn sử dụng:**\n`;
    messageText += `• Sử dụng menu bên dưới để điều hướng\n`;
    messageText += `• Nạp tiền để mua sản phẩm\n\n`;



    // Gửi 1 tin nhắn duy nhất kèm menu
    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '➕ Nạp tiền' }, { text: '🛒 Mua sản phẩm' }],
          [{ text: '🧾 Lịch sử mua' }]

        ],
        resize_keyboard: true
      }
    };

    await bot.sendMessage(msg.chat.id, messageText, opts);
    await sendProductList(bot, msg.chat.id, 1, config.PAGE_SIZE);
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







  // Message listener for text flows
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();

    // Log incoming message
    console.log(`[CHAT] User ${msg.from.id} (${msg.from.username || msg.from.first_name}): ${text}`);

    // Ignore commands handled by onText
    if (text.startsWith('/')) return;

    const user = await ensureUser(bot, msg);

    // Kiểm tra input số lượng cho sản phẩm trước (ưu tiên cao nhất)
    const handledProduct = await handleProductQuantityInput(bot, msg, text, config);
    if (handledProduct) return; // Đã xử lý input số lượng sản phẩm

    // Kiểm tra manual order input (email/note)
    const handledManual = await handleManualOrderInput(bot, msg, user.telegram_id, config.ADMIN_IDS);
    if (handledManual) return; // Đã xử lý manual order input

    if (text === '➕ Nạp tiền') return startDepositFlow(bot, msg, user, config);
    if (text === '🛒 Mua sản phẩm') return sendProductList(bot, msg.chat.id, 1, config.PAGE_SIZE);
    if (text === '🧾 Lịch sử mua') return sendOrderHistory(bot, msg.chat.id, user.id, 1, config.PAGE_SIZE);

    // Thử xử lý như quantity input cho Mail


    // Nếu không phải input quantity cho Gmail/Mail, xử lý như deposit amount
    return handleDepositAmount(bot, msg, user, config);
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
        case 'products':
          return sendProductList(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'view_product':
          const { showProductDetail } = await import('./handle/handleBuy.js');
          return showProductDetail(bot, chatId, data.productId, query.from.id);
        case 'buy_product':
          return handlePurchase(bot, query.message, data.productId, query.from, config);

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




        case 'admin_delete_promotion':
          if (!await requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          const { adminDeletePromotion } = await import('./handle/handleAdmin.js');
          return adminDeletePromotion(bot, chatId, data.id);

        default:
          return;
      }
    } catch (err) {
      // Error handling without logging
    }
  });
};

