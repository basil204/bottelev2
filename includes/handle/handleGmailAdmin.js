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
import { createEduAccount, generateRandomUsername } from '../services/googleAdminService.js';
import { getSettingBoolean, toggleSetting } from '../controllers/settingsController.js';

// Helper function để tìm sản phẩm Gmail sẵn thanh toán
const findGmailPTTTProduct = async () => {
  const { query } = await import('../database/index.js');
  const products = await query(
    `SELECT * FROM products WHERE 
      name LIKE ? OR 
      name LIKE ? OR 
      name LIKE ? OR 
      name LIKE ? OR
      name LIKE ?
    LIMIT 1`,
    ['%Gmail Edu%PTTT%', '%Gmail%sẵn thanh toán%', '%Gmail Edu%sẵn thanh toán%', '%Gmail%PTTT%', '%sẵn thanh toán%']
  );
  return products && products.length > 0 ? products[0] : null;
};

// Helper function để tìm hoặc tạo sản phẩm Gmail sẵn thanh toán
const findOrCreateGmailPTTTProduct = async () => {
  let product = await findGmailPTTTProduct();
  
  if (!product) {
    // Tự động tạo sản phẩm nếu chưa có
    const { query } = await import('../database/index.js');
    
    console.log('[FIND_OR_CREATE_GMAIL_PTTT] Tạo sản phẩm Gmail sẵn thanh toán mới');
    
    try {
      // Tạo sản phẩm (database hiện tại không có cột type)
      await query(
        'INSERT INTO products (name, price, description, stock) VALUES (?, ?, ?, ?)',
        ['Gmail Edu sẵn thanh toán', 3500, 'Gmail Edu đã thêm phương thức thanh toán, thời hạn 7 ngày', 0]
      );
      
      // Lấy lại sản phẩm vừa tạo
      const products = await query(
        'SELECT * FROM products WHERE name = ? LIMIT 1',
        ['Gmail Edu sẵn thanh toán']
      );
      
      if (products && products.length > 0) {
        product = products[0];
        console.log(`[FIND_OR_CREATE_GMAIL_PTTT] ✅ Đã tạo sản phẩm #${product.id}: ${product.name}, giá: ${product.price}`);
      } else {
        console.error('[FIND_OR_CREATE_GMAIL_PTTT] ❌ Không thể lấy lại sản phẩm vừa tạo');
      }
    } catch (error) {
      console.error('[FIND_OR_CREATE_GMAIL_PTTT] ❌ Lỗi khi tạo sản phẩm:', error.message);
      throw error;
    }
  }
  
  return product;
};

// Admin: Tạo Gmail account
export const adminCreateGmailAccount = async (bot, chatId, type, domain, quantity = 1) => {
  try {
    // Với type 'non', chỉ tạo domain krishokerbondhu.org
    if (type === 'non') {
      domain = 'krishokerbondhu.org';
    } else if (!domain) {
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

  } catch (error) {
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

  } catch (error) {
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
  
  // Lấy trạng thái bật/tắt
  const gmailEduEnabled = await getSettingBoolean('gmail_edu_enabled', true);
  const gmailNonEnabled = await getSettingBoolean('gmail_non_enabled', true);

  const menuText = `🔧 **Quản lý Gmail Accounts**

**Tồn kho:**
• Gmail Edu: ${eduCount} account(s) ${gmailEduEnabled ? '✅' : '❌'}
• Google Non: ${nonCount} account(s) ${gmailNonEnabled ? '✅' : '❌'}

**Trạng thái bán:**
• Gmail Edu: ${gmailEduEnabled ? '🟢 Đang bán' : '🔴 Đã tắt'}
• Google Non: ${gmailNonEnabled ? '🟢 Đang bán' : '🔴 Đã tắt'}

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
      ],
      [
        { text: `${gmailEduEnabled ? '🔴' : '🟢'} ${gmailEduEnabled ? 'Tắt' : 'Bật'} bán Gmail Edu`, callback_data: createCallbackData({ action: 'admin_gmail_toggle_edu' }) },
        { text: `${gmailNonEnabled ? '🔴' : '🟢'} ${gmailNonEnabled ? 'Tắt' : 'Bật'} bán Gmail Non`, callback_data: createCallbackData({ action: 'admin_gmail_toggle_non' }) }
      ],
      [
        { text: '📧 Thêm Gmail Edu Permanent', callback_data: createCallbackData({ action: 'admin_gmail_edu_permanent' }) }
      ],
      [
        { text: '➕ Thêm Gmail sẵn thanh toán', callback_data: createCallbackData({ action: 'admin_gmail_edu_pttt' }) }
      ],
      [
        { text: '✨ Tạo Gmail Edu (không lưu DB)', callback_data: createCallbackData({ action: 'admin_gmail_edu_create_only' }) }
      ]
    ]
  };

  await bot.sendMessage(chatId, menuText, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
};

// Admin: Thêm Gmail Edu permanent (không bị xóa) - lưu vào gmail_accounts
export const adminAddGmailEduPermanent = async (bot, chatId) => {
  await bot.sendMessage(
    chatId,
    '📧 **Thêm Gmail Edu Permanent (không bị xóa)**\n\n' +
    '📝 **Định dạng:**\n' +
    '• Text: `email|password` (mỗi dòng một account)\n' +
    '• File: Gửi file .txt với format `email|password` mỗi dòng\n\n' +
    '💡 **Ví dụ:**\n' +
    '```\n' +
    'user1@domain.edu|password123\n' +
    'user2@domain.edu|password456\n' +
    '```\n\n' +
    '⚠️ **Lưu ý:** Các account này sẽ KHÔNG bị xóa tự động.',
    { parse_mode: 'Markdown' }
  );
};

// Admin: Parse thêm Gmail Edu permanent
export const adminParseAddGmailEduPermanent = async (bot, msg) => {
  try {
    let textContent = msg.text || msg.caption || '';
    
    // Nếu có file document, download và đọc
    if (msg.document && !textContent) {
      try {
        const file = await bot.getFile(msg.document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
        const response = await fetch(fileUrl);
        textContent = await response.text();
      } catch (error) {
        console.error('[ADMIN_ADD_GMAIL_EDU_PERMANENT] Error downloading file:', error);
        return bot.sendMessage(msg.chat.id, '❌ Không thể đọc file. Vui lòng gửi lại file hoặc dán nội dung.');
      }
    }
    
    if (!textContent || !textContent.trim()) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy nội dung. Vui lòng gửi file .txt hoặc dán nội dung email|password mỗi dòng.');
    }
    
    // Parse accounts
    const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);
    const accounts = [];
    
    for (const line of lines) {
      const [email, password] = line.split('|').map(x => x.trim());
      if (email && password) {
        accounts.push({ email, password });
      }
    }
    
    if (accounts.length === 0) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy account hợp lệ. Định dạng: email|password');
    }
    
    // Lưu vào gmail_accounts với type='edu', status='available'
    const { query } = await import('../database/index.js');
    let successCount = 0;
    let failCount = 0;
    
    for (const acc of accounts) {
      try {
        await query(
          'INSERT INTO gmail_accounts (email, password, type, domain, status) VALUES (?, ?, "edu", ?, "available")',
          [acc.email, acc.password, acc.email.split('@')[1] || null]
        );
        successCount++;
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          failCount++;
          console.error(`[ADMIN_ADD_GMAIL_EDU_PERMANENT] Duplicate email: ${acc.email}`);
        } else {
          failCount++;
          console.error(`[ADMIN_ADD_GMAIL_EDU_PERMANENT] Error adding ${acc.email}:`, error);
        }
      }
    }
    
    await bot.sendMessage(
      msg.chat.id,
      `✅ **Đã thêm Gmail Edu Permanent:**\n\n` +
      `✅ Thành công: ${successCount} account(s)\n` +
      (failCount > 0 ? `❌ Thất bại: ${failCount} account(s)\n` : '') +
      `\n💡 Các account này sẽ KHÔNG bị xóa tự động.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('[ADMIN_ADD_GMAIL_EDU_PERMANENT] Error:', error);
    await bot.sendMessage(msg.chat.id, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Thêm Gmail Edu có sẵn vào sản phẩm (7 ngày)
export const adminAddGmailEduStock = async (bot, chatId, productId) => {
  await bot.sendMessage(
    chatId,
    `📧 **Thêm Gmail Edu có sẵn vào sản phẩm #${productId}**\n\n` +
    `📝 **Định dạng:**\n` +
    `• Text: \`email|password\` (mỗi dòng một account)\n` +
    `• File: Gửi file .txt với format \`email|password\` mỗi dòng\n\n` +
    `💡 **Ví dụ:**\n` +
    `\`\`\`\n` +
    `user1@domain.edu|password123\n` +
    `user2@domain.edu|password456\n` +
    `\`\`\`\n\n` +
    `⚠️ **Lưu ý:** Các account này sẽ được xóa sau 7 ngày kể từ ngày mua.`,
    { parse_mode: 'Markdown' }
  );
};

// Admin: Parse thêm Gmail Edu có sẵn vào sản phẩm
export const adminParseAddGmailEduStock = async (bot, msg, productId) => {
  try {
    let textContent = msg.text || msg.caption || '';
    
    // Nếu có file document, download và đọc
    if (msg.document && !textContent) {
      try {
        const file = await bot.getFile(msg.document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
        const response = await fetch(fileUrl);
        textContent = await response.text();
      } catch (error) {
        console.error('[ADMIN_ADD_GMAIL_EDU_STOCK] Error downloading file:', error);
        return bot.sendMessage(msg.chat.id, '❌ Không thể đọc file. Vui lòng gửi lại file hoặc dán nội dung.');
      }
    }
    
    if (!textContent || !textContent.trim()) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy nội dung. Vui lòng gửi file .txt hoặc dán nội dung email|password mỗi dòng.');
    }
    
    // Parse accounts
    const lines = textContent.split('\n').map(l => l.trim()).filter(Boolean);
    const accounts = [];
    
    for (const line of lines) {
      const [email, password] = line.split('|').map(x => x.trim());
      if (email && password) {
        accounts.push({ username: email, password });
      }
    }
    
    if (accounts.length === 0) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy account hợp lệ. Định dạng: email|password');
    }
    
    // Lưu vào accounts table với product_id
    const { addAccounts } = await import('../controllers/accountController.js');
    await addAccounts(productId, accounts);
    
    await bot.sendMessage(
      msg.chat.id,
      `✅ **Đã thêm ${accounts.length} Gmail Edu vào sản phẩm #${productId}**\n\n` +
      `💡 Các account này sẽ được xóa sau 7 ngày kể từ ngày mua.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('[ADMIN_ADD_GMAIL_EDU_STOCK] Error:', error);
    await bot.sendMessage(msg.chat.id, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Thêm Gmail sẵn thanh toán (tự động tìm sản phẩm)
export const adminAddGmailEduPTTT = async (bot, chatId) => {
  try {
    // Tìm hoặc tạo sản phẩm Gmail sẵn thanh toán
    const product = await findOrCreateGmailPTTTProduct();
    
    if (!product) {
      return bot.sendMessage(
        chatId,
        '❌ **Không thể tìm hoặc tạo sản phẩm Gmail sẵn thanh toán!**\n\n' +
        '💡 Vui lòng thử lại hoặc liên hệ quản trị viên.',
        { parse_mode: 'Markdown' }
      );
    }
    
    await bot.sendMessage(
      chatId,
      `📧 **Thêm Gmail sẵn thanh toán vào sản phẩm #${product.id}**\n\n` +
      `🎁 **Sản phẩm:** ${product.name}\n` +
      `💰 **Giá:** ${formatCurrency(product.price)}\n` +
      `📊 **Tồn kho hiện tại:** ${product.stock || 0} tài khoản\n\n` +
      `📝 **Định dạng:**\n` +
      `• Text: \`email|password\` (mỗi dòng một account)\n` +
      `• File: Gửi file .txt với format \`email|password\` mỗi dòng\n\n` +
      `💡 **Ví dụ:**\n` +
      `\`\`\`\n` +
      `user1@domain.edu|password123\n` +
      `user2@domain.edu|password456\n` +
      `\`\`\`\n\n` +
      `⚠️ **Lưu ý:** Các account này sẽ được xóa sau 7 ngày kể từ ngày mua.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('[ADMIN_ADD_GMAIL_EDU_PTTT] Error:', error);
    await bot.sendMessage(chatId, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Tạo Gmail Edu chỉ trên Google Admin, không lưu vào database
export const adminCreateGmailEduOnly = async (bot, chatId) => {
  await bot.sendMessage(
    chatId,
    '✨ **Tạo Gmail Edu (không lưu database)**\n\n' +
    '📝 **Định dạng:**\n' +
    '• Nhập: `domain,quantity`\n' +
    '• Ví dụ: `example.edu,5` - Tạo 5 Gmail Edu với domain example.edu\n\n' +
    '💡 **Lưu ý:**\n' +
    '• Chỉ tạo trên Google Admin, KHÔNG lưu vào database\n' +
    '• KHÔNG tự động xóa\n' +
    '• Thông tin email/password sẽ được trả về ngay\n' +
    '• Password mặc định: `Vietcombank9338739954`',
    { parse_mode: 'Markdown' }
  );
};

// Admin: Parse tạo Gmail Edu chỉ (không lưu DB)
export const adminParseCreateGmailEduOnly = async (bot, msg) => {
  try {
    const text = msg.text.trim();
    const parts = text.split(',').map(p => p.trim());
    
    if (parts.length !== 2) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ **Sai định dạng!**\n\n' +
        '📝 **Định dạng:** `domain,quantity`\n' +
        '💡 **Ví dụ:** `example.edu,5`',
        { parse_mode: 'Markdown' }
      );
    }
    
    const [domain, quantityStr] = parts;
    const quantity = parseInt(quantityStr, 10);
    
    if (!domain || domain.length === 0) {
      return bot.sendMessage(msg.chat.id, '❌ Domain không hợp lệ.');
    }
    
    if (isNaN(quantity) || quantity < 1 || quantity > 50) {
      return bot.sendMessage(msg.chat.id, '❌ Số lượng phải từ 1 đến 50.');
    }
    
    const password = 'Vietcombank9338739954';
    await bot.sendMessage(msg.chat.id, `⏳ Đang tạo ${quantity} Gmail Edu với domain ${domain}...`);
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < quantity; i++) {
      try {
        const username = generateRandomUsername();
        const result = await createEduAccount(username, domain, password);
        
        if (result.success) {
          results.push({
            email: result.email,
            password: password,
            username: username
          });
          successCount++;
        } else {
          failCount++;
          console.error(`[ADMIN_CREATE_GMAIL_EDU_ONLY] Lỗi tạo account ${i + 1}: ${result.error}`);
        }
        
        // Delay nhỏ để tránh rate limit
        if (i < quantity - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        failCount++;
        console.error(`[ADMIN_CREATE_GMAIL_EDU_ONLY] Exception khi tạo account ${i + 1}:`, error);
      }
    }
    
    // Tạo nội dung để gửi lại
    let message = `✅ **Tạo thành công ${successCount} Gmail Edu**\n\n`;
    
    if (failCount > 0) {
      message += `❌ Thất bại: ${failCount} account(s)\n\n`;
    }
    
    message += `📧 **Domain:** ${domain}\n`;
    message += `🔑 **Password:** \`${password}\`\n\n`;
    message += `📋 **Danh sách accounts:**\n\`\`\`\n`;
    
    results.forEach((acc, index) => {
      message += `${index + 1}. ${acc.email}|${acc.password}\n`;
    });
    
    message += `\`\`\`\n\n`;
    message += `⚠️ **Lưu ý:** Các account này KHÔNG được lưu vào database và KHÔNG tự động xóa.`;
    
    await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('[ADMIN_CREATE_GMAIL_EDU_ONLY] Error:', error);
    await bot.sendMessage(msg.chat.id, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Parse thêm Gmail sẵn thanh toán
export const adminParseAddGmailEduPTTT = async (bot, msg, adminIds = []) => {
  try {
    // Kiểm tra quyền admin
    if (adminIds && adminIds.length > 0 && !adminIds.includes(msg.from.id)) {
      console.log(`[ADMIN_ADD_GMAIL_EDU_PTTT] Unauthorized user ${msg.from.id} tried to add accounts`);
      return; // Không phải admin, bỏ qua
    }
    
    // Bỏ qua nếu là command hoặc callback query
    if (msg.text && (msg.text.startsWith('/') || msg.text.startsWith('admin_'))) {
      return; // Không phải input cho việc thêm accounts
    }
    
    // Tìm hoặc tạo sản phẩm Gmail sẵn thanh toán
    const product = await findOrCreateGmailPTTTProduct();
    
    if (!product) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ **Không thể tìm hoặc tạo sản phẩm Gmail sẵn thanh toán!**\n\n' +
        '💡 Vui lòng thử lại hoặc liên hệ quản trị viên.',
        { parse_mode: 'Markdown' }
      );
    }
    
    let textContent = msg.text || msg.caption || '';
    
    // Nếu có file document, download và đọc
    if (msg.document && !textContent) {
      try {
        const file = await bot.getFile(msg.document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
        const response = await fetch(fileUrl);
        textContent = await response.text();
      } catch (error) {
        console.error('[ADMIN_ADD_GMAIL_EDU_PTTT] Error downloading file:', error);
        return bot.sendMessage(msg.chat.id, '❌ Không thể đọc file. Vui lòng gửi lại file hoặc dán nội dung.');
      }
    }
    
    if (!textContent || !textContent.trim()) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy nội dung. Vui lòng gửi file .txt hoặc dán nội dung email|password mỗi dòng.');
    }
    
    // Parse accounts - xử lý cả \r\n và \n
    const lines = textContent
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(line => line && line.includes('|'));
    
    console.log(`[ADMIN_ADD_GMAIL_EDU_PTTT] Số dòng tìm thấy: ${lines.length}`);
    
    const accounts = [];
    const invalidLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Split theo dấu |, lấy phần đầu làm email, phần còn lại là password
      const parts = line.split('|').map(x => x.trim()).filter(x => x);
      
      if (parts.length >= 2) {
        // Lấy email là phần đầu tiên, password là phần còn lại (nối lại nếu có nhiều dấu |)
        const email = parts[0];
        const password = parts.slice(1).join('|'); // Nếu password có chứa | thì nối lại
        
        // Validate email đơn giản
        if (email.includes('@') && password.length > 0) {
          accounts.push({ username: email, password });
          console.log(`[ADMIN_ADD_GMAIL_EDU_PTTT] ✅ Dòng ${i + 1}: ${email} | ${password.substring(0, 10)}...`);
        } else {
          invalidLines.push(`Dòng ${i + 1}: ${line} (email hoặc password không hợp lệ)`);
          console.log(`[ADMIN_ADD_GMAIL_EDU_PTTT] ❌ Dòng ${i + 1} không hợp lệ: ${line}`);
        }
      } else {
        invalidLines.push(`Dòng ${i + 1}: ${line} (thiếu dấu | hoặc format sai)`);
        console.log(`[ADMIN_ADD_GMAIL_EDU_PTTT] ❌ Dòng ${i + 1} format sai: ${line}`);
      }
    }
    
    if (accounts.length === 0) {
      let errorMsg = '❌ Không tìm thấy account hợp lệ. Định dạng: email|password\n\n';
      if (invalidLines.length > 0) {
        errorMsg += '📝 **Các dòng không hợp lệ:**\n' + invalidLines.slice(0, 5).join('\n');
        if (invalidLines.length > 5) {
          errorMsg += `\n... và ${invalidLines.length - 5} dòng khác`;
        }
      }
      return bot.sendMessage(msg.chat.id, errorMsg, { parse_mode: 'Markdown' });
    }
    
    console.log(`[ADMIN_ADD_GMAIL_EDU_PTTT] Tổng cộng ${accounts.length} accounts hợp lệ, ${invalidLines.length} dòng không hợp lệ`);
    
    // Lưu vào accounts table với product_id
    try {
      const { addAccounts } = await import('../controllers/accountController.js');
      await addAccounts(product.id, accounts);
      
      // Lấy lại stock mới nhất
      const { getProduct } = await import('../controllers/productController.js');
      const updatedProduct = await getProduct(product.id);
      const newStock = updatedProduct ? (updatedProduct.stock || 0) : 0;
      
      let successMsg = `✅ **Đã thêm ${accounts.length} Gmail sẵn thanh toán vào sản phẩm #${product.id}**\n\n`;
      successMsg += `🎁 **Sản phẩm:** ${product.name}\n`;
      successMsg += `📊 **Tồn kho mới:** ${newStock} tài khoản\n`;
      
      if (invalidLines.length > 0) {
        successMsg += `\n⚠️ **Lưu ý:** ${invalidLines.length} dòng không hợp lệ đã bị bỏ qua.\n`;
      }
      
      successMsg += `\n💡 Các account này sẽ được xóa sau 7 ngày kể từ ngày mua.`;
      
      await bot.sendMessage(msg.chat.id, successMsg, { parse_mode: 'Markdown' });
    } catch (dbError) {
      console.error('[ADMIN_ADD_GMAIL_EDU_PTTT] Database error:', dbError);
      await bot.sendMessage(msg.chat.id, `❌ Lỗi khi lưu vào database: ${dbError.message}\n\nĐã parse được ${accounts.length} accounts nhưng không thể lưu.`);
    }
  } catch (error) {
    console.error('[ADMIN_ADD_GMAIL_EDU_PTTT] Error:', error);
    await bot.sendMessage(msg.chat.id, `❌ Lỗi: ${error.message}`);
  }
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
    
    const successMessage = `✅ Đã cập nhật giá:\n\n` +
      `Type: ${type === 'edu' ? '📧 Gmail Edu' : '🌐 Google Non'}\n` +
      `Duration: ${duration === 'single' ? 'Single' : 'Daily'}\n` +
      `Quantity: ${quantity} account(s)\n` +
      `Price: ${formatCurrency(price)}`;
    
    await bot.sendMessage(msg.chat.id, successMessage);
    
    // Gửi thông báo vào group chat (nếu có cấu hình)
    // Lấy chat ID từ config hoặc environment variable
    const notificationChatId = process.env.NOTIFICATION_CHAT_ID || -1003580438934;
    
    if (notificationChatId) {
      try {
        const notificationMessage = `📢 **Cập nhật giá Gmail**\n\n` +
          `${type === 'edu' ? '📧 Gmail Edu' : '🌐 Google Non'}\n` +
          `⏱️ ${duration === 'single' ? 'Single' : 'Daily'}\n` +
          `📦 ${quantity} account(s)\n` +
          `💰 Giá mới: ${formatCurrency(price)}\n\n` +
          `👤 Admin: ${msg.from.first_name || 'N/A'} (${msg.from.id})`;
        
        await bot.sendMessage(notificationChatId, notificationMessage, { parse_mode: 'Markdown' });
        console.log(`[ADMIN_UPDATE_PRICE] ✅ Đã gửi thông báo vào group ${notificationChatId}`);
      } catch (error) {
        // Xử lý lỗi một cách im lặng - có thể bot chưa được thêm vào group hoặc chat ID sai
        const errorDescription = error.response?.body?.description || error.message || 'Unknown error';
        
        if (errorDescription.includes('chat not found') || errorDescription.includes('Bad Request')) {
          console.log(`[ADMIN_UPDATE_PRICE] ⚠️ Bot chưa được thêm vào group ${notificationChatId} hoặc chat ID không hợp lệ`);
          console.log(`[ADMIN_UPDATE_PRICE] 💡 Hãy đảm bảo bot đã được thêm vào group và có quyền gửi tin nhắn`);
        } else {
          console.error(`[ADMIN_UPDATE_PRICE] ❌ Lỗi khi gửi thông báo vào group: ${errorDescription}`);
        }
      }
    }
    
  } catch (error) {
    bot.sendMessage(msg.chat.id, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Check kho Gmail sẵn thanh toán
export const adminCheckGmailPTTTStock = async (bot, chatId) => {
  try {
    // Tìm sản phẩm Gmail sẵn thanh toán
    const product = await findGmailPTTTProduct();
    
    if (!product) {
      return bot.sendMessage(
        chatId,
        '❌ **Không tìm thấy sản phẩm Gmail sẵn thanh toán!**\n\n' +
        '💡 Vui lòng tạo sản phẩm với tên chứa "Gmail sẵn thanh toán" hoặc "Gmail Edu PTTT" trước.',
        { parse_mode: 'Markdown' }
      );
    }
    
    // Lấy thống kê accounts
    const { listAccounts } = await import('../controllers/accountController.js');
    const { rows: availableAccounts } = await listAccounts(product.id, 0, 999999, 'available');
    const { rows: soldAccounts } = await listAccounts(product.id, 0, 999999, 'sold');
    
    const availableCount = availableAccounts.length;
    const soldCount = soldAccounts.length;
    const totalCount = availableCount + soldCount;
    
    // Lấy một số accounts để hiển thị (tối đa 10)
    const displayAccounts = availableAccounts.slice(0, 10);
    let accountsText = '';
    
    if (displayAccounts.length > 0) {
      accountsText = '\n\n📋 **Một số accounts (tối đa 10):**\n';
      displayAccounts.forEach((acc, index) => {
        accountsText += `${index + 1}. \`${acc.username}\` | \`${acc.password}\`\n`;
      });
      if (availableCount > 10) {
        accountsText += `\n... và ${availableCount - 10} account(s) khác`;
      }
    }
    
    // Lấy tồn kho từ product.stock để đảm bảo chính xác
    const productStock = product.stock || 0;
    
    const message = `📊 **KIỂM TRA KHO - Gmail sẵn thanh toán**\n\n` +
                   `🎁 **Sản phẩm:** ${product.name}\n` +
                   `💰 **Giá:** ${formatCurrency(product.price)}\n\n` +
                   `📦 **Thống kê tồn kho:**\n` +
                   `✅ Available: ${availableCount} account(s)\n` +
                   `💰 Sold: ${soldCount} account(s)\n` +
                   `📊 Tổng: ${totalCount} account(s)\n` +
                   `📈 Stock trong DB: ${productStock} account(s)\n` +
                   accountsText +
                   `\n\n💡 Chọn hành động bên dưới để quản lý accounts.`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { 
            text: '📋 Xem danh sách chi tiết', 
            callback_data: createCallbackData({ action: 'admin_accounts', productId: product.id, page: 1 }) 
          }
        ],
        [
          { 
            text: '🗑️ Xóa accounts', 
            callback_data: createCallbackData({ action: 'admin_gmail_pttt_delete_menu' }) 
          }
        ],
        [
          { text: '🔙 Về menu Gmail', callback_data: createCallbackData({ action: 'admin_gmail_menu' }) }
        ]
      ]
    };
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('[ADMIN_CHECK_GMAIL_PTTT_STOCK] Error:', error);
    await bot.sendMessage(chatId, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Menu xóa Gmail sẵn thanh toán
export const adminDeleteGmailPTTTMenu = async (bot, chatId) => {
  try {
    // Tìm sản phẩm Gmail sẵn thanh toán
    const product = await findGmailPTTTProduct();
    
    if (!product) {
      return bot.sendMessage(
        chatId,
        '❌ **Không tìm thấy sản phẩm Gmail sẵn thanh toán!**\n\n' +
        '💡 Vui lòng tạo sản phẩm với tên chứa "Gmail sẵn thanh toán" hoặc "Gmail Edu PTTT" trước.',
        { parse_mode: 'Markdown' }
      );
    }
    
    // Lấy thống kê
    const { listAccounts } = await import('../controllers/accountController.js');
    const { rows: availableAccounts } = await listAccounts(product.id, 0, 999999, 'available');
    const { rows: soldAccounts } = await listAccounts(product.id, 0, 999999, 'sold');
    
    const availableCount = availableAccounts.length;
    const soldCount = soldAccounts.length;
    
    const message = `🗑️ **XÓA GMAIL SẴN THANH TOÁN**\n\n` +
                   `🎁 **Sản phẩm:** ${product.name}\n` +
                   `💰 **Giá:** ${formatCurrency(product.price)}\n\n` +
                   `📦 **Tồn kho:**\n` +
                   `✅ Available: ${availableCount} account(s)\n` +
                   `💰 Sold: ${soldCount} account(s)\n\n` +
                   `Chọn cách xóa:`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { 
            text: '📋 Xem danh sách & Xóa từng cái', 
            callback_data: createCallbackData({ action: 'admin_accounts', productId: product.id, page: 1 }) 
          }
        ],
        [
          { 
            text: `🗑️ Xóa tất cả Available (${availableCount})`, 
            callback_data: createCallbackData({ action: 'admin_gmail_pttt_delete_all', status: 'available' }) 
          }
        ],
        [
          { 
            text: `🗑️ Xóa tất cả Sold (${soldCount})`, 
            callback_data: createCallbackData({ action: 'admin_gmail_pttt_delete_all', status: 'sold' }) 
          }
        ],
        [
          { 
            text: '❌ Xóa theo ID', 
            callback_data: createCallbackData({ action: 'admin_gmail_pttt_delete_by_id' }) 
          }
        ],
        [
          { text: '🔙 Về menu Gmail', callback_data: createCallbackData({ action: 'admin_gmail_menu' }) }
        ]
      ]
    };
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('[ADMIN_DELETE_GMAIL_PTTT_MENU] Error:', error);
    await bot.sendMessage(chatId, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Xóa tất cả accounts theo status của Gmail sẵn thanh toán
export const adminDeleteAllGmailPTTTByStatus = async (bot, chatId, status) => {
  try {
    // Tìm sản phẩm Gmail sẵn thanh toán
    const product = await findGmailPTTTProduct();
    
    if (!product) {
      return bot.sendMessage(
        chatId,
        '❌ **Không tìm thấy sản phẩm Gmail sẵn thanh toán!**',
        { parse_mode: 'Markdown' }
      );
    }
    
    // Xóa accounts theo status
    const { deleteAccountsByStatus } = await import('../controllers/accountController.js');
    const result = await deleteAccountsByStatus(product.id, status);
    
    if (!result.success) {
      return bot.sendMessage(chatId, `❌ ${result.error || 'Không thể xóa tài khoản'}`);
    }
    
    // Lấy lại product để có stock mới nhất
    const { getProduct } = await import('../controllers/productController.js');
    const updatedProduct = await getProduct(product.id);
    const newStock = updatedProduct ? (updatedProduct.stock || 0) : 0;
    
    await bot.sendMessage(
      chatId,
      `✅ **Đã xóa ${result.deletedCount} tài khoản (status: ${status})**\n\n` +
      `🎁 Sản phẩm: ${product.name}\n` +
      `📊 Tồn kho mới: ${newStock} tài khoản\n` +
      `📈 Trước đó: ${product.stock || 0} tài khoản`,
      { parse_mode: 'Markdown' }
    );
    
    // Refresh menu hoặc quay lại check stock
    const keyboard = {
      inline_keyboard: [
        [
          { 
            text: '📊 Check kho lại', 
            callback_data: createCallbackData({ action: 'admin_gmail_pttt_check_stock' }) 
          }
        ],
        [
          { text: '🔙 Về menu Gmail', callback_data: createCallbackData({ action: 'admin_gmail_menu' }) }
        ]
      ]
    };
    
    await bot.sendMessage(chatId, 'Chọn hành động tiếp theo:', { reply_markup: keyboard });
    
  } catch (error) {
    console.error('[ADMIN_DELETE_ALL_GMAIL_PTTT_BY_STATUS] Error:', error);
    await bot.sendMessage(chatId, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Xóa account theo ID của Gmail sẵn thanh toán
export const adminDeleteGmailPTTTById = async (bot, chatId) => {
  try {
    // Tìm sản phẩm Gmail sẵn thanh toán
    const product = await findGmailPTTTProduct();
    
    if (!product) {
      return bot.sendMessage(
        chatId,
        '❌ **Không tìm thấy sản phẩm Gmail sẵn thanh toán!**',
        { parse_mode: 'Markdown' }
      );
    }
    
    await bot.sendMessage(
      chatId,
      '❌ **Xóa account theo ID**\n\n' +
      '📝 Nhập ID account cần xóa (hoặc nhiều ID cách nhau bằng dấu phẩy):\n' +
      'Ví dụ: `123` hoặc `123,456,789`',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('[ADMIN_DELETE_GMAIL_PTTT_BY_ID] Error:', error);
    await bot.sendMessage(chatId, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Parse xóa account theo ID của Gmail sẵn thanh toán
export const adminParseDeleteGmailPTTTById = async (bot, msg) => {
  try {
    const text = msg.text.trim();
    const ids = text.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0);
    
    if (ids.length === 0) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy ID hợp lệ. Vui lòng nhập ID số.');
    }
    
    // Tìm sản phẩm Gmail sẵn thanh toán
    const product = await findGmailPTTTProduct();
    
    if (!product) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy sản phẩm Gmail sẵn thanh toán!');
    }
    
    const { query } = await import('../database/index.js');
    let successCount = 0;
    let failCount = 0;
    const failedIds = [];
    const invalidIds = [];
    
    for (const accountId of ids) {
      try {
        // Kiểm tra account có thuộc sản phẩm này không
        const accountRows = await query('SELECT * FROM accounts WHERE id = ? AND product_id = ?', [accountId, product.id]);
        
        if (accountRows.length === 0) {
          invalidIds.push(accountId);
          failCount++;
          continue;
        }
        
        // Xóa account
        const { deleteAccount } = await import('../controllers/accountController.js');
        const result = await deleteAccount(accountId);
        
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          failedIds.push(accountId);
        }
      } catch (error) {
        failCount++;
        failedIds.push(accountId);
        console.error(`[ADMIN_DELETE_GMAIL_PTTT_BY_ID] Lỗi xóa account ${accountId}:`, error);
      }
    }
    
    let message = `✅ **Đã xóa ${successCount} tài khoản**\n\n`;
    if (invalidIds.length > 0) {
      message += `⚠️ **Không thuộc sản phẩm: ${invalidIds.length} ID(s)**\n`;
      message += `📋 IDs: ${invalidIds.join(', ')}\n\n`;
    }
    if (failedIds.length > 0) {
      message += `❌ **Thất bại: ${failIds.length} tài khoản**\n`;
      message += `📋 IDs thất bại: ${failedIds.join(', ')}\n\n`;
    }
    message += `🎁 Sản phẩm: ${product.name}`;
    
    // Lấy lại số tồn kho mới
    const { getProduct } = await import('../controllers/productController.js');
    const updatedProduct = await getProduct(product.id);
    if (updatedProduct) {
      message += `\n📊 Tồn kho mới: ${updatedProduct.stock || 0} tài khoản`;
    }
    
    await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('[ADMIN_PARSE_DELETE_GMAIL_PTTT_BY_ID] Error:', error);
    await bot.sendMessage(msg.chat.id, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Toggle bật/tắt bán Gmail Edu
export const adminToggleGmailEdu = async (bot, chatId) => {
  try {
    const result = await toggleSetting('gmail_edu_enabled', true);
    if (result.success) {
      const statusText = result.value ? '🟢 Đã bật' : '🔴 Đã tắt';
      await bot.sendMessage(
        chatId,
        `${statusText} bán Gmail Edu\n\nTrạng thái: ${result.value ? 'Đang bán' : 'Đã tắt'}`,
        { parse_mode: 'Markdown' }
      );
      // Refresh menu
      await adminShowGmailMenu(bot, chatId);
    } else {
      await bot.sendMessage(chatId, `❌ Lỗi: ${result.error}`);
    }
  } catch (error) {
    console.error('[ADMIN_TOGGLE_GMAIL_EDU] Error:', error);
    await bot.sendMessage(chatId, `❌ Lỗi: ${error.message}`);
  }
};

// Admin: Toggle bật/tắt bán Gmail Non
export const adminToggleGmailNon = async (bot, chatId) => {
  try {
    const result = await toggleSetting('gmail_non_enabled', true);
    if (result.success) {
      const statusText = result.value ? '🟢 Đã bật' : '🔴 Đã tắt';
      await bot.sendMessage(
        chatId,
        `${statusText} bán Gmail Non\n\nTrạng thái: ${result.value ? 'Đang bán' : 'Đã tắt'}`,
        { parse_mode: 'Markdown' }
      );
      // Refresh menu
      await adminShowGmailMenu(bot, chatId);
    } else {
      await bot.sendMessage(chatId, `❌ Lỗi: ${result.error}`);
    }
  } catch (error) {
    console.error('[ADMIN_TOGGLE_GMAIL_NON] Error:', error);
    await bot.sendMessage(chatId, `❌ Lỗi: ${error.message}`);
  }
};

