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
        console.error('❌ Vui lòng truyền Telegram ID');
        process.exit(1);
    }

    console.log(`🚀 Đang gửi Menu Nạp Tiền & Mua Hàng Inline nút Emoji động tới Telegram ID: ${targetChatId}...`);

    const text = `<tg-emoji emoji-id="5312361253610475399">🛒</tg-emoji> <b>HỆ THỐNG MUA HÀNG & NẠP TIỀN TỰ ĐỘNG</b>\n\n` +
                 `Vui lòng chọn nút bên dưới (Chuẩn Inline Keyboard, không dùng MiniApp):`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: '{id:5312361253610475399} Nạp Tiền',
                        callback_data: 'deposit'
                    },
                    {
                        text: '{id:5312361253610475399} Sản Phẩm / Mua Hàng',
                        callback_data: 'buy_now'
                    }
                ]
            ]
        }
    };

    const sent = await bot.sendMessage(targetChatId, text, { parse_mode: 'HTML', ...keyboard });

    console.log('✅ Gửi thành công nút Nạp tiền & Sản phẩm chứa icon_custom_emoji_id! Message ID:', sent.message_id);
    process.exit(0);
};

runTest().catch(err => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
});
