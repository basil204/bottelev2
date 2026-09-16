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
    sendToGroups?: boolean;
    sendToUsers?: boolean;
    customGroupIds?: string[];
}

export interface BroadcastResult {
    total: number;
    sent: number;
    failed: number;
    removed: number;
    groupTotal?: number;
    groupSent?: number;
    groupFailed?: number;
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
 * Lấy danh sách tất cả ID Nhóm / Kênh Telegram nhận thông báo từ Settings & Môi trường
 */
export async function getNotificationGroupIds(): Promise<string[]> {
    const groupIds: Set<string> = new Set();

    // 1. Kiểm tra biến môi trường
    const envIds = [
        process.env.NOTIFICATION_CHAT_ID,
        process.env.TELEGRAM_GROUP_ID,
        process.env.TELEGRAM_CHANNEL_ID
    ];
    for (const envVal of envIds) {
        if (envVal) {
            envVal.split(/[\r\n,;|]+/).forEach(id => {
                const clean = id.trim();
                if (clean) groupIds.add(clean);
            });
        }
    }

    // 2. Kiểm tra bảng settings trong CSDL
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('notification_chat_id', 'telegram_notification_group_id', 'telegram_group_id', 'telegram_channel_id', 'auto_restock_channel_id') AND `value` IS NOT NULL AND `value` != ''"
        );

        rows.forEach(r => {
            const raw = String(r.value || '').trim();
            if (raw) {
                raw.split(/[\r\n,;|]+/).forEach(id => {
                    const clean = id.trim();
                    if (clean && !clean.startsWith('http://') && !clean.startsWith('https://')) {
                        groupIds.add(clean);
                    } else if (clean.includes('t.me/')) {
                        // Trích xuất @channel từ link t.me/channel_name (nếu không phải link invite private +)
                        const match = clean.match(/t\.me\/([a-zA-Z0-9_]+)$/i);
                        if (match && !match[1].startsWith('+') && !match[1].startsWith('joinchat')) {
                            groupIds.add('@' + match[1]);
                        }
                    }
                });
            }
        });
    } catch (e) {
        console.error('[BROADCAST] Lỗi khi truy vấn notification group ids từ settings:', e);
    }

    return Array.from(groupIds);
}

/**
 * Gửi thông báo đến danh sách Nhóm / Kênh Telegram
 */
export async function sendToTelegramGroups(options: BroadcastOptions): Promise<{ total: number; sent: number; failed: number }> {
    const {
        message,
        imageUrl,
        customEmojiId,
        inlineKeyboard,
        customGroupIds
    } = options;

    const botTokens = await getBotTokens();
    if (botTokens.length === 0) {
        return { total: 0, sent: 0, failed: 0 };
    }

    const targetGroupIds = customGroupIds && customGroupIds.length > 0
        ? customGroupIds
        : await getNotificationGroupIds();

    if (targetGroupIds.length === 0) {
        return { total: 0, sent: 0, failed: 0 };
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

    const sendToSingleTarget = async (targetId: string): Promise<boolean> => {
        for (const currentToken of botTokens) {
            try {
                if (imageUrl && imageUrl.trim()) {
                    const ok = await sendPhoto(targetId, imageUrl.trim(), formattedMessage, currentToken, replyMarkup);
                    if (ok) return true;
                }

                const payload: any = {
                    chat_id: targetId,
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
                    return true;
                }
                console.error(`[BROADCAST_GROUP] Gửi tới ${targetId} thất bại:`, data.description);
            } catch (err) {
                // Thử token tiếp theo
            }
        }
        return false;
    };

    for (const gId of targetGroupIds) {
        try {
            const ok = await sendToSingleTarget(gId);
            if (ok) {
                sent++;
                console.log(`[BROADCAST_GROUP] ✅ Đã gửi thành công tới nhóm/kênh: ${gId}`);
            } else {
                failed++;
                console.error(`[BROADCAST_GROUP] ❌ Không thể gửi tới nhóm/kênh: ${gId}`);
            }
        } catch (e) {
            failed++;
        }
    }

    return { total: targetGroupIds.length, sent, failed };
}

/**
 * Gửi phát sóng thông báo đến Nhóm Telegram VÀ toàn bộ người dùng Telegram
 */
export async function broadcastToUsers(options: BroadcastOptions): Promise<BroadcastResult> {
    const {
        message,
        imageUrl,
        customEmojiId,
        inlineKeyboard,
        batchSize = 25,
        delayMs = 800,
        sendToGroups = true,
        sendToUsers = true,
        customGroupIds
    } = options;

    const botTokens = await getBotTokens();
    if (botTokens.length === 0) {
        console.error('[BROADCAST] Không tìm thấy telegram_bot_token nào');
        return { total: 0, sent: 0, failed: 0, removed: 0, groupTotal: 0, groupSent: 0, groupFailed: 0 };
    }

    // 1. Gửi tới các Nhóm / Kênh Telegram nếu được bật
    let groupStats = { total: 0, sent: 0, failed: 0 };
    if (sendToGroups) {
        try {
            groupStats = await sendToTelegramGroups({
                message,
                imageUrl,
                customEmojiId,
                inlineKeyboard,
                customGroupIds
            });
        } catch (groupErr) {
            console.error('[BROADCAST] Lỗi khi gửi tới nhóm Telegram:', groupErr);
        }
    }

    // 2. Nếu không gửi tới người dùng cá nhân
    if (!sendToUsers) {
        return {
            total: 0,
            sent: 0,
            failed: 0,
            removed: 0,
            groupTotal: groupStats.total,
            groupSent: groupStats.sent,
            groupFailed: groupStats.failed
        };
    }

    // 3. Lấy toàn bộ người dùng Telegram
    let users: RowDataPacket[] = [];
    try {
        const [userRows] = await pool.query<RowDataPacket[]>(
            'SELECT telegram_id FROM users WHERE (is_banned = 0 OR is_banned IS NULL) AND telegram_id IS NOT NULL AND telegram_id != ""'
        );
        users = userRows || [];
    } catch (e) {
        console.error('[BROADCAST] Lỗi lấy danh sách users:', e);
    }

    if (users.length === 0) {
        return {
            total: 0,
            sent: 0,
            failed: 0,
            removed: 0,
            groupTotal: groupStats.total,
            groupSent: groupStats.sent,
            groupFailed: groupStats.failed
        };
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

    const sendToUser = async (telegramId: string): Promise<boolean> => {
        for (const currentToken of botTokens) {
            try {
                if (imageUrl && imageUrl.trim()) {
                    const ok = await sendPhoto(telegramId, imageUrl.trim(), formattedMessage, currentToken, replyMarkup);
                    if (ok) return true;
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
                    return true;
                }
            } catch (err) {
                // Ignore and try next token
            }
        }

        return false;
    };

    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        const results = await Promise.allSettled(
            batch.map(async (user) => {
                const ok = await sendToUser(String(user.telegram_id));
                return { telegramId: String(user.telegram_id), ok };
            })
        );

        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.ok) {
                sent++;
            } else {
                failed++;
            }
        }

        if (i + batchSize < users.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log(`[BROADCAST] Hoàn thành: ${sent}/${users.length} users thành công, ${failed} lỗi. Nhóm: ${groupStats.sent}/${groupStats.total} nhóm thành công.`);
    return {
        total: users.length,
        sent,
        failed,
        removed: 0,
        groupTotal: groupStats.total,
        groupSent: groupStats.sent,
        groupFailed: groupStats.failed
    };
}
