import TelegramBot from 'node-telegram-bot-api';
import { query, initDb } from '../includes/database/index.js';
import { config } from '../config.js';
import { installTelegramFormatHelper } from '../includes/helpers/telegramFormatHelper.js';

const test = async () => {
  await initDb(config);
  let botToken = config.TELEGRAM_BOT_TOKEN;
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token'");
    if (rows && rows.length > 0 && rows[0].value) botToken = rows[0].value;
  } catch (e) {}

  const bot = new TelegramBot(botToken);
  installTelegramFormatHelper(bot);
  
  let webAppUrl = 'https://cp-admin.manhit.dev/miniapp/capcut';
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'mini_app_url'");
    if (rows && rows.length > 0 && rows[0].value) webAppUrl = rows[0].value;
  } catch (e) {}

  let targetChatId = process.argv[2];
  if (!targetChatId && config.ADMIN_IDS && config.ADMIN_IDS.length > 0) {
    targetChatId = config.ADMIN_IDS[0];
  }
  if (!targetChatId) {
    const users = await query('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL ORDER BY id DESC LIMIT 1');
    if (users && users.length > 0) targetChatId = users[0].telegram_id;
  }

  console.log('1. Setting Chat Menu Button with URL:', webAppUrl);
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

  if (targetChatId) {
    console.log(`2. Sending WebApp test button message to Telegram ID: ${targetChatId}...`);
    const sent = await bot.sendMessage(
      targetChatId,
      '🛒 **HỆ THỐNG SẢN PHẨM WEBAPP**\n\nBấm nút xanh bên dưới để trải nghiệm giao diện MiniApp mua hàng!',
      {
        reply_markup: {
          keyboard: [
            [{ text: '🛒 Sản phẩm', web_app: { url: webAppUrl } }]
          ],
          resize_keyboard: true
        }
      }
    );
    console.log('✅ Sent WebApp button message successfully! Message ID:', sent.message_id);
  }

  process.exit(0);
};

test();
