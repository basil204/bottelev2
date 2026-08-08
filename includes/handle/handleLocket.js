import axios from 'axios';
import { getCache, setCache, delCache } from '../../lib/cache/index.js';

const waitingKey = (telegramId) => `locket_lookup_waiting_${telegramId}`;

const extractUsername = (input) => {
  const value = String(input || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (parsed.hostname === 'locket.cam' || parsed.hostname.endsWith('.locket.cam')) {
      return parsed.pathname.split('/').filter(Boolean)[0] || '';
    }
  } catch {}
  return value.replace(/^@/, '').split(/[/?#\s]/)[0];
};

export const startLocketFlow = async (bot, chatId, telegramId) => {
  setCache(waitingKey(telegramId), true, 5 * 60 * 1000);
  return bot.sendMessage(chatId,
    '🔐 LOCKET\n\nNhập username hoặc link hồ sơ Locket để kiểm tra.\nVí dụ: @username hoặc https://locket.cam/username',
    {
      reply_markup: {
        keyboard: [[{ text: '❌ Hủy', style: 'danger' }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }
  );
};

export const handleLocketInput = async (bot, msg) => {
  if (!getCache(waitingKey(msg.from.id))) return false;
  const username = extractUsername(msg.text);
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(username)) {
    await bot.sendMessage(msg.chat.id, '❌ Username hoặc link Locket không hợp lệ. Vui lòng nhập lại.');
    return true;
  }

  delCache(waitingKey(msg.from.id));
  const profileUrl = `https://locket.cam/${encodeURIComponent(username)}`;
  const status = await bot.sendMessage(msg.chat.id, '⏳ Đang kiểm tra hồ sơ Locket...');
  try {
    const response = await axios.get(profileUrl, {
      timeout: 15_000,
      maxRedirects: 5,
      headers: {
        accept: 'text/html',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      },
      validateStatus: () => true
    });
    const html = String(response.data || '');
    const finalUrl = response.request?.res?.responseUrl || profileUrl;
    const combined = `${finalUrl}\n${html}`;
    let decoded = combined;
    try { decoded = decodeURIComponent(combined); } catch {}
    const inviteId = combined.match(/\/invites\/([A-Za-z0-9]{28})/)?.[1]
      || decoded.match(/\/invites\/([A-Za-z0-9]{28})/)?.[1];

    if (response.status >= 400 || !inviteId) {
      return bot.editMessageText('❌ Không tìm thấy hồ sơ hoặc lời mời Locket công khai.', {
        chat_id: msg.chat.id,
        message_id: status.message_id
      });
    }
    return bot.editMessageText(
      `✅ TÌM THẤY HỒ SƠ LOCKET\n\n👤 Username: @${username}\n🆔 Invite ID: ${inviteId}`,
      {
        chat_id: msg.chat.id,
        message_id: status.message_id,
        reply_markup: {
          inline_keyboard: [[{ text: '🔗 Mở hồ sơ Locket', url: profileUrl, style: 'primary' }]]
        }
      }
    );
  } catch (error) {
    console.error('[LOCKET_LOOKUP] Error:', error.message);
    return bot.editMessageText('🟡 Không thể kết nối Locket lúc này. Vui lòng thử lại sau.', {
      chat_id: msg.chat.id,
      message_id: status.message_id
    });
  }
};
