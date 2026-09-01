import { getCache, setCache, delCache } from '../../lib/cache/index.js';
import { createCallbackData, formatCurrency } from '../../utils/index.js';
import { query } from '../database/index.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { getCanvaSettings, addCanvaTask, pickAvailableCanvaTeam } from '../services/canvaQueueService.js';

const stateKey = (telegramId) => `canva_flow_${telegramId}`;
const ttl = 10 * 60 * 1000;

/**
 * 1. Hiển thị Menu Dịch vụ Tự Động Mời Canva Pro
 */
export const showCanvaMenu = async (bot, chatId, telegramId) => {
  try {
    const settings = await getCanvaSettings();

    if (!settings.enabled) {
      return bot.sendMessage(
        chatId,
        '⚠️ **Dịch vụ Tự động mời Canva Pro hiện đang tạm bảo trì.**\nVui lòng quay lại sau ít phút!',
        { parse_mode: 'Markdown' }
      );
    }

    // Đếm số lượng đội khả dụng & số slot còn trống
    const teamStats = await query(`
      SELECT 
        COUNT(*) as total_teams,
        COALESCE(SUM(CASE WHEN current_members < member_limit AND status = 'active' THEN (member_limit - current_members) ELSE 0 END), 0) as slots_available,
        COALESCE(SUM(CASE WHEN current_members < member_limit AND status = 'active' THEN 1 ELSE 0 END), 0) as teams_available
      FROM canva_teams
    `);
    const slotsAvailable = Number(teamStats[0]?.slots_available || 0);
    const teamsAvailable = Number(teamStats[0]?.teams_available || 0);

    // Đếm số lượng đang chờ trong hàng
    const queueRows = await query("SELECT COUNT(*) as pending_cnt FROM canva_tasks WHERE status = 'pending'");
    const pendingCount = queueRows[0]?.pending_cnt || 0;

    // Đếm số lượng đã hoàn thành
    const successRows = await query("SELECT COUNT(*) as success_cnt FROM canva_tasks WHERE status = 'completed'");
    const successCount = successRows[0]?.success_cnt || 0;

    let message = settings.msg_menu || 
      `🎨 **TỰ ĐỘNG MỜI CANVA PRO / ĐỘI NHÓM**\n\n` +
      `💎 **BẢNG GIÁ DỊCH VỤ:**\n` +
      `• 🎨 **Thiết kế thương hiệu (Brand Designer):** \`{price_designer}\`\n` +
      `• 👥 **Thành viên đội (Team Member):** \`{price_member}\`\n\n` +
      `👥 **Đội khả dụng:** \`{teams_available}\` đội\n` +
      `📊 **Còn trống:** \`{slots_available}\` slots\n` +
      `⏳ **Hàng chờ hiện tại:** \`{pending_count}\` yêu cầu\n` +
      `🎉 **Đã hoàn tất:** \`{success_count}\` lượt\n\n` +
      `👉 Bấm **⚡ BẮT ĐẦU MỜI CANVA PRO** bên dưới để chọn gói vai trò và nhập Email Canva của bạn!`;

    const emojiTag = settings.customEmojiId ? `<tg-emoji emoji-id="${settings.customEmojiId}">🎨</tg-emoji>` : '🎨';

    message = message
      .split('{emoji}').join(emojiTag)
      .split('{emoji_id}').join(settings.customEmojiId || '')
      .split('{price}').join(formatCurrency(settings.priceMember))
      .split('{price_designer}').join(formatCurrency(settings.priceDesigner))
      .split('{price_member}').join(formatCurrency(settings.priceMember))
      .split('{slots_available}').join(String(slotsAvailable))
      .split('{teams_available}').join(String(teamsAvailable))
      .split('{pending_count}').join(String(pendingCount))
      .split('{success_count}').join(String(successCount));

    const startBtn = {
      text: '⚡ BẮT ĐẦU MỜI CANVA PRO',
      callback_data: createCallbackData({ action: 'canva_start' })
    };
    if (settings.customEmojiId) {
      startBtn.icon_custom_emoji_id = settings.customEmojiId;
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
    console.error('[CANVA_MENU_ERROR]', err);
    return bot.sendMessage(chatId, '❌ Lỗi hệ thống khi tải menu Canva Pro.');
  }
};

/**
 * 2. Bước 1: Cho người dùng chọn Gói vai trò (Thiết kế thương hiệu hoặc Thành viên đội)
 */
export const startCanvaFlow = async (bot, chatId, telegramId) => {
  try {
    const settings = await getCanvaSettings();
    if (!settings.enabled) {
      return bot.sendMessage(chatId, '⚠️ Dịch vụ Canva Pro hiện đang tạm bảo trì.');
    }

    // Kiểm tra còn slot không
    const availableTeam = await pickAvailableCanvaTeam();
    if (!availableTeam) {
      return bot.sendMessage(
        chatId,
        '⚠️ **Tất cả các đội Canva Pro hiện đã đủ thành viên!**\nAdmin đang cập nhật thêm đội mới, vui lòng quay lại sau ít phút.',
        { parse_mode: 'Markdown' }
      );
    }

    const selectRoleMsg = 
      `🎨 **VUI LÒNG CHỌN GÓI VAI TRÒ CANVA PRO:**\n\n` +
      `1️⃣ 🎨 **Nhà thiết kế thương hiệu (Brand Designer)**\n` +
      `💰 Đơn giá: \`${formatCurrency(settings.priceDesigner)}\`\n` +
      `✨ *Đầy đủ quyền thiết kế, tải mẫu thương hiệu & mọi tính năng Pro.*\n\n` +
      `2️⃣ 👥 **Thành viên đội (Team Member)**\n` +
      `💰 Đơn giá: \`${formatCurrency(settings.priceMember)}\`\n` +
      `✨ *Sử dụng tính năng thiết kế Pro trong nhóm.*\n\n` +
      `👉 Bấm chọn gói vai trò bạn muốn nhận bên dưới:`;

    const inlineKeyboard = [
      [
        {
          text: `🎨 Thiết kế thương hiệu - ${formatCurrency(settings.priceDesigner)}`,
          callback_data: createCallbackData({ action: 'canva_role', role: 'designer' })
        }
      ],
      [
        {
          text: `👥 Thành viên đội - ${formatCurrency(settings.priceMember)}`,
          callback_data: createCallbackData({ action: 'canva_role', role: 'member' })
        }
      ],
      [
        {
          text: '↩️ Quay lại Menu Canva',
          callback_data: createCallbackData({ action: 'canva_info' })
        }
      ]
    ];

    await bot.sendMessage(chatId, selectRoleMsg, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  } catch (err) {
    console.error('[CANVA_START_FLOW_ERR]', err);
    await bot.sendMessage(chatId, '❌ Lỗi khi khởi động chọn gói Canva Pro.');
  }
};

/**
 * 3. Bước 2: Sau khi chọn gói vai trò -> Lưu state và yêu cầu nhập Email
 */
export const handleCanvaRoleSelect = async (bot, chatId, telegramId, selectedRole = 'designer', messageId = null) => {
  try {
    const settings = await getCanvaSettings();
    const role = selectedRole === 'member' ? 'member' : 'designer';
    const price = role === 'designer' ? settings.priceDesigner : settings.priceMember;
    const roleTitle = role === 'designer' ? '🎨 Nhà thiết kế thương hiệu (Designer)' : '👥 Thành viên đội (Member)';

    // Lưu state người dùng đang chờ nhập email
    setCache(stateKey(telegramId), {
      step: 'waiting_email',
      role,
      price,
      roleTitle
    }, ttl);

    let msgText = settings.msg_prompt || 
      `📝 **VUI LÒNG NHẬP EMAIL CỦA BẠN ĐỂ NHẬN LỜI MỜI CANVA PRO**\n\n` +
      `📦 **Gói đã chọn:** {role_title}\n` +
      `💰 **Đơn giá:** \`{price}\` (Trừ thẳng vào số dư Bot)\n\n` +
      `👉 Vui lòng gửi địa chỉ Email tài khoản Canva của bạn vào khung chat bên dưới:\n` +
      `*(Ví dụ: \`example@gmail.com\`)*\n\n` +
      `Gõ /cancel hoặc nút **❌ Huỷ** để dừng thao tác.`;

    msgText = msgText
      .split('{role_title}').join(roleTitle)
      .split('{role}').join(role)
      .split('{price}').join(formatCurrency(price));

    await bot.sendMessage(chatId, msgText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Huỷ thao tác', callback_data: createCallbackData({ action: 'canva_info' }) }]
        ]
      }
    });
  } catch (err) {
    console.error('[CANVA_ROLE_SELECT_ERR]', err);
    await bot.sendMessage(chatId, '❌ Lỗi khi chọn gói vai trò Canva.');
  }
};

/**
 * 4. Bước 3: Xử lý Input Email từ Telegram Bot và thanh toán theo gói đã chọn
 */
export const handleCanvaEmailInput = async (bot, msg, config) => {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const state = getCache(stateKey(telegramId));

  if (!state || state.step !== 'waiting_email') return false;

  const text = String(msg.text || '').trim();

  // Kiểm tra lệnh hủy
  if (text.toLowerCase() === '/cancel' || text === '❌ Hủy' || text === '❌ Huỷ' || text === '❌ Cancel') {
    delCache(stateKey(telegramId));
    await bot.sendMessage(chatId, '❌ Đã hủy thao tác mời Canva Pro.');
    return true;
  }

  // Validate định dạng email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(text)) {
    await bot.sendMessage(
      chatId,
      '❌ **Địa chỉ Email không hợp lệ!**\nVui lòng nhập đúng định dạng (Ví dụ: `example@gmail.com`):',
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  const targetEmail = text.toLowerCase();
  const chosenRole = state.role || 'designer';
  const chosenPrice = state.price !== undefined ? Number(state.price) : 20000;
  const chosenRoleTitle = state.roleTitle || (chosenRole === 'designer' ? '🎨 Nhà thiết kế thương hiệu' : '👥 Thành viên đội');

  delCache(stateKey(telegramId));

  try {
    const settings = await getCanvaSettings();
    const price = chosenPrice;

    // 1. Kiểm tra số dư người dùng
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
        `📦 Gói vai trò: **${chosenRoleTitle}**\n` +
        `💰 Đơn giá dịch vụ: \`${formatCurrency(price)}\`\n` +
        `💳 Số dư hiện tại: \`${formatCurrency(currentBalance)}\`\n\n` +
        `👉 Vui lòng nạp thêm tiền vào Bot để thực hiện giao dịch.`,
        { parse_mode: 'Markdown' }
      );
      return true;
    }

    // 2. Trừ tiền nếu đơn giá > 0
    let newBalance = currentBalance;
    if (price > 0) {
      newBalance = currentBalance - price;
      await query("UPDATE users SET balance = balance - ? WHERE id = ?", [price, userId]);
      try {
        await addBalanceLog({
          userId,
          amount: -price,
          reason: `buy_canva_pro_${targetEmail}_${chosenRole}`
        });
      } catch (_) {}
    }

    // 3. Gửi tin nhắn tiếp nhận và đưa vào hàng chờ
    const initialMsg = await bot.sendMessage(
      chatId,
      `⏳ **ĐÃ TIẾP NHẬN YÊU CẦU MỜI CANVA PRO!**\n\n` +
      `📧 **Email:** \`${targetEmail}\`\n` +
      `🎭 **Gói:** **${chosenRoleTitle}**\n` +
      `💰 **Đã thanh toán:** \`${formatCurrency(price)}\`\n` +
      `💳 **Số dư còn lại:** \`${formatCurrency(newBalance)}\`\n\n` +
      `🔄 Đang đưa vào hàng chờ xử lý mời tự động...`,
      { parse_mode: 'Markdown' }
    );

    // 4. Thêm task vào hàng chờ CSDL
    const { taskId, queuePos } = await addCanvaTask({
      userId,
      telegramId,
      email: targetEmail,
      role: chosenRole,
      price,
      messageId: initialMsg.message_id
    });

    // Cập nhật lại tin nhắn hiển thị số thứ tự hàng chờ
    let processingMsg = settings.msg_processing || 
      `⏳ **ĐANG XỬ LÝ MỜI CANVA PRO...**\n\n` +
      `🆔 **Mã đơn:** \`#{task_id}\`\n` +
      `📧 **Email:** \`{email}\`\n` +
      `🎭 **Vai trò:** \`{role_title}\`\n` +
      `📊 **Vị trí hàng chờ:** Số \`{queue_pos}\`\n` +
      `💰 **Đã trừ:** \`{price}\`\n\n` +
      `🛡️ *Hệ thống đang tự động thao tác gửi lời mời qua Canva Team API. Vui lòng đợi trong giây lát...*`;

    processingMsg = processingMsg
      .split('{task_id}').join(String(taskId))
      .split('{email}').join(targetEmail)
      .split('{role_title}').join(chosenRoleTitle)
      .split('{role}').join(chosenRole)
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
    console.error('[CANVA_INPUT_ERROR]', error);
    await bot.sendMessage(chatId, `❌ Lỗi khi tiếp nhận yêu cầu: ${error.message}`);
    return true;
  }
};
