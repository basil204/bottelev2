import { isAdmin, buildPaginationKeyboard, parseUploadText, formatCurrency, createCallbackData } from '../../utils/index.js';
import { createProduct, updateProduct, deleteProduct, listProducts, getProduct } from '../controllers/productController.js';
import { addAccounts, listAccounts, deleteAccount, deleteAccountsByStatus } from '../controllers/accountController.js';
import { listUsers, updateBalance as changeBalance, getUserById } from '../controllers/userController.js';
import { listOrdersByUser, listPendingManualOrders, getOrderById, completeOrder } from '../controllers/orderController.js';
import { listBalanceLogs } from '../controllers/balanceLogController.js';
import { createDepositPromotion, getAllPromotions, deletePromotion } from '../controllers/depositPromotionController.js';
import { notifyUsersAboutProductStock } from './handleNotify.js';

import { query } from '../database/index.js';

export const requireAdmin = async (adminIds, telegramId) => {
  // Merge DB admin_ids with static adminIds
  let dbAdminIds = [];
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'admin_ids'");
    if (rows && rows.length > 0) {
      dbAdminIds = JSON.parse(rows[0].value);
    }
  } catch (e) {
    console.error('Error fetching admin_ids from DB:', e);
  }

  // Ensure both are arrays and filter valid IDs
  const allAdmins = [...(adminIds || []), ...(dbAdminIds || [])].map(id => Number(id));
  return allAdmins.includes(Number(telegramId));
};

export const adminMenu = async (bot, chatId) => {
  // Lấy domain từ settings nếu có
  let webDomain = 'https://cp-admin.manhit.dev';
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'admin_web_domain'");
    if (rows && rows.length > 0 && rows[0].value) {
      webDomain = rows[0].value;
    }
  } catch (e) {
    console.error('Error fetching admin_web_domain:', e);
  }

  const inline_keyboard = [
    [{ text: '🌐 Mở Dashboard Admin', web_app: { url: webDomain } }]
  ];

  await bot.sendMessage(
    chatId,
    '👋 **Xin chào Admin!**\n\n📱 Nhấn nút bên dưới để mở Dashboard quản lý.\n\n💡 *Tất cả chức năng quản lý đã được chuyển lên Web Dashboard để tiện sử dụng.*',
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard }
    }
  );
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
  await bot.sendMessage(chatId, 'Nhập theo định dạng: tên|giá|mô tả|stock/order\n\nVí dụ:\n- Nâng cấp Gmail|50000|Nâng cấp lên Pro|order\n- Tài khoản Netflix|100000|Tài khoản Premium|stock\n\nLưu ý:\n- Sản phẩm sẽ tự động là "order" (yêu cầu nhập email/note) nếu không có tài khoản trong kho\n- Sản phẩm sẽ tự động là "stock" (tự động giao) nếu có tài khoản trong kho');
};

export const adminParseAddProduct = async (bot, msg) => {
  const parts = msg.text.split('|').map((x) => x.trim());
  const [name, price, description, type] = parts;

  // Validation
  if (!name || !price) {
    return bot.sendMessage(msg.chat.id, '❌ Sai định dạng!\n\n📝 Định dạng: tên|giá|mô tả|type\n\n💡 Ví dụ:\n- Nâng cấp Gmail|50000|Nâng cấp lên Pro|order\n- Tài khoản Netflix|100000|Tài khoản Premium|stock');
  }

  // Kiểm tra giá phải là số hợp lệ
  const priceNum = Number(price);
  if (isNaN(priceNum) || priceNum < 0) {
    return bot.sendMessage(msg.chat.id, `❌ Giá không hợp lệ!\n\n💰 Giá phải là số và >= 0\n\n📝 Bạn đã nhập: "${price}"\n\n💡 Ví dụ: 50000, 100000, 200000`);
  }

  // Kiểm tra type
  const productType = (type && (type.toLowerCase() === 'order' || type.toLowerCase() === 'stock')) ? type.toLowerCase() : 'stock';

  await createProduct({ name, price: priceNum, description: description || '', type: productType });

  await bot.sendMessage(msg.chat.id, `✅ Đã thêm sản phẩm.\n\n📦 Loại: ${productType === 'order' ? 'Order (yêu cầu nhập email/note)' : 'Stock (tự động giao, cần stock > 0)'}`);
};

export const adminUpdateProduct = async (bot, msg, productId) => {
  const parts = msg.text.split('|').map((x) => x.trim());
  const [name, price, description, type] = parts;

  // Validation
  if (!name || !price) {
    return bot.sendMessage(msg.chat.id, '❌ Sai định dạng!\n\n📝 Định dạng: tên|giá|mô tả|type\n\n💡 Ví dụ:\n- Nâng cấp Gmail|50000|Nâng cấp lên Pro|order\n- Tài khoản Netflix|100000|Tài khoản Premium|stock');
  }

  // Kiểm tra giá phải là số hợp lệ
  const priceNum = Number(price);
  if (isNaN(priceNum) || priceNum < 0) {
    return bot.sendMessage(msg.chat.id, `❌ Giá không hợp lệ!\n\n💰 Giá phải là số và >= 0\n\n📝 Bạn đã nhập: "${price}"\n\n💡 Ví dụ: 50000, 100000, 200000`);
  }

  // Kiểm tra type (nếu có)
  const productType = (type && (type.toLowerCase() === 'order' || type.toLowerCase() === 'stock')) ? type.toLowerCase() : undefined;

  await updateProduct(productId, { name, price: priceNum, description: description || '', type: productType });
  await bot.sendMessage(msg.chat.id, `✅ Đã cập nhật sản phẩm.`);
};

export const adminEditProductPrompt = async (bot, chatId, productId) => {
  const product = await getProduct(productId);
  if (!product) return bot.sendMessage(chatId, 'Không tìm thấy.');
  const currentType = product.type || 'stock';
  await bot.sendMessage(
    chatId,
    `Sửa sản phẩm #${productId}. Nhập: tên|giá|mô tả|type\n\nHiện tại: ${product.name} | ${product.price} | ${product.description || ''} | ${currentType}\n\n💡 Lưu ý:\n- type = "order": Sản phẩm order (yêu cầu nhập email/note)\n- type = "stock": Sản phẩm tự động (cần stock > 0 để mua)`,
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
  await bot.sendMessage(chatId, `Nhập tài khoản cho sản phẩm #${productId} theo dạng:\n- username|password\n- username|password|2fa\n- username|password|mail_kp|2fa\n- key (sẽ lưu user=key, pass=key)`);
};

export const adminParseAddAccount = async (bot, msg, productId) => {
  const account = parseUploadText(msg.text)[0];
  if (!account) return bot.sendMessage(msg.chat.id, 'Sai định dạng. Xem hướng dẫn ở trên.');

  const result = await addAccounts(productId, [account]);

  if (result.skipCount > 0) {
    return bot.sendMessage(msg.chat.id, `⚠️ Tài khoản "${account.username}" đã tồn tại trong sản phẩm này. Bỏ qua.`);
  }

  let msgText = `✅ Đã thêm 1 account.`;
  if (account.twofa) msgText += ' (có 2FA)';
  if (account.extra_data) msgText += ' (có Mail KP/Extra)';

  await bot.sendMessage(msg.chat.id, msgText);

  // Thông báo cho users về tài khoản mới
  await notifyUsersAboutProductStock(bot, productId, 1);

  // Thông báo vào nhóm
  const { notifyGroupAboutNewStock } = await import('./handleNotify.js');
  const { globalConfig } = await import('../listen.js');
  const notificationChatId = globalConfig?.NOTIFICATION_CHAT_ID || null;
  if (notificationChatId) {
    await notifyGroupAboutNewStock(bot, notificationChatId, productId, 1);
  }
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
    return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy nội dung. Vui lòng gửi file .txt hoặc dán nội dung username|password hoặc username|password|2fa mỗi dòng.');
  }

  const accounts = parseUploadText(textContent);
  if (!accounts.length) {
    return bot.sendMessage(msg.chat.id, '❌ File rỗng hoặc sai định dạng. Định dạng: username|password hoặc username|password|2fa (mỗi dòng một account).');
  }

  const result = await addAccounts(productId, accounts);

  let msgText = '';
  if (result.insertCount > 0) {
    msgText += `✅ Đã thêm ${result.insertCount} account.`;
  }
  if (result.skipCount > 0) {
    msgText += `\n⚠️ Bỏ qua ${result.skipCount} account đã tồn tại.`;
  }
  if (result.insertCount === 0 && result.skipCount > 0) {
    msgText = `⚠️ Tất cả ${result.skipCount} account đều đã tồn tại. Không có account mới được thêm.`;
  }

  await bot.sendMessage(msg.chat.id, msgText);

  // Chỉ thông báo nếu có account mới được thêm
  if (result.insertCount > 0) {
    // Thông báo cho users về tài khoản mới
    await notifyUsersAboutProductStock(bot, productId, result.insertCount);

    // Thông báo vào nhóm
    const { notifyGroupAboutNewStock } = await import('./handleNotify.js');
    const { globalConfig } = await import('../listen.js');
    const notificationChatId = globalConfig?.NOTIFICATION_CHAT_ID || null;
    if (notificationChatId) {
      await notifyGroupAboutNewStock(bot, notificationChatId, productId, result.insertCount);
    }
  }
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

  // Hiển thị hướng dẫn nếu không có đủ tham số
  if (args.length < 2) {
    return bot.sendMessage(
      msg.chat.id,
      '❌ **Sai cú pháp!**\n\n' +
      '📝 **Cú pháp:**\n' +
      '• `/user add <telegram_id> <số_tiền>` - Cộng tiền\n' +
      '• `/user sub <telegram_id> <số_tiền>` - Trừ tiền\n' +
      '• `/user -<số_tiền> <telegram_id>` - Trừ tiền (cách khác)\n\n' +
      '💡 **Ví dụ:**\n' +
      '• `/user add 123456789 100000` - Cộng 100,000 VNĐ\n' +
      '• `/user sub 123456789 50000` - Trừ 50,000 VNĐ\n' +
      '• `/user -50000 123456789` - Trừ 50,000 VNĐ',
      { parse_mode: 'Markdown' }
    );
  }

  let telegramId, amount, isSubtract = false;

  // Parse format: /user add <telegram_id> <amount>
  if (args[0].toLowerCase() === 'add' && args.length >= 3) {
    telegramId = args[1];
    amount = Number(args[2]);
    isSubtract = false;
  }
  // Parse format: /user sub <telegram_id> <amount>
  else if (args[0].toLowerCase() === 'sub' && args.length >= 3) {
    telegramId = args[1];
    amount = Number(args[2]);
    isSubtract = true;
    amount = -Math.abs(amount); // Đảm bảo số âm
  }
  // Parse format: /user -<amount> <telegram_id>
  else if (args[0].startsWith('-') && args.length >= 2) {
    amount = Number(args[0]);
    telegramId = args[1];
    isSubtract = true;
  }
  // Parse format: /user <amount> <telegram_id> (số dương = cộng, số âm = trừ)
  else if (args.length >= 2) {
    amount = Number(args[0]);
    telegramId = args[1];
    isSubtract = amount < 0;
  } else {
    return bot.sendMessage(
      msg.chat.id,
      '❌ **Sai cú pháp!**\n\n' +
      '📝 **Cú pháp:**\n' +
      '• `/user add <telegram_id> <số_tiền>` - Cộng tiền\n' +
      '• `/user sub <telegram_id> <số_tiền>` - Trừ tiền\n' +
      '• `/user -<số_tiền> <telegram_id>` - Trừ tiền (cách khác)\n\n' +
      '💡 **Ví dụ:**\n' +
      '• `/user add 123456789 100000`\n' +
      '• `/user sub 123456789 50000`',
      { parse_mode: 'Markdown' }
    );
  }

  // Validation
  if (!telegramId || !telegramId.match(/^\d+$/)) {
    return bot.sendMessage(msg.chat.id, '❌ Telegram ID không hợp lệ. Vui lòng nhập số Telegram ID.');
  }

  if (isNaN(amount) || amount === 0) {
    return bot.sendMessage(msg.chat.id, '❌ Số tiền không hợp lệ. Số tiền phải khác 0.');
  }

  // Tìm user
  const user = await getUserByTelegram(telegramId);
  if (!user) {
    return bot.sendMessage(msg.chat.id, `❌ Không tìm thấy user với Telegram ID: \`${telegramId}\``, { parse_mode: 'Markdown' });
  }

  // Kiểm tra số dư có đủ để trừ không
  const currentBalance = Number(user.balance);
  const newBalance = currentBalance + amount;

  if (newBalance < 0) {
    return bot.sendMessage(
      msg.chat.id,
      `❌ **Không thể trừ tiền!**\n\n` +
      `💵 Số dư hiện tại: ${formatCurrency(currentBalance)}\n` +
      `💰 Số tiền muốn trừ: ${formatCurrency(Math.abs(amount))}\n` +
      `⚠️ Số dư sau khi trừ sẽ bị âm!`,
      { parse_mode: 'Markdown' }
    );
  }

  // Cập nhật số dư
  await changeBalance(user.id, amount);

  // Lấy lại user để có số dư chính xác
  const updatedUser = await getUserByTelegram(telegramId);
  const finalBalance = Number(updatedUser.balance);

  // Ghi log
  const action = isSubtract ? 'Trừ' : 'Cộng';
  const reason = isSubtract
    ? `Admin trừ tiền (Admin ID: ${msg.from.id})`
    : `Admin cộng tiền (Admin ID: ${msg.from.id})`;
  await addBalanceLog({
    userId: user.id,
    amount,
    reason,
    adminId: msg.from.id
  });

  // Thông báo cho admin
  const adminMessage = `✅ **${action} tiền thành công!**\n\n` +
    `👤 User ID: \`${telegramId}\`\n` +
    `👤 Username: ${user.username ? `@${user.username}` : 'N/A'}\n` +
    `💰 ${action}: ${formatCurrency(Math.abs(amount))}\n` +
    `💵 Số dư cũ: ${formatCurrency(currentBalance)}\n` +
    `💵 Số dư mới: ${formatCurrency(finalBalance)}`;

  await bot.sendMessage(msg.chat.id, adminMessage, { parse_mode: 'Markdown' });

  // Thông báo cho user
  try {
    const userMessage = `✅ **${action === 'Cộng' ? 'Nạp' : 'Trừ'} tiền thành công!**\n\n` +
      `💰 ${action}: ${formatCurrency(Math.abs(amount))}\n` +
      `💵 Số dư cũ: ${formatCurrency(currentBalance)}\n` +
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

// Settings Menu
export const adminSettings = async (bot, chatId) => {
  try {
    // Fetch settings
    const settingsRows = await query("SELECT `key`, `value` FROM settings");
    const settings = {};
    if (Array.isArray(settingsRows)) {
      settingsRows.forEach(r => settings[r.key] = r.value);
    }

    // Default values
    const minDeposit = settings.min_deposit ? Number(settings.min_deposit) : 50000;
    const buyGmailEdu = settings.buy_gmail_edu !== 'false'; // Default true
    const buyGmailNon = settings.buy_gmail_non !== 'false'; // Default true

    // Fetch products summary
    const { rows: products } = await listProducts(0, 100);
    const productSummary = products.map(p => {
      const statusIcon = p.stock > 0 ? '✅' : '❌';
      const typeIcon = p.type === 'order' ? '📝' : '📦';
      return `${statusIcon} ${p.name} (${typeIcon} ${p.type}): ${p.stock}`;
    }).join('\n');

    let message = `⚙️ **Cài đặt hệ thống**\n\n`;
    message += `💰 **Nạp tối thiểu:** ${formatCurrency(minDeposit)}\n`;
    message += `🎓 **Mua Gmail Edu:** ${buyGmailEdu ? '✅ Bật' : '❌ Tắt'}\n`;
    message += `📧 **Mua Gmail Thường:** ${buyGmailNon ? '✅ Bật' : '❌ Tắt'}\n\n`;

    message += `📦 **Danh sách sản phẩm (${products.length}):**\n${productSummary || 'Chưa có sản phẩm'}\n\n`;
    message += `💡 Bấm vào nút bên dưới để thay đổi.`;

    const inline_keyboard = [
      [
        { text: `${buyGmailEdu ? '❌ Tắt' : '✅ Bật'} Gmail Edu`, callback_data: createCallbackData({ action: 'toggle_setting', key: 'buy_gmail_edu' }) },
        { text: `${buyGmailNon ? '❌ Tắt' : '✅ Bật'} Gmail Non`, callback_data: createCallbackData({ action: 'toggle_setting', key: 'buy_gmail_non' }) }
      ],
      [
        { text: '✏️ Sửa mức nạp tối thiểu', callback_data: createCallbackData({ action: 'edit_setting', key: 'min_deposit' }) }
      ]
    ];

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard }
    });
  } catch (error) {
    console.error('Error in adminSettings:', error);
    await bot.sendMessage(chatId, '❌ Lỗi khi tải cài đặt.');
  }
};

export const adminToggleSetting = async (bot, chatId, key) => {
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = ?", [key]);
    let currentValue = true; // Default true
    if (rows && rows.length > 0) {
      currentValue = rows[0].value !== 'false';
    }

    const newValue = !currentValue;
    if (rows && rows.length > 0) {
      await query("UPDATE settings SET `value` = ? WHERE `key` = ?", [String(newValue), key]);
    } else {
      await query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", [key, String(newValue)]);
    }

    await bot.sendMessage(chatId, `✅ Đã thay đổi cài đặt ${key} thành: ${newValue}`);
    // Refresh settings menu
    await adminSettings(bot, chatId);
  } catch (error) {
    console.error('Error toggling setting:', error);
    await bot.sendMessage(chatId, '❌ Lỗi khi thay đổi cài đặt.');
  }
};

export const adminEditSettingPrompt = async (bot, chatId, key) => {
  await bot.sendMessage(chatId, `Nhập giá trị mới cho **${key}** (chỉ nhập số):`, { parse_mode: 'Markdown' });
};

export const adminUpdateSetting = async (bot, msg, key) => {
  const value = msg.text.trim();
  if (!value || isNaN(Number(value))) {
    return bot.sendMessage(msg.chat.id, '❌ Giá trị không hợp lệ. Vui lòng nhập số.');
  }

  try {
    const rows = await query("SELECT `id` FROM settings WHERE `key` = ?", [key]);
    if (rows && rows.length > 0) {
      await query("UPDATE settings SET `value` = ? WHERE `key` = ?", [value, key]);
    } else {
      await query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", [key, value]);
    }
    await bot.sendMessage(msg.chat.id, `✅ Đã cập nhật ${key} thành ${value}`);
  } catch (error) {
    console.error('Error updating setting:', error);
    await bot.sendMessage(msg.chat.id, '❌ Lỗi khi cập nhật.');
  }
};

