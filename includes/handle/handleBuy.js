import { listProducts, getProduct } from '../controllers/productController.js';
import { takeOneAvailable, markSold, syncStock, deleteAccountAfterPurchase, takeAndMarkSoldOneAvailable } from '../controllers/accountController.js';
import { updateBalance, getUserByTelegram } from '../controllers/userController.js';
import { createOrder, getOrderById } from '../controllers/orderController.js';
import { formatCurrency, buildPaginationKeyboard, createCallbackData } from '../../utils/index.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { notifyAdminAboutNewManualOrder, notifyAdminAboutPurchase } from './handleNotify.js';
import { query } from '../database/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map để lưu state user đang nhập thông tin cho manual order
// Key: telegram_id (string), Value: { productId, step: 'email' | 'note' }
const manualOrderState = new Map();


// Map để lưu state user đang nhập số lượng cho sản phẩm
// Key: telegram_id (string), Value: { productId, price, stock }
const waitingForProductQuantity = new Map();




export const sendProductList = async (bot, chatId, page, pageSize, user) => {
  const { formatMoney } = await import('../helpers/langHelper.js');
  const lang = user?.language || 'vi';

  const offset = (page - 1) * pageSize;
  const { rows, total } = await listProducts(offset, pageSize);
  if (!rows.length) {
    const msg = lang === 'en' ? 'No products yet.' : 'Chưa có sản phẩm.';
    return bot.sendMessage(chatId, msg);
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
    const msg = lang === 'en'
      ? '🚫 Products are temporarily hidden. Please come back later.'
      : '🚫 Các sản phẩm đang tạm ẩn. Vui lòng quay lại sau.';
    return bot.sendMessage(chatId, msg);
  }

  const inline_keyboard = await Promise.all(filteredRows.map(async (p) => {
    let icon = '✅'; // Default: in stock
    if (p.type === 'order') {
      icon = '📝'; // Order type product
    } else if (p.stock <= 0) {
      icon = '❌'; // Out of stock
    }
    const stockText = p.type === 'order' ? '' : ` (${p.stock})`;
    const priceText = await formatMoney(p.price, lang);
    return [{
      text: `${icon} ${p.name} - ${priceText}${stockText}`,
      callback_data: createCallbackData({ action: 'view_product', productId: p.id })
    }];
  }));

  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  inline_keyboard.push(...buildPaginationKeyboard({ action: 'products', page }, page, hasPrev, hasNext));

  const selectMsg = lang === 'en' ? 'Select product:' : 'Chọn sản phẩm:';
  await bot.sendMessage(chatId, selectMsg, { reply_markup: { inline_keyboard } });
};

// Hiển thị chi tiết sản phẩm
export const showProductDetail = async (bot, chatId, productId, userId) => {
  const product = await getProduct(productId);
  const user = await getUserByTelegram(userId);
  const lang = user?.language || 'vi';

  if (!product) {
    const msg = lang === 'en' ? '❌ Product not found.' : '❌ Sản phẩm không tồn tại.';
    return bot.sendMessage(chatId, msg);
  }

  if (!user) {
    const msg = lang === 'en' ? 'Please /start to create account.' : 'Vui lòng /start để tạo tài khoản.';
    return bot.sendMessage(chatId, msg);
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

  // Tính giá USD
  const priceVnd = Number(product.price) || 0;
  const priceUsd = (priceVnd / exchangeRate).toFixed(2);

  // Normalize product type: 'auto' -> 'stock', 'manual' -> 'order'
  let productType = product.type || 'stock';
  if (productType === 'auto') productType = 'stock';
  if (productType === 'manual') productType = 'order';

  const stock = Number(product.stock) || 0;
  const defaultDesc = lang === 'en' ? 'No description' : 'Không có mô tả';
  const description = product.description || defaultDesc;

  const titleLabel = lang === 'en' ? '📦 **PRODUCT DETAILS**' : '📦 **CHI TIẾT SẢN PHẨM**';
  const nameLabel = lang === 'en' ? 'Name' : 'Tên';
  const priceLabel = lang === 'en' ? 'Price' : 'Giá';
  const descLabel = lang === 'en' ? 'Description' : 'Mô tả';
  const stockLabel = lang === 'en' ? 'Stock' : 'Tồn kho';

  let detailText = `${titleLabel}\n\n` +
    `🎁 **${nameLabel}:** ${product.name}\n` +
    `💰 **${priceLabel}:** ${formatCurrency(priceVnd)} (~$${priceUsd})\n` +
    `📝 **${descLabel}:** ${description}\n`;

  // Hiển thị thông tin tồn kho cho sản phẩm stock
  if (productType === 'stock') {
    const stockText = stock > 0
      ? (lang === 'en' ? `✅ ${stock} in stock` : `✅ Còn ${stock} sản phẩm`)
      : (lang === 'en' ? '❌ Out of stock' : '❌ Hết hàng');
    detailText += ` **${stockLabel}:** ${stockText}\n`;
  }

  // Nếu là sản phẩm stock và còn hàng, hoặc là sản phẩm order, yêu cầu nhập số lượng
  if ((productType === 'stock' && stock > 0) || productType === 'order') {
    // Lưu trạng thái đang chờ input quantity. FORCE STRING ID.
    const userIdStr = String(userId);
    waitingForProductQuantity.set(userIdStr, {
      productId: product.id,
      price: product.price,
      stock: stock,
      type: productType
    });
    console.log(`[BUY_DEBUG] Set waitingForProductQuantity for user ${userIdStr}:`, waitingForProductQuantity.get(userIdStr));

    const quantityPrompt = lang === 'en'
      ? `\n\nPlease enter quantity to buy (less than or equal to stock):`
      : `\n\nVui lòng nhập số lượng bạn muốn mua (số lượng nhỏ hơn hoặc bằng tồn kho):`;
    detailText += quantityPrompt;
  }

  const backBtn = lang === 'en' ? '⬅️ Back' : '⬅️ Quay lại';
  const inline_keyboard = [
    [
      {
        text: backBtn,
        callback_data: createCallbackData({ action: 'products', page: 1 })
      }
    ]
  ];

  await bot.sendMessage(chatId, detailText, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard }
  });

  // Nếu là sản phẩm stock và hết hàng, gửi thông báo riêng
  if (productType === 'stock' && stock === 0) {
    const outOfStockMsg = lang === 'en'
      ? '❌ This product is out of stock. Please choose another product.'
      : '❌ Sản phẩm hiện đã hết hàng. Vui lòng chọn sản phẩm khác.';
    await bot.sendMessage(chatId, outOfStockMsg);
  }
};

export const handlePurchase = async (bot, msg, productId, fromUser, config) => {
  const user = await getUserByTelegram(fromUser.id);
  if (!user) return bot.sendMessage(msg.chat.id, 'Vui lòng /start để tạo tài khoản.');
  const product = await getProduct(productId);
  if (!product) return bot.sendMessage(msg.chat.id, 'Sản phẩm không tồn tại.');

  // Lấy lại số dư mới nhất trước khi kiểm tra để đảm bảo chính xác
  const currentUser = await getUserByTelegram(fromUser.id);
  const currentBalance = Number(currentUser.balance) || 0;
  const productPrice = Number(product.price) || 0;

  if (currentBalance < productPrice) {
    return bot.sendMessage(
      msg.chat.id,
      `❌ **Số dư không đủ!**\n\n` +
      `💵 Cần: ${formatCurrency(productPrice)}\n` +
      `💰 Bạn có: ${formatCurrency(currentBalance)}\n\n` +
      `💡 Vui lòng nạp thêm tiền để tiếp tục.`,
      { parse_mode: 'Markdown' }
    );
  }

  // Kiểm tra có account available không để quyết định manual hay auto order
  // Nếu có account → auto order (tự động giao)
  // Nếu không có account → manual order (yêu cầu nhập email/note)
  const account = await takeOneAvailable(product.id);
  const isManualOrder = !account;

  if (isManualOrder) {
    // Sản phẩm không có kho: yêu cầu nhập email và note (order manual)
    // Trừ tiền (đã kiểm tra số dư ở trên)
    await updateBalance(user.id, -productPrice);
    await addBalanceLog({
      userId: user.id,
      amount: -productPrice,
      reason: `buy_product_manual_${product.id}`,
      adminId: null
    });

    // Lưu state để bắt đầu flow nhập thông tin
    manualOrderState.set(String(fromUser.id), { productId, step: 'email' });

    const updatedUser = await getUserByTelegram(fromUser.id);
    const finalBalance = Number(updatedUser.balance);

    await bot.sendMessage(
      msg.chat.id,
      `📝 **Sản phẩm yêu cầu thông tin**\n\n` +
      `🎁 Sản phẩm: ${product.name}\n` +
      `💰 Giá: ${formatCurrency(productPrice)}\n` +
      `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n` +
      `Vui lòng nhập **email** cần nâng cấp:`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Sản phẩm có kho: xử lý như bình thường (auto - giao ngay)

  await updateBalance(user.id, -productPrice);
  await addBalanceLog({
    userId: user.id,
    amount: -productPrice,
    reason: `buy_product_auto_${product.id}`,
    adminId: null
  });

  // Nếu là Gmail Edu 7 ngày, lưu delete_at = 7 ngày sau
  const isGmailEdu7Days = product.name && (
    product.name.toLowerCase().includes('gmail edu') &&
    product.name.toLowerCase().includes('7 ngày')
  );

  let deleteAt = null;
  if (isGmailEdu7Days) {
    deleteAt = new Date();
    deleteAt.setDate(deleteAt.getDate() + 7); // 7 ngày sau
    console.log(`[BUY_PRODUCT] Đã lưu delete_at cho Gmail Edu 7 ngày: ${deleteAt.toISOString()}`);
  }

  // Xóa account sau khi mua (mua đến đâu xóa đến đó)
  await deleteAccountAfterPurchase(account.id, product.id);
  await createOrder({ userId: user.id, productId: product.id, price: productPrice, status: 'completed' });

  // Lấy lại user để có số dư chính xác
  const updatedUser = await getUserByTelegram(fromUser.id);
  const finalBalance = Number(updatedUser.balance);

  const content = `✅ **Mua thành công!**\n\n` +
    `🎁 Sản phẩm: ${product.name}\n` +
    `💰 Giá: ${formatCurrency(productPrice)}\n` +
    `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n` +
    `📧 Tài khoản: \`${account.username}\` | \`${account.password}\`${account.extra_data ? ` | Extra: \`${account.extra_data}\`` : ''}${account.twofa ? ` | 2FA: \`${account.twofa}\`` : ''}`;
  await bot.sendMessage(msg.chat.id, content, { parse_mode: 'Markdown' });

  // Notify admins
  const adminIds = config?.ADMIN_IDS || [];
  if (adminIds.length > 0) {
    notifyAdminAboutPurchase(bot, adminIds, {
      orderId: 'AUTO',
      productName: product.name,
      username: user.username,
      telegramId: user.telegram_id,
      quantity: 1,
      price: productPrice,
      finalBalance: finalBalance,
      accounts: [account] // Pass single account as array
    });
  }
};

// Xử lý input email/note cho manual order
export const handleManualOrderInput = async (bot, msg, userId, adminIds = []) => {
  const state = manualOrderState.get(String(userId));
  if (!state) return false; // Không phải manual order flow

  const text = msg.text.trim();

  if (state.step === 'email') {
    // Validate email đơn giản
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      await bot.sendMessage(msg.chat.id, '❌ Email không hợp lệ. Vui lòng nhập lại:');
      return true; // Đã xử lý (validation error)
    }

    // Lưu email và chuyển sang bước nhập note
    state.email = text;
    state.step = 'note';
    manualOrderState.set(String(userId), state);

    await bot.sendMessage(
      msg.chat.id,
      `✅ Đã nhận email: ${text}\n\nVui lòng nhập **ghi chú** (note):\n(Ví dụ: Nâng cấp lên bản Pro, cần thêm tính năng XYZ...)`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  if (state.step === 'note') {
    // Lưu note và tạo order
    const product = await getProduct(state.productId);
    if (!product) {
      manualOrderState.delete(String(userId));
      return bot.sendMessage(msg.chat.id, '❌ Sản phẩm không tồn tại.');
    }

    const user = await getUserByTelegram(userId);
    if (!user) {
      manualOrderState.delete(String(userId));
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy user.');
    }

    // Tạo order với status pending (tiền đã được trừ ở handlePurchase)
    const orderResult = await createOrder({
      userId: user.id,
      productId: state.productId,
      price: product.price,
      email: state.email,
      note: text,
      status: 'pending'
    });

    // Lấy order vừa tạo để gửi thông báo cho admin
    let order = null;
    if (orderResult && orderResult.insertId) {
      order = await getOrderById(orderResult.insertId);
    } else {
      // Nếu không có insertId, tìm order mới nhất của user
      const { listOrdersByUser } = await import('../controllers/orderController.js');
      const { rows } = await listOrdersByUser(user.id, 0, 1);
      if (rows.length > 0) {
        order = await getOrderById(rows[0].id);
      }
    }

    // Thông báo cho admin
    if (order && adminIds && adminIds.length > 0) {
      await notifyAdminAboutNewManualOrder(bot, adminIds, {
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

    // Xóa state
    manualOrderState.delete(String(userId));

    await bot.sendMessage(
      msg.chat.id,
      `✅ **Đơn hàng đã được tạo!**\n\n` +
      `🎁 Sản phẩm: ${product.name}\n` +
      `📧 Email: ${state.email}\n` +
      `📝 Ghi chú: ${text}\n\n` +
      `⏳ Đơn hàng đang chờ admin xử lý. Bạn sẽ nhận được thông báo khi hoàn thành.`
    );
    return true;
  }

  return false;
};

// Hiển thị chi tiết Gmail sẵn thanh toán


// Yêu cầu nhập số lượng cho Gmail sẵn thanh toán


// Xử lý input quantity từ user cho Gmail sẵn thanh toán



// Xử lý input quantity từ user cho sản phẩm
export const handleProductQuantityInput = async (bot, msg, quantityStr, config) => {
  const userId = msg.from.id;
  const userIdStr = String(userId);
  const chatId = msg.chat.id;

  const waitingState = waitingForProductQuantity.get(userIdStr);
  console.log(`[BUY_DEBUG] Checking waitingForProductQuantity for user ${userIdStr}:`, waitingState);

  if (!waitingState) {
    console.log(`[BUY_DEBUG] Waiting state not found inside waitingForProductQuantity map`);
    return false; // Không phải input quantity cho sản phẩm, bỏ qua
  }

  waitingForProductQuantity.delete(userIdStr);

  const quantity = parseInt(quantityStr.trim(), 10);
  if (isNaN(quantity) || quantity < 1) {
    await bot.sendMessage(chatId, '❌ Số lượng không hợp lệ. Vui lòng nhập số nguyên dương (ví dụ: 1, 2, 5).');
    return true;
  }

  // Kiểm tra tồn kho chỉ với sản phẩm stock
  if (waitingState.type === 'stock' && quantity > waitingState.stock) {
    await bot.sendMessage(chatId, `❌ Số lượng bạn muốn mua (${quantity}) vượt quá số lượng tồn kho (${waitingState.stock}). Vui lòng nhập lại.`);
    return true;
  }

  // Gọi hàm mua sản phẩm
  await handlePurchaseWithQuantity(bot, msg, waitingState.productId, quantity, config);
  return true;
};

// Xử lý mua sản phẩm với số lượng và trả về file txt
export const handlePurchaseWithQuantity = async (bot, msg, productId, quantity = 1, config) => {
  try {
    const user = await getUserByTelegram(msg.from.id);
    if (!user) {
      return bot.sendMessage(msg.chat.id, 'Vui lòng /start để tạo tài khoản.');
    }

    const product = await getProduct(productId);
    if (!product) {
      return bot.sendMessage(msg.chat.id, 'Sản phẩm không tồn tại.');
    }

    const productPrice = Number(product.price) || 0;
    const totalPrice = productPrice * quantity;

    // Lấy lại số dư mới nhất trước khi kiểm tra
    const currentUser = await getUserByTelegram(msg.from.id);
    const currentBalance = Number(currentUser.balance) || 0;

    // Kiểm tra loại sản phẩm
    let productType = product.type || 'stock';
    if (productType === 'auto') productType = 'stock';
    if (productType === 'manual') productType = 'order';

    // Nếu là sản phẩm stock, kiểm tra tồn kho
    if (productType === 'stock') {
      if (product.stock < quantity || product.stock === 0) {
        return bot.sendMessage(
          msg.chat.id,
          `❌ Không đủ sản phẩm trong kho. Hiện tại còn ${product.stock} sản phẩm.`
        );
      }
    }

    // Nếu không đủ tiền, tự động tạo QR để nạp tiền
    if (currentBalance < totalPrice) {
      const missingAmount = totalPrice - currentBalance;

      // Lưu thông tin purchase vào cache để hoàn tất sau khi nạp tiền
      const { getCache, setCache } = await import('../../lib/cache/index.js');
      const purchaseKey = `purchase_${msg.from.id}`;
      setCache(purchaseKey, {
        productId,
        quantity,
        totalPrice,
        userId: user.id,
        telegramId: msg.from.id,
        chatId: msg.chat.id
      }, 30 * 60 * 1000); // 30 phút

      // Tạo QR với số tiền thiếu
      const { handleDepositAmount } = await import('./handleDeposit.js');

      // CONFIG is passed as argument, use it directly.

      // Tự động chọn MBBank và tạo QR
      const { setCache: setCacheDeposit } = await import('../../lib/cache/index.js');
      const bankKey = (telegramId) => `bank_${telegramId}`;
      setCacheDeposit(bankKey(msg.from.id), 'mbbank', 10 * 60 * 1000);

      // Tạo message giả để gọi handleDepositAmount
      const fakeMsg = {
        ...msg,
        text: missingAmount.toString()
      };

      await bot.sendMessage(
        msg.chat.id,
        `❌ **Số dư không đủ!**\n\n` +
        `💵 Cần: ${formatCurrency(totalPrice)}\n` +
        `💰 Bạn có: ${formatCurrency(currentBalance)}\n` +
        `💸 Thiếu: ${formatCurrency(missingAmount)}\n\n` +
        `💡 Hệ thống sẽ tự động tạo QR để nạp số tiền thiếu. Sau khi chuyển khoản thành công, tài khoản sẽ tự động được gửi cho bạn.`,
        { parse_mode: 'Markdown' }
      );

      await handleDepositAmount(bot, fakeMsg, user, config);
      return;
    }

    // Xử lý theo loại sản phẩm
    let purchasedAccounts = [];

    if (productType === 'order') {
      // Sản phẩm order: yêu cầu nhập email/note (manual order)
      await updateBalance(user.id, -totalPrice);
      await addBalanceLog({
        userId: user.id,
        amount: -totalPrice,
        reason: `buy_product_order_${product.id}_${quantity}`,
        adminId: null
      });

      // Lưu state để bắt đầu flow nhập thông tin
      manualOrderState.set(String(msg.from.id), { productId, step: 'email', quantity });

      const updatedUser = await getUserByTelegram(msg.from.id);
      const finalBalance = Number(updatedUser.balance);

      await bot.sendMessage(
        msg.chat.id,
        `📝 **Sản phẩm yêu cầu thông tin**\n\n` +
        `🎁 Sản phẩm: ${product.name}\n` +
        `💰 Giá: ${formatCurrency(totalPrice)}\n` +
        `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n` +
        `Vui lòng nhập **email** cần nâng cấp:`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Sản phẩm stock: lấy accounts từ kho (đánh dấu ngay để tránh lấy trùng)
    for (let i = 0; i < quantity; i++) {
      const account = await takeAndMarkSoldOneAvailable(product.id);
      if (!account) {
        // Rollback nếu không đủ accounts - khôi phục lại status "available" cho các account đã lấy
        if (purchasedAccounts.length > 0) {
          for (const acc of purchasedAccounts) {
            await query('UPDATE accounts SET status = "available" WHERE id = ?', [acc.id]);
          }
        }
        return bot.sendMessage(
          msg.chat.id,
          `❌ Không đủ tài khoản trong kho. Đã lấy được ${purchasedAccounts.length}/${quantity} tài khoản.`
        );
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

    // Xóa accounts sau khi mua (mua đến đâu xóa đến đó)
    for (const account of purchasedAccounts) {
      await deleteAccountAfterPurchase(account.id, product.id);
    }

    // Tạo order
    const orderResult = await createOrder({
      userId: user.id,
      productId: product.id,
      price: totalPrice,
      status: 'completed'
    });

    const updatedUser = await getUserByTelegram(msg.from.id);
    const finalBalance = Number(updatedUser.balance);

    // Notify admins
    const adminIds = config?.ADMIN_IDS || [];
    if (adminIds.length > 0) {
      notifyAdminAboutPurchase(bot, adminIds, {
        orderId: orderResult.insertId || 'AUTO',
        productName: product.name,
        username: user.username,
        telegramId: user.telegram_id,
        quantity: quantity,
        price: totalPrice,
        finalBalance: finalBalance,
        accounts: purchasedAccounts // Pass account list
      });
    }

    // Tạo file txt với tài khoản và mật khẩu (có 2FA nếu có)
    const fileContent = purchasedAccounts.map(acc => {
      let line = `${acc.username}|${acc.password}`;
      if (acc.extra_data) line += `|${acc.extra_data}`;
      if (acc.twofa) line += `|${acc.twofa}`;
      return line;
    }).join('\n');
    const fileName = `product_${product.id}_${quantity}_${Date.now()}.txt`;
    const tempFilePath = path.join(__dirname, '../../temp', fileName);

    // Đảm bảo thư mục temp tồn tại
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Ghi file tạm thời
    fs.writeFileSync(tempFilePath, fileContent, 'utf8');

    try {
      // Gửi file từ đường dẫn
      const caption = `✅ **Mua thành công!**\n\n` +
        `🎁 Sản phẩm: ${product.name}\n` +
        `📦 Số lượng: ${quantity}\n` +
        `💰 Giá: ${formatCurrency(totalPrice)}\n` +
        `💵 Số dư mới: ${formatCurrency(finalBalance)}`;

      await bot.sendDocument(msg.chat.id, tempFilePath, {
        caption: caption,
        parse_mode: 'Markdown'
      });
      console.log(`[BUY_PRODUCT] ✅ Đã gửi file tài khoản thành công`);
    } catch (sendError) {
      console.error(`[BUY_PRODUCT] ❌ Lỗi khi gửi file:`, sendError);
      // Nếu không gửi được file, gửi thông tin account qua text
      const accountText = purchasedAccounts.map(acc => `${acc.username}|${acc.password}`).join('\n');
      let messageText = `✅ Mua thành công!\n\n`;
      messageText += `🎁 Sản phẩm: ${product.name}\n`;
      messageText += `📦 Số lượng: ${quantity}\n`;
      messageText += `💰 Giá: ${formatCurrency(totalPrice)}\n`;
      messageText += `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n`;
      messageText += `📋 Danh sách tài khoản:\n\n${accountText}`;
      await bot.sendMessage(msg.chat.id, messageText);
    } finally {
      // Xóa file tạm thời sau khi gửi
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

  } catch (error) {
    console.error('[BUY_PRODUCT_QUANTITY] Error:', error);
    await bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra khi mua sản phẩm. Vui lòng thử lại sau.');
  }
};



// Hoàn tất purchase sau khi nạp tiền thành công
export const completePurchaseAfterDeposit = async (bot, userId, telegramId, chatId) => {
  try {
    const { getCache, delCache } = await import('../../lib/cache/index.js');
    const purchaseKey = `purchase_${telegramId}`;
    const purchaseInfo = getCache(purchaseKey);

    if (!purchaseInfo) {
      return false; // Không có purchase pending
    }

    // Xóa cache purchase
    delCache(purchaseKey);

    const { productId, quantity, totalPrice } = purchaseInfo;
    const product = await getProduct(productId);
    if (!product) {
      return bot.sendMessage(chatId, '❌ Sản phẩm không tồn tại.');
    }

    const user = await getUserByTelegram(telegramId);
    if (!user) {
      return bot.sendMessage(chatId, '❌ Không tìm thấy user.');
    }

    const currentBalance = Number(user.balance) || 0;
    if (currentBalance < totalPrice) {
      return bot.sendMessage(chatId, `❌ Số dư vẫn chưa đủ. Cần: ${formatCurrency(totalPrice)}, Bạn có: ${formatCurrency(currentBalance)}`);
    }

    // Kiểm tra loại sản phẩm
    let productType = product.type || 'stock';
    if (productType === 'auto') productType = 'stock';
    if (productType === 'manual') productType = 'order';

    if (productType === 'order') {
      // Sản phẩm order: yêu cầu nhập email/note
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
        `✅ **Đã nạp tiền thành công!**\n\n` +
        `📝 **Sản phẩm yêu cầu thông tin**\n\n` +
        `🎁 Sản phẩm: ${product.name}\n` +
        `💰 Giá: ${formatCurrency(totalPrice)}\n` +
        `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n` +
        `Vui lòng nhập **email** cần nâng cấp:`,
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    // Sản phẩm stock: lấy accounts từ kho
    if (product.stock < quantity || product.stock === 0) {
      return bot.sendMessage(chatId, `❌ Không đủ sản phẩm trong kho. Hiện tại còn ${product.stock} sản phẩm.`);
    }

    const purchasedAccounts = [];
    for (let i = 0; i < quantity; i++) {
      const account = await takeAndMarkSoldOneAvailable(product.id);
      if (!account) {
        // Rollback nếu không đủ accounts - khôi phục lại status "available" cho các account đã lấy
        if (purchasedAccounts.length > 0) {
          for (const acc of purchasedAccounts) {
            await query('UPDATE accounts SET status = "available" WHERE id = ?', [acc.id]);
          }
        }
        return bot.sendMessage(chatId, `❌ Không đủ tài khoản trong kho. Đã lấy được ${purchasedAccounts.length}/${quantity} tài khoản.`);
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

    // Xóa accounts sau khi mua (mua đến đâu xóa đến đó)
    for (const account of purchasedAccounts) {
      await deleteAccountAfterPurchase(account.id, product.id);
    }

    // Tạo order
    await createOrder({
      userId: user.id,
      productId: product.id,
      price: totalPrice,
      status: 'completed'
    });

    const updatedUser = await getUserByTelegram(telegramId);
    const finalBalance = Number(updatedUser.balance);

    // Tạo file txt với tài khoản và mật khẩu (có 2FA nếu có)
    const fileContent = purchasedAccounts.map(acc => {
      let line = `${acc.username}|${acc.password}`;
      if (acc.extra_data) line += `|${acc.extra_data}`;
      if (acc.twofa) line += `|${acc.twofa}`;
      return line;
    }).join('\n');
    const fileName = `product_${product.id}_${quantity}_${Date.now()}.txt`;
    const tempFilePath = path.join(__dirname, '../../temp', fileName);

    // Đảm bảo thư mục temp tồn tại
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Ghi file tạm thời
    fs.writeFileSync(tempFilePath, fileContent, 'utf8');

    try {
      // Gửi file từ đường dẫn
      const caption = `✅ **Mua thành công!**\n\n` +
        `🎁 Sản phẩm: ${product.name}\n` +
        `📦 Số lượng: ${quantity}\n` +
        `💰 Giá: ${formatCurrency(totalPrice)}\n` +
        `💵 Số dư mới: ${formatCurrency(finalBalance)}`;

      await bot.sendDocument(chatId, tempFilePath, {
        caption: caption,
        parse_mode: 'Markdown'
      });
      console.log(`[BUY_PRODUCT] ✅ Đã gửi file tài khoản thành công`);
    } catch (sendError) {
      console.error(`[BUY_PRODUCT] ❌ Lỗi khi gửi file:`, sendError);
      // Nếu không gửi được file, gửi thông tin account qua text
      const accountText = purchasedAccounts.map(acc => {
        if (acc.twofa) {
          return `${acc.username}|${acc.password}|${acc.twofa}`;
        }
        return `${acc.username}|${acc.password}`;
      }).join('\n');
      let messageText = `✅ Mua thành công!\n\n`;
      messageText += `🎁 Sản phẩm: ${product.name}\n`;
      messageText += `📦 Số lượng: ${quantity}\n`;
      messageText += `💰 Giá: ${formatCurrency(totalPrice)}\n`;
      messageText += `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n`;
      messageText += `📋 Danh sách tài khoản:\n\n${accountText}`;
      await bot.sendMessage(chatId, messageText);
    } finally {
      // Xóa file tạm thời sau khi gửi
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    return true;
  } catch (error) {
    console.error('[COMPLETE_PURCHASE_AFTER_DEPOSIT] Error:', error);
    return false;
  }
};

