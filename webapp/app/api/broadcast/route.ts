import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendPhoto } from '@/lib/telegram';

// Kiểm tra lỗi Telegram có phải user đã block/deactivated không
function isUserBlockedError(response: Response | null, error: any): boolean {
    // Telegram error codes:
    // 403 - Forbidden: bot was blocked by the user
    // 400 - Bad Request: chat not found (user deleted account)
    if (response && (response.status === 403 || response.status === 400)) {
        return true;
    }
    if (error) {
        const msg = String(error.message || error).toLowerCase();
        if (msg.includes('blocked') || msg.includes('chat not found') ||
            msg.includes('user is deactivated') || msg.includes('forbidden')) {
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

// Gửi tin nhắn theo batch, mỗi batch gửi song song, giữa các batch delay để tránh rate limit
// Tự động xóa user không gửi được (blocked/deactivated)
async function sendBatch(
    users: RowDataPacket[],
    sendFn: (telegramId: string) => Promise<{ ok: boolean; blocked: boolean }>,
    batchSize: number = 25,
    delayMs: number = 1000
): Promise<{ sent: number; failed: number; removed: number }> {
    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        const results = await Promise.allSettled(
            batch.map(async (user) => {
                const result = await sendFn(user.telegram_id);
                return { telegramId: user.telegram_id, ...result };
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                if (result.value.ok) {
                    sent++;
                } else if (result.value.blocked) {
                    // User đã block bot hoặc deactivated → xóa khỏi DB
                    await removeDeadUser(result.value.telegramId);
                    removed++;
                } else {
                    failed++;
                }
            } else {
                failed++;
            }
        }

        // Delay giữa các batch để tránh rate limit (Telegram cho phép ~30 msg/s)
        if (i + batchSize < users.length) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return { sent, failed, removed };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, productName, productPrice, addedCount, totalStock, productId } = body;

        // Get shop name, bot token and bot username from settings
        const [settings] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('shop_name', 'telegram_bot_token', 'bot_username')"
        );

        let shopName = 'SHOP';
        let botToken = '';
        let botUsername = '';

        settings.forEach((row: any) => {
            if (row.key === 'shop_name') shopName = row.value || 'SHOP';
            if (row.key === 'telegram_bot_token') botToken = row.value;
            if (row.key === 'bot_username') botUsername = row.value;
        });

        if (!botToken) {
            return NextResponse.json({ error: 'Bot token not configured' }, { status: 400 });
        }

        // Get all users
        const [users] = await pool.query<RowDataPacket[]>('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL');

        if (!users || users.length === 0) {
            return NextResponse.json({ success: true, sent: 0, message: 'No users to notify' });
        }

        // Build message based on type
        let broadcastMessage = '';

        if (type === 'new_product') {
            broadcastMessage = `📢 ${shopName} thông báo có sản phẩm mới!\n\n` +
                `🎁 Sản phẩm: ${productName}\n` +
                `💰 Giá: ${Number(productPrice).toLocaleString('vi-VN')}đ\n\n` +
                `👉 Click nút bên dưới để vào bot mua ngay nhé!`;
        } else if (type === 'stock_added') {
            broadcastMessage = `📢 ${shopName} thông báo có hàng mới!\n\n` +
                `🎁 Sản phẩm: ${productName}\n` +
                `➕ Vừa thêm: ${addedCount} tài khoản\n` +
                `📦 Tồn hiện tại: ${totalStock} tài khoản\n\n` +
                `👉 Click nút bên dưới để vào bot mua ngay nhé!`;
        } else if (type === 'custom' || body.message) {
            const customMessage = body.message;
            if (!customMessage || !customMessage.trim()) {
                return NextResponse.json({ error: 'Message is required for custom broadcast' }, { status: 400 });
            }
            broadcastMessage = `📢 ${shopName} thông báo:\n\n${customMessage}`;
        } else {
            return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
        }

        const imageUrl = body.imageUrl;
        let finalImageUrl = imageUrl;
        if (imageUrl && imageUrl.startsWith('/')) {
            const protocol = request.headers.get('x-forwarded-proto') || 'http';
            const host = request.headers.get('host');
            if (host) {
                finalImageUrl = `${protocol}://${host}${imageUrl}`;
            }
        }

        // Build inline keyboard reply markup if bot username and product ID are present
        let replyMarkup: any = undefined;
        if (botUsername && productId) {
            replyMarkup = {
                inline_keyboard: [
                    [
                        { text: '🛒 Mua Ngay', url: `https://t.me/${botUsername}?start=buy_${productId}` }
                    ]
                ]
            };
        }

        // Gửi theo batch song song (25 tin/batch, delay 1s giữa các batch)
        // User nào block bot hoặc deactivated sẽ tự động bị xóa khỏi DB
        const sendFn = async (telegramId: string): Promise<{ ok: boolean; blocked: boolean }> => {
            try {
                if (finalImageUrl) {
                    await sendPhoto(telegramId, finalImageUrl, broadcastMessage, botToken, replyMarkup);
                    return { ok: true, blocked: false };
                } else {
                    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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
                        return { ok: true, blocked: false };
                    }

                    // Kiểm tra nếu user đã block/deactivated
                    if (isUserBlockedError(response, null)) {
                        return { ok: false, blocked: true };
                    }

                    return { ok: false, blocked: false };
                }
            } catch (err) {
                if (isUserBlockedError(null, err)) {
                    return { ok: false, blocked: true };
                }
                console.error(`[BROADCAST] Error sending to ${telegramId}:`, err);
                return { ok: false, blocked: false };
            }
        };

        const { sent, failed, removed } = await sendBatch(users, sendFn);

        console.log(`[BROADCAST] ✅ Hoàn thành: ${sent}/${users.length} thành công, ${failed} thất bại, ${removed} user đã bị xóa`);

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
