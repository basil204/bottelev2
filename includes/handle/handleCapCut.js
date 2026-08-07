import { getCache, setCache, delCache } from '../../lib/cache/index.js';
import { createCallbackData } from '../../utils/index.js';

const stateKey = (telegramId) => `capcut_flow_${telegramId}`;
const ttl = 15 * 60 * 1000;

const flows = {
  login: [
    ['email', 'Nhập email Admin CapCut:'],
    ['password', 'Nhập mật khẩu Admin CapCut:'],
    ['proxy_url', 'Nhập proxy live (http://user:pass@host:port):']
  ],
  join: [
    ['api_key', 'Nhập API key (capcut_sec_...):'],
    ['invite_link', 'Nhập invite link Workspace:'],
    ['proxy_url', 'Nhập proxy live:'],
    ['accounts', 'Nhập tài khoản thành viên, mỗi dòng email|password:']
  ],
  batch: [
    ['admin_email', 'Nhập email Admin CapCut:'],
    ['admin_password', 'Nhập mật khẩu Admin CapCut:'],
    ['workspace_id', 'Nhập Workspace ID:'],
    ['proxy_url', 'Nhập proxy live:'],
    ['accounts', 'Nhập tài khoản thành viên, mỗi dòng email|password:']
  ],
  invite: [
    ['email', 'Nhập email Admin CapCut:'],
    ['password', 'Nhập mật khẩu Admin CapCut:'],
    ['workspace_id', 'Nhập Workspace ID:'],
    ['proxy_url', 'Nhập proxy live:'],
    ['emails', 'Nhập email thành viên, mỗi email một dòng:']
  ]
};

export const showCapCutMenu = async (bot, chatId) => bot.sendMessage(chatId,
  '🎬 *CAPCUT WORKSPACE*\n\nChọn tính năng bạn muốn sử dụng:', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: '🔐 Đăng nhập Admin', callback_data: createCallbackData({ action: 'capcut_login' }) }],
      [{ text: '🔗 Join bằng Invite Link', callback_data: createCallbackData({ action: 'capcut_join' }) }],
      [{ text: '👥 Batch Join bằng Admin', callback_data: createCallbackData({ action: 'capcut_batch' }) }],
      [{ text: '✉️ Mời trực tiếp qua Email', callback_data: createCallbackData({ action: 'capcut_invite' }) }]
    ] }
  });

export const startCapCutFlow = async (bot, chatId, telegramId, action) => {
  if (!flows[action]) return showCapCutMenu(bot, chatId);
  setCache(stateKey(telegramId), { action, step: 0, data: {} }, ttl);
  await bot.sendMessage(chatId, `${flows[action][0][1]}\n\nGõ /cancel để hủy.`);
};

const parseAccounts = (text) => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
  const [email, ...password] = line.split('|');
  return { email: email?.trim(), password: password.join('|').trim() };
}).filter(item => item.email && item.password);

const callCapCutApi = async (config, action, data) => {
  const base = String(config.CAPCUT_API_BASE || 'https://tienich.manhit.dev').replace(/\/$/, '');
  const paths = { login: '/api/v1/login', join: '/api/v1/join', batch: '/api/web/batch-join', invite: '/api/web/invite-members' };
  const headers = { 'Content-Type': 'application/json' };
  let payload = { ...data };
  if (action === 'join') {
    headers.Authorization = `Bearer ${data.api_key}`;
    delete payload.api_key;
  }
  if (action === 'batch') payload.mode = 'admin';
  if (payload.accounts) payload.accounts = parseAccounts(payload.accounts);
  if (payload.emails) payload.emails = payload.emails.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${base}${paths[action]}`, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
    const result = await response.json().catch(() => ({ error: 'API trả về dữ liệu không hợp lệ' }));
    if (!response.ok || result.success === false) throw new Error(result.error || result.message || `API lỗi ${response.status}`);
    return result;
  } finally { clearTimeout(timeout); }
};

const resultText = (action, result) => {
  if (action === 'login') {
    const workspaces = (result.workspaces || []).slice(0, 10).map(item =>
      `• ${item.name || 'Workspace'} (${item.member_cnt || 0}/${item.member_limit || 0})\n  ID: ${item.workspace_id}\n  Link: ${item.join_link || 'Chưa có'}`
    ).join('\n\n');
    return `✅ Đăng nhập thành công\n\nAPI key:\n${result.api_key || 'Không có'}\n\n${workspaces || 'Không tìm thấy Workspace.'}`;
  }
  const joined = result.joined_count ?? result.joinedCount ?? 0;
  const failed = result.failed_count ?? result.failedCount ?? 0;
  return `✅ Xử lý hoàn tất\n\nThành công: ${joined}\nThất bại: ${failed}\nTổng: ${result.total ?? joined + failed}`;
};

export const handleCapCutInput = async (bot, msg, config) => {
  const state = getCache(stateKey(msg.from.id));
  if (!state) return false;
  const text = String(msg.text || '').trim();
  if (text.toLowerCase() === '/cancel' || text === '❌ Hủy') {
    delCache(stateKey(msg.from.id));
    await bot.sendMessage(msg.chat.id, 'Đã hủy thao tác CapCut.');
    return true;
  }

  const [field] = flows[state.action][state.step];
  if (!text) return true;
  state.data[field] = text;
  if (field.includes('password') || field === 'api_key' || field === 'proxy_url' || field === 'accounts') {
    await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
  }
  state.step += 1;
  if (state.step < flows[state.action].length) {
    setCache(stateKey(msg.from.id), state, ttl);
    await bot.sendMessage(msg.chat.id, flows[state.action][state.step][1]);
    return true;
  }

  delCache(stateKey(msg.from.id));
  const waiting = await bot.sendMessage(msg.chat.id, '⏳ Đang kết nối và xử lý CapCut...');
  try {
    const result = await callCapCutApi(config, state.action, state.data);
    await bot.editMessageText(resultText(state.action, result), { chat_id: msg.chat.id, message_id: waiting.message_id, disable_web_page_preview: true });
  } catch (error) {
    const message = error.name === 'AbortError' ? 'API CapCut phản hồi quá lâu.' : error.message;
    await bot.editMessageText(`❌ Không thể xử lý CapCut:\n${message}`, { chat_id: msg.chat.id, message_id: waiting.message_id });
  }
  return true;
};
