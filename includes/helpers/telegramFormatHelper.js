/**
 * Helper hỗ trợ định dạng tin nhắn Telegram HTML & Animated Custom Emoji (<tg-emoji emoji-id="...">)
 */

export function stripHtmlTags(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/<tg-emoji\s+emoji-id="[^"]*">([\s\S]*?)<\/tg-emoji>/gi, '$1')
              .replace(/!\[([^\]]*)\]\(tg:\/\/emoji\?id=\d+\)/gi, '$1')
              .replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '')
              .replace(/<[^>]*>/g, '')
              .trim();
}

export function formatReplyMarkup(replyMarkup) {
    if (!replyMarkup) return replyMarkup;
    let newMarkup = { ...replyMarkup };

    // 1. Clean Reply Keyboards (Bàn phím menu dưới khung chat)
    if (newMarkup.keyboard && Array.isArray(newMarkup.keyboard)) {
        newMarkup.keyboard = newMarkup.keyboard.map(row => {
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
    }

    // 2. Clean & Tự động trích xuất icon_custom_emoji_id cho Inline Keyboards (Nút bấm tin nhắn)
    if (newMarkup.inline_keyboard && Array.isArray(newMarkup.inline_keyboard)) {
        newMarkup.inline_keyboard = newMarkup.inline_keyboard.map(row => {
            if (!Array.isArray(row)) return row;
            return row.map(btn => {
                if (btn && typeof btn === 'object' && typeof btn.text === 'string') {
                    let customEmojiId = btn.icon_custom_emoji_id || null;

                    // Match <tg-emoji emoji-id="ID">
                    if (!customEmojiId) {
                        const tagMatch = btn.text.match(/<tg-emoji\s+emoji-id="(\d+)"/i);
                        if (tagMatch) customEmojiId = tagMatch[1];
                    }

                    // Match tg://emoji?id=ID
                    if (!customEmojiId) {
                        const tgMatch = btn.text.match(/tg:\/\/emoji\?id=(\d+)/i);
                        if (tgMatch) customEmojiId = tgMatch[1];
                    }

                    // Match {5312361253610475399} hoặc {id:5312361253610475399} hoặc {emoji:5312361253610475399}
                    if (!customEmojiId) {
                        const codeMatch = btn.text.match(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/i);
                        if (codeMatch) customEmojiId = codeMatch[1];
                    }

                    const cleanText = stripHtmlTags(btn.text);
                    const newBtn = { ...btn, text: cleanText };
                    if (customEmojiId) {
                        newBtn.icon_custom_emoji_id = customEmojiId;
                    }
                    return newBtn;
                }
                return btn;
            });
        });
    }

    return newMarkup;
}

export function markdownToTelegramHtml(text) {
    if (!text || typeof text !== 'string') return text;

    let html = text;

    // 1. Xử lý định dạng copy từ Telegram Desktop: ![🛒](tg://emoji?id=5854776233950187351)
    html = html.replace(/!\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/gi, '<tg-emoji emoji-id="$2">$1</tg-emoji>');

    // 2. Xử lý cú pháp rút gọn linh hoạt: {5312361253610475399} hoặc {id:5312361253610475399} hoặc {emoji:5312361253610475399}
    html = html.replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');

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
            newOptions.reply_markup = formatReplyMarkup(newOptions.reply_markup);
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
            newOptions.reply_markup = formatReplyMarkup(newOptions.reply_markup);
        }

        if (typeof newOptions.caption === 'string') {
            newOptions.caption = markdownToTelegramHtml(newOptions.caption);
            newOptions.parse_mode = 'HTML';
        }
        return originalSendPhoto(chatId, photo, newOptions, fileOptions);
    };
}
