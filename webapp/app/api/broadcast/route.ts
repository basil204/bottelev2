import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendPhoto, parseTokens, getBotTokens } from '@/lib/telegram';

// Format message text converting animated emoji IDs and markdown to Telegram HTML
function formatTelegramText(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let formatted = text;

    // Convert {5375135722514685501} or {id:5375135722514685501} to <tg-emoji emoji-id="5375135722514685501">⭐</tg-emoji>
    formatted = formatted.replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');
    formatted = formatted.replace(/!\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/gi, '<tg-emoji emoji-id="$2">$1</tg-emoji>');

    // Format markdown bold & code
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    return formatted;
}

// Gửi tin nhắn theo batch song song - lỗi bỏ qua không xóa user
async function sendBatch(
    users: RowDataPacket[],
    sendFn: (telegramId: string) => Promise<{ ok: boolean; blocked?: boolean }>,
    batchSize: number = 25,
    delayMs: number = 1000
): Promise<{ sent: number; failed: number; removed: number }> {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        const results = await Promise.allSettled(
            batch.map(async (user) => {
                const result = await sendFn(user.telegram_id);
                return { telegramId: user.telegram_id, ...result };
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.ok) {
                sent++;
            } else {
                failed++;
            }
        }

        if (i + batchSize < users.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return { sent, failed, removed: 0 };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, productName, productPrice, addedCount, totalStock, productId, buttonText, buttonUrl, buttonCallback } = body;

        // Get shop name, bot token and bot username from settings
        const [settings] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('shop_name', 'telegram_bot_token', 'bot_username')"
        );

        let shopName = 'SHOP';
        let rawBotToken = '';
        let botUsername = '';

        settings.forEach((row) => {
            if (row.key === 'shop_name') shopName = row.value || 'SHOP';
            if (row.key === 'telegram_bot_token') rawBotToken = row.value;
            if (row.key === 'bot_username') botUsername = row.value;
        });

        const botTokens = parseTokens(rawBotToken);
        if (botTokens.length === 0) {
            botTokens.push(...(await getBotTokens()));
        }

        if (botTokens.length === 0) {
            return NextResponse.json({ error: 'Bot token not configured' }, { status: 400 });
        }
        const primaryBotToken = botTokens[0];

        // Fetch product category and price dynamically from database
        let categoryName = '';
        let fetchedPrice = productPrice;

        if (productId) {
            try {
                const [productRows] = await pool.query<RowDataPacket[]>(
                    `SELECT p.price, c.name AS category_name 
                     FROM products p 
                     LEFT JOIN categories c ON p.category_id = c.id 
                     WHERE p.id = ?`,
                    [productId]
                );
                if (productRows && productRows.length > 0) {
                    categoryName = productRows[0].category_name || '';
                    if (productRows[0].price !== undefined && productRows[0].price !== null) {
                        fetchedPrice = productRows[0].price;
                    }
                }
            } catch (err: unknown) {
                console.error('Error fetching product details for broadcast:', err instanceof Error ? err.message : err);
            }
        }

        // Get all users
        const [users] = await pool.query<RowDataPacket[]>('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL');

        if (!users || users.length === 0) {
            return NextResponse.json({ success: true, sent: 0, message: 'No users to notify' });
        }

        // Build message based on type
        let broadcastMessage = '';

        if (type === 'custom' || body.message) {
            const customMessage = body.message;
            if (!customMessage || !customMessage.trim()) {
                return NextResponse.json({ error: 'Message is required for custom broadcast' }, { status: 400 });
            }
            broadcastMessage = customMessage.trim();
        } else if (type === 'new_product') {
            broadcastMessage = `🎁 Sản phẩm: ${productName}\n` +
                `💰 Giá: ${Number(fetchedPrice).toLocaleString('vi-VN')}đ\n\n` +
                `👉 Click nút bên dưới để vào bot mua ngay nhé!`;
        } else if (type === 'stock_added') {
            broadcastMessage = `🎁 Sản phẩm: ${productName} ${Number(fetchedPrice).toLocaleString('vi-VN')}đ\n` +
                `➕ Vừa thêm: ${addedCount} tài khoản\n` +
                `📦 Tồn hiện tại: ${totalStock} tài khoản\n\n` +
                `👉 Click nút bên dưới để vào bot mua ngay nhé!`;
        } else {
            return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
        }

        // Format HTML and dynamic animated emojis in message text
        broadcastMessage = formatTelegramText(broadcastMessage);

        const imageUrl = body.imageUrl;
        let finalImageUrl = imageUrl;
        if (imageUrl && imageUrl.trim()) {
            finalImageUrl = imageUrl.trim();
        }

        // Build inline keyboard reply markup
        let replyMarkup: any = undefined;

        if (Array.isArray(body.inlineKeyboard) && body.inlineKeyboard.length > 0) {
            const formattedRows = body.inlineKeyboard.map((row: any[]) => {
                if (!Array.isArray(row)) return [];
                return row.map((btn: any) => {
                    let textVal = (btn.text || '').trim();
                    let customEmojiId: string | undefined = undefined;

                    const codeMatch = textVal.match(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/i);
                    if (codeMatch) {
                        customEmojiId = codeMatch[1];
                        textVal = textVal.replace(codeMatch[0], '').trim();
                    }

                    if (!textVal) textVal = 'Xem sản phẩm';

                    let btnObj: any = { text: textVal };
                    if (customEmojiId) {
                        btnObj.icon_custom_emoji_id = customEmojiId;
                    }

                    if (btn.type === 'product' && btn.productId) {
                        const urlVal = botUsername 
                            ? `https://t.me/${botUsername}?start=buy_${btn.productId}` 
                            : `https://t.me?start=buy_${btn.productId}`;
                        btnObj.url = urlVal;
                    } else if (btn.type === 'url' || (btn.url && (btn.url.startsWith('http://') || btn.url.startsWith('https://')))) {
                        btnObj.url = (btn.url || btn.value || '').trim() || `https://t.me/${botUsername || ''}`;
                    } else {
                        let target = (btn.callbackData || btn.value || btn.url || '').trim();
                        if (target.startsWith('start:')) {
                            const param = target.replace(/^start:/, '');
                            btnObj.url = botUsername ? `https://t.me/${botUsername}?start=${param}` : `https://t.me?start=${param}`;
                        } else if (target.startsWith('buy_')) {
                            btnObj.url = botUsername ? `https://t.me/${botUsername}?start=${target}` : `https://t.me?start=${target}`;
                        } else if (target.startsWith('http://') || target.startsWith('https://')) {
                            btnObj.url = target;
                        } else {
                            btnObj.url = botUsername ? `https://t.me/${botUsername}` : 'https://t.me';
                        }
                    }

                    return btnObj;
                }).filter((b: any) => Boolean(b.text));
            }).filter((r: any[]) => r.length > 0);

            if (formattedRows.length > 0) {
                replyMarkup = { inline_keyboard: formattedRows };
            }
        } else if (buttonText && buttonText.trim()) {
            let textVal = buttonText.trim();
            let urlVal = (buttonUrl || buttonCallback || '').trim();
            let customEmojiId: string | undefined = undefined;

            const codeMatch = textVal.match(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/i);
            if (codeMatch) {
                customEmojiId = codeMatch[1];
                textVal = textVal.replace(codeMatch[0], '').trim();
            }

            if (!textVal) textVal = 'Xem sản phẩm';

            if (urlVal.startsWith('start:')) {
                const param = urlVal.replace(/^start:/, '');
                urlVal = botUsername ? `https://t.me/${botUsername}?start=${param}` : `https://t.me?start=${param}`;
            } else if (urlVal.startsWith('buy_')) {
                urlVal = botUsername ? `https://t.me/${botUsername}?start=${urlVal}` : `https://t.me?start=${urlVal}`;
            } else if (!urlVal.startsWith('http://') && !urlVal.startsWith('https://')) {
                urlVal = botUsername ? `https://t.me/${botUsername}` : 'https://t.me';
            }

            const btnObj: any = { text: textVal, url: urlVal, style: 'primary' };
            if (customEmojiId) {
                btnObj.icon_custom_emoji_id = customEmojiId;
            }

            replyMarkup = {
                inline_keyboard: [[btnObj]]
            };
        } else if (botUsername && productId) {
            replyMarkup = {
                inline_keyboard: [
                    [
                        { text: '🛒 Mua Ngay', url: `https://t.me/${botUsername}?start=buy_${productId}`, style: 'primary' }
                    ]
                ]
            };
        }

        const sendFn = async (telegramId: string): Promise<{ ok: boolean }> => {
            for (const currentToken of botTokens) {
                try {
                    if (finalImageUrl) {
                        const success = await sendPhoto(telegramId, finalImageUrl, broadcastMessage, currentToken, replyMarkup);
                        if (success) return { ok: true };
                    } else {
                        const response = await fetch(`https://api.telegram.org/bot${currentToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: telegramId,
                                text: broadcastMessage,
                                parse_mode: 'HTML',
                                reply_markup: replyMarkup
                            })
                        });

                        if (response.ok) {
                            return { ok: true };
                        }
                    }
                } catch (err) {
                    console.error(`[BROADCAST] Error sending to ${telegramId}:`, err);
                }
            }
            return { ok: false };
        };

        const { sent, failed, removed } = await sendBatch(users, sendFn);

        console.log(`[BROADCAST] ✅ Hoàn thành: ${sent}/${users.length} thành công, ${failed} thất bại (bỏ qua không xóa user)`);

        return NextResponse.json({
            success: true,
            sent,
            failed,
            removed,
            total: users.length
        });

    } catch (error) {
        console.error('Broadcast Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
