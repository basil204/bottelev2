import { listProducts, getProduct } from '../controllers/productController.js';
import { takeOneAvailable, markSold, syncStock, deleteAccountAfterPurchase, takeAndMarkSoldOneAvailable } from '../controllers/accountController.js';
import { updateBalance, getUserByTelegram } from '../controllers/userController.js';
import { createOrder, getOrderById } from '../controllers/orderController.js';
import { formatCurrency, buildPaginationKeyboard, createCallbackData } from '../../utils/index.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { notifyAdminAboutNewManualOrder, notifyAdminAboutPurchase, getAdminIds } from './handleNotify.js';
import { query } from '../database/index.js';
import { checkGmailLive } from '../helpers/gmailChecker.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for 3-lang text
const L = (lang, vi, en, zh) => ({ en, zh }[lang] || vi);

// Map để lưu state user đang nhập thông tin cho manual order
const manualOrderState = new Map();

// Map để lưu state user đang nhập số lượng cho sản phẩm
const waitingForProductQuantity = new Map();




export const sendCategoryList = async (bot, chatId, user) => {
  const lang = user?.language || 'vi';

  // Fetch all categories from categories table
  const categories = await query('SELECT * FROM categories ORDER BY priority DESC, id DESC');
  if (!categories || !categories.length) {
    return bot.sendMessage(chatId, L(lang, 'Chưa có thư mục nào.', 'No categories yet.', '暂无分类。'));
  }

  // Fetch products to check stock
  const { rows } = await listProducts(0, 1000);

  const buttons = categories.map(cat => {
    // Check if this category has stock
    const productsInCat = rows.filter(p => p.category_id === cat.id);
    const totalAccounts = productsInCat.reduce(
      (total, product) => total + Math.max(0, Number(product.stock) || 0),
      0
    );
    const hasStock = productsInCat.some(p => p.type === 'order' || (p.stock && p.stock > 0));
    const icon = hasStock ? '🟢' : '🔴';

    // Remove any existing duplicate status circle emojis
    const cleanName = cat.name.replace(/^[🟢🔴]\s*/, '');

    return {
      text: `${icon} ${cleanName} (${totalAccounts.toLocaleString('vi-VN')})`,
      callback_data: createCallbackData({ action: 'category_products', catId: cat.id })
    };
  });

  // Chunk buttons into rows of 3 columns
  const inline_keyboard = [];
  for (let i = 0; i < buttons.length; i += 3) {
    inline_keyboard.push(buttons.slice(i, i + 3));
  }

  const selectMsg = L(lang, '📂 Chọn danh mục sản phẩm:', '📂 Select product category:', '📂 选择产品分类：');
  await bot.sendMessage(chatId, selectMsg, {
    reply_markup: { inline_keyboard }
  });
};

export const sendProductList = async (bot, chatId, page, pageSize, user, categoryId = null, messageId = null) => {
  const { formatMoney } = await import('../helpers/langHelper.js');
  const lang = user?.language || 'vi';

  const actualPageSize = 10;
  const offset = (page - 1) * actualPageSize;
  const { rows, total } = await listProducts(offset, actualPageSize, categoryId);
  if (!rows.length) {
    return bot.sendMessage(chatId, L(lang, 'Không có sản phẩm trong danh mục này.', 'No products in this category.', '此分类下暂无产品。'));
  }

  // Get settings
  let settings = { buy_gmail_edu: true, buy_gmail_non: true };
  try {
    const settingRows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('buy_gmail_edu', 'buy_gmail_non')");
    if (Array.isArray(settingRows)) {
      settingRows.forEach(r => {
        if (r.key === 'buy_gmail_edu') settings.buy_gmail_edu = r.value === 'true';
        if (r.key === 'buy_gmail_non') settings.buy_gmail_non = r.value === 'true';
      });
    }
  } catch (err) {
    console.error('Error fetching settings for product list:', err);
  }

  // Filter products
  const filteredRows = rows.filter(p => {
    const name = p.name.toLowerCase();
    const isEdu = name.includes('edu');
    if (isEdu && !settings.buy_gmail_edu) return false;
    if (!isEdu && !settings.buy_gmail_non) return false;
    return true;
  });

  if (!filteredRows.length && rows.length > 0) {
    return bot.sendMessage(chatId, L(lang,
      '🚫 Các sản phẩm đang tạm ẩn. Vui lòng quay lại sau.',
      '🚫 Products are temporarily hidden. Please come back later.',
      '🚫 产品暂时隐藏，请稍后再来。'
    ));
  }

  const inline_keyboard = await Promise.all(filteredRows.map(async (p) => {
    let icon = '✅';
    if (p.type === 'order') {
      icon = '📝';
    } else if (p.stock <= 0) {
      icon = '❌';
    }
    const stockText = p.type === 'order' ? '' : ` (${p.stock})`;
    const priceText = await formatMoney(p.price, lang);
    return [{
      text: `${icon} ${p.name} - ${priceText}${stockText}`,
      callback_data: createCallbackData({ action: 'view_product', productId: p.id }),
      style: p.type === 'order' || p.stock > 0 ? 'success' : 'danger'
    }];
  }));

  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  inline_keyboard.push(...buildPaginationKeyboard({ action: 'products', catId: categoryId, page }, page, hasPrev, hasNext));

  // Add back to categories button
  inline_keyboard.push([{
    text: L(lang, '🔙 Quay lại danh mục', '🔙 Back to Categories', '🔙 返回分类'),
    callback_data: createCallbackData({ action: 'back_to_categories' })
  }]);

  const selectMsg = L(lang, 'Chọn sản phẩm:', 'Select product:', '选择产品：');

  if (messageId) {
    try {
      await bot.editMessageText(selectMsg, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard }
      });
    } catch (e) {
      console.log('[PRODUCT_LIST] Edit message skipped:', e.message);
    }
  } else {
    await bot.sendMessage(chatId, selectMsg, { reply_markup: { inline_keyboard } });
  }
};

// Hiển thị chi tiết sản phẩm
export const showProductDetail = async (bot, chatId, productId, userId) => {
  const product = await getProduct(productId);
  const user = await getUserByTelegram(userId);
  const lang = user?.language || 'vi';

  if (!product) {
    return bot.sendMessage(chatId, L(lang, '❌ Sản phẩm không tồn tại.', '❌ Product not found.', '❌ 产品不存在。'));
  }

  if (!user) {
    return bot.sendMessage(chatId, L(lang, 'Vui lòng /start để tạo tài khoản.', 'Please /start to create account.', '请 /start 创建账户。'));
  }

  // Lấy tỷ giá từ settings
  let exchangeRate = 26000;
  try {
    const rateRows = await query("SELECT `value` FROM settings WHERE `key` = 'exchange_rate'");
    if (rateRows && rateRows[0]?.value) {
      exchangeRate = Number(rateRows[0].value) || 26000;
    }
  } catch (e) {
    console.error('[PRODUCT_DETAIL] Error fetching exchange rate:', e);
  }

  const priceVnd = Number(product.price) || 0;
  const priceUsd = (priceVnd / exchangeRate).toFixed(2);

  let productType = product.type || 'stock';
  if (productType === 'auto') productType = 'stock';
  if (productType === 'manual') productType = 'order';

  const stock = Number(product.stock) || 0;
  const soldCount = Math.max(0, Number(product.sold_count) || 0);
  const defaultDesc = L(lang, 'Không có mô tả', 'No description', '暂无描述');
  const description = product.description || defaultDesc;

  const titleLabel = L(lang, '📦 **CHI TIẾT SẢN PHẨM**', '📦 **PRODUCT DETAILS**', '📦 **产品详情**');
  const nameLabel = L(lang, 'Tên', 'Name', '名称');
  const priceLabel = L(lang, 'Giá', 'Price', '价格');
  const descLabel = L(lang, 'Mô tả', 'Description', '描述');
  const stockLabel = L(lang, 'Tồn kho', 'Stock', '库存');
  const soldLabel = L(lang, 'Đã bán', 'Sold', '已售');
  const soldText = L(
    lang,
    `${soldCount.toLocaleString('vi-VN')} sản phẩm`,
    `${soldCount.toLocaleString('en-US')} products`,
    `${soldCount.toLocaleString('zh-CN')} 件商品`
  );

  let detailText = `${titleLabel}\n\n` +
    `🎁 **${nameLabel}:** ${product.name}\n` +
    `💰 **${priceLabel}:** ${formatCurrency(priceVnd)} (~$${priceUsd})\n` +
    `📝 **${descLabel}:** ${description}\n` +
    `📊 **${soldLabel}:** ${soldText}\n`;

  if (productType === 'stock') {
    const stockText = stock > 0
      ? L(lang, `✅ Còn ${stock} sản phẩm`, `✅ ${stock} in stock`, `✅ 库存 ${stock} 件`)
      : L(lang, '❌ Hết hàng', '❌ Out of stock', '❌ 已售罄');
    detailText += ` **${stockLabel}:** ${stockText}\n`;
  }

  if ((productType === 'stock' && stock > 0) || productType === 'order') {
    const userIdStr = String(userId);
    waitingForProductQuantity.set(userIdStr, {
      productId: product.id,
      price: product.price,
      stock: stock,
      type: productType
    });

    const quantityPrompt = L(lang,
      '\n\nVui lòng nhập số lượng bạn muốn mua (số lượng nhỏ hơn hoặc bằng tồn kho):',
      '\n\nPlease enter quantity to buy (less than or equal to stock):',
      '\n\n请输入购买数量（数量小于或等于库存）：'
    );
    detailText += quantityPrompt;
  }

  const backBtn = L(lang, '⬅️ Quay lại', '⬅️ Back', '⬅️ 返回');
  const inline_keyboard = [
    [{ text: backBtn, callback_data: createCallbackData({ action: 'products', page: 1 }), style: 'danger' }]
  ];

  await bot.sendMessage(chatId, detailText, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard }
  });

  if (productType === 'stock' && stock === 0) {
    const outOfStockMsg = L(lang,
      '❌ Sản phẩm hiện đã hết hàng. Vui lòng chọn sản phẩm khác.',
      '❌ This product is out of stock. Please choose another product.',
      '❌ 该产品已售罄，请选择其他产品。'
    );
    await bot.sendMessage(chatId, outOfStockMsg);
  }
};

export const handlePurchase = async (bot, msg, productId, fromUser, config) => {
  const user = await getUserByTelegram(fromUser.id);
  const lang = user?.language || 'vi';
  if (!user) return bot.sendMessage(msg.chat.id, L(lang, 'Vui lòng /start để tạo tài khoản.', 'Please /start to create account.', '请 /start 创建账户。'));
  const product = await getProduct(productId);
  if (!product) return bot.sendMessage(msg.chat.id, L(lang, 'Sản phẩm không tồn tại.', 'Product not found.', '产品不存在。'));

  const currentUser = await getUserByTelegram(fromUser.id);
  const currentBalance = Number(currentUser.balance) || 0;
  const productPrice = Number(product.price) || 0;

  if (currentBalance < productPrice) {
    return bot.sendMessage(
      msg.chat.id,
      L(lang,
        `❌ **Số dư không đủ!**\n\n💵 Cần: ${formatCurrency(productPrice)}\n💰 Bạn có: ${formatCurrency(currentBalance)}\n\n💡 Vui lòng nạp thêm tiền để tiếp tục.`,
        `❌ **Insufficient balance!**\n\n💵 Need: ${formatCurrency(productPrice)}\n💰 You have: ${formatCurrency(currentBalance)}\n\n💡 Please deposit more to continue.`,
        `❌ **余额不足！**\n\n💵 需要: ${formatCurrency(productPrice)}\n💰 您有: ${formatCurrency(currentBalance)}\n\n💡 请充值后继续。`
      ),
      { parse_mode: 'Markdown' }
    );
  }

  const account = await takeOneAvailable(product.id);
  const isManualOrder = !account;

  if (isManualOrder) {
    await updateBalance(user.id, -productPrice);
    await addBalanceLog({
      userId: user.id,
      amount: -productPrice,
      reason: `buy_product_manual_${product.id}`,
      adminId: null
    });

    manualOrderState.set(String(fromUser.id), { productId, step: 'email' });

    const updatedUser = await getUserByTelegram(fromUser.id);
    const finalBalance = Number(updatedUser.balance);

    await bot.sendMessage(
      msg.chat.id,
      L(lang,
        `📝 **Sản phẩm yêu cầu thông tin**\n\n🎁 Sản phẩm: ${product.name}\n💰 Giá: ${formatCurrency(productPrice)}\n💵 Số dư mới: ${formatCurrency(finalBalance)}\n\nVui lòng nhập **email** cần nâng cấp:`,
        `📝 **Product requires information**\n\n🎁 Product: ${product.name}\n💰 Price: ${formatCurrency(productPrice)}\n💵 New balance: ${formatCurrency(finalBalance)}\n\nPlease enter **email** to upgrade:`,
        `📝 **产品需要信息**\n\n🎁 产品: ${product.name}\n💰 价格: ${formatCurrency(productPrice)}\n💵 新余额: ${formatCurrency(finalBalance)}\n\n请输入需要升级的 **邮箱**：`
      ),
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Sản phẩm có kho: xử lý auto
  await updateBalance(user.id, -productPrice);
  await addBalanceLog({
    userId: user.id,
    amount: -productPrice,
    reason: `buy_product_auto_${product.id}`,
    adminId: null
  });

  const isGmailEdu7Days = product.name && (
    product.name.toLowerCase().includes('gmail edu') &&
    product.name.toLowerCase().includes('7 ngày')
  );

  let deleteAt = null;
  if (isGmailEdu7Days) {
    deleteAt = new Date();
    deleteAt.setDate(deleteAt.getDate() + 7);
    console.log(`[BUY_PRODUCT] Đã lưu delete_at cho Gmail Edu 7 ngày: ${deleteAt.toISOString()}`);
  }

  await deleteAccountAfterPurchase(account.id, product.id);

  const accountDataForOrder = `${account.username}|${account.password}${account.extra_data ? `|${account.extra_data}` : ''}${account.twofa ? `|${account.twofa}` : ''}`;
  const orderResult = await createOrder({
    userId: user.id,
    productId: product.id,
    price: productPrice,
    status: 'completed',
    email: accountDataForOrder
  });

  const updatedUser = await getUserByTelegram(fromUser.id);
  const finalBalance = Number(updatedUser.balance);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  let accountInfo;
  if (!account.password && !account.twofa && !account.extra_data) {
    const isEmail = account.username.includes('@');
    accountInfo = isEmail
      ? `📧 **Email:** \`${account.username}\``
      : `🔑 **Key:** \`${account.username}\``;
  } else {
    accountInfo = L(lang,
      `📧 **TK:** \`${account.username}\`\n🔑 **MK:** \`${account.password}\``,
      `📧 **Username:** \`${account.username}\`\n🔑 **Password:** \`${account.password}\``,
      `📧 **账号:** \`${account.username}\`\n🔑 **密码:** \`${account.password}\``
    );
    if (account.twofa) accountInfo += `\n🔐 **2FA:** \`${account.twofa}\``;
    if (account.extra_data) accountInfo += `\n📩 **Extra:** \`${account.extra_data}\``;
  }

  const content = L(lang,
    `✅ **THANH TOÁN THÀNH CÔNG!**\n\n🧾 Mã HĐ: \`${orderResult.invoiceCode}\`\n🕒 Thời gian: ${timeStr}\n🎁 Sản phẩm: ${product.name}\n💰 Giá: ${formatCurrency(productPrice)}\n💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n${accountInfo}`,
    `✅ **PAYMENT SUCCESSFUL!**\n\n🧾 Invoice: \`${orderResult.invoiceCode}\`\n🕒 Time: ${timeStr}\n🎁 Product: ${product.name}\n💰 Price: ${formatCurrency(productPrice)}\n💵 New balance: ${formatCurrency(finalBalance)}\n\n${accountInfo}`,
    `✅ **支付成功！**\n\n🧾 订单号: \`${orderResult.invoiceCode}\`\n🕒 时间: ${timeStr}\n🎁 产品: ${product.name}\n💰 价格: ${formatCurrency(productPrice)}\n💵 新余额: ${formatCurrency(finalBalance)}\n\n${accountInfo}`
  );
  await bot.sendMessage(msg.chat.id, content, { parse_mode: 'Markdown' });

  // Notify admins
  const adminIds = await getAdminIds(config?.ADMIN_IDS || []);
  if (adminIds.length > 0) {
    notifyAdminAboutPurchase(bot, adminIds, {
      orderId: orderResult.invoiceCode || orderResult.insertId || 'AUTO',
      productName: product.name,
      username: user.username,
      telegramId: user.telegram_id,
      quantity: 1,
      price: productPrice,
      finalBalance: finalBalance,
      accounts: [account]
    });
  }
};

// Xử lý input email/note cho manual order
export const handleManualOrderInput = async (bot, msg, userId, adminIds = []) => {
  const state = manualOrderState.get(String(userId));
  if (!state) return false;

  const user = await getUserByTelegram(userId);
  const lang = user?.language || 'vi';
  const text = msg.text.trim();

  if (state.step === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      await bot.sendMessage(msg.chat.id, L(lang,
        '❌ Email không hợp lệ. Vui lòng nhập lại:',
        '❌ Invalid email. Please enter again:',
        '❌ 邮箱无效，请重新输入：'
      ));
      return true;
    }

    state.email = text;
    state.step = 'note';
    manualOrderState.set(String(userId), state);

    await bot.sendMessage(
      msg.chat.id,
      L(lang,
        `✅ Đã nhận email: ${text}\n\nVui lòng nhập **ghi chú** (note):\n(Ví dụ: Nâng cấp lên bản Pro, cần thêm tính năng XYZ...)`,
        `✅ Email received: ${text}\n\nPlease enter **note**:\n(Example: Upgrade to Pro, need feature XYZ...)`,
        `✅ 已收到邮箱: ${text}\n\n请输入 **备注**：\n（例如：升级到专业版，需要功能 XYZ...）`
      ),
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  if (state.step === 'note') {
    const product = await getProduct(state.productId);
    if (!product) {
      manualOrderState.delete(String(userId));
      return bot.sendMessage(msg.chat.id, L(lang, '❌ Sản phẩm không tồn tại.', '❌ Product not found.', '❌ 产品不存在。'));
    }

    if (!user) {
      manualOrderState.delete(String(userId));
      return bot.sendMessage(msg.chat.id, L(lang, '❌ Không tìm thấy user.', '❌ User not found.', '❌ 未找到用户。'));
    }

    const orderResult = await createOrder({
      userId: user.id,
      productId: state.productId,
      price: product.price,
      email: state.email,
      note: text,
      status: 'pending'
    });

    let order = null;
    if (orderResult && orderResult.insertId) {
      order = await getOrderById(orderResult.insertId);
    } else {
      const { listOrdersByUser } = await import('../controllers/orderController.js');
      const { rows } = await listOrdersByUser(user.id, 0, 1);
      if (rows.length > 0) {
        order = await getOrderById(rows[0].id);
      }
    }

    const dbAdminIds = await getAdminIds(adminIds);
    if (order && dbAdminIds.length > 0) {
      await notifyAdminAboutNewManualOrder(bot, dbAdminIds, {
        id: order.id,
        product_name: product.name,
        username: user.username,
        telegram_id: user.telegram_id,
        email: order.email,
        note: order.note,
        price: order.price,
        created_at: order.created_at
      });
    }

    manualOrderState.delete(String(userId));

    await bot.sendMessage(
      msg.chat.id,
      L(lang,
        `✅ **Đơn hàng đã được tạo!**\n\n🎁 Sản phẩm: ${product.name}\n📧 Email: ${state.email}\n📝 Ghi chú: ${text}\n\n⏳ Đơn hàng đang chờ admin xử lý. Bạn sẽ nhận được thông báo khi hoàn thành.`,
        `✅ **Order created!**\n\n🎁 Product: ${product.name}\n📧 Email: ${state.email}\n📝 Note: ${text}\n\n⏳ Order is waiting for admin processing. You will be notified when completed.`,
        `✅ **订单已创建！**\n\n🎁 产品: ${product.name}\n📧 邮箱: ${state.email}\n📝 备注: ${text}\n\n⏳ 订单等待管理员处理，完成后会通知您。`
      )
    );
    return true;
  }

  return false;
};


// Xử lý input quantity từ user cho sản phẩm
export const handleProductQuantityInput = async (bot, msg, quantityStr, config) => {
  const userId = msg.from.id;
  const userIdStr = String(userId);
  const chatId = msg.chat.id;

  const waitingState = waitingForProductQuantity.get(userIdStr);
  if (!waitingState) return false;

  const user = await getUserByTelegram(userId);
  const lang = user?.language || 'vi';

  waitingForProductQuantity.delete(userIdStr);

  const quantity = parseInt(quantityStr.trim(), 10);
  if (isNaN(quantity) || quantity < 1) {
    await bot.sendMessage(chatId, L(lang,
      '❌ Số lượng không hợp lệ. Vui lòng nhập số nguyên dương (ví dụ: 1, 2, 5).',
      '❌ Invalid quantity. Please enter a positive integer (e.g. 1, 2, 5).',
      '❌ 数量无效，请输入正整数（例如：1、2、5）。'
    ));
    return true;
  }

  if (waitingState.type === 'stock' && quantity > waitingState.stock) {
    await bot.sendMessage(chatId, L(lang,
      `❌ Số lượng bạn muốn mua (${quantity}) vượt quá số lượng tồn kho (${waitingState.stock}). Vui lòng nhập lại.`,
      `❌ Quantity (${quantity}) exceeds stock (${waitingState.stock}). Please enter again.`,
      `❌ 数量（${quantity}）超过库存（${waitingState.stock}），请重新输入。`
    ));
    return true;
  }

  await handlePurchaseWithQuantity(bot, msg, waitingState.productId, quantity, config);
  return true;
};

// Helper to build account info text
const buildAccountInfo = (acc, lang) => {
  if (!acc.password && !acc.twofa && !acc.extra_data) {
    const isEmail = acc.username.includes('@');
    return isEmail
      ? `📧 **Email:** \`${acc.username}\``
      : `🔑 **Key:** \`${acc.username}\``;
  }
  let info = L(lang,
    `📧 **TK:** \`${acc.username}\`\n🔑 **MK:** \`${acc.password}\``,
    `📧 **Username:** \`${acc.username}\`\n🔑 **Password:** \`${acc.password}\``,
    `📧 **账号:** \`${acc.username}\`\n🔑 **密码:** \`${acc.password}\``
  );
  if (acc.twofa) info += `\n🔐 **2FA:** \`${acc.twofa}\``;
  if (acc.extra_data) info += `\n📩 **Extra:** \`${acc.extra_data}\``;
  return info;
};

// Helper to build success message
const buildSuccessMsg = (lang, invoiceCode, timeStr, productName, price, finalBalance, accountInfo, quantity = null) => {
  const qtyLine = quantity ? L(lang, `📦 Số lượng: ${quantity}\n`, `📦 Quantity: ${quantity}\n`, `📦 数量: ${quantity}\n`) : '';
  return L(lang,
    `✅ **THANH TOÁN THÀNH CÔNG!**\n\n🧾 Mã HĐ: \`${invoiceCode}\`\n🕒 Thời gian: ${timeStr}\n🎁 Sản phẩm: ${productName}\n${qtyLine}💰 Giá: ${formatCurrency(price)}\n💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n${accountInfo}`,
    `✅ **PAYMENT SUCCESSFUL!**\n\n🧾 Invoice: \`${invoiceCode}\`\n🕒 Time: ${timeStr}\n🎁 Product: ${productName}\n${qtyLine}💰 Price: ${formatCurrency(price)}\n💵 New balance: ${formatCurrency(finalBalance)}\n\n${accountInfo}`,
    `✅ **支付成功！**\n\n🧾 订单号: \`${invoiceCode}\`\n🕒 时间: ${timeStr}\n🎁 产品: ${productName}\n${qtyLine}💰 价格: ${formatCurrency(price)}\n💵 新余额: ${formatCurrency(finalBalance)}\n\n${accountInfo}`
  );
};

// Helper to get formatted time string
const getTimeStr = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
};

// Xử lý mua sản phẩm với số lượng và trả về file txt
export const handlePurchaseWithQuantity = async (bot, msg, productId, quantity = 1, config) => {
  try {
    const user = await getUserByTelegram(msg.from.id);
    const lang = user?.language || 'vi';

    if (!user) {
      return bot.sendMessage(msg.chat.id, L(lang, 'Vui lòng /start để tạo tài khoản.', 'Please /start to create account.', '请 /start 创建账户。'));
    }

    const product = await getProduct(productId);
    if (!product) {
      return bot.sendMessage(msg.chat.id, L(lang, 'Sản phẩm không tồn tại.', 'Product not found.', '产品不存在。'));
    }

    const productPrice = Number(product.price) || 0;
    const totalPrice = productPrice * quantity;

    const currentUser = await getUserByTelegram(msg.from.id);
    const currentBalance = Number(currentUser.balance) || 0;

    let productType = product.type || 'stock';
    if (productType === 'auto') productType = 'stock';
    if (productType === 'manual') productType = 'order';

    // Kiểm tra tồn kho
    if (productType === 'stock') {
      if (product.stock < quantity || product.stock === 0) {
        return bot.sendMessage(msg.chat.id, L(lang,
          `❌ Không đủ sản phẩm trong kho. Hiện tại còn ${product.stock} sản phẩm.`,
          `❌ Not enough stock. Currently ${product.stock} available.`,
          `❌ 库存不足，当前剩余 ${product.stock} 件。`
        ));
      }
    }

    // Nếu không đủ tiền, tự động tạo QR
    if (currentBalance < totalPrice) {
      const missingAmount = totalPrice - currentBalance;

      const { getCache, setCache } = await import('../../lib/cache/index.js');
      const purchaseKey = `purchase_${msg.from.id}`;
      setCache(purchaseKey, {
        productId,
        quantity,
        totalPrice,
        userId: user.id,
        telegramId: msg.from.id,
        chatId: msg.chat.id
      }, 30 * 60 * 1000);

      const { handleDepositAmount } = await import('./handleDeposit.js');

      // Retrieve active_bank setting from database
      let activeBank = 'viettel';
      try {
        const rows = await query("SELECT `value` FROM settings WHERE `key` = 'active_bank'");
        if (rows?.[0]?.value) {
          activeBank = rows[0].value;
        }
      } catch (e) {
        console.error('Error fetching active_bank setting for auto deposit:', e);
      }

      setCache(`bank_selection_${msg.from.id}`, activeBank, 15 * 60 * 1000);

      const fakeMsg = { ...msg, text: missingAmount.toString() };

      await bot.sendMessage(
        msg.chat.id,
        L(lang,
          `❌ **Số dư không đủ!**\n\n💵 Cần: ${formatCurrency(totalPrice)}\n💰 Bạn có: ${formatCurrency(currentBalance)}\n💸 Thiếu: ${formatCurrency(missingAmount)}\n\n💡 Hệ thống sẽ tự động tạo QR để nạp số tiền thiếu. Sau khi chuyển khoản thành công, tài khoản sẽ tự động được gửi cho bạn.`,
          `❌ **Insufficient balance!**\n\n💵 Need: ${formatCurrency(totalPrice)}\n💰 You have: ${formatCurrency(currentBalance)}\n💸 Missing: ${formatCurrency(missingAmount)}\n\n💡 QR code will be auto-generated. After successful transfer, the account will be sent automatically.`,
          `❌ **余额不足！**\n\n💵 需要: ${formatCurrency(totalPrice)}\n💰 您有: ${formatCurrency(currentBalance)}\n💸 差额: ${formatCurrency(missingAmount)}\n\n💡 系统将自动生成 QR 码，转账成功后账户将自动发送给您。`
        ),
        { parse_mode: 'Markdown' }
      );

      try {
        await handleDepositAmount(bot, fakeMsg, user, config);
      } catch (depErr) {
        console.error('[AUTO_QR_DEPOSIT_ERROR]', depErr);
      }
      return;
    }

    // Xử lý theo loại sản phẩm
    let purchasedAccounts = [];

    if (productType === 'order') {
      await updateBalance(user.id, -totalPrice);
      await addBalanceLog({
        userId: user.id,
        amount: -totalPrice,
        reason: `buy_product_order_${product.id}_${quantity}`,
        adminId: null
      });

      manualOrderState.set(String(msg.from.id), { productId, step: 'email', quantity });

      const updatedUser = await getUserByTelegram(msg.from.id);
      const finalBalance = Number(updatedUser.balance);

      await bot.sendMessage(
        msg.chat.id,
        L(lang,
          `📝 **Sản phẩm yêu cầu thông tin**\n\n🎁 Sản phẩm: ${product.name}\n💰 Giá: ${formatCurrency(totalPrice)}\n💵 Số dư mới: ${formatCurrency(finalBalance)}\n\nVui lòng nhập **email** cần nâng cấp:`,
          `📝 **Product requires information**\n\n🎁 Product: ${product.name}\n💰 Price: ${formatCurrency(totalPrice)}\n💵 New balance: ${formatCurrency(finalBalance)}\n\nPlease enter **email** to upgrade:`,
          `📝 **产品需要信息**\n\n🎁 产品: ${product.name}\n💰 价格: ${formatCurrency(totalPrice)}\n💵 新余额: ${formatCurrency(finalBalance)}\n\n请输入需要升级的 **邮箱**：`
        ),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Sản phẩm stock: lấy accounts từ kho
    for (let i = 0; i < quantity; i++) {
      let accountFound = false;
      while (!accountFound) {
        const account = await takeAndMarkSoldOneAvailable(product.id);
        if (!account) {
          // Refund partially if some accounts were already bought? 
          // Currently, handlePurchaseWithQuantity marks accounts as sold and deducts balance at once.
          // If we fail here, we should probably refund.

          if (purchasedAccounts.length > 0) {
            // We've already got some accounts. Should we return them or refund everything?
            // The original logic returns what it got and errors.
          }

          bot.sendMessage(msg.chat.id, L(lang,
            `❌ Không đủ tài khoản sống trong kho. Đã lấy được ${purchasedAccounts.length}/${quantity} tài khoản.`,
            `❌ Not enough live accounts in stock. Got ${purchasedAccounts.length}/${quantity}.`,
            `❌ 库存中没有足够的活跃账户。已获取 ${purchasedAccounts.length}/${quantity} 个。`
          ));

          // Refund logic for the remaining quantity
          if (purchasedAccounts.length < quantity) {
            const refundAmount = productPrice * (quantity - purchasedAccounts.length);
            await updateBalance(user.id, refundAmount);
            await addBalanceLog({
              userId: user.id,
              amount: refundAmount,
              reason: `refund_buy_product_insufficient_live_${product.id}`,
              adminId: null
            });
            bot.sendMessage(msg.chat.id, L(lang,
              `💰 Đã hoàn lại ${formatCurrency(refundAmount)} cho ${quantity - purchasedAccounts.length} sản phẩm lỗi/hết hàng.`,
              `💰 Refunded ${formatCurrency(refundAmount)} for ${quantity - purchasedAccounts.length} failed/out-of-stock items.`,
              `💰 已为 ${quantity - purchasedAccounts.length} 个失败/缺货产品退款 ${formatCurrency(refundAmount)}。`
            ));
          }

          if (purchasedAccounts.length === 0) return; // Exit if nothing bought
          break; // Exit loop if some were bought but stock is out
        }

        // Check live if enabled
        if (product.check_live) {
          console.log(`[BUY_PRODUCT] Checking live for: ${account.username}`);
          const liveResult = await checkGmailLive(account.username);
          const isLive = liveResult?.results?.[account.username] === true;

          if (!isLive) {
            console.log(`[BUY_PRODUCT] Account is DEAD: ${account.username}. Deleting and trying next...`);
            await deleteAccountAfterPurchase(account.id, product.id);
            continue; // Try next account
          }
          console.log(`[BUY_PRODUCT] Account is LIVE: ${account.username}`);
        }

        purchasedAccounts.push(account);
        accountFound = true;
      }
      if (purchasedAccounts.length < (i + 1)) break; // Break if we couldn't find a live account
    }

    if (purchasedAccounts.length === 0) return; // Final fallback

    // Trừ tiền
    await updateBalance(user.id, -totalPrice);
    await addBalanceLog({
      userId: user.id,
      amount: -totalPrice,
      reason: `buy_product_${product.id}_${quantity}`,
      adminId: null
    });

    // Xóa accounts sau khi mua
    for (const account of purchasedAccounts) {
      await deleteAccountAfterPurchase(account.id, product.id);
    }

    const accountsData = purchasedAccounts.map(acc => {
      let line = `${acc.username}|${acc.password}`;
      if (acc.extra_data) line += `|${acc.extra_data}`;
      if (acc.twofa) line += `|${acc.twofa}`;
      return line;
    }).join('\n');

    // Tạo order
    const orderResult = await createOrder({
      userId: user.id,
      productId: product.id,
      price: totalPrice,
      status: 'completed',
      email: accountsData
    });

    const updatedUser = await getUserByTelegram(msg.from.id);
    const finalBalance = Number(updatedUser.balance);

    // Notify admins
    const adminIds = await getAdminIds(config?.ADMIN_IDS || []);
    if (adminIds.length > 0) {
      notifyAdminAboutPurchase(bot, adminIds, {
        orderId: orderResult.insertId || 'AUTO',
        productName: product.name,
        username: user.username,
        telegramId: user.telegram_id,
        quantity: quantity,
        price: totalPrice,
        finalBalance: finalBalance,
        accounts: purchasedAccounts
      });
    }

    if (quantity === 1) {
      const acc = purchasedAccounts[0];
      const accountInfo = buildAccountInfo(acc, lang);
      const timeStr = getTimeStr();
      const content = buildSuccessMsg(lang, orderResult.invoiceCode, timeStr, product.name, totalPrice, finalBalance, accountInfo);
      await bot.sendMessage(msg.chat.id, content, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{
            text: L(lang, 'Mua tiếp', 'Buy more', '继续购买'),
            callback_data: createCallbackData({ action: 'products', page: 1 }),
            style: 'primary'
          }]]
        }
      });
      console.log(`[BUY_PRODUCT] ✅ Đã gửi tài khoản trực tiếp (số lượng: 1)`);
    } else {
      // Mua từ 2 tài khoản trở lên: gửi file TXT
      const fileContent = purchasedAccounts.map(acc => {
        let line = `${acc.username}|${acc.password}`;
        if (acc.extra_data) line += `|${acc.extra_data}`;
        if (acc.twofa) line += `|${acc.twofa}`;
        return line;
      }).join('\n');
      const fileName = `product_${product.id}_${quantity}_${Date.now()}.txt`;
      const tempFilePath = path.join(__dirname, '../../temp', fileName);

      const tempDir = path.dirname(tempFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempFilePath, fileContent, 'utf8');

      try {
        const timeStr = getTimeStr();
        const caption = buildSuccessMsg(lang, orderResult.invoiceCode, timeStr, product.name, totalPrice, finalBalance, '', quantity);

        await bot.sendDocument(msg.chat.id, tempFilePath, {
          caption: caption,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{
              text: L(lang, 'Mua tiếp', 'Buy more', '继续购买'),
              callback_data: createCallbackData({ action: 'products', page: 1 }),
              style: 'primary'
            }]]
          }
        });
        console.log(`[BUY_PRODUCT] ✅ Đã gửi file tài khoản thành công (số lượng: ${quantity})`);
      } catch (sendError) {
        console.error(`[BUY_PRODUCT] ❌ Lỗi khi gửi file:`, sendError);
        const accountText = purchasedAccounts.map(acc => `${acc.username}|${acc.password}`).join('\n');
        const timeStr = getTimeStr();
        let messageText = L(lang,
          `✅ Mua thành công!\n\n🧾 Mã HĐ: ${orderResult.invoiceCode}\n🕒 Thời gian: ${timeStr}\n🎁 Sản phẩm: ${product.name}\n📦 Số lượng: ${quantity}\n💰 Giá: ${formatCurrency(totalPrice)}\n💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n📋 Danh sách tài khoản:\n\n${accountText}`,
          `✅ Purchase successful!\n\n🧾 Invoice: ${orderResult.invoiceCode}\n🕒 Time: ${timeStr}\n🎁 Product: ${product.name}\n📦 Quantity: ${quantity}\n💰 Price: ${formatCurrency(totalPrice)}\n💵 New balance: ${formatCurrency(finalBalance)}\n\n📋 Account list:\n\n${accountText}`,
          `✅ 购买成功！\n\n🧾 订单号: ${orderResult.invoiceCode}\n🕒 时间: ${timeStr}\n🎁 产品: ${product.name}\n📦 数量: ${quantity}\n💰 价格: ${formatCurrency(totalPrice)}\n💵 新余额: ${formatCurrency(finalBalance)}\n\n📋 账户列表：\n\n${accountText}`
        );
        await bot.sendMessage(msg.chat.id, messageText);
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

  } catch (error) {
    console.error('[BUY_PRODUCT_QUANTITY] Error:', error);
    const user = await getUserByTelegram(msg.from.id).catch(() => null);
    const lang = user?.language || 'vi';
    await bot.sendMessage(msg.chat.id, L(lang,
      '❌ Có lỗi xảy ra khi mua sản phẩm. Vui lòng thử lại sau.',
      '❌ An error occurred while purchasing. Please try again later.',
      '❌ 购买时出错，请稍后重试。'
    ));
  }
};



// Hoàn tất purchase sau khi nạp tiền thành công
export const completePurchaseAfterDeposit = async (bot, userId, telegramId, chatId) => {
  try {
    const { getCache, delCache } = await import('../../lib/cache/index.js');
    const purchaseKey = `purchase_${telegramId}`;
    const purchaseInfo = getCache(purchaseKey);

    if (!purchaseInfo) {
      return false;
    }

    delCache(purchaseKey);

    const { productId, quantity, totalPrice } = purchaseInfo;
    const product = await getProduct(productId);
    const user = await getUserByTelegram(telegramId);
    const lang = user?.language || 'vi';

    if (!product) {
      return bot.sendMessage(chatId, L(lang, '❌ Sản phẩm không tồn tại.', '❌ Product not found.', '❌ 产品不存在。'));
    }

    if (!user) {
      return bot.sendMessage(chatId, L(lang, '❌ Không tìm thấy user.', '❌ User not found.', '❌ 未找到用户。'));
    }

    const currentBalance = Number(user.balance) || 0;
    if (currentBalance < totalPrice) {
      return bot.sendMessage(chatId, L(lang,
        `❌ Số dư vẫn chưa đủ. Cần: ${formatCurrency(totalPrice)}, Bạn có: ${formatCurrency(currentBalance)}`,
        `❌ Balance still insufficient. Need: ${formatCurrency(totalPrice)}, You have: ${formatCurrency(currentBalance)}`,
        `❌ 余额仍不足。需要: ${formatCurrency(totalPrice)}, 您有: ${formatCurrency(currentBalance)}`
      ));
    }

    let productType = product.type || 'stock';
    if (productType === 'auto') productType = 'stock';
    if (productType === 'manual') productType = 'order';

    if (productType === 'order') {
      await updateBalance(user.id, -totalPrice);
      await addBalanceLog({
        userId: user.id,
        amount: -totalPrice,
        reason: `buy_product_order_${product.id}_${quantity}`,
        adminId: null
      });

      manualOrderState.set(telegramId, { productId, step: 'email', quantity });

      const updatedUser = await getUserByTelegram(telegramId);
      const finalBalance = Number(updatedUser.balance);

      await bot.sendMessage(
        chatId,
        L(lang,
          `✅ **Đã nạp tiền thành công!**\n\n📝 **Sản phẩm yêu cầu thông tin**\n\n🎁 Sản phẩm: ${product.name}\n💰 Giá: ${formatCurrency(totalPrice)}\n💵 Số dư mới: ${formatCurrency(finalBalance)}\n\nVui lòng nhập **email** cần nâng cấp:`,
          `✅ **Deposit successful!**\n\n📝 **Product requires information**\n\n🎁 Product: ${product.name}\n💰 Price: ${formatCurrency(totalPrice)}\n💵 New balance: ${formatCurrency(finalBalance)}\n\nPlease enter **email** to upgrade:`,
          `✅ **充值成功！**\n\n📝 **产品需要信息**\n\n🎁 产品: ${product.name}\n💰 价格: ${formatCurrency(totalPrice)}\n💵 新余额: ${formatCurrency(finalBalance)}\n\n请输入需要升级的 **邮箱**：`
        ),
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    // Sản phẩm stock
    if (product.stock < quantity || product.stock === 0) {
      return bot.sendMessage(chatId, L(lang,
        `❌ Không đủ sản phẩm trong kho. Hiện tại còn ${product.stock} sản phẩm.`,
        `❌ Not enough stock. Currently ${product.stock} available.`,
        `❌ 库存不足，当前剩余 ${product.stock} 件。`
      ));
    }

    const purchasedAccounts = [];
    for (let i = 0; i < quantity; i++) {
      const account = await takeAndMarkSoldOneAvailable(product.id);
      if (!account) {
        if (purchasedAccounts.length > 0) {
          for (const acc of purchasedAccounts) {
            await query('UPDATE accounts SET status = "available" WHERE id = ?', [acc.id]);
          }
        }
        return bot.sendMessage(chatId, L(lang,
          `❌ Không đủ tài khoản trong kho. Đã lấy được ${purchasedAccounts.length}/${quantity} tài khoản.`,
          `❌ Not enough accounts. Got ${purchasedAccounts.length}/${quantity}.`,
          `❌ 账户不足，已获取 ${purchasedAccounts.length}/${quantity}。`
        ));
      }
      purchasedAccounts.push(account);
    }

    // Trừ tiền
    await updateBalance(user.id, -totalPrice);
    await addBalanceLog({
      userId: user.id,
      amount: -totalPrice,
      reason: `buy_product_${product.id}_${quantity}`,
      adminId: null
    });

    // Xóa accounts
    for (const account of purchasedAccounts) {
      await deleteAccountAfterPurchase(account.id, product.id);
    }

    const accountsData = purchasedAccounts.map(acc => {
      let line = `${acc.username}|${acc.password}`;
      if (acc.extra_data) line += `|${acc.extra_data}`;
      if (acc.twofa) line += `|${acc.twofa}`;
      return line;
    }).join('\n');

    // Tạo order
    const orderResult = await createOrder({
      userId: user.id,
      productId: product.id,
      price: totalPrice,
      status: 'completed',
      email: accountsData
    });

    const updatedUser = await getUserByTelegram(telegramId);
    const finalBalance = Number(updatedUser.balance);

    if (quantity === 1) {
      const acc = purchasedAccounts[0];
      const accountInfo = buildAccountInfo(acc, lang);
      const timeStr = getTimeStr();
      const content = buildSuccessMsg(lang, orderResult.invoiceCode, timeStr, product.name, totalPrice, finalBalance, accountInfo);
      await bot.sendMessage(chatId, content, { parse_mode: 'Markdown' });
      console.log(`[BUY_PRODUCT] ✅ Đã gửi tài khoản trực tiếp (số lượng: 1)`);
    } else {
      // Mua từ 2 trở lên: gửi file TXT
      const fileContent = purchasedAccounts.map(acc => {
        let line = `${acc.username}|${acc.password}`;
        if (acc.extra_data) line += `|${acc.extra_data}`;
        if (acc.twofa) line += `|${acc.twofa}`;
        return line;
      }).join('\n');
      const fileName = `product_${product.id}_${quantity}_${Date.now()}.txt`;
      const tempFilePath = path.join(__dirname, '../../temp', fileName);

      const tempDir = path.dirname(tempFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempFilePath, fileContent, 'utf8');

      try {
        const timeStr = getTimeStr();
        const caption = buildSuccessMsg(lang, orderResult.invoiceCode, timeStr, product.name, totalPrice, finalBalance, '', quantity);

        await bot.sendDocument(chatId, tempFilePath, {
          caption: caption,
          parse_mode: 'Markdown'
        });
        console.log(`[BUY_PRODUCT] ✅ Đã gửi file tài khoản thành công (số lượng: ${quantity})`);
      } catch (sendError) {
        console.error(`[BUY_PRODUCT] ❌ Lỗi khi gửi file:`, sendError);
        const accountText = purchasedAccounts.map(acc => {
          if (acc.twofa) {
            return `${acc.username}|${acc.password}|${acc.twofa}`;
          }
          return `${acc.username}|${acc.password}`;
        }).join('\n');
        const timeStr = getTimeStr();
        let messageText = L(lang,
          `✅ Mua thành công!\n\n🧾 Mã HĐ: ${orderResult.invoiceCode}\n🕒 Thời gian: ${timeStr}\n🎁 Sản phẩm: ${product.name}\n📦 Số lượng: ${quantity}\n💰 Giá: ${formatCurrency(totalPrice)}\n💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n📋 Danh sách tài khoản:\n\n${accountText}`,
          `✅ Purchase successful!\n\n🧾 Invoice: ${orderResult.invoiceCode}\n🕒 Time: ${timeStr}\n🎁 Product: ${product.name}\n📦 Quantity: ${quantity}\n💰 Price: ${formatCurrency(totalPrice)}\n💵 New balance: ${formatCurrency(finalBalance)}\n\n📋 Account list:\n\n${accountText}`,
          `✅ 购买成功！\n\n🧾 订单号: ${orderResult.invoiceCode}\n🕒 时间: ${timeStr}\n🎁 产品: ${product.name}\n📦 数量: ${quantity}\n💰 价格: ${formatCurrency(totalPrice)}\n💵 新余额: ${formatCurrency(finalBalance)}\n\n📋 账户列表：\n\n${accountText}`
        );
        await bot.sendMessage(chatId, messageText);
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('[COMPLETE_PURCHASE_AFTER_DEPOSIT] Error:', error);
    return false;
  }
};
