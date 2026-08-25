/**
 * Helper hỗ trợ định dạng tin nhắn Telegram HTML & Animated Custom Emoji (<tg-emoji emoji-id="...">)
 */

export function stripHtmlTags(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/<tg-emoji\s+emoji-id="[^"]*">([\s\S]*?)<\/tg-emoji>/gi, '$1')
              .replace(/!\[([^\]]*)\]\(tg:\/\/emoji\?id=\d+\)/gi, '$1')
              .replace(/\{(?:emoji_id|emoji|id|tg_emoji):\d+\}/gi, '')
              .replace(/<[^>]*>/g, '')
              .trim();
}

export function cleanReplyKeyboard(replyMarkup) {
    if (!replyMarkup || !replyMarkup.keyboard || !Array.isArray(replyMarkup.keyboard)) {
        return replyMarkup;
    }
    const cleanKeyboard = replyMarkup.keyboard.map(row => {
        if (!Array.isArray(row)) return row;
        return row.map(btn => {
            if (typeof btn === 'string') {
                return { text: stripHtmlTags(btn) };
            } else if (btn && typeof btn === 'object' && typeof btn.text === 'string') {
                return { ...btn, text: stripHtmlTags(btn.text) };
            }
            return btn;
        });
    });
    return { ...replyMarkup, keyboard: cleanKeyboard };
}

export function markdownToTelegramHtml(text) {
    if (!text || typeof text !== 'string') return text;

    let html = text;

    // 1. Xử lý định dạng copy từ Telegram Desktop: ![🛒](tg://emoji?id=5854776233950187351)
    html = html.replace(/!\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/gi, '<tg-emoji emoji-id="$2">$1</tg-emoji>');

    // 2. Xử lý cú pháp rút gọn: {id:5420323339723881652} hoặc {emoji_id:5420323339723881652}
    html = html.replace(/\{(?:emoji_id|emoji|id|tg_emoji):(\d+)\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');

    // 3. Tự động giữ nguyên các thẻ HTML chuẩn của Telegram và <tg-emoji ...>
    const htmlPlaceholders = [];
    const tagRegex = /<(tg-emoji|b|i|u|s|code|pre|a)(\s+[^>]*)?>[\s\S]*?<\/\1>/gi;
    
    html = html.replace(tagRegex, (match) => {
        const idx = htmlPlaceholders.length;
        htmlPlaceholders.push(match);
        return `@@TG_TAG_HOLDER_${idx}@@`;
    });

    // Escape các ký tự HTML đặc biệt độc lập
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Chuyển đổi cú pháp Markdown phổ biến sang Telegram HTML
    // Bold: **text** hoặc __text__
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/__(.*?)__/g, '<b>$1</b>');
    
    // Inline Code: `text`
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Link: [label](url) (trừ tg://emoji)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Khôi phục các thẻ HTML và <tg-emoji>
    htmlPlaceholders.forEach((tag, idx) => {
        html = html.replace(`@@TG_TAG_HOLDER_${idx}@@`, tag);
    });

    return html;
}

/**
 * Tự động gắn interceptor chuẩn hóa sendMessage & sendPhoto cho Bot Telegram
 */
export function installTelegramFormatHelper(bot) {
    if (!bot || bot._telegramFormatHelperInstalled) return;
    bot._telegramFormatHelperInstalled = true;

    const originalSendMessage = bot.sendMessage.bind(bot);
    bot.sendMessage = function (chatId, text, options = {}) {
        let newOptions = { ...options };
        if (newOptions.reply_markup) {
            newOptions.reply_markup = cleanReplyKeyboard(newOptions.reply_markup);
        }

        if (typeof text === 'string') {
            const formattedText = markdownToTelegramHtml(text);
            newOptions.parse_mode = 'HTML';
            return originalSendMessage(chatId, formattedText, newOptions);
        }
        return originalSendMessage(chatId, text, newOptions);
    };

    const originalSendPhoto = bot.sendPhoto.bind(bot);
    bot.sendPhoto = function (chatId, photo, options = {}, fileOptions = {}) {
        let newOptions = { ...options };
        if (newOptions.reply_markup) {
            newOptions.reply_markup = cleanReplyKeyboard(newOptions.reply_markup);
        }

        if (typeof newOptions.caption === 'string') {
            newOptions.caption = markdownToTelegramHtml(newOptions.caption);
            newOptions.parse_mode = 'HTML';
        }
        return originalSendPhoto(chatId, photo, newOptions, fileOptions);
    };
}
