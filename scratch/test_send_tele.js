import TelegramBot from 'node-telegram-bot-api';
import { query, initDb } from '../includes/database/index.js';
import { config } from '../config.js';
import { installTelegramFormatHelper } from '../includes/helpers/telegramFormatHelper.js';

const runTest = async () => {
    await initDb(config);
    let botToken = config.TELEGRAM_BOT_TOKEN;
    try {
        const rows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token'");
        if (rows && rows.length > 0 && rows[0].value) botToken = rows[0].value;
    } catch (e) {}

    if (!botToken) {
        console.error('❌ Missing TELEGRAM_BOT_TOKEN');
        process.exit(1);
    }

    const bot = new TelegramBot(botToken);
    installTelegramFormatHelper(bot);

    let targetChatId = process.argv[2];
    if (!targetChatId && config.ADMIN_IDS && config.ADMIN_IDS.length > 0) {
        targetChatId = config.ADMIN_IDS[0];
    }
    if (!targetChatId) {
        const users = await query('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL ORDER BY id DESC LIMIT 1');
        if (users && users.length > 0) targetChatId = users[0].telegram_id;
    }

    if (!targetChatId) {
        console.error('❌ Vui lòng truyền Telegram ID làm tham số: node scratch/test_send_tele.js <TELEGRAM_ID>');
        process.exit(1);
    }

    console.log(`🚀 Testing auto-extracted icon_custom_emoji_id on InlineKeyboardButton to Telegram ID: ${targetChatId}...`);

    const text = `<tg-emoji emoji-id="5312361253610475399">🛒</tg-emoji> <b>HỆ THỐNG MUA HÀNG</b>\nVui lòng chọn danh mục bên dưới:`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "<tg-emoji emoji-id=\"5312361253610475399\">🛒</tg-emoji> Mua ngay",
                        callback_data: "buy"
                    }
                ]
            ]
        }
    };

    const sent = await bot.sendMessage(targetChatId, text, { parse_mode: 'HTML', ...keyboard });

    console.log('✅ Gửi thành công nút bấm tự động trích xuất icon_custom_emoji_id! Message ID:', sent.message_id);
    process.exit(0);
};

runTest().catch(err => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
});
