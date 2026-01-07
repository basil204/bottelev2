import { listProducts, getProduct } from '../controllers/productController.js';
import { takeOneAvailable, markSold, syncStock } from '../controllers/accountController.js';
import { updateBalance, getUserByTelegram } from '../controllers/userController.js';
import { createOrder, getOrderById } from '../controllers/orderController.js';
import { formatCurrency, buildPaginationKeyboard, createCallbackData } from '../../utils/index.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { notifyAdminAboutNewManualOrder } from './handleNotify.js';

// Map để lưu state user đang nhập thông tin cho manual order
// Key: telegram_id, Value: { productId, step: 'email' | 'note' }
const manualOrderState = new Map();

export const sendProductList = async (bot, chatId, page, pageSize) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await listProducts(offset, pageSize);
  if (!rows.length) return bot.sendMessage(chatId, 'Chưa có sản phẩm.');
  const inline_keyboard = rows.map((p) => [
    {
      text: `${p.name} - ${formatCurrency(p.price)} (còn ${p.stock})`,
      callback_data: createCallbackData({ action: 'buy_product', productId: p.id })
    }
  ]);
  const hasPrev = page > 1;
  const hasNext = offset + rows.length < total;
  inline_keyboard.push(...buildPaginationKeyboard({ action: 'products', page }, page, hasPrev, hasNext));
  await bot.sendMessage(chatId, 'Chọn sản phẩm:', { reply_markup: { inline_keyboard } });
};

export const handlePurchase = async (bot, msg, productId, fromUser) => {
  const user = await getUserByTelegram(fromUser.id);
  if (!user) return bot.sendMessage(msg.chat.id, 'Vui lòng /start để tạo tài khoản.');
  const product = await getProduct(productId);
  if (!product) return bot.sendMessage(msg.chat.id, 'Sản phẩm không tồn tại.');
  if (Number(user.balance) < Number(product.price)) return bot.sendMessage(msg.chat.id, 'Số dư không đủ.');

  // Kiểm tra có account available không để quyết định manual hay auto order
  // Nếu có account → auto order (tự động giao)
  // Nếu không có account → manual order (yêu cầu nhập email/note)
  const account = await takeOneAvailable(product.id);
  const isManualOrder = !account;
  
  if (isManualOrder) {
    // Sản phẩm không có kho: yêu cầu nhập email và note (order manual)
    // Kiểm tra số dư trước
    await updateBalance(user.id, -product.price);
    await addBalanceLog({
      userId: user.id,
      amount: -product.price,
      reason: `buy_product_manual_${product.id}`,
      adminId: null
    });
    
    // Lưu state để bắt đầu flow nhập thông tin
    manualOrderState.set(fromUser.id, { productId, step: 'email' });
    
    const updatedUser = await getUserByTelegram(fromUser.id);
    const finalBalance = Number(updatedUser.balance);
    
    await bot.sendMessage(
      msg.chat.id,
      `📝 **Sản phẩm yêu cầu thông tin**\n\n` +
      `🎁 Sản phẩm: ${product.name}\n` +
      `💰 Giá: ${formatCurrency(product.price)}\n` +
      `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n` +
      `Vui lòng nhập **email** cần nâng cấp:`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Sản phẩm có kho: xử lý như bình thường (auto - giao ngay)

  await updateBalance(user.id, -product.price);
  await addBalanceLog({
    userId: user.id,
    amount: -product.price,
    reason: `buy_product_auto_${product.id}`,
    adminId: null
  });
  await markSold(account.id);
  await syncStock(product.id);
  await createOrder({ userId: user.id, productId: product.id, price: product.price, status: 'completed' });

  // Lấy lại user để có số dư chính xác
  const updatedUser = await getUserByTelegram(fromUser.id);
  const finalBalance = Number(updatedUser.balance);

  const content = `✅ **Mua thành công!**\n\n` +
                 `🎁 Sản phẩm: ${product.name}\n` +
                 `💰 Giá: ${formatCurrency(product.price)}\n` +
                 `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n` +
                 `📧 Tài khoản: \`${account.username}\` | \`${account.password}\``;
  await bot.sendMessage(msg.chat.id, content, { parse_mode: 'Markdown' });
};

// Xử lý input email/note cho manual order
export const handleManualOrderInput = async (bot, msg, userId, adminIds = []) => {
  const state = manualOrderState.get(userId);
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
    manualOrderState.set(userId, state);
    
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
      manualOrderState.delete(userId);
      return bot.sendMessage(msg.chat.id, '❌ Sản phẩm không tồn tại.');
    }
    
    const user = await getUserByTelegram(userId);
    if (!user) {
      manualOrderState.delete(userId);
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy user.');
    }
    
    // Tạo order với status pending
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
    manualOrderState.delete(userId);
    
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

