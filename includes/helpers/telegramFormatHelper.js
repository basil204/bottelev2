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

    const processBtn = (btn) => {
        if (!btn) return btn;
        let textVal = typeof btn === 'string' ? btn : btn.text;
        if (typeof textVal !== 'string') return btn;

        let customEmojiId = typeof btn === 'object' && btn.icon_custom_emoji_id ? btn.icon_custom_emoji_id : null;

        // Tự động bóc tách ID Emoji Động nếu có trong chuỗi chữ
        if (!customEmojiId) {
            const tagMatch = textVal.match(/<tg-emoji\s+emoji-id="(\d+)"/i);
            if (tagMatch) customEmojiId = tagMatch[1];
        }
        if (!customEmojiId) {
            const tgMatch = textVal.match(/tg:\/\/emoji\?id=(\d+)/i);
            if (tgMatch) customEmojiId = tgMatch[1];
        }
        if (!customEmojiId) {
            const codeMatch = textVal.match(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/i);
            if (codeMatch) customEmojiId = codeMatch[1];
        }

        const cleanText = stripHtmlTags(textVal);

        if (typeof btn === 'string') {
            const obj = { text: cleanText };
            if (customEmojiId) obj.icon_custom_emoji_id = customEmojiId;
            return obj;
        } else {
            const obj = { ...btn, text: cleanText };
            if (customEmojiId) obj.icon_custom_emoji_id = customEmojiId;
            return obj;
        }
    };

    // 1. Xử lý Reply Keyboards (Nút bấm bàn phím dưới khung chat - KeyboardButton)
    // Loại bỏ icon_custom_emoji_id để không bị hiển thị icon mặc định kép ở đầu nút
    if (newMarkup.keyboard && Array.isArray(newMarkup.keyboard)) {
        newMarkup.keyboard = newMarkup.keyboard.map(row => {
            if (!Array.isArray(row)) return row;
            return row.map(btn => {
                const processed = processBtn(btn);
                if (processed && typeof processed === 'object') {
                    delete processed.icon_custom_emoji_id;
                }
                return processed;
            });
        });
    }

    // 2. Xử lý Inline Keyboards (Nút bấm dính kèm tin nhắn - InlineKeyboardButton)
    if (newMarkup.inline_keyboard && Array.isArray(newMarkup.inline_keyboard)) {
        newMarkup.inline_keyboard = newMarkup.inline_keyboard.map(row => {
            if (!Array.isArray(row)) return row;
            return row.map(processBtn);
        });
    }

    return newMarkup;
}

export function markdownToTelegramHtml(text) {
    if (!text || typeof text !== 'string') return text;

    let html = text;

    // 1. Xử lý định dạng copy từ Telegram Desktop: ![🛒](tg://emoji?id=5854776233950187351)
    html = html.replace(/!\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/gi, '<tg-emoji emoji-id="$2">$1</tg-emoji>');

    // 2. Xử lý cú pháp rút gọn linh hoạt: {5312361253610475399} hoặc {id:5312361253610475399}
    html = html.replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');

    // 3. Giữ nguyên các thẻ HTML chuẩn của Telegram (bao gồm <blockquote>, <blockquote expandable>, <tg-spoiler>, <tg-emoji>, <b>, <i>, <u>, <s>, <code>, <pre>, <a>)
    const htmlPlaceholders = [];
    const tagRegex = /<(tg-emoji|b|strong|i|em|u|ins|s|strike|del|code|pre|blockquote|tg-spoiler|span|a)(\s+[^>]*)?>[\s\S]*?<\/\1>/gi;
    
    html = html.replace(tagRegex, (match) => {
        const idx = htmlPlaceholders.length;
        htmlPlaceholders.push(match);
        return `@@TG_TAG_HOLDER_${idx}@@`;
    });

    // 4. Xử lý cú pháp trích dẫn Markdown dòng bắt đầu bằng `> ` thành <blockquote>...</blockquote>
    html = html.replace(/(?:^[ \t]*>[ \t]?(.*)(?:\r?\n|$))+/gm, (match) => {
        const lines = match.split(/\r?\n/).map(l => l.replace(/^[ \t]*>[ \t]?/, '')).filter(l => l.trim().length > 0);
        if (!lines.length) return '';
        const idx = htmlPlaceholders.length;
        htmlPlaceholders.push(`<blockquote>${lines.join('\n')}</blockquote>`);
        return `@@TG_TAG_HOLDER_${idx}@@\n`;
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

    // Spoiler: ||text||
    html = html.replace(/\|\|(.*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');
    
    // Inline Code: `text`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
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
    bot.sendPhoto = async function (chatId, photo, options = {}, fileOptions = {}) {
        let newOptions = { ...options };
        if (newOptions.reply_markup) {
            newOptions.reply_markup = formatReplyMarkup(newOptions.reply_markup);
        }

        if (typeof newOptions.caption === 'string') {
            newOptions.caption = markdownToTelegramHtml(newOptions.caption);
            newOptions.parse_mode = 'HTML';
        }

        let photoToSend = photo;
        if (typeof photo === 'string' && (photo.startsWith('/uploads/') || photo.startsWith('uploads/'))) {
            try {
                const fs = await import('fs');
                const path = await import('path');
                const cleanRel = photo.replace(/^\//, '');
                const candidates = [
                    path.join(process.cwd(), 'webapp', 'public', cleanRel),
                    path.join(process.cwd(), 'public', cleanRel),
                    path.join(process.cwd(), cleanRel)
                ];
                for (const c of candidates) {
                    if (fs.existsSync(c)) {
                        photoToSend = c;
                        break;
                    }
                }
            } catch (err) {
                console.warn('[TELEGRAM_PHOTO_RESOLVE_ERR]', err);
            }
        }

        return originalSendPhoto(chatId, photoToSend, newOptions, fileOptions);
    };

    const originalEditMessageText = bot.editMessageText.bind(bot);
    bot.editMessageText = function (text, options = {}) {
        let newOptions = { ...options };
        if (newOptions.reply_markup) {
            newOptions.reply_markup = formatReplyMarkup(newOptions.reply_markup);
        }

        if (typeof text === 'string') {
            const formattedText = markdownToTelegramHtml(text);
            newOptions.parse_mode = 'HTML';
            return originalEditMessageText(formattedText, newOptions);
        }
        return originalEditMessageText(text, newOptions);
    };

    const originalEditMessageReplyMarkup = bot.editMessageReplyMarkup.bind(bot);
    bot.editMessageReplyMarkup = function (replyMarkup, options = {}) {
        const formattedMarkup = formatReplyMarkup(replyMarkup);
        return originalEditMessageReplyMarkup(formattedMarkup, options);
    };
}
