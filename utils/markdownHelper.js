export const escapeMarkdown = (text) => {
    if (!text) return '';
    // Helper to escape special characters for Legacy Telegram Markdown (Markdown V1)
    // Escapes: '_', '*', '`', '['
    return String(text).replace(/([_*[`])/g, '\\$1');
};
