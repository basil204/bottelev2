/**
 * Standalone Telegram Bot Demo - Tự động kết nối Database, gửi Nút Xanh Lam WebApp & Emoji Động (<tg-emoji>)
 * Chạy độc lập bằng lệnh: node bot_demo.js
 */

import TelegramBot from 'node-telegram-bot-api';
import { query, initDb } from './includes/database/index.js';
import { config } from './config.js';

const startBotDemo = async () => {
    // 1. Kết nối CSDL MySQL và lấy token & mini_app_url
    await initDb(config);
    let token = config.TELEGRAM_BOT_TOKEN;
    let webAppUrl = config.MINI_APP_URL || 'https://cp-admin.manhit.dev/miniapp/capcut';

    try {
        const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('telegram_bot_token', 'mini_app_url')");
        if (rows && rows.length > 0) {
            rows.forEach(r => {
                if (r.key === 'telegram_bot_token' && r.value) token = r.value;
                if (r.key === 'mini_app_url' && r.value) webAppUrl = r.value;
            });
        }
    } catch (e) {
        console.error('⚠️ Lỗi truy vấn Database:', e.message);
    }

    if (!token) {
        console.error('❌ Vui lòng cài đặt TELEGRAM_BOT_TOKEN trong Database hoặc config.js!');
        process.exit(1);
    }

    const bot = new TelegramBot(token, { polling: true });
    
    try {
        const botInfo = await bot.getMe();
        console.log(`🤖 Bot Demo đã kết nối Database & đang chạy: @${botInfo.username}`);
    } catch (e) {
        console.log('🤖 Bot Demo đang chạy...');
    }

    /**
     * Helper chuyển đổi cú pháp Markdown & Telegram Animated Emoji sang HTML
     */
    function formatTelegramHtml(text) {
        if (!text || typeof text !== 'string') return text;
        let html = text;

        // 1. Chuyển đổi định dạng copy Telegram Desktop: ![🛒](tg://emoji?id=5312361253610475399)
        html = html.replace(/!\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/gi, '<tg-emoji emoji-id="$2">$1</tg-emoji>');

        // 2. Chuyển đổi cú pháp rút gọn: {id:5312361253610475399}
        html = html.replace(/\{(?:emoji_id|emoji|id|tg_emoji):(\d+)\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');

        // 3. Chuyển đổi Markdown Bold: **text** -> <b>text</b>
        html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

        return html;
    }

    /**
     * Gửi tin nhắn chuẩn HTML với Custom Emoji Động & Nút Xanh WebApp
     */
    async function sendEmojiMessage(chatId, text, replyMarkup = null) {
        const formattedText = formatTelegramHtml(text);
        const options = { parse_mode: 'HTML' };
        if (replyMarkup) {
            options.reply_markup = replyMarkup;
        }
        return bot.sendMessage(chatId, formattedText, options);
    }

    // Lệnh /start hoặc /menu
    bot.onText(/\/(start|menu)/, async (msg) => {
        const chatId = msg.chat.id;

        const text = `<tg-emoji emoji-id="5312361253610475399">🛒</tg-emoji> <b>HỆ THỐNG MUA HÀNG TỰ ĐỘNG</b>\n\n` +
                     `👋 Xin chào <b>${msg.from.first_name || 'bạn'}</b>!\n` +
                     `Vui lòng chọn chức năng bên dưới hoặc bấm **Nút Xanh Lam** bên dưới để mua hàng:`;

        const replyMarkup = {
            inline_keyboard: [
                [
                    { text: '🛒 Mua Ngay', callback_data: 'buy_now' },
                    { text: '📧 Gmail EDU', callback_data: 'buy_edu' }
                ],
                [
                    { text: '🧾 Lịch Sử Đơn Hàng', callback_data: 'history' }
                ]
            ],
            keyboard: [
                [
                    {
                        text: '🛒 Sản phẩm',
                        web_app: { url: webAppUrl }
                    }
                ]
            ],
            resize_keyboard: true
        };

        await sendEmojiMessage(chatId, text, replyMarkup);
    });

    // Xử lý khi người dùng bấm vào các nút Inline Keyboard
    bot.on('callback_query', async (queryMsg) => {
        const chatId = queryMsg.message.chat.id;
        const action = queryMsg.data;

        await bot.answerCallbackQuery(queryMsg.id);

        if (action === 'buy_now') {
            const text = `<tg-emoji emoji-id="5312361253610475399">🛒</tg-emoji> <b>DANH SÁCH SẢN PHẨM</b>\n\n` +
                         `1. Tài khoản ChatGPT Plus\n` +
                         `2. Tài khoản CapCut Pro\n\n` +
                         `Vui lòng chọn sản phẩm muốn mua:`;

            const replyMarkup = {
                inline_keyboard: [
                    [{ text: '⚡ ChatGPT Plus - 50k', callback_data: 'item_chatgpt' }],
                    [{ text: '🎬 CapCut Pro - 30k', callback_data: 'item_capcut' }],
                    [{ text: '↩️ Quay lại Menu', callback_data: 'back_menu' }]
                ]
            };

            await sendEmojiMessage(chatId, text, replyMarkup);
        } else if (action === 'buy_edu') {
            const text = `📧 <b>TẠO TÀI KHOẢN GMAIL EDU</b>\n\n` +
                         `• Tên miền: <code>nttp.edu.pl</code>\n` +
                         `• Thời hạn tự xóa: 1 giờ sau khi tạo\n\n` +
                         `Bấm nút xác nhận bên dưới để khởi tạo:`;

            const replyMarkup = {
                inline_keyboard: [
                    [{ text: '✅ Tạo Gmail EDU Ngay', callback_data: 'create_edu_confirm' }],
                    [{ text: '↩️ Quay lại Menu', callback_data: 'back_menu' }]
                ]
            };

            await sendEmojiMessage(chatId, text, replyMarkup);
        } else if (action === 'back_menu') {
            const text = `<tg-emoji emoji-id="5312361253610475399">🛒</tg-emoji> <b>HỆ THỐNG MUA HÀNG TỰ ĐỘNG</b>\n\nVui lòng chọn chức năng:`;
            const replyMarkup = {
                inline_keyboard: [
                    [
                        { text: '🛒 Mua Ngay', callback_data: 'buy_now' },
                        { text: '📧 Gmail EDU', callback_data: 'buy_edu' }
                    ]
                ]
            };
            await sendEmojiMessage(chatId, text, replyMarkup);
        } else {
            await bot.sendMessage(chatId, `✅ Bạn vừa bấm nút: <b>${action}</b>`, { parse_mode: 'HTML' });
        }
    });
};

startBotDemo().catch(err => {
    console.error('❌ Lỗi khởi chạy Bot Demo:', err.message);
});
