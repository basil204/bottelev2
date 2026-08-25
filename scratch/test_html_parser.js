export function markdownToTelegramHtml(text) {
    if (!text || typeof text !== 'string') return text;

    let html = text;

    // Placeholders for valid HTML tags that Telegram supports
    const htmlPlaceholders = [];
    
    // Match <tg-emoji ...>...</tg-emoji> and valid Telegram HTML tags
    const tagRegex = /<(tg-emoji|b|i|u|s|code|pre|a)(\s+[^>]*)?>[\s\S]*?<\/\1>/gi;
    
    html = html.replace(tagRegex, (match) => {
        const idx = htmlPlaceholders.length;
        htmlPlaceholders.push(match);
        return `@@TG_TAG_HOLDER_${idx}@@`;
    });

    // Escape raw special HTML chars
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Convert Markdown syntax to HTML
    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    // Bold: __text__
    html = html.replace(/__(.*?)__/g, '<b>$1</b>');
    // Inline code: `text`
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    // Markdown link: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Restore protected HTML tags
    htmlPlaceholders.forEach((tag, idx) => {
        html = html.replace(`@@TG_TAG_HOLDER_${idx}@@`, tag);
    });

    return html;
}

// Test cases
console.log('Test 1:', markdownToTelegramHtml('🎉 **Chào mừng!** <tg-emoji emoji-id="5420323339723881652">⚠️</tg-emoji>'));
console.log('Test 2:', markdownToTelegramHtml('👤 **ID**: `12345` & Số dư: < 100$'));
console.log('Test 3:', markdownToTelegramHtml('🔗 [Tham gia nhóm](https://t.me/group)'));
