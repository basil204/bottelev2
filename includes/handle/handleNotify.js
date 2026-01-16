import { formatCurrency } from '../../utils/index.js';
import { query } from '../database/index.js';

export const notifyNewProduct = async (bot, chatId, product) => {
  await bot.sendMessage(
    chatId,
    `📢 SẢN PHẨM MỚI\nTên: ${product.name}\nGiá: ${formatCurrency(product.price)}`
  );
};

export const notifyUpdateProduct = async (bot, chatId, product) => {
  await bot.sendMessage(
    chatId,
    `✏️ CẬP NHẬT SẢN PHẨM\nTên: ${product.name}\nGiá mới: ${formatCurrency(product.price)}`
  );
};

export const notifyAccounts = async (bot, chatId, product, count) => {
  await bot.sendMessage(
    chatId,
    `📦 HÀNG VỀ\nSản phẩm: ${product.name}\nSố lượng: +${count}`
  );
};

// Thông báo cho tất cả users về sản phẩm có thêm tài khoản mới
export const notifyUsersAboutProductStock = async (bot, productId, accountCount) => {
  try {
    // Lấy thông tin sản phẩm
    const productRows = await query('SELECT * FROM products WHERE id = ?', [productId]);
    if (!productRows || productRows.length === 0) {
      console.log(`[NOTIFY] Không tìm thấy sản phẩm #${productId}`);
      return;
    }
    const product = productRows[0];
    
    // Lấy danh sách users đã mua sản phẩm này (có orders)
    const userRows = await query(
      `SELECT DISTINCT u.telegram_id, u.id 
       FROM users u 
       INNER JOIN orders o ON o.user_id = u.id 
       WHERE o.product_id = ? AND u.telegram_id IS NOT NULL`,
      [productId]
    );
    
    if (!userRows || userRows.length === 0) {
      console.log(`[NOTIFY] Không có user nào đã mua sản phẩm #${productId}`);
      return;
    }
    
    console.log(`[NOTIFY] Đang thông báo cho ${userRows.length} user(s) về sản phẩm #${productId}`);
    
    const message = `📦 **HÀNG VỀ KHO**\n\n` +
                   `🎁 Sản phẩm: ${product.name}\n` +
                   `💰 Giá: ${formatCurrency(product.price)}\n` +
                   `➕ Số lượng mới: +${accountCount} tài khoản\n\n` +
                   `🔔 Sản phẩm đã có hàng, bạn có thể mua ngay!`;
    
    let successCount = 0;
    let failCount = 0;
    
    // Gửi thông báo cho từng user
    for (const userRow of userRows) {
      try {
        await bot.sendMessage(userRow.telegram_id, message, { parse_mode: 'Markdown' });
        successCount++;
        
        // Delay nhỏ để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[NOTIFY] Lỗi khi gửi thông báo cho user ${userRow.telegram_id}:`, error.message);
        failCount++;
        // Nếu user đã block bot hoặc lỗi, bỏ qua và tiếp tục
      }
    }
    
    console.log(`[NOTIFY] ✅ Hoàn thành: ${successCount} thành công, ${failCount} thất bại`);
    
  } catch (error) {
    console.error('[NOTIFY] ❌ Lỗi khi thông báo cho users:', error);
  }
};

// Thông báo cho admin khi có đơn hàng manual mới
export const notifyAdminAboutNewManualOrder = async (bot, adminIds, order) => {
  try {
    if (!adminIds || !Array.isArray(adminIds) || adminIds.length === 0) {
      console.log('[NOTIFY_ADMIN] Không có admin IDs');
      return;
    }
    
    const message = `📝 **ĐƠN HÀNG MỚI CẦN XỬ LÝ**\n\n` +
                   `🆔 Mã đơn: #${order.id}\n` +
                   `🎁 Sản phẩm: ${order.product_name}\n` +
                   `👤 User: ${order.username || order.telegram_id}\n` +
                   `📧 Email: ${order.email || 'N/A'}\n` +
                   `📝 Note: ${order.note || 'Không có'}\n` +
                   `💰 Giá: ${formatCurrency(order.price)}\n` +
                   `🕐 ${order.created_at}\n\n` +
                   `👉 Vào menu Admin → Đơn hàng cần xử lý để xem chi tiết`;
    
    let successCount = 0;
    let failCount = 0;
    
    // Gửi thông báo cho từng admin
    for (const adminId of adminIds) {
      try {
        await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
        successCount++;
        
        // Delay nhỏ để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[NOTIFY_ADMIN] Lỗi khi gửi thông báo cho admin ${adminId}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`[NOTIFY_ADMIN] ✅ Hoàn thành: ${successCount} thành công, ${failCount} thất bại`);
    
  } catch (error) {
    console.error('[NOTIFY_ADMIN] ❌ Lỗi khi thông báo cho admin:', error);
  }
};

// Thông báo cho admin khi mua hàng thành công
export const notifyAdminAboutPurchase = async (bot, adminIds, purchaseInfo) => {
  try {
    if (!adminIds || !Array.isArray(adminIds) || adminIds.length === 0) {
      console.log('[NOTIFY_ADMIN] Không có admin IDs');
      return;
    }
    
    const message = `🛒 **MUA HÀNG THÀNH CÔNG**\n\n` +
                   `🆔 Mã đơn: #${purchaseInfo.orderId || 'N/A'}\n` +
                   `🎁 Sản phẩm: ${purchaseInfo.productName}\n` +
                   `👤 User: ${purchaseInfo.username || purchaseInfo.telegramId}\n` +
                   `📧 ID: ${purchaseInfo.telegramId}\n` +
                   `📦 Số lượng: ${purchaseInfo.quantity}\n` +
                   `💰 Giá: ${formatCurrency(purchaseInfo.price)}\n` +
                   `💵 Số dư sau mua: ${formatCurrency(purchaseInfo.finalBalance)}`;
    
    let successCount = 0;
    let failCount = 0;
    
    // Gửi thông báo cho từng admin
    for (const adminId of adminIds) {
      try {
        await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
        successCount++;
        
        // Delay nhỏ để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[NOTIFY_ADMIN] Lỗi khi gửi thông báo cho admin ${adminId}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`[NOTIFY_ADMIN_PURCHASE] ✅ Hoàn thành: ${successCount} thành công, ${failCount} thất bại`);
    
  } catch (error) {
    console.error('[NOTIFY_ADMIN_PURCHASE] ❌ Lỗi khi thông báo cho admin:', error);
  }
};

// Thông báo cho admin khi nạp tiền thành công
export const notifyAdminAboutDeposit = async (bot, adminIds, depositInfo) => {
  try {
    if (!adminIds || !Array.isArray(adminIds) || adminIds.length === 0) {
      console.log('[NOTIFY_ADMIN] Không có admin IDs');
      return;
    }
    
    let message = `💰 **NẠP TIỀN THÀNH CÔNG**\n\n` +
                  `🆔 Mã giao dịch: #${depositInfo.depositId}\n` +
                  `👤 User: ${depositInfo.username || depositInfo.telegramId}\n` +
                  `📧 ID: ${depositInfo.telegramId}\n` +
                  `💵 Số tiền gốc: ${formatCurrency(depositInfo.originalAmount)}`;
    
    if (depositInfo.bonusAmount > 0) {
      message += `\n🎁 Khuyến mại: +${formatCurrency(depositInfo.bonusAmount)} (${depositInfo.bonusPercentage}%)`;
    }
    
    message += `\n💵 Tổng nhận: ${formatCurrency(depositInfo.finalAmount)}` +
               `\n💵 Số dư mới: ${formatCurrency(depositInfo.finalBalance)}`;
    
    let successCount = 0;
    let failCount = 0;
    
    // Gửi thông báo cho từng admin
    for (const adminId of adminIds) {
      try {
        await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
        successCount++;
        
        // Delay nhỏ để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[NOTIFY_ADMIN] Lỗi khi gửi thông báo cho admin ${adminId}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`[NOTIFY_ADMIN_DEPOSIT] ✅ Hoàn thành: ${successCount} thành công, ${failCount} thất bại`);
    
  } catch (error) {
    console.error('[NOTIFY_ADMIN_DEPOSIT] ❌ Lỗi khi thông báo cho admin:', error);
  }
};

// Thông báo vào nhóm khi có sản phẩm mới được thêm vào kho
export const notifyGroupAboutNewStock = async (bot, notificationChatId, productId, accountCount) => {
  try {
    if (!notificationChatId) {
      console.log('[NOTIFY_GROUP] Không có notification chat ID');
      return;
    }

    // Lấy thông tin sản phẩm
    const productRows = await query('SELECT * FROM products WHERE id = ?', [productId]);
    if (!productRows || productRows.length === 0) {
      console.log(`[NOTIFY_GROUP] Không tìm thấy sản phẩm #${productId}`);
      return;
    }
    const product = productRows[0];
    
    const message = `📦 **HÀNG VỀ KHO**\n\n` +
                   `🎁 Sản phẩm: ${product.name}\n` +
                   `💰 Giá: ${formatCurrency(product.price)}\n` +
                   `➕ Số lượng mới: +${accountCount} tài khoản\n` +
                   `📊 Tồn kho hiện tại: ${product.stock || 0} sản phẩm\n\n` +
                   `🔔 Sản phẩm đã có hàng, các bạn có thể mua ngay!`;
    
    try {
      await bot.sendMessage(notificationChatId, message, { parse_mode: 'Markdown' });
      console.log(`[NOTIFY_GROUP] ✅ Đã gửi thông báo vào nhóm về sản phẩm #${productId}`);
    } catch (error) {
      console.error(`[NOTIFY_GROUP] ❌ Lỗi khi gửi thông báo vào nhóm:`, error.message);
    }
    
  } catch (error) {
    console.error('[NOTIFY_GROUP] ❌ Lỗi khi thông báo vào nhóm:', error);
  }
};
