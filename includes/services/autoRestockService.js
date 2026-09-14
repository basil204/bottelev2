import { query } from '../database/index.js';
import { formatCurrency } from '../../utils/index.js';
import { t } from '../helpers/langHelper.js';

let schedulerInterval = null;
let isRunning = false;

/**
 * Kiểm tra xem thời điểm hiện tại có nằm trong khung giờ im lặng (Quiet Hours) hay không
 * Hỗ trợ cả trường hợp vắt qua nửa đêm (vd: 23:00 -> 07:30)
 */
export const isQuietTime = (quietStart, quietEnd) => {
  if (!quietStart || !quietEnd) return false;
  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = quietStart.split(':').map(Number);
    const [endH, endM] = quietEnd.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return false;

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (startTotal <= endTotal) {
      return currentMinutes >= startTotal && currentMinutes < endTotal;
    } else {
      // Vắt qua nửa đêm, vd: 23:00 (1380) đến 07:30 (450)
      return currentMinutes >= startTotal || currentMinutes < endTotal;
    }
  } catch (e) {
    console.error('[AUTO_RESTOCK] Lỗi kiểm tra giờ im lặng:', e);
    return false;
  }
};

/**
 * Thực thi phát sóng thông báo nhập kho ảo (Auto Restock)
 */
export const executeAutoRestock = async (bot, customParams = null) => {
  try {
    // 1. Lấy cấu hình từ bảng settings
    const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'auto_restock_%' OR `key` = 'bot_username'");
    const settingsMap = {};
    if (rows && Array.isArray(rows)) {
      rows.forEach((r) => { settingsMap[r.key] = r.value; });
    }

    const isActive = customParams?.isActive !== undefined ? customParams.isActive : (settingsMap.auto_restock_active === '1');
    if (!isActive && !customParams?.force) {
      return { success: false, reason: 'disabled' };
    }

    const quietStart = settingsMap.auto_restock_quiet_start || '23:00';
    const quietEnd = settingsMap.auto_restock_quiet_end || '07:30';

    if (!customParams?.force && isQuietTime(quietStart, quietEnd)) {
      console.log(`[AUTO_RESTOCK] 🌙 Đang trong khung giờ im lặng (${quietStart} - ${quietEnd}), tạm bỏ qua lượt phát sóng.`);
      return { success: false, reason: 'quiet_hours' };
    }

    const targetType = customParams?.targetType || settingsMap.auto_restock_target || 'channel';
    const channelId = (customParams?.channelId !== undefined ? customParams.channelId : (settingsMap.auto_restock_channel_id || '')).trim();
    const channelLang = customParams?.channelLang || settingsMap.auto_restock_lang || 'vi';
    const fakeRule = customParams?.fakeRule || settingsMap.auto_restock_rule || 'random';
    const specificProdId = customParams?.productId || settingsMap.auto_restock_product_id || '0';
    const customImage = (customParams?.customImage !== undefined ? customParams.customImage : (settingsMap.auto_restock_custom_image || '')).trim();
    const useProductImage = customParams?.useProductImage !== undefined ? customParams.useProductImage : (settingsMap.auto_restock_use_product_image === '1');
    const minQty = Number(customParams?.minQty || settingsMap.auto_restock_min_qty) || 15;
    const maxQty = Number(customParams?.maxQty || settingsMap.auto_restock_max_qty) || 50;

    // 2. Chọn sản phẩm theo quy tắc (random, min_stock hoặc specific)
    let product = null;
    if (fakeRule === 'specific' && specificProdId && specificProdId !== '0') {
      const prods = await query("SELECT * FROM products WHERE id = ?", [specificProdId]);
      if (prods && prods.length > 0) product = prods[0];
    }

    if (!product) {
      let prodQuery = "SELECT * FROM products WHERE is_active = 1";
      if (fakeRule === 'min_stock') {
        prodQuery += " ORDER BY stock ASC, RAND() LIMIT 1";
      } else {
        prodQuery += " ORDER BY RAND() LIMIT 1";
      }

      const prods = await query(prodQuery);
      if (!prods || prods.length === 0) {
        console.log('[AUTO_RESTOCK] ⚠️ Không có sản phẩm nào đang kích hoạt (is_active = 1)');
        return { success: false, reason: 'no_products' };
      }
      product = prods[0];
    }

    // 3. Tính số lượng ảo ngẫu nhiên
    const safeMin = Math.min(minQty, maxQty);
    const safeMax = Math.max(minQty, maxQty);
    const randQty = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;

    // 4. Lấy bot username để tạo deep-link
    let botUsername = settingsMap.bot_username || '';
    if (!botUsername && bot?.getMe) {
      try {
        const me = await bot.getMe();
        botUsername = me.username || '';
      } catch (e) {
        console.error('[AUTO_RESTOCK] Lỗi lấy getMe:', e.message);
      }
    }

    const buyUrl = botUsername ? `https://t.me/${botUsername}?start=buy_${product.id}` : undefined;

    // 5. Soạn tin nhắn từ hệ thống mẫu tin đa ngôn ngữ cấu hình
    const { getBotTemplate, renderBotTemplate } = await import('../helpers/templateHelper.js');
    const { markdownToTelegramHtml } = await import('../helpers/telegramFormatHelper.js');
    const formattedPrice = formatCurrency(Number(product.price) || 0);

    let rawTemplate = await getBotTemplate('template_restock_notify', channelLang);
    if (!rawTemplate) rawTemplate = t('template_restock_notify', channelLang) || t('auto_restock_notify', channelLang);

    const textMsg = markdownToTelegramHtml(renderBotTemplate(rawTemplate, {
      name: product.name || '',
      quantity: String(randQty),
      stock: String(product.stock || randQty),
      price: formattedPrice,
      shop_name: settingsMap.shop_name || 'SHOP'
    }));

    let buttonText = await getBotTemplate('btn_view_and_buy', channelLang);
    if (!buttonText) buttonText = t('btn_view_and_buy', channelLang) || t('btn_buy_now_direct', channelLang) || '🛍️ Xem & Mua ngay';

    const replyMarkup = buyUrl ? {
      inline_keyboard: [
        [
          { text: buttonText, url: buyUrl }
        ]
      ]
    } : undefined;

    let imageUrlToUse = customImage;
    if (!imageUrlToUse && useProductImage && product.image_url && String(product.image_url).trim().startsWith('http')) {
      imageUrlToUse = product.image_url.trim();
    }

    const sendBotMsg = async (targetId) => {
      const opts = {
        parse_mode: 'HTML',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {})
      };
      if (imageUrlToUse) {
        return bot.sendPhoto(targetId, imageUrlToUse, { caption: textMsg, ...opts });
      }
      return bot.sendMessage(targetId, textMsg, opts);
    };

    let channelSuccess = false;
    let userSuccessCount = 0;
    let totalUsersCount = 0;

    // 6. Gửi tới Channel nếu có
    if (channelId && (targetType === 'channel' || targetType === 'both')) {
      try {
        await sendBotMsg(channelId);
        channelSuccess = true;
        console.log(`[AUTO_RESTOCK] 📢 Đã gửi thông báo tới kênh Telegram: ${channelId}`);
      } catch (chanErr) {
        console.error(`[AUTO_RESTOCK] ❌ Lỗi gửi tới kênh ${channelId}:`, chanErr.message);
      }
    }

    // 7. Gửi tới Users nếu targetType là 'users' hoặc 'both' hoặc channelId để trống
    if (!channelId || targetType === 'users' || targetType === 'both') {
      const users = await query("SELECT DISTINCT telegram_id FROM users WHERE telegram_id IS NOT NULL AND telegram_id != ''");
      if (users && Array.isArray(users)) {
        totalUsersCount = users.length;
        for (const u of users) {
          try {
            await sendBotMsg(u.telegram_id);
            userSuccessCount++;
            await new Promise((r) => setTimeout(r, 40));
          } catch (uErr) {
            // Bỏ qua lỗi từng user
          }
        }
        console.log(`[AUTO_RESTOCK] 👥 Đã gửi thông báo tới ${userSuccessCount}/${totalUsersCount} người dùng CSDL`);
      }
    }

    // 8. Cập nhật mốc thời gian chạy gần nhất vào database
    const now = new Date();
    const nowStr = `${now.toLocaleTimeString('vi-VN')} ${now.toLocaleDateString('vi-VN')}`;
    const nowTs = String(Date.now());

    await query(
      "INSERT INTO settings (`key`, `value`) VALUES ('auto_restock_last_run', ?) ON DUPLICATE KEY UPDATE `value` = ?",
      [nowStr, nowStr]
    );
    await query(
      "INSERT INTO settings (`key`, `value`) VALUES ('auto_restock_last_run_timestamp', ?) ON DUPLICATE KEY UPDATE `value` = ?",
      [nowTs, nowTs]
    );

    console.log(`[AUTO_RESTOCK] ✅ Hoàn tất chu kỳ thông báo kho ảo ("${product.name}" +${randQty} item). Lần chạy: ${nowStr}`);

    return {
      success: true,
      productName: product.name,
      randQty,
      channelSuccess,
      userSuccessCount,
      totalUsersCount,
      lastRun: nowStr
    };
  } catch (error) {
    console.error('[AUTO_RESTOCK] ❌ Lỗi trong quá trình thực thi Auto Restock:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Khởi động bộ định thời hẹn giờ kiểm tra tự động phát sóng kho ảo
 * Quét mỗi phút 1 lần để đảm bảo chuẩn xác theo chu kỳ cấu hình (mỗi X giờ)
 */
export const startAutoRestockScheduler = (bot) => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  console.log('🚀 [AUTO_RESTOCK] Khởi động dịch vụ Hẹn giờ thông báo kho ảo (Auto Restock Scheduler)...');

  const checkTick = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'auto_restock_%'");
      const settingsMap = {};
      if (rows && Array.isArray(rows)) {
        rows.forEach((r) => { settingsMap[r.key] = r.value; });
      }

      const isActive = settingsMap.auto_restock_active === '1';
      if (!isActive) {
        isRunning = false;
        return;
      }

      const intervalHours = Number(settingsMap.auto_restock_interval) || 4;
      const intervalMs = intervalHours * 60 * 60 * 1000;
      const lastRunTs = Number(settingsMap.auto_restock_last_run_timestamp) || 0;
      const now = Date.now();

      // Kiểm tra xem đã đến thời điểm phát sóng tiếp theo chưa
      if (lastRunTs > 0 && (now - lastRunTs) < intervalMs) {
        isRunning = false;
        return;
      }

      // Đã đủ chu kỳ -> Thực thi
      await executeAutoRestock(bot);
    } catch (err) {
      console.error('[AUTO_RESTOCK] Lỗi trong Scheduler tick:', err.message);
    } finally {
      isRunning = false;
    }
  };

  // Quét mỗi 60 giây
  schedulerInterval = setInterval(checkTick, 60 * 1000);

  // Chạy kiểm tra khởi động ban đầu sau 10 giây
  setTimeout(checkTick, 10 * 1000);
};

export const stopAutoRestockScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[AUTO_RESTOCK] Đã dừng dịch vụ Auto Restock Scheduler.');
  }
};
