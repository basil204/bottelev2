/**
 * Helper hỗ trợ định dạng tin nhắn Telegram HTML & Animated Custom Emoji (<tg-emoji emoji-id="...">)
 */

export function markdownToTelegramHtml(text) {
    if (!text || typeof text !== 'string') return text;

    let html = text;

    // Tự động chuyển đổi cú pháp Telegram Custom Emoji Markdown: ![⚠️](tg://emoji?id=5420323339723881652) hoặc [⚠️](tg://emoji?id=5420323339723881652)
    html = html.replace(/!?\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/gi, (match, fallbackChar, emojiId) => {
        const char = fallbackChar.trim() || '⚠️';
        return `<tg-emoji emoji-id="${emojiId}">${char}</tg-emoji>`;
    });

    // Tự động xử lý cú pháp rút gọn cho Emoji động: {id:5420323339723881652} hoặc {emoji_id:5420323339723881652}
    html = html.replace(/\{(?:emoji_id|emoji|id|tg_emoji):(\d+)\}/gi, '<tg-emoji emoji-id="$1">⚠️</tg-emoji>');

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

export function cleanButtonText(text) {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    // Chuyển đổi cú pháp Telegram Markdown Emoji ![⚠️](tg://emoji?id=...) cho Nút bấm Telegram
    result = result.replace(/!?\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/gi, '$1 ');
    // Chuyển đổi cú pháp {emoji_id:...} thành icon ⚠️ cho Nút bấm Telegram
    result = result.replace(/\{(?:emoji_id|emoji|id|tg_emoji):(\d+)\}/gi, '⚠️ ');
    // Lấy ký tự emoji dự phòng từ thẻ <tg-emoji>
    result = result.replace(/<tg-emoji\s+emoji-id="[^"]*">([\s\S]*?)<\/tg-emoji>/gi, '$1');
    // Loại bỏ các thẻ HTML khác
    result = result.replace(/<[^>]*>/g, '');
    return result.replace(/\s+/g, ' ').trim();
}

function sanitizeReplyMarkup(reply_markup) {
    if (!reply_markup) return reply_markup;
    try {
        const markup = JSON.parse(JSON.stringify(reply_markup));

        if (markup.keyboard && Array.isArray(markup.keyboard)) {
            markup.keyboard = markup.keyboard.map((row) => {
                if (!Array.isArray(row)) return row;
                return row.map((btn) => {
                    if (typeof btn === 'string') return cleanButtonText(btn);
                    if (btn && typeof btn === 'object' && btn.text) {
                        return { ...btn, text: cleanButtonText(btn.text) };
                    }
                    return btn;
                });
            });
        }

        if (markup.inline_keyboard && Array.isArray(markup.inline_keyboard)) {
            markup.inline_keyboard = markup.inline_keyboard.map((row) => {
                if (!Array.isArray(row)) return row;
                return row.map((btn) => {
                    if (btn && typeof btn === 'object' && btn.text) {
                        return { ...btn, text: cleanButtonText(btn.text) };
                    }
                    return btn;
                });
            });
        }

        return markup;
    } catch {
        return reply_markup;
    }
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
            const newOptions = {
                parse_mode: 'HTML',
                ...options,
                reply_markup: options?.reply_markup ? sanitizeReplyMarkup(options.reply_markup) : undefined
            };
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
                parse_mode: 'HTML',
                reply_markup: options?.reply_markup ? sanitizeReplyMarkup(options.reply_markup) : undefined
            };
        }
        return originalSendPhoto(chatId, photo, options, fileOptions);
    };
}
