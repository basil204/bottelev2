import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { initDb } from './includes/database/index.js';
import { registerListeners } from './includes/listen.js';
import { logEvent, logError } from './utils/log.js';
import { startAutoDepositWatcher, startQrExpirationChecker } from './includes/services/autoDeposit.js';
import { startGmailAutoDeleteChecker, startGmailLoginChecker, startEduAccountsDailyCleanup } from './includes/services/gmailAutoDelete.js';

dotenv.config();

const configPath = path.join(process.cwd(), 'config.json');
const fileConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath)) : {};

const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || fileConfig.TELEGRAM_BOT_TOKEN,
  DB_HOST: process.env.DB_HOST || fileConfig.DB_HOST,
  DB_NAME: process.env.DB_NAME || fileConfig.DB_NAME,
  DB_USER: process.env.DB_USER || fileConfig.DB_USER,
  DB_PASS: process.env.DB_PASS || fileConfig.DB_PASS,
  VIETQR_ACCOUNT_NO: process.env.VIETQR_ACCOUNT_NO || fileConfig.VIETQR_ACCOUNT_NO,
  VIETQR_BANK_CODE: process.env.VIETQR_BANK_CODE || fileConfig.VIETQR_BANK_CODE,
  ADMIN_IDS: process.env.ADMIN_IDS ? JSON.parse(process.env.ADMIN_IDS) : fileConfig.ADMIN_IDS || [],
  NOTIFY_MODE: process.env.NOTIFY_MODE || fileConfig.NOTIFY_MODE || 'all',
  PAGE_SIZE: Number(process.env.PAGE_SIZE || fileConfig.PAGE_SIZE || 10),
  MB_API_URL: process.env.MB_API_URL || fileConfig.MB_API_URL,
  MB_CHECK_INTERVAL: Number(process.env.MB_CHECK_INTERVAL || fileConfig.MB_CHECK_INTERVAL || 20000),
  TIMO_API_URL: process.env.TIMO_API_URL || fileConfig.TIMO_API_URL,
  TIMO_BANK_CODE: process.env.TIMO_BANK_CODE || fileConfig.TIMO_BANK_CODE,
  TIMO_ACCOUNT_NO: process.env.TIMO_ACCOUNT_NO || fileConfig.TIMO_ACCOUNT_NO,
  TIMO_ACCOUNT_NAME: process.env.TIMO_ACCOUNT_NAME || fileConfig.TIMO_ACCOUNT_NAME
};

if (!config.TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bootstrap = async () => {
  await initDb(config);
  logEvent('db_connected');

  const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
  registerListeners(bot, config);
  startQrExpirationChecker(bot); // Always start QR expiration checker
  startAutoDepositWatcher(bot, config);
  startGmailAutoDeleteChecker(); // Start Gmail auto delete checker
  startGmailLoginChecker(); // Start Gmail login checker (check tất cả accounts)
  startEduAccountsDailyCleanup(); // Start daily cleanup cho Edu accounts chưa login (00:00 VN time)
  logEvent('bot_started');
};

bootstrap().catch((err) => {
  logError(err);
  process.exit(1);
});

