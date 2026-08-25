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

    console.log(`🚀 Đang gửi tin nhắn test Emoji động tới Telegram ID: ${targetChatId}...`);

    const messageText = `🎉 <tg-emoji emoji-id="5854776233950187351">🛒</tg-emoji> **TEST EMOJI ĐỘNG TRONG TIN NHẮN & NÚT BẤM**\n\n` +
                        `• Cú pháp 1: <tg-emoji emoji-id="5854776233950187351">🛒</tg-emoji>\n` +
                        `• Cú pháp 2: ![🛒](tg://emoji?id=5854776233950187351)\n` +
                        `• Cú pháp 3: {id:5854776233950187351}\n\n` +
                        `Bấm vào nút bấm Inline bên dưới để kiểm tra icon động rực rỡ!`;

    const sent = await bot.sendMessage(targetChatId, messageText, {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: '![🛒](tg://emoji?id=5854776233950187351) Nút Mua Tài Khoản Động',
                        callback_data: 'test_click_1'
                    }
                ],
                [
                    {
                        text: '<tg-emoji emoji-id="5854776233950187351">🛒</tg-emoji> Mua Hàng Siêu Tốc',
                        callback_data: 'test_click_2'
                    }
                ]
            ]
        }
    });

    console.log('✅ Gửi tin nhắn test thành công! Message ID:', sent.message_id);
    process.exit(0);
};

runTest().catch(err => {
    console.error('❌ Lỗi gửi tin nhắn Telegram:', err.message);
    process.exit(1);
});
