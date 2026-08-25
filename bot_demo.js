/**
 * Standalone Telegram Bot Demo - Tự động kết nối Database, gửi Nút Bàn Phím KeyboardButton & InlineKeyboardButton với icon_custom_emoji_id
 * Theo chuẩn Telegram Bot API Spec: https://core.telegram.org/bots/api#keyboardbutton
 * Chạy độc lập bằng lệnh: node bot_demo.js
 */

import TelegramBot from 'node-telegram-bot-api';
import { query, initDb } from './includes/database/index.js';
import { config } from './config.js';
import { installTelegramFormatHelper } from './includes/helpers/telegramFormatHelper.js';

const startBotDemo = async () => {
    // 1. Kết nối CSDL MySQL và lấy token
    await initDb(config);
    let token = config.TELEGRAM_BOT_TOKEN;

    try {
        const rows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token'");
        if (rows && rows.length > 0 && rows[0].value) token = rows[0].value;
    } catch (e) {
        console.error('⚠️ Lỗi truy vấn Database:', e.message);
    }

    if (!token) {
        console.error('❌ Vui lòng cài đặt TELEGRAM_BOT_TOKEN trong Database hoặc config.js!');
        process.exit(1);
    }

    const bot = new TelegramBot(token, { polling: true });
    installTelegramFormatHelper(bot);

    try {
        const botInfo = await bot.getMe();
        console.log(`🤖 Bot Demo đang chạy: @${botInfo.username}`);
    } catch (e) {
        console.log('🤖 Bot Demo đang chạy...');
    }

    // Lệnh /start hoặc /menu
    bot.onText(/\/(start|menu)/, async (msg) => {
        const chatId = msg.chat.id;

        const text = `<tg-emoji emoji-id="5312361253610475399">🛒</tg-emoji> <b>HỆ THỐNG BOT TỰ ĐỘNG</b>\n\n` +
            `👋 Xin chào <b>${msg.from.first_name || 'bạn'}</b>!\n` +
            `Cả Nút Bàn Phím Dưới (KeyboardButton) và Nút Inline đều đính kèm icon_custom_emoji_id theo chuẩn Telegram Bot API Spec:`;

        const replyMarkup = {
            // Nút bấm tin nhắn (InlineKeyboardButton)
            inline_keyboard: [
                [
                    {
                        text: '{id:5312361253610475399} Mua Ngay',
                        callback_data: 'buy_now'
                    },
                    {
                        text: '{id:5312361253610475399} Gmail EDU',
                        callback_data: 'buy_edu'
                    }
                ],
                [
                    {
                        text: '{id:5312361253610475399} Lịch Sử Đơn Hàng',
                        callback_data: 'history'
                    }
                ]
            ],
            // Nút bấm bàn phím dưới khung chat (KeyboardButton) với icon_custom_emoji_id
            keyboard: [
                [
                    {
                        text: 'Nạp tiền',
                        icon_custom_emoji_id: '5312361253610475399'
                    },
                    {
                        text: '{id:5312361253610475399} Sản phẩm'
                    }
                ]
            ],
            resize_keyboard: true
        };

        await bot.sendMessage(chatId, text, { reply_markup: replyMarkup });
    });

    // Xử lý khi người dùng bấm vào các nút Inline Keyboard
    bot.on('callback_query', async (queryMsg) => {
        const chatId = queryMsg.message.chat.id;
        const action = queryMsg.data;

        try {
            await bot.answerCallbackQuery(queryMsg.id);
        } catch (e) {}

        if (action === 'buy_now') {
            const text = `<tg-emoji emoji-id="5312361253610475399">🛒</tg-emoji> <b>DANH SÁCH SẢN PHẨM KHẢ DỤNG</b>\n\n` +
                `1. ⚡ Tài khoản ChatGPT Plus\n` +
                `2. 🎬 Tài khoản CapCut Pro\n\n` +
                `Vui lòng chọn loại sản phẩm bạn muốn mua:`;

            const replyMarkup = {
                inline_keyboard: [
                    [{ text: '{id:5312361253610475399} ChatGPT Plus - 50k', callback_data: 'item_chatgpt' }],
                    [{ text: '{id:5312361253610475399} CapCut Pro - 30k', callback_data: 'item_capcut' }],
                    [{ text: '↩️ Quay lại Menu', callback_data: 'back_menu' }]
                ]
            };

            await bot.sendMessage(chatId, text, { reply_markup: replyMarkup });
        } else if (action === 'buy_edu') {
            const text = `📧 <b>TẠO TÀI KHOẢN GMAIL EDU</b>\n\n` +
                `• Tên miền: <code>nttp.edu.pl</code>\n` +
                `• Thời hạn tự xóa: 1 giờ sau khi tạo\n\n` +
                `Bấm nút bên dưới để tiến hành khởi tạo:`;

            const replyMarkup = {
                inline_keyboard: [
                    [{ text: '{id:5312361253610475399} Tạo Gmail EDU Ngay', callback_data: 'create_edu_confirm' }],
                    [{ text: '↩️ Quay lại Menu', callback_data: 'back_menu' }]
                ]
            };

            await bot.sendMessage(chatId, text, { reply_markup: replyMarkup });
        } else if (action === 'back_menu') {
            const text = `<tg-emoji emoji-id="5312361253610475399">🛒</tg-emoji> <b>HỆ THỐNG MUA HÀNG TỰ ĐỘNG</b>\n\nVui lòng chọn chức năng:`;
            const replyMarkup = {
                inline_keyboard: [
                    [
                        {
                            text: '{id:5312361253610475399} Sản phẩm',
                            callback_data: 'buy_now'
                        }
                    ],
                    [
                        {
                            text: '{id:5312361253610475399} Mua Gmail EDU',
                            callback_data: 'buy_edu'
                        }
                    ]
                ]
            };
            await bot.sendMessage(chatId, text, { reply_markup: replyMarkup });
        } else {
            await bot.sendMessage(chatId, `✅ Bạn vừa bấm nút: <b>${action}</b>`, { parse_mode: 'HTML' });
        }
    });
};

startBotDemo().catch(err => {
    console.error('❌ Lỗi khởi chạy Bot Demo:', err.message);
});
