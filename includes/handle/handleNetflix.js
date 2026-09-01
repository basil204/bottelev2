import { getCache, setCache, delCache } from '../../lib/cache/index.js';
import { createCallbackData, formatCurrency } from '../../utils/index.js';
import { query } from '../database/index.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { getNetflixSettings, addNetflixTask } from '../services/netflixQueueService.js';

const stateKey = (telegramId) => `netflix_flow_${telegramId}`;
const ttl = 10 * 60 * 1000;

/**
 * 1. Hiển thị Menu Dịch vụ Nhận Netflix 30 Ngày
 */
export const showNetflixMenu = async (bot, chatId, telegramId) => {
  try {
    const settings = await getNetflixSettings();

    if (!settings.enabled) {
      return bot.sendMessage(
        chatId,
        '⚠️ **Dịch vụ Tự động nhận Netflix 30 ngày hiện đang tạm bảo trì.**\nVui lòng quay lại sau ít phút!',
        { parse_mode: 'Markdown' }
      );
    }

    // Đếm số lượng đang chờ trong hàng
    const queueRows = await query("SELECT COUNT(*) as pending_cnt FROM netflix_tasks WHERE status = 'pending'");
    const pendingCount = queueRows[0]?.pending_cnt || 0;

    // Đếm số lượng đã hoàn thành
    const successRows = await query("SELECT COUNT(*) as success_cnt FROM netflix_tasks WHERE status = 'completed'");
    const successCount = successRows[0]?.success_cnt || 0;

    let message = settings.msg_menu || 
      `🎬 **TỰ ĐỘNG NHẬN NETFLIX 30 NGÀY (GET 30 DAYS)**\n\n` +
      `💰 **Đơn giá:** \`{price}\` / 1 Email\n` +
      `🛡 **Cơ chế an toàn:** Tích hợp Proxy sạch & Cookie chống checkpoint\n` +
      `⚡ **Trạng thái:** Hoạt động ổn định\n` +
      `⏳ **Hàng chờ hiện tại:** \`{pending_count}\` yêu cầu đang chờ\n` +
      `🎉 **Đã hoàn tất:** \`{success_count}\` lượt thành công\n\n` +
      `👉 Bấm **⚡ BẮT ĐẦU NHẬN NETFLIX** bên dưới rồi nhập địa chỉ Email của bạn. Hệ thống sẽ tự động thao tác từ A - Z!`;

    const emojiTag = settings.custom_emoji_id ? `<tg-emoji emoji-id="${settings.custom_emoji_id}">🎬</tg-emoji>` : '🎬';

    message = message
      .split('{emoji}').join(emojiTag)
      .split('{emoji_id}').join(settings.custom_emoji_id || '')
      .split('{price}').join(formatCurrency(settings.price))
      .split('{pending_count}').join(String(pendingCount))
      .split('{success_count}').join(String(successCount));

    const startBtn = {
      text: '⚡ BẮT ĐẦU NHẬN NETFLIX 30 NGÀY',
      callback_data: createCallbackData({ action: 'netflix_start' })
    };
    if (settings.custom_emoji_id) {
      startBtn.icon_custom_emoji_id = settings.custom_emoji_id;
    }

    return bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [startBtn],
          [{ text: '↩️ Quay lại Menu chính', callback_data: createCallbackData({ action: 'back_to_menu' }) }]
        ]
      }
    });
  } catch (err) {
    console.error('[NETFLIX_MENU_ERROR]', err);
    return bot.sendMessage(chatId, '❌ Lỗi hệ thống khi tải menu Netflix 30 Ngày.');
  }
};

/**
 * 2. Khởi động luồng nhập Email
 */
export const startNetflixFlow = async (bot, chatId, telegramId) => {
  const settings = await getNetflixSettings();
  if (!settings.enabled) {
    return bot.sendMessage(chatId, '⚠️ Dịch vụ Netflix hiện đang tạm bảo trì.');
  }

  setCache(stateKey(telegramId), { step: 'waiting_email' }, ttl);

  let msgText = settings.msg_prompt || 
    `📝 **VUI LÒNG NHẬP EMAIL CỦA BẠN ĐỂ NHẬN NETFLIX 30 NGÀY**\n\n` +
    `💰 **Đơn giá:** \`{price}\` (Trừ thẳng vào số dư Bot)\n\n` +
    `👉 Vui lòng gửi địa chỉ Email hợp lệ vào khung chat bên dưới:\n` +
    `*(Ví dụ: \`example@hotmail.com\` hoặc \`yourname@gmail.com\`)*\n\n` +
    `Gõ /cancel hoặc nút **❌ Huỷ** để dừng thao tác.`;

  msgText = msgText.split('{price}').join(formatCurrency(settings.price));

  await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
};

/**
 * 3. Xử lý Input Email từ Telegram Bot
 */
export const handleNetflixEmailInput = async (bot, msg, config) => {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const state = getCache(stateKey(telegramId));

  if (!state || state.step !== 'waiting_email') return false;

  const text = String(msg.text || '').trim();

  // Kiểm tra lệnh hủy
  if (text.toLowerCase() === '/cancel' || text === '❌ Hủy' || text === '❌ Huỷ' || text === '❌ Cancel') {
    delCache(stateKey(telegramId));
    await bot.sendMessage(chatId, '❌ Đã hủy thao tác nhận Netflix 30 Ngày.');
    return true;
  }

  // Validate định dạng email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(text)) {
    await bot.sendMessage(
      chatId,
      '❌ **Địa chỉ Email không hợp lệ!**\nVui lòng nhập đúng định dạng (Ví dụ: `name@hotmail.com` hoặc `name@gmail.com`):',
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  const targetEmail = text.toLowerCase();
  delCache(stateKey(telegramId));

  try {
    // 1. Kiểm tra cấu hình và đơn giá
    const settings = await getNetflixSettings();
    const price = settings.price || 0;

    // 2. Kiểm tra số dư người dùng
    const userRows = await query("SELECT id, balance FROM users WHERE telegram_id = ?", [telegramId]);
    if (!userRows || userRows.length === 0) {
      await bot.sendMessage(chatId, '❌ Không tìm thấy thông tin tài khoản của bạn.');
      return true;
    }

    const userId = userRows[0].id;
    const currentBalance = Number(userRows[0].balance || 0);

    if (currentBalance < price) {
      await bot.sendMessage(
        chatId,
        `❌ **SỐ DƯ TÀI KHOẢN KHÔNG ĐỦ!**\n\n` +
        `💰 Đơn giá dịch vụ: \`${formatCurrency(price)}\`\n` +
        `💳 Số dư hiện tại: \`${formatCurrency(currentBalance)}\`\n\n` +
        `👉 Vui lòng nạp thêm tiền vào Bot để thực hiện giao dịch.`,
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    // 3. Trừ tiền nếu đơn giá > 0
    let newBalance = currentBalance;
    if (price > 0) {
      newBalance = currentBalance - price;
      await query("UPDATE users SET balance = balance - ? WHERE id = ?", [price, userId]);
      try {
        await addBalanceLog({
          userId,
          amount: -price,
          reason: `buy_netflix_30days_${targetEmail}`
        });
      } catch (_) {}
    }

    // 4. Gửi tin nhắn tiếp nhận và đưa vào hàng chờ
    const initialMsg = await bot.sendMessage(
      chatId,
      `⏳ **ĐÃ TIẾP NHẬN YÊU CẦU NHẬN NETFLIX 30 NGÀY!**\n\n` +
      `📧 **Email:** \`${targetEmail}\`\n` +
      `💰 **Đã thanh toán:** \`${formatCurrency(price)}\`\n` +
      `💳 **Số dư còn lại:** \`${formatCurrency(newBalance)}\`\n\n` +
      `🔄 Đang đưa vào hàng chờ xử lý tự động qua Proxy...`,
      { parse_mode: 'Markdown' }
    );

    // 5. Thêm task vào hàng chờ CSDL
    const { taskId, queuePos } = await addNetflixTask({
      userId,
      telegramId,
      email: targetEmail,
      price,
      messageId: initialMsg.message_id
    });

    // Cập nhật lại tin nhắn hiển thị số thứ tự hàng chờ (từ cài đặt hoặc mặc định)
    let processingMsg = settings.msg_processing || 
      `⏳ **ĐANG XỬ LÝ NHẬN NETFLIX 30 NGÀY...**\n\n` +
      `🆔 **Mã yêu cầu:** \`#{task_id}\`\n` +
      `📧 **Email:** \`{email}\`\n` +
      `📊 **Vị trí hàng chờ:** Số \`{queue_pos}\`\n` +
      `💰 **Đã trừ:** \`{price}\`\n\n` +
      `🛡️ *Hệ thống đang chạy ngầm với Proxy an toàn. Tiến trình sẽ được cập nhật liên tục tại đây...*`;

    processingMsg = processingMsg
      .split('{task_id}').join(String(taskId))
      .split('{email}').join(targetEmail)
      .split('{queue_pos}').join(String(queuePos))
      .split('{price}').join(formatCurrency(price));

    await bot.editMessageText(
      processingMsg,
      {
        chat_id: chatId,
        message_id: initialMsg.message_id,
        parse_mode: 'Markdown'
      }
    ).catch(() => {});

    return true;
  } catch (error) {
    console.error('[NETFLIX_INPUT_ERROR]', error);
    await bot.sendMessage(chatId, `❌ Lỗi khi tiếp nhận yêu cầu: ${error.message}`);
    return true;
  }
};
