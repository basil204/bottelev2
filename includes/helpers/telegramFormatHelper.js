/**
 * Helper hỗ trợ định dạng tin nhắn Telegram HTML & Animated Custom Emoji (<tg-emoji emoji-id="...">)
 */

export function markdownToTelegramHtml(text) {
    if (!text || typeof text !== 'string') return text;

    let html = text;

    // Tự động xử lý nếu người dùng gõ cú pháp rút gọn kiểu: {emoji_id:5420323339723881652} ⚠️
    html = html.replace(/\{emoji_id:(\d+)\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');

    // Tự động giữ nguyên các thẻ HTML chuẩn của Telegram và <tg-emoji ...>
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
    
    // Link: [label](url)
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
        if (typeof text === 'string') {
            const formattedText = markdownToTelegramHtml(text);
            const newOptions = { parse_mode: 'HTML', ...options };
            return originalSendMessage(chatId, formattedText, newOptions);
        }
        return originalSendMessage(chatId, text, options);
    };

    const originalSendPhoto = bot.sendPhoto.bind(bot);
    bot.sendPhoto = function (chatId, photo, options = {}, fileOptions = {}) {
        if (options && typeof options.caption === 'string') {
            options = {
                ...options,
                caption: markdownToTelegramHtml(options.caption),
                parse_mode: 'HTML'
            };
        }
        return originalSendPhoto(chatId, photo, options, fileOptions);
    };
}
