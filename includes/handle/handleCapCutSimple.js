import { getCache, setCache, delCache } from '../../lib/cache/index.js';
import { createCallbackData, formatCurrency } from '../../utils/index.js';
import { query } from '../database/index.js';
import { loginCapCut } from '../../webapp/lib/joincapcut/capcutteamql/login_getinfo.js';
import { getlinkWithCookie } from '../../webapp/lib/joincapcut/capcutteamql/getlink.js';
import { refresh_invitation_link } from '../../webapp/lib/joincapcut/capcutteamql/doilink.js';
import { joinWorkspace } from '../../webapp/lib/joincapcut/join.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';

const stateKey = (telegramId) => `capcut_flow_${telegramId}`;
const ttl = 15 * 60 * 1000;

/**
 * 1. Hiển thị Menu Mua Nâng Cấp CapCut Pro Chính Chủ cho Khách Hàng
 */
export const showCapCutMenu = async (bot, chatId, telegramId) => {
  try {
    const [priceRows] = await query("SELECT value FROM settings WHERE `key` = 'capcut_upgrade_price'");
    const [enabledRows] = await query("SELECT value FROM settings WHERE `key` = 'capcut_upgrade_enabled'");

    const price = priceRows[0]?.value ? Number(priceRows[0].value) : 50000;
    const isEnabled = enabledRows[0]?.value ? enabledRows[0].value === 'true' : true;

    if (!isEnabled) {
      return bot.sendMessage(chatId, '⚠️ Chức năng Nâng cấp CapCut Pro hiện đang tạm bảo trì. Vui lòng quay lại sau!');
    }

    const [wsRows] = await query(
      "SELECT SUM(member_limit - member_cnt) as available_slots FROM capcut_admin_workspaces WHERE status = 'active'"
    );
    const totalAvailableSlots = Number(wsRows[0]?.available_slots || 0);

    const message = 
      `🎬 **NÂNG CẤP CAPCUT PRO CHÍNH CHỦ**\n\n` +
      `💰 **Giá gói:** \`${formatCurrency(price)}\` / 1 Tài Khoản\n` +
      `⚡ **Slot khả dụng:** \`${totalAvailableSlots}\` slots trống\n` +
      `🛡 **Bảo hành:** Full thời gian sử dụng\n\n` +
      `👉 Bấm **Bắt đầu Nâng Cấp** bên dưới để nhập Email & Mật khẩu tài khoản CapCut của bạn.`;

    return bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚡ BẮT ĐẦU NÂNG CẤP NGAY', callback_data: createCallbackData({ action: 'capcut_buy_start' }) }],
          [{ text: '🛠 Auto Join Free (Admin)', callback_data: createCallbackData({ action: 'capcut_start' }) }]
        ]
      }
    });
  } catch (err) {
    console.error('[CAPCUT_MENU_ERROR]', err);
    return bot.sendMessage(chatId, '❌ Lỗi hệ thống khi tải menu CapCut Pro.');
  }
};

/**
 * 2. Khởi động luồng nhập Email:MậtKhẩu cho khách mua
 */
export const startCapCutBuyFlow = async (bot, chatId, telegramId) => {
  setCache(stateKey(telegramId), { step: 'buy_user_acc', data: {} }, ttl);
  
  const [priceRows] = await query("SELECT value FROM settings WHERE `key` = 'capcut_upgrade_price'");
  const price = priceRows[0]?.value ? Number(priceRows[0].value) : 50000;

  const msgText = 
    `📝 **VUI LÒNG NHẬP THÔNG TIN TÀI KHOẢN CAPCUT CỦA BẠN**\n\n` +
    `💰 **Giá thanh toán:** \`${formatCurrency(price)}\` (Trừ thẳng vào số dư Bot)\n\n` +
    `👉 Vui lòng gửi định dạng:\n` +
    `\`email_capcut@gmail.com|matkhau\`\n` +
    `*(Hoặc \`email_capcut@gmail.com:matkhau\`)*\n\n` +
    `Gõ /cancel để hủy bất cứ lúc nào.`;

  await bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
};

export const startCapCutFlow = async (bot, chatId, telegramId) => {
  return startCapCutBuyFlow(bot, chatId, telegramId);
};

/**
 * 3. Xử lý Mua & Nâng Cấp Tự Động CapCut Pro
 */
const handleUserUpgrade = async (bot, msg, state, text) => {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  // Split input format email|password or email:password
  let parts = text.split('|');
  if (parts.length < 2) parts = text.split(':');
  
  const userEmail = parts[0]?.trim();
  const userPass = parts.slice(1).join(':').trim();

  if (!userEmail || !userPass || !userEmail.includes('@')) {
    return bot.sendMessage(chatId, '❌ Sai định dạng! Vui lòng nhập đúng: `email|matkhau` hoặc `email:matkhau`', { parse_mode: 'Markdown' });
  }

  // 1. Kiểm tra giá tiền & số dư khách hàng
  const [priceRows] = await query("SELECT value FROM settings WHERE `key` = 'capcut_upgrade_price'");
  const price = priceRows[0]?.value ? Number(priceRows[0].value) : 50000;

  const [userRows] = await query("SELECT id, balance FROM users WHERE telegram_id = ?", [telegramId]);
  if (!userRows || userRows.length === 0) {
    delCache(stateKey(telegramId));
    return bot.sendMessage(chatId, '❌ Không tìm thấy thông tin tài khoản Bot của bạn.');
  }

  const currentBalance = Number(userRows[0].balance || 0);
  if (currentBalance < price) {
    delCache(stateKey(telegramId));
    return bot.sendMessage(chatId, 
      `❌ **SỐ DƯ KHÔNG ĐỦ!**\n\n` +
      `💰 Giá nâng cấp: \`${formatCurrency(price)}\` đ\n` +
      `💳 Số dư hiện tại: \`${formatCurrency(currentBalance)}\` đ\n\n` +
      `Vui lòng nạp thêm tiền vào Bot để thực hiện giao dịch.`,
      { parse_mode: 'Markdown' }
    );
  }

  // 2. Tìm Workspace Admin còn chỗ (ngẫu nhiên)
  const currentTs = Math.floor(Date.now() / 1000);
  const [adminWsRows] = await query(
    `SELECT * FROM capcut_admin_workspaces 
     WHERE status = 'active' AND member_cnt < member_limit AND (team_vip_end = 0 OR team_vip_end > ?)
     ORDER BY RAND() LIMIT 1`,
    [currentTs]
  );

  if (!adminWsRows || adminWsRows.length === 0) {
    delCache(stateKey(telegramId));
    return bot.sendMessage(chatId, '❌ Hiện tại hệ thống đang hết slot trống Nâng Cấp CapCut. Vui lòng quay lại sau hoặc liên hệ Admin!');
  }

  const adminWs = adminWsRows[0];
  delCache(stateKey(telegramId));

  const statusMsg = await bot.sendMessage(chatId, '⏳ **ĐANG NÂNG CẤP CAPCUT PRO CHÍNH CHỦ...**\n\n1️⃣ Đang đăng nhập tài khoản CapCut của bạn...', { parse_mode: 'Markdown' });

  try {
    // 3. Đăng nhập tài khoản User CapCut
    const { cookieStr: userCookie, userInfo } = await loginCapCut(userEmail, userPass);
    const userUid = String(userInfo?.user_id_str || userInfo?.user_id || '');

    await bot.editMessageText('⏳ **ĐANG NÂNG CẤP CAPCUT PRO CHÍNH CHỦ...**\n\n2️⃣ Đang lấy Link Mời từ Workspace Admin...', {
      chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown'
    });

    // 4. Lấy Link mời từ Workspace Admin
    const linkRes = await getlinkWithCookie(adminWs.admin_cookie, { workspace_id: adminWs.workspace_id });
    const inviteLink = linkRes?.data?.invitation_link || linkRes?.data?.invite_link || linkRes?.data?.link || '';

    if (!inviteLink) {
      throw new Error('Không thể khởi tạo Link mời từ Workspace Admin.');
    }

    await bot.editMessageText('⏳ **ĐANG NÂNG CẤP CAPCUT PRO CHÍNH CHỦ...**\n\n3️⃣ Đang tự động Join vào Workspace Pro...', {
      chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown'
    });

    // 5. Join User vào Workspace Admin
    const joinRes = await joinWorkspace(userCookie, inviteLink, null);
    const isSuccess = joinRes?.ret === 0 || joinRes?.ret === '0' || joinRes?.errmsg === 'SUCCESS' || (joinRes?.data && joinRes?.data?.workspace_info);

    if (!isSuccess) {
      throw new Error(joinRes?.errmsg || joinRes?.data?.description || 'Tham gia Workspace thất bại');
    }

    await bot.editMessageText('⏳ **ĐANG NÂNG CẤP CAPCUT PRO CHÍNH CHỦ...**\n\n4️⃣ Đã Join thành công! Đang tự động đổi mã Link mới để bảo mật...', {
      chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown'
    });

    // 6. NGAY KHI JOIN THÀNH CÔNG ➔ ĐỔI MÃ LINK MỚI NGAY LẬP TỨC
    await new Promise(r => setTimeout(r, 2000));
    try {
      await refresh_invitation_link(adminWs.admin_cookie, { workspace_id: adminWs.workspace_id });
    } catch (e) {}

    // 7. Trừ tiền & Cập nhật CSDL
    const newBalance = currentBalance - price;
    await query("UPDATE users SET balance = balance - ? WHERE telegram_id = ?", [price, telegramId]);

    // Add Balance Log
    try {
      await addBalanceLog(
        userRows[0].id,
        -price,
        'buy_capcut_upgrade',
        `Nâng cấp CapCut Pro cho tài khoản ${userEmail} (WS: ${adminWs.workspace_id})`,
        currentBalance,
        newBalance
      );
    } catch (e) {}

    // Cập nhật member_cnt Admin Workspace
    const newMemberCnt = adminWs.member_cnt + 1;
    const newStatus = newMemberCnt >= adminWs.member_limit ? 'full' : 'active';
    await query("UPDATE capcut_admin_workspaces SET member_cnt = ?, status = ? WHERE workspace_id = ?", [newMemberCnt, newStatus, adminWs.workspace_id]);

    // Lưu Bảo Hành
    const expiresAtDate = adminWs.team_vip_end > 0 
      ? new Date(adminWs.team_vip_end * 1000) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO capcut_user_warranties 
        (telegram_id, user_capcut_email, user_capcut_uid, workspace_id, admin_email, price_paid, expires_at, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [telegramId, userEmail, userUid, adminWs.workspace_id, adminWs.admin_email, price, expiresAtDate, `Admin: ${adminWs.admin_email} | Workspace: ${adminWs.workspace_name}`]
    );

    // 8. Thông báo thành công cho Khách Hàng
    const successMsg = 
      `🎉 **NÂNG CẤP CAPCUT PRO CHÍNH CHỦ THÀNH CÔNG!**\n\n` +
      `👤 **Email CapCut:** \`${userEmail}\`\n` +
      `🆔 **UID:** \`${userUid || 'N/A'}\`\n` +
      `🏢 **Workspace Joined:** \`${adminWs.workspace_name}\`\n` +
      `💰 **Số tiền trừ:** \`${formatCurrency(price)}\` đ\n` +
      `💳 **Số dư còn lại:** \`${formatCurrency(newBalance)}\` đ\n` +
      `📅 **Hạn VIP / Bảo hành:** \`${expiresAtDate.toLocaleDateString('vi-VN')}\`\n\n` +
      `✨ Mở ứng dụng hoặc web CapCut để kiểm tra quyền Pro ngay bây giờ!`;

    return bot.editMessageText(successMsg, {
      chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown'
    });

  } catch (err) {
    console.error('[CAPCUT_UPGRADE_ERROR]', err);
    return bot.editMessageText(
      `❌ **NÂNG CẤP THẤT BẠI!**\n\n` +
      `Lỗi: \`${err.message}\`\n\n` +
      `⚠️ Tài khoản của bạn KHÔNG bị trừ tiền. Vui lòng kiểm tra lại Email/Mật khẩu CapCut hoặc thử lại sau.`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
    );
  }
};

/**
 * 4. Chuyển tiếp tin nhắn input từ Telegram Bot
 */
export const handleCapCutInput = async (bot, msg, config) => {
  const state = getCache(stateKey(msg.from.id));
  if (!state) return false;
  
  const text = String(msg.text || '').trim();

  if (text.toLowerCase() === '/cancel' || text === '❌ Hủy') {
    delCache(stateKey(msg.from.id));
    await bot.sendMessage(msg.chat.id, 'Đã hủy thao tác CapCut Pro.');
    return true;
  }

  try {
    if (state.step === 'buy_user_acc') {
      await handleUserUpgrade(bot, msg, state, text);
      return true;
    }
  } catch (error) {
    delCache(stateKey(msg.from.id));
    await bot.sendMessage(msg.chat.id, `❌ Lỗi xử lý CapCut: ${error.message}`);
    return true;
  }
  return false;
};
