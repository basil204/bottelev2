/**
 * Xử lý lệnh lấy thông tin UID Người dùng, ID Box/Nhóm chat, Kênh (Channel)
 */
export const handleGetId = async (bot, msg) => {
  try {
    const chat = msg.chat || {};
    const from = msg.from || {};
    const forwardChat = msg.forward_from_chat;
    const forwardFrom = msg.forward_from;

    let chatTypeStr = 'Trò chuyện cá nhân (Private)';
    if (chat.type === 'group') chatTypeStr = 'Nhóm thường (Group)';
    if (chat.type === 'supergroup') chatTypeStr = 'Siêu nhóm / Box Chat (Supergroup)';
    if (chat.type === 'channel') chatTypeStr = 'Kênh thông báo (Channel)';

    const userFullName = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Chưa đặt';
    const userHandle = from.username ? `@${from.username}` : 'Không có';

    let response = `🆔 <b>THÔNG TIN ID & UID TELEGRAM</b>\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 1. Thông tin người gửi (User)
    if (from.id) {
      response += `👤 <b>NGƯỜI GỬI (USER):</b>\n`;
      response += `• Tên: <b>${escapeHtml(userFullName)}</b>\n`;
      response += `• Username: <b>${escapeHtml(userHandle)}</b>\n`;
      response += `• User ID: <code>${from.id}</code> <i>(Chạm để copy)</i>\n\n`;
    }

    // 2. Thông tin cuộc trò chuyện / Box / Kênh hiện tại
    response += `💬 <b>VỊ TRÍ HIỆN TẠI (CHAT / BOX / KÊNH):</b>\n`;
    response += `• Loại: <b>${chatTypeStr}</b>\n`;
    if (chat.title) {
      response += `• Tên: <b>${escapeHtml(chat.title)}</b>\n`;
    }
    if (chat.username) {
      response += `• Username: <b>@${escapeHtml(chat.username)}</b>\n`;
    }
    response += `• Chat / Box ID: <code>${chat.id}</code> <i>(Chạm để copy)</i>\n`;

    if (msg.message_thread_id) {
      response += `• Topic / Thread ID: <code>${msg.message_thread_id}</code>\n`;
    }
    response += `\n`;

    // 3. Nếu là tin nhắn chuyển tiếp từ Kênh hoặc Nhóm hoặc User khác
    if (forwardChat) {
      let fwdType = forwardChat.type === 'channel' ? 'Kênh (Channel)' : 'Nhóm (Group)';
      response += `📢 <b>NGUỒN CHUYỂN TIẾP (FORWARDED SOURCE):</b>\n`;
      response += `• Loại: <b>${fwdType}</b>\n`;
      if (forwardChat.title) {
        response += `• Tên: <b>${escapeHtml(forwardChat.title)}</b>\n`;
      }
      if (forwardChat.username) {
        response += `• Username: <b>@${escapeHtml(forwardChat.username)}</b>\n`;
      }
      response += `• Nguồn ID: <code>${forwardChat.id}</code> <i>(Chạm để copy)</i>\n\n`;
    } else if (forwardFrom) {
      const fwdUserName = [forwardFrom.first_name, forwardFrom.last_name].filter(Boolean).join(' ') || 'Chưa đặt';
      response += `👤 <b>NGƯỜI ĐƯỢC CHUYỂN TIẾP (FORWARDED USER):</b>\n`;
      response += `• Tên: <b>${escapeHtml(fwdUserName)}</b>\n`;
      if (forwardFrom.username) response += `• Username: <b>@${escapeHtml(forwardFrom.username)}</b>\n`;
      response += `• User ID: <code>${forwardFrom.id}</code> <i>(Chạm để copy)</i>\n\n`;
    }

    // 4. Mẹo hướng dẫn cấu hình nhận thông báo
    if (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel') {
      response += `💡 <b>Mẹo Cài Đặt Thông Báo:</b>\n`;
      response += `Copy ID <code>${chat.id}</code> dán vào mục <b>Cài Đặt Hệ Thống</b> trên Web Dashboard để tự động nhận thông báo khi thêm sản phẩm mới, nạp kho và Flash Sale!`;
    } else if (forwardChat) {
      response += `💡 <b>Mẹo Cài Đặt Thông Báo:</b>\n`;
      response += `Copy ID <code>${forwardChat.id}</code> dán vào mục <b>Cài Đặt Hệ Thống</b> trên Web Dashboard để tự động nhận thông báo!`;
    }

    await bot.sendMessage(chat.id, response, {
      parse_mode: 'HTML',
      reply_to_message_id: msg.message_id
    });
  } catch (err) {
    console.error('[HANDLE_GET_ID_ERR]', err);
    try {
      await bot.sendMessage(msg.chat.id, `ID của chat này là: <code>${msg.chat.id}</code>\nUser ID của bạn: <code>${msg.from?.id || 'N/A'}</code>`, {
        parse_mode: 'HTML'
      });
    } catch (e) {}
  }
};

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
