import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { initDb } from './includes/database/index.js';
import { registerListeners } from './includes/listen.js';
import { startAutoDepositWatcher, startQrExpirationChecker } from './includes/services/autoDeposit.js';


import { config } from './config.js';

if (!config.TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bootstrap = async () => {
  await initDb(config);

  const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });

  // Lấy bot info để có username
  try {
    const botInfo = await bot.getMe();
    config.BOT_USERNAME = botInfo.username;
    console.log(`✅ Bot started: @${botInfo.username}`);
  } catch (error) {
    console.error('⚠️  Could not get bot info:', error.message);
  }

  registerListeners(bot, config);
  startQrExpirationChecker(bot); // Always start QR expiration checker
  startAutoDepositWatcher(bot, config);

};

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

