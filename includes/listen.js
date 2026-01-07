import { sendMenu, ensureUser, sendOrderHistory, sendUserInfo } from './handle/handleUser.js';
import { startDepositFlow, handleDepositAmount, cancelQr, handleBankSelection } from './handle/handleDeposit.js';
import { sendProductList, handlePurchase, handleManualOrderInput } from './handle/handleBuy.js';
import { showGmailMenu, showGmailQuantityMenu, buyGmailAccount, buyGmailAccountDaily, handleBuyGmailCommand, handleGmailTypeSelection, handleGmailQuantityInput } from './handle/handleGmail.js';
import { showMailMenu, handleMailTypeSelection, handleMailQuantityInput } from './handle/handleMail.js';
import { showVipMenu, buyVipPackage, showVipHistory } from './handle/handleVip.js';
import { doCheckIn, processReferral } from './controllers/checkinController.js';
import { showCreditExchangeMenu, exchangeCreditForGmail } from './handle/handleCredit.js';
import { 
  adminShowGmailMenu,
  adminCheckAndDeleteNotLoggedIn,
  adminCreateGmailAccount,
  adminListGmailAccounts,
  adminCheckAccountStatus,
  adminCheckAllAccountsStatus,
  adminDeleteGmailAccount,
  adminGmailPricingMenu,
  adminParseUpdateGmailPrice
} from './handle/handleGmailAdmin.js';
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
import { listPendingDeposits, approveDeposit, rejectDeposit } from './handle/handleDeposit.js';
import { addBalanceLog } from './controllers/balanceLogController.js';
import { createCallbackData } from '../utils/index.js';

export const registerListeners = (bot, config) => {
  bot.onText(/^\/start(.*)/i, async (msg, match) => {
    const user = await ensureUser(bot, msg);
    
    // Xử lý referral code nếu có
    const referralCode = match[1] ? match[1].trim() : null;
    if (referralCode && referralCode.length > 0) {
      try {
        const referralResult = await processReferral(user.id, referralCode);
        if (referralResult.success) {
          await bot.sendMessage(
            msg.chat.id,
            `🎉 Chào mừng bạn đến với bot!\n\n` +
            `✅ Bạn đã sử dụng mã giới thiệu thành công!\n` +
            `💎 Người giới thiệu đã nhận được 3 credit.\n\n` +
            `💡 Sử dụng /checkin để nhận credit miễn phí mỗi ngày!`
          );
        }
        // Không hiển thị thông báo nếu đã sử dụng mã rồi (để tránh spam)
      } catch (error) {
        // Xử lý lỗi một cách im lặng để không làm gián đoạn flow
        console.error('[REFERRAL] Error processing referral:', error.message);
      }
    }
    
    await sendMenu(bot, msg.chat.id, user);
  });

  bot.onText(/^\/menu/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendMenu(bot, msg.chat.id, user);
  });

  bot.onText(/^\/info/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    await sendUserInfo(bot, msg.chat.id, user);
  });

  bot.onText(/^\/admin/i, async (msg) => {
    if (!requireAdmin(config.ADMIN_IDS, msg.from.id)) return bot.sendMessage(msg.chat.id, 'Không có quyền.');
    await adminMenu(bot, msg.chat.id);
  });

  bot.onText(/^\/user\s+(.+)/i, async (msg, match) => {
    if (!requireAdmin(config.ADMIN_IDS, msg.from.id)) return bot.sendMessage(msg.chat.id, 'Không có quyền.');
    const { handleUserCommand } = await import('./handle/handleAdmin.js');
    const args = match[1].trim().split(/\s+/);
    await handleUserCommand(bot, msg, args);
  });

  bot.onText(/^\/kmnap/i, async (msg) => {
    if (!requireAdmin(config.ADMIN_IDS, msg.from.id)) return bot.sendMessage(msg.chat.id, 'Không có quyền.');
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

  bot.onText(/^\/get/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    const { getUserCredit } = await import('./controllers/creditController.js');
    const { generateReferralCode, getReferralStats, createReferralLink } = await import('./controllers/checkinController.js');
    
    const currentCredit = await getUserCredit(user.id);
    const referralCode = await generateReferralCode(user.id);
    const referralStats = await getReferralStats(user.id);
    const referralLink = createReferralLink(config.BOT_USERNAME, referralCode);

    let referralText = `🔗 Mã giới thiệu của bạn:\n\`${referralCode}\``;
    if (referralLink) {
      referralText += `\n\n🔗 Link mời:\n${referralLink}`;
    }

    const message = `📋 Thông tin giới thiệu\n\n` +
                   `💰 Credit hiện tại: ${currentCredit}\n\n` +
                   `📊 Thống kê:\n` +
                   `• Tổng người giới thiệu: ${referralStats.total_referrals}\n` +
                   `• Credit từ giới thiệu: ${referralStats.total_credits_earned}\n\n` +
                   `${referralText}\n\n` +
                   `💡 Chia sẻ link này để nhận thêm 3 credit mỗi người!\n` +
                   `🎁 Mỗi người join qua link của bạn = +3 credit cho bạn!`;

    await bot.sendMessage(msg.chat.id, message);
  });

  bot.onText(/^\/checkin/i, async (msg) => {
    const user = await ensureUser(bot, msg);
    const result = await doCheckIn(user.id);

    if (!result.success) {
      const hours = result.hoursRemaining || 0;
      const minutes = Math.ceil((hours - Math.floor(hours)) * 60);
      return bot.sendMessage(
        msg.chat.id,
        `⏰ Bạn đã check-in rồi!\n\n⏳ Thời gian còn lại: ${Math.floor(hours)} giờ ${minutes} phút\n\n💡 Hãy quay lại sau 24 giờ để check-in tiếp.`
      );
    }

    const { getUserCredit } = await import('./controllers/creditController.js');
    const { generateReferralCode, getReferralStats, createReferralLink } = await import('./controllers/checkinController.js');
    
    const currentCredit = await getUserCredit(user.id);
    const referralCode = await generateReferralCode(user.id);
    const referralStats = await getReferralStats(user.id);
    const referralLink = createReferralLink(config.BOT_USERNAME, referralCode);

    let referralText = `🔗 Mã giới thiệu của bạn:\n\`${referralCode}\``;
    if (referralLink) {
      referralText += `\n\n🔗 Link mời:\n${referralLink}`;
    }

    const message = `✅ Check-in thành công!\n\n` +
                   `🎁 Nhận được: 1 Credit\n` +
                   `💰 Credit hiện tại: ${currentCredit}\n\n` +
                   `📊 Thống kê:\n` +
                   `• Tổng người giới thiệu: ${referralStats.total_referrals}\n` +
                   `• Credit từ giới thiệu: ${referralStats.total_credits_earned}\n\n` +
                   `${referralText}\n\n` +
                   `💡 Chia sẻ link này để nhận thêm 3 credit mỗi người!`;

    await bot.sendMessage(msg.chat.id, message);
  });

  bot.onText(/^\/buygmail/i, async (msg) => {
    const text = msg.text.trim();
    const parts = text.split(/\s+/);
    
    if (parts.length !== 3) {
      return bot.sendMessage(msg.chat.id, 'Sai cú pháp.\n\nSử dụng:\n/buygmail gmail <số_lượng>\n/buygmail gmailnon <số_lượng>\n\nVí dụ:\n/buygmail gmail 1\n/buygmail gmailnon 1');
    }
    
    const typeStr = parts[1].toLowerCase();
    const quantityStr = parts[2];
    await handleBuyGmailCommand(bot, msg, typeStr, quantityStr);
  });

  // Message listener for text flows
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    const user = await ensureUser(bot, msg);

    if (text === '➕ Nạp tiền') return startDepositFlow(bot, msg, user, config);
    if (text === '🛒 Mua sản phẩm') return sendProductList(bot, msg.chat.id, 1, config.PAGE_SIZE);
    if (text === '📧 Mua Gmail') return showGmailMenu(bot, msg.chat.id);
    if (text === '📧 Mua Mail') return showMailMenu(bot, msg.chat.id);
    if (text === '⭐ Gói VIP') return showVipMenu(bot, msg.chat.id, user);
    if (text === '🧾 Lịch sử mua') return sendOrderHistory(bot, msg.chat.id, user.id, 1, config.PAGE_SIZE);
    if (text === '🎁 Check-in') {
      const result = await doCheckIn(user.id);
      if (!result.success) {
        const hours = result.hoursRemaining || 0;
        const minutes = Math.ceil((hours - Math.floor(hours)) * 60);
        return bot.sendMessage(
          msg.chat.id,
          `⏰ Bạn đã check-in rồi!\n\n⏳ Thời gian còn lại: ${Math.floor(hours)} giờ ${minutes} phút\n\n💡 Hãy quay lại sau 24 giờ để check-in tiếp.`
        );
      }
      const { getUserCredit } = await import('./controllers/creditController.js');
      const { generateReferralCode, getReferralStats, createReferralLink } = await import('./controllers/checkinController.js');
      const currentCredit = await getUserCredit(user.id);
      const referralCode = await generateReferralCode(user.id);
      const referralStats = await getReferralStats(user.id);
      const referralLink = createReferralLink(config.BOT_USERNAME, referralCode);
      
      let referralText = `🔗 Mã giới thiệu của bạn:\n\`${referralCode}\``;
      if (referralLink) {
        referralText += `\n\n🔗 Link mời:\n${referralLink}`;
      }
      
      const message = `✅ Check-in thành công!\n\n` +
                     `🎁 Nhận được: 1 Credit\n` +
                     `💰 Credit hiện tại: ${currentCredit}\n\n` +
                     `📊 Thống kê:\n` +
                     `• Tổng người giới thiệu: ${referralStats.total_referrals}\n` +
                     `• Credit từ giới thiệu: ${referralStats.total_credits_earned}\n\n` +
                     `${referralText}\n\n` +
                     `💡 Chia sẻ link này để nhận thêm 3 credit mỗi người!`;
      return bot.sendMessage(msg.chat.id, message);
    }
    if (text === '💎 Đổi Credit') return showCreditExchangeMenu(bot, msg.chat.id, user);

    // Kiểm tra manual order input trước (email/note)
    const handledManual = await handleManualOrderInput(bot, msg, user.telegram_id, config.ADMIN_IDS);
    if (handledManual) return; // Đã xử lý manual order input

    // Kiểm tra xem có đang chờ input quantity cho Gmail hoặc Mail không
    if (/^\d+$/.test(text)) {
      // Thử xử lý như quantity input cho Gmail trước
      const handledGmail = await handleGmailQuantityInput(bot, msg, text);
      if (handledGmail) return; // Đã xử lý, không cần check deposit nữa
      
      // Thử xử lý như quantity input cho Mail
      const handledMail = await handleMailQuantityInput(bot, msg, user);
      if (handledMail) return; // Đã xử lý, không cần check deposit nữa
      
      // Nếu không phải input quantity cho Gmail/Mail, xử lý như deposit amount
      return handleDepositAmount(bot, msg, user, config);
    }
  });

  // Callback query listener
  bot.on('callback_query', async (query) => {
    try {
      const data = JSON.parse(query.data);
      const chatId = query.message.chat.id;
      const user = await ensureUser(bot, { ...query.message, from: query.from, text: query.data });

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
        case 'buy_product':
          return handlePurchase(bot, query.message, data.productId, query.from);
        case 'select_bank':
          return handleBankSelection(bot, chatId, query.from.id, data.bank);
        case 'cancel_qr':
          return cancelQr(bot, chatId, query.from);
        case 'user_orders':
          return sendOrderHistory(bot, chatId, user.id, data.page || 1, config.PAGE_SIZE);
        case 'buy_vip':
          return buyVipPackage(bot, query.message, user);
        case 'vip_history':
          return showVipHistory(bot, chatId, user.id, data.page || 1, config.PAGE_SIZE);
        case 'back_to_menu':
          return sendMenu(bot, chatId, user);
        case 'admin_products':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminProducts(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'admin_add_product':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          bot.once('message', (m) => adminParseAddProduct(bot, m));
          return adminAddProduct(bot, chatId);
        case 'admin_delete_product':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminDeleteProduct(bot, chatId, data.id);
        case 'admin_edit_product':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          bot.once('message', (m) => adminUpdateProduct(bot, m, data.id));
          return adminEditProductPrompt(bot, chatId, data.id);
        case 'admin_accounts':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          // Hỗ trợ cả format đầy đủ và format ngắn
          const productId = data.productId || data.p;
          const page = data.page || data.pg || 1;
          const status = data.status || data.s || null;
          // Hardcode 10 tài khoản mỗi trang
          return adminListAccounts(bot, chatId, productId, page, 10, status);
        case 'admin_add_account':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          bot.once('message', (m) => adminParseAddAccount(bot, m, data.productId));
          return adminAddAccount(bot, chatId, data.productId);
        case 'admin_upload_account':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          await bot.sendMessage(chatId, 'Gửi file .txt hoặc dán nội dung username|password mỗi dòng.');
          bot.once('message', (m) => adminParseUploadAccounts(bot, m, data.productId));
          return;
        case 'admin_delete_account':
        case 'del_acc': // Hỗ trợ format ngắn
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          // Hỗ trợ cả format đầy đủ và format ngắn
          const accountId = data.accountId || data.ac;
          const delProductId = data.productId || data.p;
          const delPage = data.page || data.pg || 1;
          const delStatus = data.status || data.s || null;
          return adminDeleteAccount(bot, chatId, accountId, delProductId, delPage, delStatus);
        case 'admin_delete_accounts_by_status':
        case 'del_all': // Hỗ trợ format ngắn
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          // Hỗ trợ cả format đầy đủ và format ngắn
          const delByStatusProductId = data.productId || data.p;
          const delStatusValue = data.status || data.s;
          const delByStatusPage = data.page || data.pg || 1;
          return adminDeleteAccountsByStatus(bot, chatId, delByStatusProductId, delStatusValue, delByStatusPage);
        case 'admin_accounts_pick':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminProducts(bot, chatId, 1, config.PAGE_SIZE);
        case 'admin_deposits':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return listPendingDeposits(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'approve_deposit':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return approveDeposit(bot, chatId, data.id, query.from);
        case 'reject_deposit':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return rejectDeposit(bot, chatId, data.id, query.from);
        case 'admin_users':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminListUsers(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'admin_adjust_balance':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          bot.once('message', (m) => adminParseAdjustBalance(bot, m, addBalanceLog));
          return adminAdjustBalance(bot, chatId);
        case 'admin_user_orders':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminUserOrders(bot, chatId, data.userId, data.page || 1, config.PAGE_SIZE);
        case 'admin_user_logs':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminUserBalances(bot, chatId, data.userId, data.page || 1, config.PAGE_SIZE);
        case 'admin_manual_orders':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminListManualOrders(bot, chatId, data.page || 1, config.PAGE_SIZE);
        case 'admin_complete_order':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminCompleteManualOrder(bot, chatId, data.orderId, query.from);
        case 'gmail_menu':
          return showGmailMenu(bot, chatId);
        case 'gmail_select_type':
          const selectedType = data.type || data.t;
          if (selectedType) {
            return handleGmailTypeSelection(bot, chatId, query.from.id, selectedType);
          }
          return showGmailMenu(bot, chatId);
        case 'mail_sel':
          // Support both old format (select_mail_type) and new format (mail_sel)
          const mailAccountType = data.accountType || data.t;
          const mailPrice = data.price || data.p;
          if (mailAccountType && mailPrice) {
            return handleMailTypeSelection(bot, chatId, query.from.id, mailAccountType, mailPrice);
          }
          return;
        case 'select_mail_type':
          // Backward compatibility
          if (data.accountType && data.price) {
            return handleMailTypeSelection(bot, chatId, query.from.id, data.accountType, data.price);
          }
          return;
        case 'buy_gmail':
          const buyType = data.type || data.t;
          const buyDuration = data.duration || data.d;
          const buyQuantity = data.quantity || data.q || 1;
          // Tạo message object giả với from từ query để tương thích với buyGmailAccount
          const msgObj = {
            ...query.message,
            from: query.from
          };
          if (buyDuration === 'single') {
            return buyGmailAccount(bot, msgObj, buyType, buyQuantity);
          } else if (buyDuration === 'daily') {
            return buyGmailAccountDaily(bot, msgObj, buyType, buyQuantity);
          }
          return;
        case 'admin_gmail_menu':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminShowGmailMenu(bot, chatId);
        case 'admin_gmail_create_menu':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          await bot.sendMessage(chatId, 'Nhập: type,domain,quantity\nVí dụ: edu,example.edu,10 hoặc non,example.com,5');
          bot.once('message', async (m) => {
            const parts = m.text.split(',');
            if (parts.length === 3) {
              const [type, domain, quantity] = parts;
              await adminCreateGmailAccount(bot, chatId, type.trim(), domain.trim(), parseInt(quantity.trim()));
            } else {
              await bot.sendMessage(chatId, 'Định dạng không đúng. Ví dụ: edu,example.edu,10');
            }
          });
          return;
        case 'admin_gmail_list_menu':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          const listKeyboard = {
            inline_keyboard: [
              [
                { text: '📧 Edu Available', callback_data: createCallbackData({ action: 'admin_gmail_list', type: 'edu', status: 'available', page: 1 }) },
                { text: '🌐 Non Available', callback_data: createCallbackData({ action: 'admin_gmail_list', type: 'non', status: 'available', page: 1 }) }
              ],
              [
                { text: '💰 Edu Sold', callback_data: createCallbackData({ action: 'admin_gmail_list', type: 'edu', status: 'sold', page: 1 }) },
                { text: '💰 Non Sold', callback_data: createCallbackData({ action: 'admin_gmail_list', type: 'non', status: 'sold', page: 1 }) }
              ],
              [
                { text: '📋 Tất cả', callback_data: createCallbackData({ action: 'admin_gmail_list', page: 1 }) }
              ]
            ]
          };
          return bot.sendMessage(chatId, 'Chọn loại danh sách:', { reply_markup: listKeyboard });
        case 'admin_gmail_list':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminListGmailAccounts(bot, chatId, data.type || null, data.status || null, data.page || 1, config.PAGE_SIZE);
        case 'admin_gmail_check_status':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          await bot.sendMessage(chatId, 'Nhập ID account cần check (hoặc "all" để check tất cả):');
          bot.once('message', async (m) => {
            if (m.text.toLowerCase() === 'all') {
              return adminCheckAllAccountsStatus(bot, chatId);
            }
            const accountId = parseInt(m.text);
            if (isNaN(accountId)) {
              return bot.sendMessage(chatId, 'ID không hợp lệ.');
            }
            return adminCheckAccountStatus(bot, chatId, accountId);
          });
          return;
        case 'admin_gmail_delete':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          await bot.sendMessage(chatId, 'Nhập ID account cần xóa:');
          bot.once('message', async (m) => {
            const accountId = parseInt(m.text);
            if (isNaN(accountId)) {
              return bot.sendMessage(chatId, 'ID không hợp lệ.');
            }
            return adminDeleteGmailAccount(bot, chatId, accountId);
          });
          return;
        case 'admin_gmail_check_delete':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          return adminCheckAndDeleteNotLoggedIn(bot, chatId);
        case 'admin_gmail_pricing':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          await bot.sendMessage(chatId, 'Nhập để sửa giá theo format: type|duration|quantity|price\nVí dụ: edu|single|1|700');
          bot.once('message', (m) => adminParseUpdateGmailPrice(bot, m));
          return adminGmailPricingMenu(bot, chatId);
        case 'admin_delete_promotion':
          if (!requireAdmin(config.ADMIN_IDS, query.from.id)) return;
          const { adminDeletePromotion } = await import('./handle/handleAdmin.js');
          return adminDeletePromotion(bot, chatId, data.id);
        case 'exchange_credit':
        case 'ex_cr': // Format ngắn
          // Hỗ trợ cả format đầy đủ và format ngắn
          const exchangeType = data.type || data.t;
          const exchangeDuration = data.duration || data.d;
          const exchangeCost = data.cost || data.c;
          
          // Map duration ngắn về đầy đủ
          let mappedDuration = exchangeDuration;
          if (exchangeDuration === 's') mappedDuration = 'single';
          if (exchangeDuration === 'd') mappedDuration = 'daily';
          
          if (exchangeType && mappedDuration && exchangeCost) {
            const msgObj = {
              ...query.message,
              from: query.from,
              chat: query.message.chat
            };
            return exchangeCreditForGmail(bot, msgObj, user, exchangeType, mappedDuration, exchangeCost);
          }
          return;
        default:
          return;
      }
    } catch (err) {
      // Error handling without logging
    }
  });
};

