import axios from 'axios';
import crypto from 'crypto';
import { getCache, setCache, delCache } from '../../lib/cache/index.js';

const waitingKey = (telegramId) => `download_all_waiting_${telegramId}`;
const mediaKey = (telegramId) => `download_media_choices_${telegramId}`;
const downloadLockKey = (telegramId) => `download_media_lock_${telegramId}`;
const MAX_MEDIA = 10;
const MAX_TELEGRAM_FILE_SIZE = 49 * 1024 * 1024;
const J2_ORIGIN = 'https://j2download.com';
const J2_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36';
let automaticSession = null;
let automaticSessionPromise = null;

const normalizeAuthorization = (value = '') => {
  const token = String(value).trim();
  if (!token) return '';
  return /^Bearer\s/i.test(token) ? token : `Bearer ${token}`;
};

const mergeCookies = (...setCookieGroups) => {
  const jar = new Map();
  for (const group of setCookieGroups) {
    const values = Array.isArray(group) ? group : (group ? [group] : []);
    for (const value of values) {
      const pair = String(value).split(';', 1)[0];
      const separator = pair.indexOf('=');
      if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
};

const hasLeadingZeroNibbles = (digest, difficulty) => {
  const fullBytes = Math.floor(difficulty / 2);
  for (let index = 0; index < fullBytes; index += 1) {
    if (digest[index] !== 0) return false;
  }
  return difficulty % 2 === 0 || (digest[fullBytes] & 0xf0) === 0;
};

const solveSinglePow = (challengeType, challenge, nonce, difficulty) => {
  const prefix = challengeType === 'alt' ? `pow:${nonce}:` : `pow:${challenge}:`;
  const suffix = challengeType === 'alt' ? `:${challenge}` : `:${nonce}:${challenge.length}`;
  for (let solution = 0; solution < 100_000_000; solution += 1) {
    const digest = crypto.createHash('sha256').update(`${prefix}${solution}${suffix}`).digest();
    if (hasLeadingZeroNibbles(digest, difficulty)) return String(solution);
  }
  throw new Error('Không giải được thử thách J2Download');
};

const solvePow = (bootstrap) => {
  const type = bootstrap.challengeType || 'classic';
  const first = solveSinglePow(type, bootstrap.powChallenge, bootstrap.nonce, Number(bootstrap.powDifficulty));
  if (type !== 'alt') return first;
  const secondChallenge = crypto.createHash('sha256')
    .update(`pow:alt:${bootstrap.powChallenge}:${bootstrap.nonce}:${first}`)
    .digest('hex')
    .slice(0, 32);
  const second = solveSinglePow(type, secondChallenge, bootstrap.nonce, Number(bootstrap.powDifficulty));
  return `${first}.${second}`;
};

const getJwtExpiry = (token) => {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    return Number(payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
};

const createAutomaticSession = async () => {
  const commonHeaders = {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'vi,en-US;q=0.9,en;q=0.8',
    'user-agent': J2_USER_AGENT
  };
  const page = await axios.get(`${J2_ORIGIN}/vi`, {
    headers: commonHeaders,
    timeout: 20_000,
    maxRedirects: 5
  });
  const match = String(page.data).match(/window\.__BOOTSTRAP__\s*=\s*(\{.+?\})\s*;/);
  if (!match) throw new Error('Không tìm thấy bootstrap J2Download');
  const bootstrap = JSON.parse(match[1]);
  if (!bootstrap.nonce || !bootstrap.powChallenge) throw new Error('Bootstrap J2Download không hợp lệ');

  let cookie = mergeCookies(page.headers['set-cookie']);
  if (!cookie) throw new Error('J2Download không cấp session cookie');
  const solution = solvePow(bootstrap);
  const issued = await axios.post(`${J2_ORIGIN}/api/auth/issue`, null, {
    headers: {
      accept: 'application/json, text/plain, */*',
      cookie,
      'user-agent': J2_USER_AGENT,
      'x-page-nonce': bootstrap.nonce,
      'x-pow-solution': solution,
      origin: J2_ORIGIN,
      referer: `${J2_ORIGIN}/vi`
    },
    timeout: 20_000
  });
  cookie = mergeCookies(cookie, issued.headers['set-cookie']);
  const accessToken = issued.data?.accessToken;
  const expiresAt = getJwtExpiry(accessToken);
  if (!accessToken || !expiresAt) throw new Error('J2Download không cấp access token');
  return { authorization: `Bearer ${accessToken}`, cookie, expiresAt };
};

const getJ2Credentials = async (config, forceRefresh = false) => {
  const configuredAuthorization = normalizeAuthorization(config.J2DOWNLOAD_AUTHORIZATION);
  if (configuredAuthorization) {
    return { authorization: configuredAuthorization, cookie: config.J2DOWNLOAD_COOKIE || '' };
  }
  if (!forceRefresh && automaticSession && Date.now() < automaticSession.expiresAt - 5_000) {
    return automaticSession;
  }
  if (automaticSessionPromise) return automaticSessionPromise;
  automaticSessionPromise = createAutomaticSession();
  try {
    automaticSession = await automaticSessionPromise;
    return automaticSession;
  } finally {
    automaticSessionPromise = null;
  }
};

export const requestAutolink = async (inputUrl, config = {}, forceRefresh = false) => {
  const credentials = await getJ2Credentials(config, forceRefresh);
  const headers = {
    accept: 'application/json, text/plain, */*',
    authorization: credentials.authorization,
    'content-type': 'application/json',
    origin: J2_ORIGIN,
    referer: `${J2_ORIGIN}/vi`,
    'user-agent': J2_USER_AGENT
  };
  if (credentials.cookie) headers.cookie = credentials.cookie;
  try {
    return await axios.post(
      config.J2DOWNLOAD_API_URL || `${J2_ORIGIN}/api/autolink`,
      { data: { url: inputUrl, unlock: true } },
      { headers, timeout: 30_000 }
    );
  } catch (error) {
    const code = error.response?.data?.error;
    const refreshable = error.response?.status === 401 || [
      'session_required', 'session_expired', 'bootstrap_expired',
      'page_nonce_invalid', 'pow_context_invalid'
    ].includes(code);
    if (!forceRefresh && !normalizeAuthorization(config.J2DOWNLOAD_AUTHORIZATION) && refreshable) {
      automaticSession = null;
      return requestAutolink(inputUrl, config, true);
    }
    throw error;
  }
};

const safeFilePart = (value, fallback = 'media') => {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60);
  return cleaned || fallback;
};

export const startDownloadFlow = async (bot, chatId, telegramId) => {
  setCache(waitingKey(telegramId), true, 5 * 60 * 1000);
  await bot.sendMessage(chatId,
    '⬇️ DOWNLOAD ALL\n\nDán link video/bài đăng cần tải vào đây. Bot sẽ gửi tất cả video và audio mà dịch vụ tìm thấy.',
    {
      reply_markup: {
        keyboard: [[{ text: '❌ Hủy', style: 'danger' }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }
  );
};

const isHttpUrl = (text) => {
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const sendMedia = async (bot, chatId, media, index, metadata) => {
  if (!media?.url || !isHttpUrl(media.url)) throw new Error('Media URL không hợp lệ');

  if (Number(media.data_size || 0) > MAX_TELEGRAM_FILE_SIZE) {
    await bot.sendMessage(chatId, `⚠️ Tệp ${index + 1} lớn hơn giới hạn gửi của bot. Link tải trực tiếp:\n${media.url}`);
    return;
  }

  const response = await axios.get(media.url, {
    responseType: 'stream',
    timeout: 90_000,
    maxRedirects: 5,
    maxContentLength: MAX_TELEGRAM_FILE_SIZE,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const extension = safeFilePart(media.extension || (media.type === 'audio' ? 'mp3' : 'mp4'));
  const filename = `${safeFilePart(metadata.id, 'download')}_${index + 1}_${safeFilePart(media.quality, media.type)}.${extension}`;
  const quality = media.quality ? ` · ${media.quality}` : '';
  const caption = `⬇️ ${index + 1}/${metadata.total}${quality}`.slice(0, 1024);
  const fileOptions = {
    filename,
    contentType: response.headers['content-type'] || (media.type === 'audio' ? 'audio/mpeg' : 'video/mp4')
  };

  if (media.type === 'audio') {
    await bot.sendAudio(chatId, response.data, { caption }, fileOptions);
  } else if (media.type === 'image') {
    await bot.sendPhoto(chatId, response.data, { caption }, fileOptions);
  } else if (media.type === 'video') {
    await bot.sendVideo(chatId, response.data, { caption, supports_streaming: true }, fileOptions);
  } else {
    await bot.sendDocument(chatId, response.data, { caption }, fileOptions);
  }
};

export const handleDownloadInput = async (bot, msg, config) => {
  if (!getCache(waitingKey(msg.from.id))) return false;

  const inputUrl = String(msg.text || '').trim();
  if (!isHttpUrl(inputUrl)) {
    await bot.sendMessage(msg.chat.id, '❌ Link không hợp lệ. Vui lòng dán link bắt đầu bằng http:// hoặc https://.');
    return true;
  }

  delCache(waitingKey(msg.from.id));
  const status = await bot.sendMessage(msg.chat.id, '⏳ Đang lấy thông tin và tải media...');
  try {
    const response = await requestAutolink(inputUrl, config);
    const result = response.data?.response || response.data;
    if (!result || result.error || !Array.isArray(result.medias) || !result.medias.length) {
      throw new Error(result?.message || 'Dịch vụ không trả về media');
    }

    const medias = result.medias.slice(0, MAX_MEDIA);
    const title = String(result.title || '').slice(0, 500);
    setCache(mediaKey(msg.from.id), {
      id: result.id,
      author: result.author,
      title,
      medias
    }, 10 * 60 * 1000);

    const mediaButtons = medias.map((media, index) => {
      const icon = media.type === 'audio' ? '🎵' : media.type === 'image' ? '🖼️' : '🎬';
      const resolution = media.width && media.height ? ` · ${media.width}x${media.height}` : '';
      const size = media.data_size ? ` · ${(Number(media.data_size) / 1024 / 1024).toFixed(1)}MB` : '';
      const quality = media.quality || media.extension || `Tệp ${index + 1}`;
      return [{
        text: `${icon} ${quality}${resolution}${size}`.slice(0, 60),
        callback_data: JSON.stringify({ a: 'dl', i: index }),
        style: 'primary'
      }];
    });
    mediaButtons.push([{
      text: `⬇️ Tải tất cả (${medias.length})`,
      callback_data: JSON.stringify({ a: 'dla' }),
      style: 'success'
    }]);
    mediaButtons.push([{
      text: '❌ Hủy',
      callback_data: JSON.stringify({ a: 'dlc' }),
      style: 'danger'
    }]);

    await bot.editMessageText(
      `✅ Đã tìm thấy ${medias.length} lựa chọn${result.author ? `\n👤 ${result.author}` : ''}${title ? `\n📝 ${title}` : ''}\n\nChọn tệp cần tải:`,
      {
        chat_id: msg.chat.id,
        message_id: status.message_id,
        reply_markup: { inline_keyboard: mediaButtons }
      }
    );
  } catch (error) {
    const detail = error.response?.data?.message || error.response?.data?.error || error.message;
    console.error('[DOWNLOAD_ALL] Error:', detail);
    await bot.editMessageText(
      '❌ Không thể tải link này. Token/phiên J2Download có thể đã hết hạn hoặc nền tảng chưa được hỗ trợ.',
      { chat_id: msg.chat.id, message_id: status.message_id }
    );
  }
  return true;
};

export const handleDownloadSelection = async (bot, query, action, index) => {
  const telegramId = query.from.id;
  const chatId = query.message.chat.id;
  if (action === 'download_cancel') {
    delCache(mediaKey(telegramId));
    await bot.answerCallbackQuery(query.id, { text: 'Đã hủy tải.' });
    return bot.sendMessage(chatId, '❌ Đã hủy lựa chọn tải.');
  }

  const saved = getCache(mediaKey(telegramId));
  if (!saved?.medias?.length) {
    await bot.answerCallbackQuery(query.id, { text: 'Danh sách đã hết hạn.', show_alert: true });
    return bot.sendMessage(chatId, '⌛ Danh sách tải đã hết hạn. Hãy dùng /getlink và dán lại link.');
  }
  if (getCache(downloadLockKey(telegramId))) {
    return bot.answerCallbackQuery(query.id, { text: 'Bot đang tải tệp trước đó, vui lòng chờ.', show_alert: true });
  }

  const selected = action === 'download_all'
    ? saved.medias
    : [saved.medias[Number(index)]].filter(Boolean);
  if (!selected.length) {
    return bot.answerCallbackQuery(query.id, { text: 'Lựa chọn không hợp lệ.', show_alert: true });
  }

  setCache(downloadLockKey(telegramId), true, 2 * 60 * 1000);
  await bot.answerCallbackQuery(query.id, { text: `Bắt đầu tải ${selected.length} tệp...` });
  const status = await bot.sendMessage(chatId, `⏳ Đang tải ${selected.length} tệp đã chọn...`);
  let sent = 0;
  try {
    for (let position = 0; position < selected.length; position += 1) {
      try {
        await sendMedia(bot, chatId, selected[position], position, {
          id: saved.id,
          total: selected.length
        });
        sent += 1;
      } catch (error) {
        console.error(`[DOWNLOAD_SELECTION] Media ${position + 1}:`, error.message);
        await bot.sendMessage(chatId, `⚠️ Không gửi được tệp ${position + 1}. Link tải trực tiếp:\n${selected[position].url}`);
      }
    }
    await bot.editMessageText(`✅ Hoàn tất: ${sent}/${selected.length} tệp đã được gửi.`, {
      chat_id: chatId,
      message_id: status.message_id
    });
  } finally {
    delCache(downloadLockKey(telegramId));
  }
};
