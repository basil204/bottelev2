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

import { config, parseBotTokens } from './config.js';
import { installTelegramFormatHelper } from './includes/helpers/telegramFormatHelper.js';
import { createMultiBotProxy } from './includes/helpers/multiBotHelper.js';

export { createMultiBotProxy };

const BOT_COMMANDS = [
  { command: 'start', description: 'Khởi động và xem menu chính' },
  { command: 'products', description: '🛍️ Danh sách sản phẩm' },
  { command: 'wallet', description: '👛 Ví & Số dư tài khoản' },
  { command: 'api', description: '🔗 Kết nối API tự động' },
  { command: 'warranty', description: '🛡️ Bảo hành đơn hàng' },
  { command: 'support', description: '💬 Hỗ trợ khách hàng' },
  { command: 'history', description: '🧾 Lịch sử đơn hàng' },
  { command: 'lang', description: '🌐 Đổi ngôn ngữ' },
  { command: 'id', description: '🆔 Lấy UID người dùng, ID nhóm (Box) & Kênh' },
  { command: 'uid', description: '🆔 Lấy UID người dùng, ID nhóm (Box) & Kênh' }
];

const botHolder = { bots: [] };
let currentTokens = [];
let isReloading = false;

export const startBotsForTokens = async (tokens) => {
  if (isReloading) return;
  isReloading = true;

  try {
    const areEqual =
      currentTokens.length === tokens.length &&
      currentTokens.every((t, i) => t === tokens[i]);

    if (areEqual && botHolder.bots.length > 0) {
      return;
    }

    console.log(`\n======================================================`);
    console.log(`🚀 [BOT_MANAGER] Khởi chạy ${tokens.length} Telegram Bot instance(s)...`);
    console.log(`======================================================`);

    // Dừng các bot cũ nếu đang chạy
    if (botHolder.bots.length > 0) {
      console.log('🛑 Đang dừng polling các bot phiên bản cũ...');
      await Promise.allSettled(botHolder.bots.map((b) => b.stopPolling().catch(() => {})));
      botHolder.bots = [];
    }

    const newBots = [];
    const botUsernames = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      try {
        const bot = new TelegramBot(token, { polling: true });
        installTelegramFormatHelper(bot);

        try {
          const botInfo = await bot.getMe();
          bot.username = botInfo.username;
          botUsernames.push(botInfo.username);
          console.log(`✅ [Bot #${i + 1}] Đã kết nối thành công: @${botInfo.username}`);
        } catch (infoErr) {
          console.warn(`⚠️ [Bot #${i + 1}] Không thể lấy thông tin bot info:`, infoErr.message);
        }

        registerListeners(bot, config);

        try {
          await bot.setChatMenuButton({ menu_button: { type: 'default' } });
        } catch (menuErr) {
          // Ignored
        }

        try {
          await bot.setMyCommands(BOT_COMMANDS);
        } catch (cmdErr) {
          console.warn(`⚠️ [Bot #${i + 1}] Không thể cập nhật danh sách lệnh:`, cmdErr.message);
        }

        newBots.push(bot);
      } catch (err) {
        console.error(`❌ Khởi tạo Bot #${i + 1} thất bại:`, err.message);
      }
    }

    if (newBots.length === 0) {
      console.error('❌ Không thể khởi chạy bất kỳ Telegram Bot nào từ danh sách token!');
      return;
    }

    botHolder.bots = newBots;
    currentTokens = [...tokens];

    if (botUsernames.length > 0) {
      config.BOT_USERNAME = botUsernames[0];
      config.BOT_USERNAMES = botUsernames;
      try {
        await query(
          "INSERT INTO settings (`key`, `value`) VALUES ('bot_username', ?) ON DUPLICATE KEY UPDATE `value` = ?",
          [botUsernames.join(', '), botUsernames.join(', ')]
        );
      } catch (dbErr) {
        console.error('⚠️ Could not save bot_username to DB:', dbErr.message);
      }
    }

    console.log(`🎉 [BOT_MANAGER] Đang chạy song song ${newBots.length} bot: ${botUsernames.map(u => '@' + u).join(', ')}\n`);
  } finally {
    isReloading = false;
  }
};

const bootstrap = async () => {
  // Initialize DB first
  await initDb(config);

  // Get tokens from DB, fallback to config/env
  let rawTokens = config.TELEGRAM_BOT_TOKENS?.length ? config.TELEGRAM_BOT_TOKENS : config.TELEGRAM_BOT_TOKEN;
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token'");
    if (rows && rows.length > 0 && rows[0].value) {
      rawTokens = rows[0].value;
      console.log('✅ Using Telegram token(s) from database');
    } else {
      console.log('ℹ️ Using Telegram token(s) from config/env');
    }
  } catch (err) {
    console.log('⚠️ Could not read token from DB, using config/env');
  }

  const tokens = parseBotTokens(rawTokens);
  if (tokens.length === 0 && config.TELEGRAM_BOT_TOKENS?.length) {
    tokens.push(...config.TELEGRAM_BOT_TOKENS);
  }

  if (tokens.length === 0) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_TOKENS');
    process.exit(1);
  }

  await startBotsForTokens(tokens);

  if (botHolder.bots.length === 0) {
    console.error('❌ Could not start any Telegram Bot instance. Exiting...');
    process.exit(1);
  }

  const multiBot = createMultiBotProxy(botHolder);

  const shutdown = async () => {
    console.log('🛑 Stopping all Telegram bot polling...');
    await Promise.allSettled(botHolder.bots.map((b) => b.stopPolling().catch(() => {})));
    await closeDb().catch(() => {});
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.once('SIGUSR2', shutdown);

  startQrExpirationChecker(multiBot); // Always start QR expiration checker
  startAutoDepositWatcher(multiBot, config);
  startAutoRestockScheduler(multiBot); // Khởi động hẹn giờ thông báo kho ảo (Auto Restock)
  startDriveBackupCron(); // Khởi động tự động sao lưu dữ liệu CSDL lên Google Drive
  startBinanceWatcher(multiBot, config); // Khởi động tự động quét giao dịch nạp tiền Binance Pay

  // Theo dõi tín hiệu khởi động lại (Restart Signal) và thay đổi Token
  let lastRestartSignal = '';
  try {
    const initSignalRows = await query("SELECT `value` FROM settings WHERE `key` = 'bot_restart_signal' LIMIT 1");
    if (initSignalRows && initSignalRows.length > 0) {
      lastRestartSignal = initSignalRows[0].value || '';
    }
  } catch (_) {}

  // Tự động kiểm tra tín hiệu Restart và cập nhật token trong database định kỳ mỗi 3 giây
  // Khi Admin bấm nút "RESTART / CẬP NHẬT BOT" hoặc thêm/sửa Token trên Web Admin, bot sẽ tự động reload ngay lập tức
  setInterval(async () => {
    try {
      // 1. Kiểm tra tín hiệu restart cưỡng bức từ Web Admin
      const signalRows = await query("SELECT `value` FROM settings WHERE `key` = 'bot_restart_signal' LIMIT 1");
      const currentSignal = signalRows?.[0]?.value || '';
      const isManualRestartTriggered = currentSignal && currentSignal !== lastRestartSignal;

      // 2. Kiểm tra thay đổi token bot trong database
      const rows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token' LIMIT 1");
      let tokenChanged = false;
      let dbTokens = [];
      if (rows && rows.length > 0 && rows[0].value) {
        dbTokens = parseBotTokens(rows[0].value);
        if (dbTokens.length > 0) {
          tokenChanged =
            dbTokens.length !== currentTokens.length ||
            dbTokens.some((t, i) => t !== currentTokens[i]);
        }
      }

      if (isManualRestartTriggered || tokenChanged) {
        lastRestartSignal = currentSignal;
        const tokensToRun = dbTokens.length > 0 ? dbTokens : currentTokens;
        console.log(`⚡ [BOT_RELOAD] ${isManualRestartTriggered ? 'Nhận lệnh Restart / Cập nhật từ Web Admin!' : 'Phát hiện thay đổi token bot trong CSDL!'} Đang tải lại ${tokensToRun.length} bot...`);
        await startBotsForTokens(tokensToRun);
      }
    } catch (pollErr) {
      // Ignored
    }
  }, 3000);
};

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
