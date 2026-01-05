import { 
  createGmailAccount, 
  createMultipleGmailAccounts,
  deleteGmailAccount,
  listGmailAccounts,
  checkLoginStatus,
  checkAllAccountsLoginStatus,
  getAvailableDomains,
  countAvailableAccounts
} from '../controllers/gmailAccountController.js';
import { getAllGmailPricing, updateGmailPrice } from '../controllers/gmailPricingController.js';
import { formatCurrency, createCallbackData } from '../../utils/index.js';
import { logEvent, logError } from '../../utils/log.js';

// Admin: Tạo Gmail account
export const adminCreateGmailAccount = async (bot, chatId, type, domain, quantity = 1) => {
  try {
    if (!domain) {
      return bot.sendMessage(chatId, 'Vui lòng nhập domain.');
    }

    if (quantity <= 0 || quantity > 100) {
      return bot.sendMessage(chatId, 'Số lượng phải từ 1 đến 100.');
    }

    await bot.sendMessage(chatId, `Đang tạo ${quantity} tài khoản ${type === 'edu' ? 'Gmail Edu' : 'Google Non'} với domain ${domain}...`);

    const results = await createMultipleGmailAccounts(type, domain, quantity);
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    const message = `✅ Đã tạo thành công ${successCount} tài khoản.\n` +
                   (failCount > 0 ? `❌ Thất bại: ${failCount} tài khoản.\n` : '') +
                   `📧 Domain: ${domain}\n` +
                   `🏷️ Loại: ${type === 'edu' ? 'Gmail Edu' : 'Google Non'}`;

    await bot.sendMessage(chatId, message);

    logEvent('admin_gmail_accounts_created', { type, domain, quantity, successCount, failCount });

  } catch (error) {
    logError({ context: 'adminCreateGmailAccount', error: error.message });
    bot.sendMessage(chatId, `Lỗi: ${error.message}`);
  }
};

// Admin: Xóa Gmail account
export const adminDeleteGmailAccount = async (bot, chatId, accountId) => {
  try {
    const result = await deleteGmailAccount(accountId);
    if (result.success) {
      await bot.sendMessage(chatId, `✅ Đã xóa account #${accountId}`);
    } else {
      await bot.sendMessage(chatId, `❌ Lỗi: ${result.error}`);
    }
  } catch (error) {
    logError({ context: 'adminDeleteGmailAccount', error: error.message });
    bot.sendMessage(chatId, `Lỗi: ${error.message}`);
  }
};

// Admin: List Gmail accounts
export const adminListGmailAccounts = async (bot, chatId, type, status, page = 1, pageSize = 10) => {
  try {
    const offset = (page - 1) * pageSize;
    const { rows, total } = await listGmailAccounts(type, status, offset, pageSize);

    if (!rows.length) {
      return bot.sendMessage(chatId, 'Không có tài khoản nào.');
    }

    const lines = rows.map(acc => {
      const statusEmoji = acc.status === 'available' ? '✅' : acc.status === 'sold' ? '💰' : '❌';
      return `${statusEmoji} #${acc.id} | ${acc.email} | ${acc.type} | ${acc.status}`;
    });

    const message = lines.join('\n') + `\n\nTrang ${page}/${Math.ceil(total / pageSize)} (Tổng: ${total})`;

    const keyboard = {
      inline_keyboard: [
        ...(page > 1 ? [[{ text: '◀️ Trước', callback_data: createCallbackData({ action: 'admin_gmail_list', type, status, page: page - 1 }) }]] : []),
        ...(offset + rows.length < total ? [[{ text: '▶️ Sau', callback_data: createCallbackData({ action: 'admin_gmail_list', type, status, page: page + 1 }) }]] : [])
      ]
    };

    await bot.sendMessage(chatId, message, { reply_markup: keyboard });

  } catch (error) {
    logError({ context: 'adminListGmailAccounts', error: error.message });
    bot.sendMessage(chatId, `Lỗi: ${error.message}`);
  }
};

// Admin: Check login status của một account
export const adminCheckAccountStatus = async (bot, chatId, accountId) => {
  try {
    const result = await checkLoginStatus(accountId);
    
    if (!result.success) {
      return bot.sendMessage(chatId, `❌ ${result.error}`);
    }

    const statusText = result.isLoggedIn ? '✅ ĐÃ ĐĂNG NHẬP' : '⏳ CHƯA ĐĂNG NHẬP';
    let message = `📧 Account: ${result.email}\n` +
                 `📊 Trạng thái: ${statusText}\n`;

    if (result.lastLoginTime) {
      const loginDate = new Date(result.lastLoginTime);
      message += `🕐 Lần đăng nhập cuối: ${loginDate.toLocaleString('vi-VN')}`;
    } else {
      message += `🕐 Lần đăng nhập cuối: Chưa có`;
    }

    await bot.sendMessage(chatId, message);

  } catch (error) {
    logError({ context: 'adminCheckAccountStatus', error: error.message });
    bot.sendMessage(chatId, `Lỗi: ${error.message}`);
  }
};

// Admin: Check login status của tất cả accounts
export const adminCheckAllAccountsStatus = async (bot, chatId) => {
  try {
    await bot.sendMessage(chatId, 'Đang kiểm tra trạng thái đăng nhập của tất cả accounts...');

    const results = await checkAllAccountsLoginStatus();
    
    const loggedInCount = results.filter(r => r.isLoggedIn).length;
    const notLoggedInCount = results.filter(r => !r.isLoggedIn).length;

    const message = `📊 **Kết quả kiểm tra:**\n\n` +
                   `✅ Đã đăng nhập: ${loggedInCount} account(s)\n` +
                   `⏳ Chưa đăng nhập: ${notLoggedInCount} account(s)\n` +
                   `📧 Tổng số: ${results.length} account(s)`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    logEvent('admin_check_all_accounts_status', { total: results.length, loggedIn: loggedInCount, notLoggedIn: notLoggedInCount });

  } catch (error) {
    logError({ context: 'adminCheckAllAccountsStatus', error: error.message });
    bot.sendMessage(chatId, `Lỗi: ${error.message}`);
  }
};

// Admin: Check và xóa accounts chưa login
export const adminCheckAndDeleteNotLoggedIn = async (bot, chatId) => {
  try {
    await bot.sendMessage(chatId, '⏳ Đang check và xóa accounts chưa login...\n\n📋 **Quy tắc xóa:**\n• Edu: Xóa sau 24h nếu chưa login\n• Non: Xóa sau 72h nếu chưa login', { parse_mode: 'Markdown' });
    
    // Import hàm checkAccountsByType
    const { checkAccountsByType } = await import('../services/gmailAutoDelete.js');
    
    // Check Edu accounts
    const eduResult = await checkAccountsByType('edu');
    
    // Check Non accounts
    const nonResult = await checkAccountsByType('non');
    
    // Tổng hợp kết quả
    const totalLoggedIn = eduResult.loggedIn + nonResult.loggedIn;
    const totalNotLoggedIn = eduResult.notLoggedIn + nonResult.notLoggedIn;
    const totalDeleted = eduResult.deleted + nonResult.deleted;
    const totalErrors = eduResult.errors + nonResult.errors;
    const totalAccounts = eduResult.total + nonResult.total;
    
    const resultText = `✅ **Hoàn thành check và xóa**

📊 **Kết quả Edu:**
• Tổng: ${eduResult.total}
• Đã login: ${eduResult.loggedIn}
• Chưa login: ${eduResult.notLoggedIn}
• Đã xóa: ${eduResult.deleted}
• Lỗi: ${eduResult.errors}

📊 **Kết quả Non:**
• Tổng: ${nonResult.total}
• Đã login: ${nonResult.loggedIn}
• Chưa login: ${nonResult.notLoggedIn}
• Đã xóa: ${nonResult.deleted}
• Lỗi: ${nonResult.errors}

📈 **Tổng hợp:**
• Tổng accounts: ${totalAccounts}
• Đã login: ${totalLoggedIn}
• Chưa login: ${totalNotLoggedIn}
• Đã xóa: ${totalDeleted}
• Lỗi: ${totalErrors}`;

    await bot.sendMessage(chatId, resultText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('[ADMIN_CHECK_DELETE] Lỗi:', error);
    await bot.sendMessage(chatId, `❌ Lỗi khi check và xóa: ${error.message}`);
  }
};

// Admin: Show Gmail management menu
export const adminShowGmailMenu = async (bot, chatId) => {
  const eduCount = await countAvailableAccounts('edu');
  const nonCount = await countAvailableAccounts('non');

  const menuText = `🔧 **Quản lý Gmail Accounts**

**Tồn kho:**
• Gmail Edu: ${eduCount} account(s)
• Google Non: ${nonCount} account(s)

Chọn chức năng:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '➕ Tạo account', callback_data: createCallbackData({ action: 'admin_gmail_create_menu' }) },
        { text: '📋 Danh sách', callback_data: createCallbackData({ action: 'admin_gmail_list_menu' }) }
      ],
      [
        { text: '✅ Check login status', callback_data: createCallbackData({ action: 'admin_gmail_check_status' }) },
        { text: '🗑️ Xóa account', callback_data: createCallbackData({ action: 'admin_gmail_delete' }) }
      ],
      [
        { text: '🔍 Check & Xóa chưa login', callback_data: createCallbackData({ action: 'admin_gmail_check_delete' }) }
      ],
      [
        { text: '💰 Quản lý giá', callback_data: createCallbackData({ action: 'admin_gmail_pricing' }) }
      ]
    ]
  };

  await bot.sendMessage(chatId, menuText, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
};

// Admin: Hiển thị menu quản lý giá Gmail
export const adminGmailPricingMenu = async (bot, chatId) => {
  try {
    const pricing = await getAllGmailPricing();
    
    let message = '💰 **Quản lý giá Gmail**\n\n';
    
    if (pricing.length === 0) {
      message += 'Chưa có giá nào được thiết lập.\n';
    } else {
      // Nhóm theo type
      const eduPrices = pricing.filter(p => p.type === 'edu');
      const nonPrices = pricing.filter(p => p.type === 'non');
      
      if (eduPrices.length > 0) {
        message += '**📧 Gmail Edu:**\n';
        const single = eduPrices.filter(p => p.duration === 'single');
        const daily = eduPrices.filter(p => p.duration === 'daily');
        
        if (single.length > 0) {
          message += '  • Single:\n';
          single.forEach(p => {
            message += `    - ${p.quantity} account(s): ${formatCurrency(p.price)}\n`;
          });
        }
        if (daily.length > 0) {
          message += '  • Daily:\n';
          daily.forEach(p => {
            message += `    - ${p.quantity} account(s): ${formatCurrency(p.price)}\n`;
          });
        }
        message += '\n';
      }
      
      if (nonPrices.length > 0) {
        message += '**🌐 Google Non:**\n';
        const single = nonPrices.filter(p => p.duration === 'single');
        const daily = nonPrices.filter(p => p.duration === 'daily');
        
        if (single.length > 0) {
          message += '  • Single:\n';
          single.forEach(p => {
            message += `    - ${p.quantity} account(s): ${formatCurrency(p.price)}\n`;
          });
        }
        if (daily.length > 0) {
          message += '  • Daily:\n';
          daily.forEach(p => {
            message += `    - ${p.quantity} account(s): ${formatCurrency(p.price)}\n`;
          });
        }
      }
    }
    
    message += '\nNhập để sửa giá theo format:\n';
    message += '`type|duration|quantity|price`\n\n';
    message += 'Ví dụ:\n';
    message += '• `edu|single|1|700` - Sửa giá Edu Single 1 account = 700 VNĐ\n';
    message += '• `non|single|1|4000` - Sửa giá Non Single 1 account = 4000 VNĐ\n';
    message += '• `edu|single|10|6500` - Sửa giá Edu Single 10 accounts = 6500 VNĐ';
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Về menu', callback_data: createCallbackData({ action: 'admin_gmail_menu' }) }]
        ]
      }
    });
  } catch (error) {
    logError({ context: 'adminGmailPricingMenu', error: error.message });
    bot.sendMessage(chatId, `Lỗi: ${error.message}`);
  }
};

// Admin: Parse và cập nhật giá Gmail
export const adminParseUpdateGmailPrice = async (bot, msg) => {
  try {
    const parts = msg.text.split('|').map(x => x.trim());
    if (parts.length !== 4) {
      return bot.sendMessage(msg.chat.id, '❌ Sai định dạng. Nhập: type|duration|quantity|price');
    }
    
    const [type, duration, quantityStr, priceStr] = parts;
    
    // Validate
    if (!['edu', 'non'].includes(type)) {
      return bot.sendMessage(msg.chat.id, '❌ Type phải là "edu" hoặc "non"');
    }
    if (!['single', 'daily'].includes(duration)) {
      return bot.sendMessage(msg.chat.id, '❌ Duration phải là "single" hoặc "daily"');
    }
    
    const quantity = parseInt(quantityStr);
    const price = parseFloat(priceStr);
    
    if (isNaN(quantity) || quantity <= 0) {
      return bot.sendMessage(msg.chat.id, '❌ Quantity phải là số nguyên dương');
    }
    if (isNaN(price) || price < 0) {
      return bot.sendMessage(msg.chat.id, '❌ Price phải là số >= 0');
    }
    
    await updateGmailPrice(type, duration, quantity, price);
    
    logEvent('admin_gmail_price_updated', { type, duration, quantity, price });
    
    await bot.sendMessage(
      msg.chat.id,
      `✅ Đã cập nhật giá:\n\n` +
      `Type: ${type === 'edu' ? '📧 Gmail Edu' : '🌐 Google Non'}\n` +
      `Duration: ${duration === 'single' ? 'Single' : 'Daily'}\n` +
      `Quantity: ${quantity} account(s)\n` +
      `Price: ${formatCurrency(price)}`
    );
    
  } catch (error) {
    logError({ context: 'adminParseUpdateGmailPrice', error: error.message });
    bot.sendMessage(msg.chat.id, `❌ Lỗi: ${error.message}`);
  }
};

