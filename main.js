import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { initDb, query } from './includes/database/index.js';
import { registerListeners } from './includes/listen.js';
import { startAutoDepositWatcher, startQrExpirationChecker } from './includes/services/autoDeposit.js';
import { startGmailCleanup } from './includes/services/gmailCleanup.js';

import { config } from './config.js';

const bootstrap = async () => {
  // Initialize DB first
  await initDb(config);

  // Auto-migrate database schema
  try {
    const { default: migrate } = await import('./scripts/migration_add_columns.js');
    await migrate();
  } catch (error) {
    console.error('❌ Auto-migration failed:', error);
  }

  // Get token from DB, fallback to config/env
  let botToken = config.TELEGRAM_BOT_TOKEN;
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token'");
    if (rows && rows.length > 0 && rows[0].value) {
      botToken = rows[0].value;
      console.log('✅ Using Telegram token from database');
    } else {
      console.log('ℹ️ Using Telegram token from config/env');
    }
  } catch (err) {
    console.log('⚠️ Could not read token from DB, using config/env');
  }

  if (!botToken) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN');
    process.exit(1);
  }

  const bot = new TelegramBot(botToken, { polling: true });

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
  startGmailCleanup(5, 5); // Check login và cleanup mỗi 5 phút

};

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

