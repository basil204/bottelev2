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
        console.error('❌ Vui lòng truyền Telegram ID làm tham số');
        process.exit(1);
    }

    console.log(`🚀 Thử nghiệm đầy đủ các loại nút InlineKeyboardButton (Telegram Bot API Spec)...`);

    const text = `<tg-emoji emoji-id="5312361253610475399">🛒</tg-emoji> <b>DEMO TẤT CẢ CÁC LOẠI NÚT INLINE KEYBOARD</b>\n\n` +
                        `• Tất cả các nút bấm bên dưới đều được truyền <code>icon_custom_emoji_id</code> chuẩn của Telegram Bot API!`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "🛒 Mua ngay (Callback Data)",
                        callback_data: "buy_now",
                        icon_custom_emoji_id: "5312361253610475399"
                    }
                ],
                [
                    {
                        text: "🔗 Nút Mở Link (URL)",
                        url: "https://cp-admin.manhit.dev",
                        icon_custom_emoji_id: "5312361253610475399"
                    }
                ],
                [
                    {
                        text: "📋 Copy Mã Giảm Giá (Copy Text)",
                        copy_text: { text: "DISCOUNT2026" },
                        icon_custom_emoji_id: "5312361253610475399"
                    }
                ]
            ]
        }
    };

    console.log('📦 JSON Payload gửi sang Telegram Bot API:');
    console.log(JSON.stringify(keyboard, null, 2));

    const sent = await bot.sendMessage(targetChatId, text, { parse_mode: 'HTML', ...keyboard });

    console.log('✅ Gửi tin nhắn chứa InlineKeyboardButton thành công! Message ID:', sent.message_id);
    process.exit(0);
};

runTest().catch(err => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
});
