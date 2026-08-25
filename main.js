import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { initDb, query, closeDb } from './includes/database/index.js';
import { registerListeners } from './includes/listen.js';
import { startAutoDepositWatcher, startQrExpirationChecker } from './includes/services/autoDeposit.js';
import { startGmailCleanup } from './includes/services/gmailCleanup.js';

import { config } from './config.js';
import { installTelegramFormatHelper } from './includes/helpers/telegramFormatHelper.js';

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
  installTelegramFormatHelper(bot);

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

  // Cài đặt nút Chat Menu Button (Nút xanh WebApp "🛒 Sản phẩm" bên cạnh khung chat Telegram)
  try {
    let miniAppUrl = config.MINI_APP_URL || 'https://cp-admin.manhit.dev/miniapp/capcut';
    const { query } = await import('./includes/database/index.js');
    const dbAppUrl = await query("SELECT `value` FROM settings WHERE `key` = 'mini_app_url'");
    if (dbAppUrl && dbAppUrl.length > 0 && dbAppUrl[0].value) {
      miniAppUrl = dbAppUrl[0].value;
    }
    if (miniAppUrl) {
      await bot.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: '🛒 Sản phẩm',
          web_app: { url: miniAppUrl }
        }
      });
      console.log('✅ Updated Telegram Chat Menu Button ("🛒 Sản phẩm") to:', miniAppUrl);
    }
  } catch (menuErr) {
    console.error('⚠️ Could not set chat menu button:', menuErr.message);
  }

  await bot.setMyCommands([
    { command: 'start', description: 'Khởi động và xem hướng dẫn' },
    { command: 'menu', description: 'Mở menu chính' },
    { command: 'info', description: 'Xem tài khoản và số dư' },
    { command: 'gmail', description: 'Mua Gmail EDU' },
    { command: 'buymail', description: 'Mua Gmail EDU nhanh theo số lượng' },
    { command: 'history', description: 'Lịch sử mua hôm nay' },
    { command: 'getlink', description: 'Tải video, ảnh hoặc audio' },
    { command: 'checklive', description: 'Kiểm tra tài khoản mạng xã hội' },
    { command: 'lang', description: 'Đổi ngôn ngữ' }
  ]).catch((error) => console.error('⚠️ Không thể cập nhật danh sách lệnh:', error.message));
  startQrExpirationChecker(bot); // Always start QR expiration checker
  startAutoDepositWatcher(bot, config);
  startGmailCleanup(5, 5); // Check login và cleanup mỗi 5 phút

};

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

