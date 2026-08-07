import { getCache, setCache, delCache } from '../../lib/cache/index.js';
import { createCallbackData } from '../../utils/index.js';

const stateKey = (telegramId) => `capcut_flow_${telegramId}`;
const ttl = 15 * 60 * 1000;

const requestApi = async (config, path, payload, apiKey = '') => {
  const base = String(config.CAPCUT_API_BASE || 'https://tienich.manhit.dev').replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal
    });
    const result = await response.json().catch(() => ({ error: 'API trả về dữ liệu không hợp lệ' }));
    if (!response.ok || result.success === false) {
      throw new Error(result.error || result.message || `API lỗi ${response.status}`);
    }
    return result;
  } finally { clearTimeout(timeout); }
};

const parseAccounts = (text) => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
  const [email, ...passwordParts] = line.split('|');
  return { email: email?.trim(), password: passwordParts.join('|').trim() };
}).filter(account => account.email && account.password);

export const showCapCutMenu = async (bot, chatId) => bot.sendMessage(
  chatId,
  '🎬 *CAPCUT AUTO JOIN*\n\nBot sẽ đăng nhập Admin, kiểm tra Family còn slot và tự động Join tài khoản thành viên.',
  {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[
      { text: 'Bắt đầu Auto Join', callback_data: createCallbackData({ action: 'capcut_start' }) }
    ]] }
  }
);

export const startCapCutFlow = async (bot, chatId, telegramId) => {
  setCache(stateKey(telegramId), { step: 'admin_email', data: {} }, ttl);
  await bot.sendMessage(chatId, 'Nhập email tài khoản Admin CapCut:\n\nGõ /cancel để hủy.');
};

const loginAdmin = async (bot, msg, state, config) => {
  const proxyUrl = String(state.data.proxy_url || config.CAPCUT_PROXY_URL || '').trim();

  const waiting = await bot.sendMessage(msg.chat.id, '⏳ Đang đăng nhập Admin và kiểm tra Family...');
  const result = await requestApi(config, '/api/v1/login', {
    email: state.data.admin_email,
    password: state.data.admin_password,
    proxy_url: proxyUrl
  });
  const available = (Array.isArray(result.workspaces) ? result.workspaces : [])
    .map(workspace => ({
      ...workspace,
      free_slots: Math.max(0, Number(workspace.member_limit || 0) - Number(workspace.member_cnt || 0))
    }))
    .filter(workspace => workspace.free_slots > 0 && workspace.join_link)
    .sort((a, b) => b.free_slots - a.free_slots);

  if (!available.length) {
    delCache(stateKey(msg.from.id));
    return bot.editMessageText('❌ Không tìm thấy Family nào còn slot hoặc có Invite Link.', {
      chat_id: msg.chat.id, message_id: waiting.message_id
    });
  }

  const selected = available[0];
  setCache(stateKey(msg.from.id), {
    step: 'member_accounts',
    data: {
      api_key: result.api_key,
      invite_link: selected.join_link,
      workspace_id: selected.workspace_id,
      workspace_name: selected.name,
      free_slots: selected.free_slots,
      proxy_url: proxyUrl
    }
  }, ttl);

  const familySummary = available.slice(0, 10).map((workspace, index) =>
    `${index === 0 ? '✅' : '•'} ${workspace.name || workspace.workspace_id}: còn ${workspace.free_slots} slot`
  ).join('\n');
  return bot.editMessageText(
    `✅ Đăng nhập thành công\n\n${familySummary}\n\nBot chọn: ${selected.name || selected.workspace_id}\nSố lượng có thể Join: ${selected.free_slots}\n\nGửi tối đa ${selected.free_slots} tài khoản, mỗi dòng theo định dạng:\nemail@gmail.com|password`,
    { chat_id: msg.chat.id, message_id: waiting.message_id }
  );
};

const joinMembers = async (bot, msg, state, config, text) => {
  const accounts = parseAccounts(text);
  if (!accounts.length) {
    return bot.sendMessage(msg.chat.id, '❌ Sai định dạng. Mỗi dòng phải là email|password. Vui lòng gửi lại.');
  }
  if (accounts.length > state.data.free_slots) {
    return bot.sendMessage(msg.chat.id, `❌ Family chỉ còn ${state.data.free_slots} slot. Bạn đã gửi ${accounts.length} tài khoản, vui lòng gửi lại.`);
  }
  await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
  delCache(stateKey(msg.from.id));
  const waiting = await bot.sendMessage(msg.chat.id, `⏳ Đang Join ${accounts.length} tài khoản vào ${state.data.workspace_name}...`);
  const result = await requestApi(config, '/api/v1/join', {
    invite_link: state.data.invite_link,
    proxy_url: state.data.proxy_url,
    accounts
  }, state.data.api_key);
  const joined = Number(result.joined_count ?? result.joinedCount ?? result.joined?.length ?? 0);
  const failed = Number(result.failed_count ?? result.failedCount ?? result.failed?.length ?? 0);
  const failedList = (result.failed || result.failedList || []).slice(0, 10)
    .map(item => `• ${item.email || 'Tài khoản'}: ${item.error || item.message || 'Thất bại'}`).join('\n');
  return bot.editMessageText(
    `✅ AUTO JOIN HOÀN TẤT\n\nFamily: ${state.data.workspace_name}\nThành công: ${joined}\nThất bại: ${failed}${failedList ? `\n\nChi tiết lỗi:\n${failedList}` : ''}`,
    { chat_id: msg.chat.id, message_id: waiting.message_id }
  );
};

export const handleCapCutInput = async (bot, msg, config) => {
  const state = getCache(stateKey(msg.from.id));
  if (!state) return false;
  const text = String(msg.text || '').trim();
  if (text.toLowerCase() === '/cancel' || text === '❌ Hủy') {
    delCache(stateKey(msg.from.id));
    await bot.sendMessage(msg.chat.id, 'Đã hủy Auto Join CapCut.');
    return true;
  }

  try {
    if (state.step === 'admin_email') {
      if (!text.includes('@')) {
        await bot.sendMessage(msg.chat.id, '❌ Email không hợp lệ, vui lòng nhập lại.');
        return true;
      }
      state.data.admin_email = text;
      state.step = 'admin_password';
      setCache(stateKey(msg.from.id), state, ttl);
      await bot.sendMessage(msg.chat.id, 'Nhập mật khẩu tài khoản Admin CapCut:');
      return true;
    }
    if (state.step === 'admin_password') {
      state.data.admin_password = text;
      await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
      if (!String(config.CAPCUT_PROXY_URL || '').trim()) {
        state.step = 'proxy_url';
        setCache(stateKey(msg.from.id), state, ttl);
        await bot.sendMessage(msg.chat.id, 'Nhập proxy live theo định dạng:\nhttp://user:password@host:port\n\nHoặc: host:port:user:password');
        return true;
      }
      await loginAdmin(bot, msg, state, config);
      return true;
    }
    if (state.step === 'proxy_url') {
      if (!text.includes(':')) {
        await bot.sendMessage(msg.chat.id, '❌ Proxy không đúng định dạng, vui lòng nhập lại.');
        return true;
      }
      state.data.proxy_url = text;
      await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
      await loginAdmin(bot, msg, state, config);
      return true;
    }
    if (state.step === 'member_accounts') {
      await joinMembers(bot, msg, state, config, text);
      return true;
    }
  } catch (error) {
    delCache(stateKey(msg.from.id));
    const message = error.name === 'AbortError' ? 'API CapCut phản hồi quá lâu.' : error.message;
    await bot.sendMessage(msg.chat.id, `❌ Lỗi CapCut: ${message}`);
    return true;
  }
  return false;
};
