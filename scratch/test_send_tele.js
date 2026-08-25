import TelegramBot from 'node-telegram-bot-api';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { installTelegramFormatHelper } from '../includes/helpers/telegramFormatHelper.js';

dotenv.config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '103.139.155.175',
        user: process.env.DB_USER || 'testv1',
        password: process.env.DB_PASSWORD || process.env.DB_PASS || 'skeLdYCEGkFESpdZ',
        database: process.env.DB_NAME || 'testv1',
        port: Number(process.env.DB_PORT) || 3306
    });

    const [rows] = await connection.query("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token'");
    let token = process.env.TELEGRAM_BOT_TOKEN;
    if (rows && rows.length > 0 && rows[0].value) {
        token = rows[0].value;
    }

    if (!token) {
        console.error('❌ Không tìm thấy TELEGRAM_BOT_TOKEN!');
        process.exit(1);
    }

    console.log('✅ Đang gửi tin nhắn test tới Telegram ID: 8202830305...');

    const bot = new TelegramBot(token, { polling: false });
    installTelegramFormatHelper(bot);

    const testMessage = `🎉 **XÁC NHẬN TEST EMOJI THÔ tg://emoji?id=5420323339723881652**

tg://emoji?id=5420323339723881652 **DANH MỤC MUA HÀNG GMAIL EDU**

![🔥](tg://emoji?id=5420323339723881652) **Đã hỗ trợ link thô tg://emoji?id=NUM trực tiếp!**`;

    try {
        const res = await bot.sendMessage(8202830305, testMessage, {
            reply_markup: {
                keyboard: [
                    [{ text: 'tg://emoji?id=5420323339723881652 🛒 Mua Gmail EDU' }],
                    [{ text: '↩️ Menu chính' }]
                ],
                resize_keyboard: true
            }
        });
        console.log('✅ Gửi tin nhắn thành công tới Telegram ID 8202830305! Message ID:', res.message_id);
    } catch (err) {
        console.error('❌ Lỗi khi gửi tin nhắn Telegram:', err.message);
    } finally {
        await connection.end();
    }
}

run();
