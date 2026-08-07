import crypto from 'node:crypto';

export interface TelegramMiniAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export function verifyTelegramInitData(initData: string, maxAgeSeconds = 3600) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !initData) throw new Error('UNAUTHORIZED');

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!receivedHash || !authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) {
    throw new Error('UNAUTHORIZED');
  }

  params.delete('hash');
  params.delete('signature');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const valid = receivedHash.length === calculatedHash.length && crypto.timingSafeEqual(
    Buffer.from(receivedHash, 'hex'),
    Buffer.from(calculatedHash, 'hex')
  );
  if (!valid) throw new Error('UNAUTHORIZED');

  const rawUser = params.get('user');
  if (!rawUser) throw new Error('UNAUTHORIZED');
  return JSON.parse(rawUser) as TelegramMiniAppUser;
}
