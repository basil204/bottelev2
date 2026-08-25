import TelegramBot from 'node-telegram-bot-api';
import { query, initDb } from '../includes/database/index.js';
import { config } from '../config.js';

const test = async () => {
  await initDb(config);
  let botToken = config.TELEGRAM_BOT_TOKEN;
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token'");
    if (rows && rows.length > 0 && rows[0].value) botToken = rows[0].value;
  } catch (e) {}

  const bot = new TelegramBot(botToken);
  
  let webAppUrl = 'https://cp-admin.manhit.dev/miniapp/capcut';
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'mini_app_url'");
    if (rows && rows.length > 0 && rows[0].value) webAppUrl = rows[0].value;
  } catch (e) {}

  console.log('Setting Chat Menu Button with URL:', webAppUrl);

  try {
    await bot.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '🛒 Sản phẩm',
        web_app: { url: webAppUrl }
      }
    });
    console.log('✅ setChatMenuButton success!');
  } catch (e) {
    console.error('❌ Error setting menu button:', e.message);
  }
  process.exit(0);
};

test();
