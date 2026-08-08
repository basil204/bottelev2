import axios from 'axios';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

const normalizeUsername = (input, domains) => {
  let value = String(input || '').trim().replace(/^@/, '');
  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (domains.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))) {
      value = parsed.pathname.split('/').filter(Boolean)[0] || '';
    }
  } catch {}
  return value.replace(/^@/, '').split(/[?&#/]/)[0];
};

const checkFacebook = async (input) => {
  let uid = String(input).trim();
  const idMatch = uid.match(/[?&]id=(\d+)/i);
  if (idMatch) uid = idMatch[1];
  else if (/facebook\.com|fb\.com/i.test(uid)) {
    uid = normalizeUsername(uid, ['facebook.com', 'fb.com']);
  }
  if (!/^[a-zA-Z0-9.]+$/.test(uid)) throw new Error('UID hoặc username Facebook không hợp lệ');

  const response = await axios.get(`https://graph.facebook.com/${encodeURIComponent(uid)}/picture`, {
    params: { redirect: 'false' },
    timeout: 15_000,
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    validateStatus: () => true
  });
  const picture = response.data?.data;
  if (response.status === 200 && picture?.url && picture.width && picture.height && !picture.is_silhouette) {
    return { status: 'live', label: uid, detail: `${picture.width}x${picture.height}` };
  }
  return { status: 'die', label: uid, detail: response.data?.error?.message || 'Không tìm thấy tài khoản công khai' };
};

const checkInstagram = async (input) => {
  const username = normalizeUsername(input, ['instagram.com']);
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) throw new Error('Username Instagram không hợp lệ');
  const response = await axios.get(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
    timeout: 20_000,
    maxRedirects: 3,
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'vi,en-US;q=0.9',
      'user-agent': USER_AGENT
    },
    validateStatus: () => true
  });
  if (response.status === 404) return { status: 'die', label: `@${username}`, detail: 'Profile không tồn tại' };

  const cookies = (response.headers['set-cookie'] || []).map((value) => value.split(';')[0]).join('; ');
  const csrfToken = cookies.match(/csrftoken=([^;]+)/i)?.[1] || 'missing';
  const apiResponse = await axios.get('https://www.instagram.com/api/v1/users/web_profile_info/', {
    params: { username },
    timeout: 20_000,
    headers: {
      accept: '*/*',
      'user-agent': USER_AGENT,
      'x-ig-app-id': '936619743392459',
      'x-csrftoken': csrfToken,
      'x-requested-with': 'XMLHttpRequest',
      referer: `https://www.instagram.com/${username}/`,
      cookie: cookies
    },
    validateStatus: () => true
  });
  const user = apiResponse.data?.data?.user;
  if (apiResponse.status === 200 && user) {
    return { status: 'live', label: `@${username}`, detail: user.full_name || 'Profile đang hoạt động' };
  }
  if (apiResponse.status === 404 || (apiResponse.status === 200 && apiResponse.data?.data?.user === null)) {
    return { status: 'die', label: `@${username}`, detail: 'Profile không tồn tại' };
  }
  return {
    status: 'unknown',
    label: `@${username}`,
    detail: apiResponse.status === 429 ? 'Instagram đang giới hạn lượt kiểm tra' : `Instagram phản hồi HTTP ${apiResponse.status}`
  };
};

const checkTikTok = async (input) => {
  const username = normalizeUsername(input, ['tiktok.com']);
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) throw new Error('Username TikTok không hợp lệ');
  const response = await axios.get('https://www.tikwm.com/api/user/info', {
    params: { unique_id: username },
    timeout: 20_000,
    headers: { accept: 'application/json', 'user-agent': USER_AGENT, referer: 'https://www.tikwm.com/' },
    validateStatus: () => true
  });
  const user = response.data?.data?.user;
  if (response.status === 200 && response.data?.code === 0 && user) {
    return { status: 'live', label: `@${username}`, detail: user.nickname || 'Tài khoản đang hoạt động' };
  }
  if (response.status === 200 && response.data?.code === -1) {
    return { status: 'die', label: `@${username}`, detail: response.data?.msg || 'Không tìm thấy tài khoản' };
  }
  return { status: 'unknown', label: `@${username}`, detail: response.data?.msg || `API phản hồi HTTP ${response.status}` };
};

const HELP = `🔎 CHECK LIVE TÀI KHOẢN

Cú pháp:
/checklive fb <UID hoặc link>
/checklive ig <username hoặc link>
/checklive tiktok <username hoặc link>

Ví dụ:
/checklive fb 1000123456789
/checklive ig instagram
/checklive tiktok tiktok`;

export const handleCheckLiveCommand = async (bot, msg, rawArgs = '') => {
  const args = String(rawArgs).trim();
  if (!args) return bot.sendMessage(msg.chat.id, HELP);
  const [platformRaw, ...inputParts] = args.split(/\s+/);
  const input = inputParts.join(' ').trim();
  const platform = platformRaw.toLowerCase();
  if (!input || !['fb', 'facebook', 'ig', 'instagram', 'tt', 'tiktok'].includes(platform)) {
    return bot.sendMessage(msg.chat.id, `❌ Sai cú pháp.\n\n${HELP}`);
  }

  const statusMessage = await bot.sendMessage(msg.chat.id, '⏳ Đang kiểm tra tài khoản...');
  try {
    let result;
    let platformName;
    if (platform === 'fb' || platform === 'facebook') {
      platformName = 'Facebook';
      result = await checkFacebook(input);
    } else if (platform === 'ig' || platform === 'instagram') {
      platformName = 'Instagram';
      result = await checkInstagram(input);
    } else {
      platformName = 'TikTok';
      result = await checkTikTok(input);
    }

    const icon = result.status === 'live' ? '🟢 LIVE' : result.status === 'die' ? '🔴 DIE' : '🟡 KHÔNG XÁC ĐỊNH';
    return bot.editMessageText(
      `🔎 KẾT QUẢ KIỂM TRA\n\nNền tảng: ${platformName}\nTài khoản: ${result.label}\nTrạng thái: ${icon}\nThông tin: ${result.detail}`,
      { chat_id: msg.chat.id, message_id: statusMessage.message_id }
    );
  } catch (error) {
    console.error('[CHECK_LIVE] Error:', error.message);
    const isNetworkError = ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'].includes(error.code);
    return bot.editMessageText(
      isNetworkError
        ? '🟡 Không thể xác định trạng thái do API timeout. Vui lòng thử lại sau.'
        : `❌ Không thể kiểm tra: ${error.message}`,
      { chat_id: msg.chat.id, message_id: statusMessage.message_id }
    );
  }
};

export const CHECK_LIVE_HELP = HELP;
