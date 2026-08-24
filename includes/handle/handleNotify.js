import { formatCurrency } from '../../utils/index.js';
import { query } from '../database/index.js';

// Helper function to escape Markdown special characters
const escapeMarkdown = (text) => {
  if (!text) return '';
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
};

// Helper function to get admin IDs from database settings
export const getAdminIds = async (configAdminIds = []) => {
  const ids = new Set(
    (Array.isArray(configAdminIds) ? configAdminIds : [configAdminIds])
      .map(Number)
      .filter(Number.isFinite)
  );

  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'admin_ids'");
    if (rows && rows.length > 0 && rows[0].value) {
      let configuredIds;
      try {
        configuredIds = JSON.parse(rows[0].value);
      } catch {
        configuredIds = String(rows[0].value).split(',');
      }
      (Array.isArray(configuredIds) ? configuredIds : [configuredIds])
        .map(Number)
        .filter(Number.isFinite)
        .forEach((id) => ids.add(id));
    }
  } catch (e) {
    console.error('[getAdminIds] Error fetching from DB:', e);
  }

  try {
    const accounts = await query(
      'SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL'
    );
    accounts.map((row) => Number(row.telegram_id)).filter(Number.isFinite).forEach((id) => ids.add(id));
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') {
      console.error('[getAdminIds] Error fetching admin_accounts:', e);
    }
  }

  return [...ids];
};

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

// Kiểm tra lỗi Telegram có phải user đã block/deactivated không
const isUserBlockedError = (err) => {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  const code = err.response?.statusCode || err.response?.status || 0;
  return code === 403 || code === 400 ||
    msg.includes('blocked') || msg.includes('chat not found') ||
    msg.includes('user is deactivated') || msg.includes('forbidden');
};

// Xóa user không còn hoạt động khỏi database
const removeDeadUser = async (telegramId) => {
  try {
    await query('DELETE FROM users WHERE telegram_id = ?', [telegramId]);
    console.log(`[NOTIFY] 🗑️ Đã xóa user ${telegramId} (blocked/deactivated)`);
  } catch (err) {
    console.error(`[NOTIFY] Lỗi xóa user ${telegramId}:`, err.message);
  }
};

// Helper: gửi tin nhắn theo batch song song, tránh rate limit Telegram
// Tự động xóa user nào không gửi được (blocked/deactivated)
const sendBatchMessages = async (bot, users, message, options = {}, batchSize = 25, delayMs = 1000) => {
  let successCount = 0;
  let failCount = 0;
  let removedCount = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(user =>
        bot.sendMessage(user.telegram_id, message, options)
          .then(() => ({ ok: true, blocked: false, telegramId: user.telegram_id }))
          .catch(err => {
            const blocked = isUserBlockedError(err);
            if (!blocked) {
              console.error(`[NOTIFY] Lỗi gửi cho ${user.telegram_id}:`, err.message);
            }
            return { ok: false, blocked, telegramId: user.telegram_id };
          })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.ok) {
          successCount++;
        } else if (result.value.blocked) {
          await removeDeadUser(result.value.telegramId);
          removedCount++;
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }
    }

    // Delay giữa các batch
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { successCount, failCount, removedCount };
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

    const { successCount, failCount, removedCount } = await sendBatchMessages(bot, userRows, message, { parse_mode: 'Markdown' });

    console.log(`[NOTIFY] ✅ Hoàn thành: ${successCount} thành công, ${failCount} thất bại, ${removedCount} user đã xóa`);

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
      `🆔 Mã đơn: #${escapeMarkdown(order.id)}\n` +
      `🎁 Sản phẩm: ${escapeMarkdown(order.product_name)}\n` +
      `👤 User: ${escapeMarkdown(order.username || order.telegram_id)}\n` +
      `📧 Email: ${escapeMarkdown(order.email || 'N/A')}\n` +
      `📝 Note: ${escapeMarkdown(order.note || 'Không có')}\n` +
      `💰 Giá: ${escapeMarkdown(formatCurrency(order.price))}\n` +
      `🕐 ${escapeMarkdown(order.created_at)}\n\n` +
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

    let message = `🛒 MUA HÀNG THÀNH CÔNG\n\n` +
      `🆔 Mã đơn: #${purchaseInfo.orderId || 'N/A'}\n` +
      `🎁 Sản phẩm: ${purchaseInfo.productName || 'N/A'}\n` +
      `👤 User: ${purchaseInfo.username || purchaseInfo.telegramId}\n` +
      `📧 ID: ${purchaseInfo.telegramId}\n` +
      `📦 Số lượng: ${purchaseInfo.quantity}\n` +
      `💰 Giá: ${formatCurrency(purchaseInfo.price)}\n` +
      `💵 Số dư sau mua: ${formatCurrency(purchaseInfo.finalBalance)}`;

    // Nếu có thông tin tài khoản, hiển thị thêm
    if (purchaseInfo.accounts) {
      message += `\n\n📋 CHI TIẾT TÀI KHOẢN:\n`;
      if (Array.isArray(purchaseInfo.accounts)) {
        const accountList = purchaseInfo.accounts.map(acc => {
          const user = acc.username || acc.email || '';
          const pass = acc.password || '';
          const extra = acc.extra_data ? ` | Extra: ${acc.extra_data}` : '';
          const twofa = acc.twofa ? ` | 2FA: ${acc.twofa}` : '';
          return `• ${user} | ${pass}${extra}${twofa}`;
        }).join('\n');
        message += accountList;
      } else if (typeof purchaseInfo.accounts === 'string') {
        // Nếu đã là string format sẵn
        message += purchaseInfo.accounts;
      }
    }

    let successCount = 0;
    let failCount = 0;

    // Gửi thông báo cho từng admin
    for (const adminId of adminIds) {
      try {
        await bot.sendMessage(adminId, message);
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
      `🆔 Mã giao dịch: #${escapeMarkdown(depositInfo.depositId)}\n` +
      `👤 User: ${escapeMarkdown(depositInfo.username || depositInfo.telegramId)}\n` +
      `📧 ID: ${escapeMarkdown(depositInfo.telegramId)}\n` +
      `💵 Số tiền gốc: ${escapeMarkdown(formatCurrency(depositInfo.originalAmount))}`;

    if (depositInfo.bonusAmount > 0) {
      message += `\n🎁 Khuyến mại: +${escapeMarkdown(formatCurrency(depositInfo.bonusAmount))} (${escapeMarkdown(depositInfo.bonusPercentage)}%)`;
    }

    message += `\n💵 Tổng nhận: ${escapeMarkdown(formatCurrency(depositInfo.finalAmount))}` +
      `\n💵 Số dư mới: ${escapeMarkdown(formatCurrency(depositInfo.finalBalance))}`;

    // Thêm mã tham chiếu ngân hàng nếu có
    if (depositInfo.transactionRef) {
      message += `\n📝 Ref: \`${escapeMarkdown(depositInfo.transactionRef)}\``;
    }

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

// Thông báo giao dịch tiền vào chưa được khớp với một yêu cầu nạp thành công.
export const notifyAdminAboutIncomingTransfer = async (bot, adminIds, transaction) => {
  if (!Array.isArray(adminIds) || adminIds.length === 0) return false;

  const message = `💸 CÓ TIỀN CHUYỂN VÀO TÀI KHOẢN\n\n` +
    `🏦 Ngân hàng: ${transaction.bank || 'N/A'}\n` +
    `💰 Số tiền: ${formatCurrency(transaction.amount)}\n` +
    `📝 Nội dung: ${transaction.description || 'Không có nội dung'}\n` +
    `🆔 Mã giao dịch: ${transaction.reference || 'N/A'}\n` +
    `🕐 Thời gian: ${transaction.transDate || new Date().toLocaleString('vi-VN')}\n\n` +
    `⚠️ Giao dịch này chưa được khớp với yêu cầu nạp tiền thành công.`;

  let successCount = 0;
  for (const adminId of adminIds) {
    try {
      await bot.sendMessage(adminId, message);
      successCount += 1;
    } catch (error) {
      console.error(`[NOTIFY_INCOMING_TRANSFER] Admin ${adminId}:`, error.message);
    }
  }
  console.log(`[NOTIFY_INCOMING_TRANSFER] ${successCount}/${adminIds.length} admin đã nhận thông báo`);
  return successCount > 0;
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

// Thông báo cho admin khi đổi credit thành công
export const notifyAdminAboutExchange = async (bot, adminIds, exchangeInfo) => {
  try {
    if (!adminIds || !Array.isArray(adminIds) || adminIds.length === 0) {
      console.log('[NOTIFY_ADMIN] Không có admin IDs');
      return;
    }

    const message = `💎 **ĐỔI CREDIT THÀNH CÔNG**\n\n` +
      `🎁 Sản phẩm: ${escapeMarkdown(exchangeInfo.productName)}\n` +
      `👤 User: ${escapeMarkdown(exchangeInfo.username || exchangeInfo.telegramId)}\n` +
      `📧 ID: ${escapeMarkdown(exchangeInfo.telegramId)}\n` +
      `💎 Số Credit trừ: ${escapeMarkdown(exchangeInfo.cost)}\n` +
      `💰 Credit còn lại: ${escapeMarkdown(exchangeInfo.remainingCredit)}`;

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

    console.log(`[NOTIFY_ADMIN_EXCHANGE] ✅ Hoàn thành: ${successCount} thành công, ${failCount} thất bại`);

  } catch (error) {
    console.error('[NOTIFY_ADMIN_EXCHANGE] ❌ Lỗi khi thông báo cho admin:', error);
  }
};

// Broadcast thông báo tới tất cả người dùng hệ thống
export const broadcastToAllUsers = async (bot, messageText, imageUrl = null) => {
  try {
    const userRows = await query('SELECT DISTINCT telegram_id FROM users WHERE telegram_id IS NOT NULL AND telegram_id != 0');
    if (!userRows || userRows.length === 0) {
      return { successCount: 0, failCount: 0, removedCount: 0, totalUsers: 0 };
    }

    console.log(`[BROADCAST] Đang gửi thông báo tới ${userRows.length} người dùng...`);

    let successCount = 0;
    let failCount = 0;
    let removedCount = 0;
    const batchSize = 25;

    for (let i = 0; i < userRows.length; i += batchSize) {
      const batch = userRows.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(user => {
          if (imageUrl && String(imageUrl).trim().startsWith('http')) {
            return bot.sendPhoto(user.telegram_id, imageUrl.trim(), { caption: messageText, parse_mode: 'Markdown' })
              .then(() => ({ ok: true, blocked: false, telegramId: user.telegram_id }))
              .catch(err => {
                const blocked = isUserBlockedError(err);
                return { ok: false, blocked, telegramId: user.telegram_id };
              });
          } else {
            return bot.sendMessage(user.telegram_id, messageText, { parse_mode: 'Markdown' })
              .then(() => ({ ok: true, blocked: false, telegramId: user.telegram_id }))
              .catch(err => {
                const blocked = isUserBlockedError(err);
                return { ok: false, blocked, telegramId: user.telegram_id };
              });
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.ok) successCount++;
          else if (result.value.blocked) {
            await removeDeadUser(result.value.telegramId);
            removedCount++;
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      }

      if (i + batchSize < userRows.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return { successCount, failCount, removedCount, totalUsers: userRows.length };
  } catch (error) {
    console.error('[BROADCAST_ERR]', error);
    return { successCount: 0, failCount: 0, error: error.message };
  }
};
