import pool from './db';
import { RowDataPacket } from 'mysql2';
import { getBotTokens, sendPhoto } from './telegram';

export interface BroadcastOptions {
    message: string;
    imageUrl?: string | null;
    customEmojiId?: string | null;
    inlineKeyboard?: Array<Array<{ text: string; url?: string; callback_data?: string; style?: string; icon_custom_emoji_id?: string }>>;
    batchSize?: number;
    delayMs?: number;
}

export interface BroadcastResult {
    total: number;
    sent: number;
    failed: number;
    removed: number;
}

// Kiểm tra lỗi Telegram có phải user đã block bot / deactivated không
function isUserBlockedError(response: Response | null, error: unknown): boolean {
    if (response && (response.status === 403 || response.status === 400)) {
        return true;
    }
    if (error) {
        const msg = String(error instanceof Error ? error.message : error).toLowerCase();
        if (msg.includes('blocked') || msg.includes('chat not found') ||
            msg.includes('user is deactivated') || msg.includes('forbidden') ||
            msg.includes('bot was kicked') || msg.includes('bot was blocked')) {
            return true;
        }
    }
    return false;
}

// Xóa user không còn hoạt động khỏi database
async function removeDeadUser(telegramId: string) {
    try {
        await pool.query('DELETE FROM users WHERE telegram_id = ?', [telegramId]);
        console.log(`[BROADCAST] 🗑️ Đã xóa user ${telegramId} (blocked/deactivated)`);
    } catch (err) {
        console.error(`[BROADCAST] Lỗi xóa user ${telegramId}:`, err);
    }
}

// Format message text converting animated emoji IDs and markdown to Telegram HTML
export function formatTelegramText(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let formatted = text;

    // Convert {5375135722514685501} or {id:5375135722514685501} to <tg-emoji emoji-id="5375135722514685501">⭐</tg-emoji>
    formatted = formatted.replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');
    formatted = formatted.replace(/!\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/gi, '<tg-emoji emoji-id="$2">$1</tg-emoji>');

    // Format markdown bold & code & strike & italic
    formatted = formatted.replace(/~~(.*?)~~/g, '<s>$1</s>');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    formatted = formatted.replace(/_([^_]+)_/g, '<i>$1</i>');

    return formatted;
}

/**
 * Gửi phát sóng thông báo đến toàn bộ người dùng Telegram
 */
export async function broadcastToUsers(options: BroadcastOptions): Promise<BroadcastResult> {
    const {
        message,
        imageUrl,
        customEmojiId,
        inlineKeyboard,
        batchSize = 25,
        delayMs = 800
    } = options;

    const botTokens = await getBotTokens();
    if (botTokens.length === 0) {
        console.error('[BROADCAST] Không tìm thấy telegram_bot_token nào');
        return { total: 0, sent: 0, failed: 0, removed: 0 };
    }

    // Lấy toàn bộ người dùng Telegram
    const [users] = await pool.query<RowDataPacket[]>(
        'SELECT telegram_id FROM users WHERE (is_banned = 0 OR is_banned IS NULL) AND telegram_id IS NOT NULL AND telegram_id != ""'
    );

    if (!users || users.length === 0) {
        return { total: 0, sent: 0, failed: 0, removed: 0 };
    }

    let finalMessage = message;
    if (customEmojiId && customEmojiId.trim()) {
        const emojiTag = `<tg-emoji emoji-id="${customEmojiId.trim()}">⚡</tg-emoji> `;
        finalMessage = emojiTag + finalMessage;
    }

    const formattedMessage = formatTelegramText(finalMessage.trim());

    // Chuẩn bị replyMarkup nếu có nút
    let replyMarkup: any = null;
    if (inlineKeyboard && inlineKeyboard.length > 0) {
        replyMarkup = {
            inline_keyboard: inlineKeyboard.map(row =>
                row.map(btn => {
                    let btnText = btn.text;
                    let emojiId = btn.icon_custom_emoji_id || (customEmojiId ? customEmojiId.trim() : undefined);

                    const match = btnText.match(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/i);
                    if (match) {
                        emojiId = match[1];
                        btnText = btnText.replace(match[0], '').trim();
                    }

                    const obj: any = { text: btnText };
                    if (btn.url) obj.url = btn.url;
                    if (btn.callback_data) obj.callback_data = btn.callback_data;
                    if (btn.style) obj.style = btn.style;
                    if (emojiId) obj.icon_custom_emoji_id = emojiId;
                    return obj;
                })
            )
        };
    }

    let sent = 0;
    let failed = 0;
    let removed = 0;

    const sendToUser = async (telegramId: string): Promise<{ ok: boolean; blocked: boolean }> => {
        let isBlockedOnAll = true;

        for (const currentToken of botTokens) {
            try {
                if (imageUrl && imageUrl.trim()) {
                    const ok = await sendPhoto(telegramId, imageUrl.trim(), formattedMessage, currentToken, replyMarkup);
                    if (ok) return { ok: true, blocked: false };
                }

                const payload: any = {
                    chat_id: telegramId,
                    text: formattedMessage,
                    parse_mode: 'HTML'
                };
                if (replyMarkup) {
                    payload.reply_markup = replyMarkup;
                }

                const res = await fetch(`https://api.telegram.org/bot${currentToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.ok) {
                    return { ok: true, blocked: false };
                }

                if (!isUserBlockedError(res, data)) {
                    isBlockedOnAll = false;
                }
            } catch (err) {
                if (!isUserBlockedError(null, err)) {
                    isBlockedOnAll = false;
                }
            }
        }

        return { ok: false, blocked: isBlockedOnAll };
    };

    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        const results = await Promise.allSettled(
            batch.map(async (user) => {
                const res = await sendToUser(String(user.telegram_id));
                return { telegramId: String(user.telegram_id), ...res };
            })
        );

        for (const r of results) {
            if (r.status === 'fulfilled') {
                if (r.value.ok) {
                    sent++;
                } else if (r.value.blocked) {
                    await removeDeadUser(r.value.telegramId);
                    removed++;
                } else {
                    failed++;
                }
            } else {
                failed++;
            }
        }

        if (i + batchSize < users.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log(`[BROADCAST] Hoàn thành: ${sent}/${users.length} thành công, ${failed} lỗi, ${removed} đã xóa`);
    return { total: users.length, sent, failed, removed };
}
