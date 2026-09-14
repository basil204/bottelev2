import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { initDb, query, closeDb } from './includes/database/index.js';
import { registerListeners } from './includes/listen.js';
import { startAutoDepositWatcher, startQrExpirationChecker } from './includes/services/autoDeposit.js';
import { startAutoRestockScheduler } from './includes/services/autoRestockService.js';
import { startDriveBackupCron } from './includes/services/driveBackupService.js';
import { startBinanceWatcher } from './includes/services/binanceWatcher.js';

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

  // Đặt Menu Button về mặc định (loại bỏ nút WebApp xanh ở khung chat Telegram)
  try {
    await bot.setChatMenuButton({
      menu_button: { type: 'default' }
    });
    console.log('✅ Reset Telegram Chat Menu Button to default');
  } catch (menuErr) {
    console.error('⚠️ Could not reset chat menu button:', menuErr.message);
  }

  await bot.setMyCommands([
    { command: 'start', description: 'Khởi động và xem menu chính' },
    { command: 'products', description: '🛍️ Danh sách sản phẩm' },
    { command: 'wallet', description: '👛 Ví & Số dư tài khoản' },
    { command: 'api', description: '🔗 Kết nối API tự động' },
    { command: 'warranty', description: '🛡️ Bảo hành đơn hàng' },
    { command: 'support', description: '💬 Hỗ trợ khách hàng' },
    { command: 'history', description: '🧾 Lịch sử đơn hàng' },
    { command: 'lang', description: '🌐 Đổi ngôn ngữ' }
  ]).catch((error) => console.error('⚠️ Không thể cập nhật danh sách lệnh:', error.message));
  startQrExpirationChecker(bot); // Always start QR expiration checker
  startAutoDepositWatcher(bot, config);
  startAutoRestockScheduler(bot); // Khởi động hẹn giờ thông báo kho ảo (Auto Restock)
  startDriveBackupCron(); // Khởi động tự động sao lưu dữ liệu CSDL lên Google Drive
  startBinanceWatcher(bot, config); // Khởi động tự động quét giao dịch nạp tiền Binance Pay

};

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

