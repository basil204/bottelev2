import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { initDb, query, closeDb } from './includes/database/index.js';
import { registerListeners } from './includes/listen.js';
import { startAutoDepositWatcher, startQrExpirationChecker } from './includes/services/autoDeposit.js';
import { startGmailCleanup } from './includes/services/gmailCleanup.js';

import { config } from './config.js';

const bootstrap = async () => {
  // Initialize DB first
  await initDb(config);

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

  const shutdown = async () => {
    await bot.stopPolling().catch(() => {});
    await closeDb().catch(() => {});
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.once('SIGUSR2', shutdown);

  // Lấy bot info để có username
  try {
    const botInfo = await bot.getMe();
    config.BOT_USERNAME = botInfo.username;
    console.log(`✅ Bot started: @${botInfo.username}`);
    try {
      const { query } = await import('./includes/database/index.js');
      await query("INSERT INTO settings (`key`, `value`) VALUES ('bot_username', ?) ON DUPLICATE KEY UPDATE `value` = ?", [botInfo.username, botInfo.username]);
    } catch (dbErr) {
      console.error('⚠️ Could not save bot_username to DB:', dbErr.message);
    }
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

