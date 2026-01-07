import { isAdmin, buildPaginationKeyboard, parseUploadText, formatCurrency, createCallbackData } from '../../utils/index.js';
import { createProduct, updateProduct, deleteProduct, listProducts, getProduct } from '../controllers/productController.js';
import { addAccounts, listAccounts, deleteAccount, deleteAccountsByStatus } from '../controllers/accountController.js';
import { listUsers, updateBalance as changeBalance, getUserById } from '../controllers/userController.js';
import { listOrdersByUser, listPendingManualOrders, getOrderById, completeOrder } from '../controllers/orderController.js';
import { listBalanceLogs } from '../controllers/balanceLogController.js';
import { createDepositPromotion, getAllPromotions, deletePromotion } from '../controllers/depositPromotionController.js';
import { notifyUsersAboutProductStock } from './handleNotify.js';

export const requireAdmin = (adminIds, telegramId) => isAdmin(telegramId, adminIds);

export const adminMenu = async (bot, chatId) => {
  const inline_keyboard = [
    [{ text: '📊 Quản lý sản phẩm', callback_data: createCallbackData({ action: 'admin_products', page: 1 }) }],
    [{ text: '📦 Quản lý tài khoản', callback_data: createCallbackData({ action: 'admin_accounts_pick', page: 1 }) }],
    [{ text: '📧 Quản lý Gmail', callback_data: createCallbackData({ action: 'admin_gmail_menu' }) }],
    [{ text: '💰 Quản lý nạp tiền', callback_data: createCallbackData({ action: 'admin_deposits', page: 1 }) }],
    [{ text: '📝 Đơn hàng cần xử lý', callback_data: createCallbackData({ action: 'admin_manual_orders', page: 1 }) }],
    [{ text: '👤 Quản lý user', callback_data: createCallbackData({ action: 'admin_users', page: 1 }) }]
  ];
  await bot.sendMessage(chatId, 'Admin panel', { reply_markup: { inline_keyboard } });
};

export const adminProducts = async (bot, chatId, page, pageSize) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listProducts(offset, pageSize);
  const lines = rows.map((p) => `#${p.id} - ${p.name} - ${formatCurrency(p.price)} - tồn ${p.stock}`);
  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  await bot.sendMessage(chatId, lines.join('\n') || 'Chưa có sản phẩm.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Thêm', callback_data: createCallbackData({ action: 'admin_add_product' }) }],
        ...rows.map((p) => [
          { text: `✏️ #${p.id}`, callback_data: createCallbackData({ action: 'admin_edit_product', id: p.id }) },
          { text: `❌ #${p.id}`, callback_data: createCallbackData({ action: 'admin_delete_product', id: p.id }) },
          { text: `📦 #${p.id}`, callback_data: createCallbackData({ action: 'admin_accounts', productId: p.id, page: 1 }) }
        ]),
        ...buildPaginationKeyboard({ action: 'admin_products', page }, page, hasPrev, hasNext)
      ]
    }
  });
};

export const adminAddProduct = async (bot, chatId) => {
  await bot.sendMessage(chatId, 'Nhập theo định dạng: tên|giá|mô tả\n\nVí dụ:\n- Nâng cấp Gmail|50000|Nâng cấp lên Pro\n- Tài khoản Netflix|100000|Tài khoản Premium\n\nLưu ý:\n- Sản phẩm sẽ tự động là "order" (yêu cầu nhập email/note) nếu không có tài khoản trong kho\n- Sản phẩm sẽ tự động là "stock" (tự động giao) nếu có tài khoản trong kho');
};

export const adminParseAddProduct = async (bot, msg) => {
  const parts = msg.text.split('|').map((x) => x.trim());
  const [name, price, description] = parts;
  if (!name || !price) return bot.sendMessage(msg.chat.id, 'Sai định dạng.');
  
  await createProduct({ name, price, description: description || '' });
  
  await bot.sendMessage(msg.chat.id, `✅ Đã thêm sản phẩm.\n\n💡 Lưu ý: Sản phẩm sẽ tự động là "order" (yêu cầu nhập email/note) nếu không có tài khoản trong kho. Nếu có tài khoản trong kho, sẽ tự động giao khi mua.`);
};

export const adminUpdateProduct = async (bot, msg, productId) => {
  const parts = msg.text.split('|').map((x) => x.trim());
  const [name, price, description] = parts;
  if (!name || !price) return bot.sendMessage(msg.chat.id, 'Sai định dạng.');
  
  await updateProduct(productId, { name, price, description: description || '' });
  await bot.sendMessage(msg.chat.id, `✅ Đã cập nhật sản phẩm.`);
};

export const adminEditProductPrompt = async (bot, chatId, productId) => {
  const product = await getProduct(productId);
  if (!product) return bot.sendMessage(chatId, 'Không tìm thấy.');
  await bot.sendMessage(
    chatId,
    `Sửa sản phẩm #${productId}. Nhập: tên|giá|mô tả\n\nHiện tại: ${product.name} | ${product.price} | ${product.description || ''}\n\n💡 Lưu ý: Sản phẩm sẽ tự động là "order" nếu không có tài khoản trong kho, "stock" nếu có tài khoản trong kho.`,
    { parse_mode: 'Markdown' }
  );
};

export const adminDeleteProduct = async (bot, chatId, productId) => {
  await deleteProduct(productId);
  await bot.sendMessage(chatId, 'Đã xoá.');
};

export const adminListAccounts = async (bot, chatId, productId, page, pageSize, status = null) => {
  // Hardcode 10 tài khoản mỗi trang
  const fixedPageSize = 10;
  const offset = (page - 1) * fixedPageSize;
  const { rows, total } = await listAccounts(productId, offset, fixedPageSize, status);
  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  
  const product = await getProduct(productId);
  const productName = product ? product.name : `Sản phẩm #${productId}`;
  
  // Đếm theo status
  const { rows: allAvailable } = await listAccounts(productId, 0, 999999, 'available');
  const { rows: allSold } = await listAccounts(productId, 0, 999999, 'sold');
  const availableCount = allAvailable.length;
  const soldCount = allSold.length;
  
  const statusText = status ? ` (${status})` : '';
  const lines = rows.map((a) => {
    const statusEmoji = a.status === 'available' ? '✅' : '💰';
    return `${statusEmoji} #${a.id} | ${a.username} | ${a.status}`;
  });
  
  const message = `📦 **Tài khoản: ${productName}${statusText}**\n\n` +
                 `📊 Tổng quan:\n` +
                 `✅ Available: ${availableCount}\n` +
                 `💰 Sold: ${soldCount}\n\n` +
                 `${lines.join('\n') || 'Chưa có tài khoản.'}\n\n` +
                 `📄 Trang ${page}/${Math.ceil(total / fixedPageSize)} | Tổng: ${total} tài khoản`;
  
  // Helper function để tạo callback_data không chứa null và đảm bảo <= 64 bytes
  const createCallbackData = (data) => {
    // Rút ngắn tên các field để tiết kiệm bytes
    const shortData = {};
    
    // Map action names
    const actionMap = {
      'admin_accounts': 'acc',
      'admin_delete_account': 'del_acc',
      'admin_delete_accounts_by_status': 'del_all',
      'admin_add_account': 'add_acc',
      'admin_upload_account': 'up_acc'
    };
    
    // Rút ngắn data
    if (data.action) shortData.a = actionMap[data.action] || data.action;
    if (data.productId !== undefined) shortData.p = data.productId;
    if (data.accountId !== undefined) shortData.ac = data.accountId;
    if (data.page !== undefined) shortData.pg = data.page;
    if (data.status !== undefined && data.status !== null) shortData.s = data.status;
    
    const jsonStr = JSON.stringify(shortData);
    
    // Telegram giới hạn callback_data là 64 bytes
    const byteLength = Buffer.byteLength(jsonStr, 'utf8');
    if (byteLength > 64) {
      console.error(`[ADMIN_ACCOUNTS] Callback data vẫn quá dài (${byteLength} bytes):`, jsonStr);
      // Fallback: chỉ giữ lại các field tối thiểu
      const minimalData = { a: shortData.a };
      if (shortData.p !== undefined) minimalData.p = shortData.p;
      return JSON.stringify(minimalData);
    }
    
    return jsonStr;
  };
  
  const inline_keyboard = [
    [
      { text: '📋 Tất cả', callback_data: createCallbackData({ action: 'admin_accounts', productId, page: 1 }) },
      { text: '✅ Available', callback_data: createCallbackData({ action: 'admin_accounts', productId, page: 1, status: 'available' }) },
      { text: '💰 Sold', callback_data: createCallbackData({ action: 'admin_accounts', productId, page: 1, status: 'sold' }) }
    ],
    [
      { text: '➕ Thêm', callback_data: createCallbackData({ action: 'admin_add_account', productId }) },
      { text: '📂 Upload', callback_data: createCallbackData({ action: 'admin_upload_account', productId }) }
    ],
    ...(status ? [
      [
        { 
          text: `🗑️ Xóa tất cả ${status}`, 
          callback_data: createCallbackData({ action: 'admin_delete_accounts_by_status', productId, status, page }) 
        }
      ]
    ] : []),
    ...rows.map((a) => {
      const deleteData = { action: 'admin_delete_account', accountId: a.id, productId, page };
      if (status) deleteData.status = status;
      return [
        { 
          text: `❌ #${a.id}`, 
          callback_data: createCallbackData(deleteData)
        }
      ];
    }),
    ...(() => {
      const paginationData = { action: 'admin_accounts', productId, page };
      if (status) paginationData.status = status;
      return buildPaginationKeyboard(paginationData, page, hasPrev, hasNext);
    })()
  ];
  
  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard }
  });
};

export const adminAddAccount = async (bot, chatId, productId) => {
  await bot.sendMessage(chatId, `Nhập tài khoản cho sản phẩm #${productId} theo dạng username|password`);
};

export const adminParseAddAccount = async (bot, msg, productId) => {
  const [username, password] = msg.text.split('|').map((x) => x.trim());
  if (!username || !password) return bot.sendMessage(msg.chat.id, 'Sai định dạng.');
  await addAccounts(productId, [{ username, password }]);
  await bot.sendMessage(msg.chat.id, 'Đã thêm 1 account.');
  
  // Thông báo cho users về tài khoản mới
  await notifyUsersAboutProductStock(bot, productId, 1);
};

export const adminParseUploadAccounts = async (bot, msg, productId) => {
  // Lấy text từ msg.text hoặc msg.caption (nếu gửi kèm caption)
  let textContent = msg.text || msg.caption || '';
  
  // Nếu có file document, cần download và đọc nội dung
  if (msg.document && !textContent) {
    try {
      const file = await bot.getFile(msg.document.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      textContent = await response.text();
    } catch (error) {
      console.error('[ADMIN_UPLOAD] Error downloading file:', error);
      return bot.sendMessage(msg.chat.id, '❌ Không thể đọc file. Vui lòng gửi lại file hoặc dán nội dung.');
    }
  }
  
  if (!textContent || !textContent.trim()) {
    return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy nội dung. Vui lòng gửi file .txt hoặc dán nội dung username|password mỗi dòng.');
  }
  
  const accounts = parseUploadText(textContent);
  if (!accounts.length) {
    return bot.sendMessage(msg.chat.id, '❌ File rỗng hoặc sai định dạng. Định dạng: username|password (mỗi dòng một account).');
  }
  
  await addAccounts(productId, accounts);
  await bot.sendMessage(msg.chat.id, `✅ Đã thêm ${accounts.length} account.`);
  
  // Thông báo cho users về tài khoản mới
  await notifyUsersAboutProductStock(bot, productId, accounts.length);
};

export const adminListUsers = async (bot, chatId, page, pageSize) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listUsers(offset, pageSize);
  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  const lines = rows.map((u) => `#${u.id} | ${u.telegram_id} | ${formatCurrency(u.balance)}`);
  await bot.sendMessage(chatId, lines.join('\n') || 'Chưa có user.', {
    reply_markup: {
      inline_keyboard: buildPaginationKeyboard({ action: 'admin_users', page }, page, hasPrev, hasNext)
    }
  });
};

export const adminAdjustBalance = async (bot, chatId) => {
  await bot.sendMessage(chatId, 'Nhập: telegram_id|+/-số tiền|lý do');
};

export const adminParseAdjustBalance = async (bot, msg, addBalanceLogFn) => {
  const [telegramId, amountRaw, reason] = msg.text.split('|').map((x) => x.trim());
  const amount = Number(amountRaw);
  if (!telegramId || !amount || !reason) return bot.sendMessage(msg.chat.id, 'Sai định dạng.');
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const user = await getUserByTelegram(telegramId);
  if (!user) return bot.sendMessage(msg.chat.id, 'Không tìm thấy user.');
  if (amount < 0 && user.balance + amount < 0) return bot.sendMessage(msg.chat.id, 'Không được âm.');
  await changeBalance(user.id, amount);
  await addBalanceLogFn({ userId: user.id, amount, reason, adminId: msg.from.id });
  await bot.sendMessage(msg.chat.id, 'Đã cập nhật số dư.');
};

export const handleUserCommand = async (bot, msg, args) => {
  const { getUserByTelegram } = await import('../controllers/userController.js');
  const { addBalanceLog } = await import('../controllers/balanceLogController.js');

  if (args.length < 2) {
    return bot.sendMessage(msg.chat.id, 'Sai cú pháp.\n\nSử dụng:\n/user add <telegram_id> <số_tiền>\n/user -<số_tiền> <telegram_id>\n\nVí dụ:\n/user add 123456789 10000\n/user -5000 123456789');
  }

  let telegramId, amount;

  // Parse format: /user add <telegram_id> <amount>
  if (args[0] === 'add' && args.length >= 3) {
    telegramId = args[1];
    amount = Number(args[2]);
  }
  // Parse format: /user -<amount> <telegram_id>
  else if (args[0].startsWith('-') && args.length >= 2) {
    amount = Number(args[0]);
    telegramId = args[1];
  }
  // Parse format: /user <amount> <telegram_id>
  else if (args.length >= 2) {
    amount = Number(args[0]);
    telegramId = args[1];
  } else {
    return bot.sendMessage(msg.chat.id, 'Sai cú pháp.\n\nSử dụng:\n/user add <telegram_id> <số_tiền>\n/user -<số_tiền> <telegram_id>\n\nVí dụ:\n/user add 123456789 10000\n/user -5000 123456789');
  }

  if (!telegramId || isNaN(amount) || amount === 0) {
    return bot.sendMessage(msg.chat.id, 'Sai định dạng. Telegram ID và số tiền phải hợp lệ.');
  }

  const user = await getUserByTelegram(telegramId);
  if (!user) {
    return bot.sendMessage(msg.chat.id, `Không tìm thấy user với telegram_id: ${telegramId}`);
  }

  // Check if balance would go negative
  const newBalance = user.balance + amount;
  if (newBalance < 0) {
    return bot.sendMessage(msg.chat.id, `Không thể trừ. Số dư hiện tại: ${formatCurrency(user.balance)}, số tiền muốn trừ: ${formatCurrency(Math.abs(amount))}`);
  }

  // Update balance
  await changeBalance(user.id, amount);
  
  // Lấy lại user để có số dư chính xác
  const updatedUser = await getUserByTelegram(telegramId);
  const finalBalance = Number(updatedUser.balance);
  
  // Add balance log
  const isSubtract = amount < 0;
  const reason = isSubtract ? `Admin trừ tiền (${msg.from.id})` : `Admin cộng tiền (${msg.from.id})`;
  await addBalanceLog({ userId: user.id, amount, reason, adminId: msg.from.id });
  
  const action = isSubtract ? 'Trừ' : 'Cộng';
  
  // Thông báo cho admin
  await bot.sendMessage(msg.chat.id, `✅ ${action} tiền thành công!\n\n👤 User: ${telegramId}\n💰 ${action}: ${formatCurrency(Math.abs(amount))}\n💵 Số dư mới: ${formatCurrency(finalBalance)}`);
  
  // Thông báo cho user
  try {
    const userMessage = `✅ **${action === 'Cộng' ? 'Nạp' : 'Trừ'} tiền thành công!**\n\n` +
                       `💰 ${action}: ${formatCurrency(Math.abs(amount))}\n` +
                       `💵 Số dư mới: ${formatCurrency(finalBalance)}\n` +
                       `📝 Lý do: ${reason}`;
    await bot.sendMessage(Number(telegramId), userMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(`[HANDLE_USER] Không thể gửi thông báo cho user ${telegramId}:`, error.message);
  }
};

export const adminUserOrders = async (bot, chatId, userId, page, pageSize) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listOrdersByUser(userId, offset, pageSize);
  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  const lines = rows.map((o) => `#${o.id} | ${o.name} | ${formatCurrency(o.price)} | ${o.created_at}`);
  await bot.sendMessage(chatId, lines.join('\n') || 'Chưa có đơn.', {
    reply_markup: {
      inline_keyboard: buildPaginationKeyboard({ action: 'admin_user_orders', userId, page }, page, hasPrev, hasNext)
    }
  });
};

export const adminUserBalances = async (bot, chatId, userId, page, pageSize) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listBalanceLogs(userId, offset, pageSize);
  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  const lines = rows.map((b) => `${b.amount} | ${b.reason} | ${b.created_at}`);
  await bot.sendMessage(chatId, lines.join('\n') || 'Chưa có log.', {
    reply_markup: {
      inline_keyboard: buildPaginationKeyboard({ action: 'admin_user_logs', userId, page }, page, hasPrev, hasNext)
    }
  });
};

// Xem danh sách manual orders cần xử lý
export const adminListManualOrders = async (bot, chatId, page, pageSize) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listPendingManualOrders(offset, pageSize);
  
  if (!rows.length) {
    return bot.sendMessage(chatId, '✅ Không có đơn hàng nào cần xử lý.');
  }
  
  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  
  const message = rows.map((order, index) => {
    return `📝 **#${order.id}** - ${order.product_name}\n` +
           `👤 User: ${order.username || order.telegram_id}\n` +
           `📧 Email: ${order.email || 'N/A'}\n` +
           `📝 Note: ${order.note || 'Không có'}\n` +
           `💰 Giá: ${formatCurrency(order.price)}\n` +
           `🕐 ${order.created_at}\n`;
  }).join('\n---\n');
  
  const inline_keyboard = [
    ...rows.map((order) => [
      { 
        text: `✅ Hoàn thành #${order.id}`, 
        callback_data: createCallbackData({ action: 'admin_complete_order', orderId: order.id }) 
      }
    ]),
    ...buildPaginationKeyboard({ action: 'admin_manual_orders', page }, page, hasPrev, hasNext)
  ];
  
  await bot.sendMessage(chatId, message, { 
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard } 
  });
};

// Hoàn thành order và thông báo cho user
export const adminCompleteManualOrder = async (bot, chatId, orderId, admin) => {
  try {
    const order = await getOrderById(orderId);
    
    if (!order) {
      return bot.sendMessage(chatId, '❌ Không tìm thấy đơn hàng.');
    }
    
    if (order.status !== 'pending') {
      return bot.sendMessage(chatId, `❌ Đơn hàng #${orderId} đã được xử lý rồi (status: ${order.status}).`);
    }
    
    // Cập nhật status thành completed
    await completeOrder(orderId);
    
    // Thông báo cho admin
    await bot.sendMessage(chatId, `✅ Đã hoàn thành đơn hàng #${orderId}.\n📧 Email: ${order.email || 'N/A'}\n📝 Note: ${order.note || 'Không có'}`);
    
    // Thông báo cho user
    try {
      const user = await getUserById(order.user_id);
      if (user && user.telegram_id) {
        const userMessage = `✅ **Đơn hàng đã hoàn thành!**\n\n` +
                           `🎁 Sản phẩm: ${order.product_name}\n` +
                           `📧 Email: ${order.email || 'N/A'}\n` +
                           `📝 Note: ${order.note || 'Không có'}\n` +
                           `🆔 Mã đơn: #${orderId}\n\n` +
                           `Cảm ơn bạn đã sử dụng dịch vụ!`;
        await bot.sendMessage(Number(user.telegram_id), userMessage, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      console.error(`[COMPLETE_ORDER] Không thể gửi thông báo cho user:`, error.message);
    }
    
  } catch (error) {
    console.error(`[COMPLETE_ORDER] Lỗi:`, error);
    await bot.sendMessage(chatId, `❌ Lỗi khi hoàn thành đơn hàng: ${error.message}`);
  }
};

export const adminDeleteAccount = async (bot, chatId, accountId, productId, page, status = null) => {
  try {
    const result = await deleteAccount(accountId);
    
    if (!result.success) {
      return bot.sendMessage(chatId, `❌ ${result.error || 'Không thể xóa tài khoản'}`);
    }
    
    // Refresh danh sách accounts
    await adminListAccounts(bot, chatId, productId, page, 10, status);
    
  } catch (error) {
    console.error('[ADMIN_DELETE_ACCOUNT] Lỗi:', error);
    await bot.sendMessage(chatId, `❌ Lỗi khi xóa tài khoản: ${error.message}`);
  }
};

// Xóa hàng loạt accounts theo status
export const adminDeleteAccountsByStatus = async (bot, chatId, productId, status, page) => {
  try {
    const result = await deleteAccountsByStatus(productId, status);
    
    if (!result.success) {
      return bot.sendMessage(chatId, `❌ ${result.error || 'Không thể xóa tài khoản'}`);
    }
    
    await bot.sendMessage(chatId, `✅ Đã xóa ${result.deletedCount} tài khoản (status: ${status}).`);
    
    // Refresh danh sách accounts
    await adminListAccounts(bot, chatId, productId, 1, 10, status);
    
  } catch (error) {
    console.error('[ADMIN_DELETE_ACCOUNTS_BY_STATUS] Lỗi:', error);
    await bot.sendMessage(chatId, `❌ Lỗi khi xóa tài khoản: ${error.message}`);
  }
};

export const logAdminCommand = (adminId, command) => {
  // Log removed
};

// Xử lý lệnh /kmnap để tạo khuyến mại nạp tiền
// Format: /kmnap start_time end_time bonus_percentage min_amount
// Ví dụ: /kmnap 2025-01-01 00:00:00 2025-01-31 23:59:59 10 100000
export const adminParseKmnap = async (bot, msg) => {
  try {
    const parts = msg.text.trim().split(/\s+/);
    
    if (parts.length < 5) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ Sai cú pháp!\n\n' +
        'Sử dụng:\n' +
        '/kmnap <thời_gian_bắt_đầu> <thời_gian_kết_thúc> <%_khuyến_mại> <số_tiền_tối_thiểu>\n\n' +
        'Ví dụ:\n' +
        '/kmnap 2025-01-01 00:00:00 2025-01-31 23:59:59 10 100000\n\n' +
        'Trong đó:\n' +
        '- Thời gian bắt đầu: YYYY-MM-DD HH:MM:SS\n' +
        '- Thời gian kết thúc: YYYY-MM-DD HH:MM:SS\n' +
        '- % khuyến mại: số phần trăm (ví dụ: 10 = 10%)\n' +
        '- Số tiền tối thiểu: số tiền nạp tối thiểu để được khuyến mại (VNĐ)'
      );
    }
    
    // Parse các tham số
    const startDateStr = `${parts[1]} ${parts[2]}`; // YYYY-MM-DD HH:MM:SS
    const endDateStr = `${parts[3]} ${parts[4]}`;   // YYYY-MM-DD HH:MM:SS
    const bonusPercentage = parseFloat(parts[5]);
    const minAmount = parseFloat(parts[6]);
    
    // Validate
    if (isNaN(bonusPercentage) || bonusPercentage <= 0 || bonusPercentage > 100) {
      return bot.sendMessage(msg.chat.id, '❌ Phần trăm khuyến mại phải là số từ 0.01 đến 100');
    }
    
    if (isNaN(minAmount) || minAmount <= 0) {
      return bot.sendMessage(msg.chat.id, '❌ Số tiền tối thiểu phải là số lớn hơn 0');
    }
    
    // Validate datetime format - giả sử user nhập thời gian theo VN time (UTC+7)
    // Parse như VN time, convert sang UTC để lưu vào DB
    const startTimeVN = new Date(startDateStr.replace(' ', 'T') + '+07:00');
    const endTimeVN = new Date(endDateStr.replace(' ', 'T') + '+07:00');
    
    if (isNaN(startTimeVN.getTime())) {
      return bot.sendMessage(msg.chat.id, '❌ Thời gian bắt đầu không hợp lệ. Format: YYYY-MM-DD HH:MM:SS');
    }
    
    if (isNaN(endTimeVN.getTime())) {
      return bot.sendMessage(msg.chat.id, '❌ Thời gian kết thúc không hợp lệ. Format: YYYY-MM-DD HH:MM:SS');
    }
    
    if (startTimeVN >= endTimeVN) {
      return bot.sendMessage(msg.chat.id, '❌ Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc');
    }
    
    // startTimeVN và endTimeVN đã là UTC time (khi parse với +07:00)
    // Lấy UTC string để lưu vào DB
    const startTimeUTC = startTimeVN.toISOString().slice(0, 19).replace('T', ' ');
    const endTimeUTC = endTimeVN.toISOString().slice(0, 19).replace('T', ' ');
    
    // Tạo khuyến mại - lưu thời gian UTC vào DB
    const promotionId = await createDepositPromotion(
      startTimeUTC,
      endTimeUTC,
      bonusPercentage,
      minAmount
    );
    
    await bot.sendMessage(
      msg.chat.id,
      `✅ Đã tạo khuyến mại nạp tiền!\n\n` +
      `📅 Thời gian: ${startDateStr} → ${endDateStr}\n` +
      `🎁 Khuyến mại: ${bonusPercentage}%\n` +
      `💰 Nạp tối thiểu: ${formatCurrency(minAmount)}\n\n` +
      `📝 ID: #${promotionId}`
    );
    
  } catch (error) {
    console.error('[ADMIN_KMMAP] Lỗi:', error);
    await bot.sendMessage(msg.chat.id, `❌ Lỗi khi tạo khuyến mại: ${error.message}`);
  }
};

// Convert UTC datetime string từ DB sang VN time để hiển thị
const formatDateTimeVN = (utcDateInput) => {
  let utcDateStr = utcDateInput;
  
  // Nếu là Date object, convert sang string
  if (utcDateInput instanceof Date) {
    utcDateStr = utcDateInput.toISOString().slice(0, 19).replace('T', ' ');
  } else if (typeof utcDateInput !== 'string') {
    utcDateStr = String(utcDateInput);
  }
  
  // Parse UTC datetime string (YYYY-MM-DD HH:MM:SS) từ DB
  const utcDate = new Date(utcDateStr.replace(' ', 'T') + 'Z');
  // Convert sang VN time (UTC+7)
  const vnDate = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
  // Format để hiển thị
  const year = vnDate.getUTCFullYear();
  const month = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(vnDate.getUTCDate()).padStart(2, '0');
  const hours = String(vnDate.getUTCHours()).padStart(2, '0');
  const minutes = String(vnDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(vnDate.getUTCSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

// Hiển thị danh sách khuyến mại
export const adminListPromotions = async (bot, chatId) => {
  try {
    const promotions = await getAllPromotions();
    
    if (!promotions || promotions.length === 0) {
      return bot.sendMessage(chatId, '📋 Chưa có khuyến mại nạp tiền nào.');
    }
    
    const now = new Date();
    const lines = promotions.map((promo) => {
      // Parse thời gian từ DB - có thể là Date object hoặc string
      let startTimeStr = promo.start_time;
      let endTimeStr = promo.end_time;
      
      // Nếu là Date object, convert sang string
      if (startTimeStr instanceof Date) {
        startTimeStr = startTimeStr.toISOString().slice(0, 19).replace('T', ' ');
      } else if (typeof startTimeStr === 'string') {
        // Đã là string, giữ nguyên
      } else {
        startTimeStr = String(startTimeStr);
      }
      
      if (endTimeStr instanceof Date) {
        endTimeStr = endTimeStr.toISOString().slice(0, 19).replace('T', ' ');
      } else if (typeof endTimeStr === 'string') {
        // Đã là string, giữ nguyên
      } else {
        endTimeStr = String(endTimeStr);
      }
      
      // Parse thời gian từ DB (UTC datetime string)
      const startTimeUTC = new Date(startTimeStr.replace(' ', 'T') + 'Z');
      const endTimeUTC = new Date(endTimeStr.replace(' ', 'T') + 'Z');
      
      let statusText = '';
      let statusIcon = '';
      
      if (promo.status !== 'active') {
        statusText = 'Tắt';
        statusIcon = '⚫';
      } else if (now < startTimeUTC) {
        statusText = 'Chờ';
        statusIcon = '🟡';
      } else if (now > endTimeUTC) {
        statusText = 'Hết hạn';
        statusIcon = '🔴';
      } else {
        statusText = 'Kích hoạt';
        statusIcon = '🟢';
      }
      
      return `${statusIcon} #${promo.id}\n` +
             `📅 ${formatDateTimeVN(startTimeStr)} → ${formatDateTimeVN(endTimeStr)}\n` +
             `🎁 ${promo.bonus_percentage}% | 💰 Tối thiểu: ${formatCurrency(promo.min_amount)}\n` +
             `📊 Trạng thái: ${statusText}\n`;
    });
    
    // Tạo inline keyboard với nút xóa cho mỗi promotion
    const inline_keyboard = promotions.map((promo) => [
      { 
        text: `❌ Xóa #${promo.id}`, 
        callback_data: createCallbackData({ action: 'admin_delete_promotion', id: promo.id }) 
      }
    ]);
    
    await bot.sendMessage(chatId, `📋 **Danh sách khuyến mại nạp tiền:**\n\n${lines.join('\n')}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard
      }
    });
    
  } catch (error) {
    console.error('[ADMIN_LIST_PROMOTIONS] Lỗi:', error);
    await bot.sendMessage(chatId, `❌ Lỗi khi lấy danh sách khuyến mại: ${error.message}`);
  }
};

// Xóa khuyến mại
export const adminDeletePromotion = async (bot, chatId, promotionId) => {
  try {
    await deletePromotion(promotionId);
    await bot.sendMessage(chatId, `✅ Đã xóa khuyến mại #${promotionId}`);
    // Refresh danh sách
    await adminListPromotions(bot, chatId);
  } catch (error) {
    console.error('[ADMIN_DELETE_PROMOTION] Lỗi:', error);
    await bot.sendMessage(chatId, `❌ Lỗi khi xóa khuyến mại: ${error.message}`);
  }
};

