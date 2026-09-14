import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';
import { sendPhoto, parseTokens, getBotTokens } from '@/lib/telegram';

// Kiểm tra lỗi Telegram có phải user đã block/deactivated không
function isUserBlockedError(response: Response | null, error: unknown): boolean {
    if (response && (response.status === 403 || response.status === 400)) {
        return true;
    }
    if (error) {
        const msg = String(error instanceof Error ? error.message : error).toLowerCase();
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
        console.log(`[PREORDERS BROADCAST] 🗑️ Đã xóa user ${telegramId} (blocked/deactivated)`);
    } catch (err) {
        console.error(`[PREORDERS BROADCAST] Lỗi xóa user ${telegramId}:`, err);
    }
}

// Format message text converting animated emoji IDs and markdown to Telegram HTML
function formatTelegramText(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let formatted = text;

    // Convert {5375135722514685501} or {id:5375135722514685501} to <tg-emoji emoji-id="5375135722514685501">⭐</tg-emoji>
    formatted = formatted.replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');
    formatted = formatted.replace(/!\[([^\]]*)\]\(tg:\/\/emoji\?id=(\d+)\)/gi, '<tg-emoji emoji-id="$2">$1</tg-emoji>');

    // Format markdown bold & code & italic
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    formatted = formatted.replace(/_([^_]+)_/g, '<i>$1</i>');

    return formatted;
}

// Gửi tin nhắn theo batch song song
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
                    await removeDeadUser(result.value.telegramId);
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

    return { sent, failed, removed };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const status = searchParams.get('status');
        const productId = searchParams.get('productId');

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'PREORDER',
            details: 'Viewed preorders list',
            request
        });

        // Ensure table exists dynamically
        await pool.query(`
            CREATE TABLE IF NOT EXISTS preorders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_code VARCHAR(100) NULL,
                user_id INT NULL,
                telegram_id BIGINT NULL,
                username VARCHAR(100) NULL,
                user_fullname VARCHAR(100) NULL,
                product_id INT NOT NULL,
                quantity INT DEFAULT 1,
                deposit_fee DECIMAL(15, 2) DEFAULT 0,
                total_price DECIMAL(15, 2) DEFAULT 0,
                payment_method VARCHAR(100) DEFAULT 'Admin Tạo Thủ Công',
                status VARCHAR(50) DEFAULT 'pending',
                fifo_position INT DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        const conditions: string[] = [];
        const params: any[] = [];

        if (status && status !== 'all') {
            conditions.push('preorders.status = ?');
            params.push(status);
        }

        if (productId && productId !== 'all') {
            conditions.push('preorders.product_id = ?');
            params.push(productId);
        }

        if (search && search.trim().length > 0) {
            const term = `%${search.trim()}%`;
            conditions.push('(preorders.invoice_code LIKE ? OR CAST(preorders.telegram_id AS CHAR) LIKE ? OR preorders.username LIKE ? OR products.name LIKE ?)');
            params.push(term, term, term, term);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT preorders.*,
                   products.name as product_name,
                   products.price as product_price,
                   users.username as user_username,
                   users.name as user_name
            FROM preorders
            LEFT JOIN products ON preorders.product_id = products.id
            LEFT JOIN users ON preorders.user_id = users.id OR preorders.telegram_id = users.telegram_id
            ${whereClause}
            ORDER BY preorders.created_at ASC
        `, params);

        // Stats summary
        const [statsRows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingCount,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN quantity ELSE 0 END), 0) as pendingProductsCount,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedCount,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN deposit_fee ELSE 0 END), 0) as depositTotal
            FROM preorders
        `);

        const stats = statsRows[0] || {
            pendingCount: 0,
            pendingProductsCount: 0,
            completedCount: 0,
            depositTotal: 0
        };

        return NextResponse.json({
            data: rows,
            stats
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, productId, telegramId, quantity, paymentMethod, broadcastMessage, bannerImage } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (action === 'create') {
            if (!productId || !telegramId) {
                return NextResponse.json({ error: 'Vui lòng chọn sản phẩm và nhập Telegram User ID' }, { status: 400 });
            }

            // Get product price & info
            const [prodRows] = await pool.query<RowDataPacket[]>('SELECT * FROM products WHERE id = ?', [productId]);
            if (prodRows.length === 0) {
                return NextResponse.json({ error: 'Sản phẩm không tồn tại' }, { status: 404 });
            }
            const product = prodRows[0];

            // Get user info if exists
            const [userRows] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE telegram_id = ? OR id = ?', [telegramId, telegramId]);
            const user = userRows[0] || null;

            const qty = Number(quantity) || 1;
            const depositFee = Number(product.preorder_fee_vnd || product.price || 0) * qty;
            const totalPrice = Number(product.price || 0) * qty;
            const invoiceCode = `PRE-${Date.now()}`;

            // Calculate FIFO position
            const [fifoRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM preorders WHERE status = "pending" AND product_id = ?', [productId]);
            const fifoPos = Number(fifoRows[0]?.count || 0) + 1;

            const [insertRes]: any = await pool.query(`
                INSERT INTO preorders (
                    invoice_code, user_id, telegram_id, username, user_fullname,
                    product_id, quantity, deposit_fee, total_price, payment_method,
                    status, fifo_position
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            `, [
                invoiceCode, user?.id || null, Number(telegramId) || null, user?.username || null, user?.name || null,
                productId, qty, depositFee, totalPrice, paymentMethod || 'Admin Tạo Thủ Công', fifoPos
            ]);

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'CREATE',
                targetType: 'PREORDER',
                targetId: insertRes.insertId,
                details: { productId, telegramId, quantity: qty, paymentMethod },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Tạo đơn đặt trước thủ công thành công' });
        }

        if (action === 'broadcast') {
            if (!broadcastMessage || !broadcastMessage.trim()) {
                return NextResponse.json({ error: 'Nội dung thông báo không được để trống' }, { status: 400 });
            }

            const {
                customEmojiId,
                button1Text = '📦 Đặt trước ngay',
                enableButton1 = true,
                enableButton2 = true,
                button2Text = '🛒 Xem tất cả sản phẩm',
                inlineKeyboard
            } = body;

            // Get bot token and bot username from settings
            const [settings] = await pool.query<RowDataPacket[]>(
                "SELECT `key`, `value` FROM settings WHERE `key` IN ('shop_name', 'telegram_bot_token', 'bot_username')"
            );

            let rawBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
            let botUsername = '';

            settings.forEach((row) => {
                if (row.key === 'telegram_bot_token' && row.value) rawBotToken = row.value.trim();
                if (row.key === 'bot_username' && row.value) botUsername = row.value.trim().replace(/^@/, '');
            });

            const botTokens = parseTokens(rawBotToken);
            if (botTokens.length === 0) {
                botTokens.push(...(await getBotTokens()));
            }

            if (botTokens.length === 0) {
                return NextResponse.json({ error: 'Chưa cấu hình Telegram Bot Token trong Cài đặt hệ thống' }, { status: 400 });
            }

            // Get all active users with telegram_id
            const [users] = await pool.query<RowDataPacket[]>(
                'SELECT DISTINCT telegram_id FROM users WHERE telegram_id IS NOT NULL AND telegram_id != "" AND telegram_id != 0'
            );

            if (!users || users.length === 0) {
                return NextResponse.json({ success: true, sent: 0, message: 'Không có người dùng nào để gửi thông báo' });
            }

            // Format message text with HTML and animated Telegram emoji tags
            let formattedMessage = formatTelegramText(broadcastMessage.trim());

            // Build replyMarkup inline keyboard
            let replyMarkup: any = undefined;

            if (Array.isArray(inlineKeyboard) && inlineKeyboard.length > 0) {
                replyMarkup = { inline_keyboard: inlineKeyboard };
            } else {
                const keyboardRows: any[] = [];
                const firstRow: any[] = [];

                if (enableButton1) {
                    let b1Text = (button1Text || '📦 Đặt trước ngay').trim();
                    let b1EmojiId: string | undefined = customEmojiId ? String(customEmojiId).trim() : undefined;

                    const codeMatch = b1Text.match(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/i);
                    if (codeMatch) {
                        b1EmojiId = codeMatch[1];
                        b1Text = b1Text.replace(codeMatch[0], '').trim();
                    }

                    if (!b1Text) b1Text = '📦 Đặt trước ngay';

                    const buyUrl = (botUsername && productId)
                        ? `https://t.me/${botUsername}?start=buy_${productId}`
                        : (botUsername ? `https://t.me/${botUsername}` : 'https://t.me');

                    const btn1: any = {
                        text: b1Text,
                        url: buyUrl
                    };
                    if (b1EmojiId) {
                        btn1.icon_custom_emoji_id = b1EmojiId;
                    }
                    firstRow.push(btn1);
                }

                if (firstRow.length > 0) {
                    keyboardRows.push(firstRow);
                }

                if (enableButton2) {
                    let b2Text = (button2Text || '🛒 Xem tất cả sản phẩm').trim();
                    let b2EmojiId: string | undefined = undefined;
                    const codeMatch = b2Text.match(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/i);
                    if (codeMatch) {
                        b2EmojiId = codeMatch[1];
                        b2Text = b2Text.replace(codeMatch[0], '').trim();
                    }

                    if (!b2Text) b2Text = '🛒 Xem tất cả sản phẩm';

                    const shopUrl = botUsername ? `https://t.me/${botUsername}?start=shop` : 'https://t.me';
                    const btn2: any = {
                        text: b2Text,
                        url: shopUrl
                    };
                    if (b2EmojiId) {
                        btn2.icon_custom_emoji_id = b2EmojiId;
                    }
                    keyboardRows.push([btn2]);
                }

                if (keyboardRows.length > 0) {
                    replyMarkup = { inline_keyboard: keyboardRows };
                }
            }

            const finalImageUrl = bannerImage && bannerImage.trim() ? bannerImage.trim() : undefined;

            const sendFn = async (telegramId: string): Promise<{ ok: boolean; blocked: boolean }> => {
                let isBlockedOnAll = true;
                for (const currentToken of botTokens) {
                    try {
                        if (finalImageUrl) {
                            const success = await sendPhoto(telegramId, finalImageUrl, formattedMessage, currentToken, replyMarkup);
                            if (success) return { ok: true, blocked: false };
                        } else {
                            const response = await fetch(`https://api.telegram.org/bot${currentToken}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chat_id: telegramId,
                                    text: formattedMessage,
                                    parse_mode: 'HTML',
                                    reply_markup: replyMarkup
                                })
                            });

                            if (response.ok) {
                                return { ok: true, blocked: false };
                            }

                            if (!isUserBlockedError(response, null)) {
                                isBlockedOnAll = false;
                            }
                        }
                    } catch (err) {
                        if (!isUserBlockedError(null, err)) {
                            isBlockedOnAll = false;
                        }
                        console.error(`[PREORDER_BROADCAST] Error sending to ${telegramId}:`, err);
                    }
                }
                return { ok: false, blocked: isBlockedOnAll };
            };

            const { sent, failed, removed } = await sendBatch(users, sendFn);

            // Log broadcast action
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'BROADCAST',
                targetType: 'PREORDER',
                details: { productId, broadcastMessage, bannerImage, customEmojiId, sent, failed, total: users.length },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({
                success: true,
                sent,
                failed,
                removed,
                total: users.length,
                message: `Đã phát sóng thông báo mở đặt trước tới ${sent}/${users.length} khách hàng!`
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, action } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!id) return NextResponse.json({ error: 'Missing Preorder ID' }, { status: 400 });

        const [preorderRows] = await pool.query<RowDataPacket[]>('SELECT * FROM preorders WHERE id = ?', [id]);
        if (preorderRows.length === 0) {
            return NextResponse.json({ error: 'Đơn đặt trước không tồn tại' }, { status: 404 });
        }
        const preorder = preorderRows[0];

        if (action === 'complete') {
            await pool.query('UPDATE preorders SET status = "completed" WHERE id = ?', [id]);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PREORDER',
                targetId: Number(id),
                details: { action: 'COMPLETE' },
                ipAddress,
                userAgent,
                request
            });
            return NextResponse.json({ success: true, message: 'Đã hoàn tất đơn đặt trước' });
        }

        if (action === 'refund') {
            // Refund deposit_fee to user's balance
            if (preorder.telegram_id || preorder.user_id) {
                const depositVal = Number(preorder.deposit_fee || 0);
                if (depositVal > 0) {
                    await pool.query('UPDATE users SET balance = balance + ? WHERE id = ? OR telegram_id = ?', [
                        depositVal, preorder.user_id || 0, preorder.telegram_id || 0
                    ]);
                    try {
                        await pool.query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)', [
                            preorder.user_id || 0, depositVal, `Hoàn tiền cọc đơn đặt trước #${id}`
                        ]);
                    } catch (e) {
                        console.error('Balance log insert failed:', e);
                    }
                }
            }

            await pool.query('UPDATE preorders SET status = "refunded" WHERE id = ?', [id]);

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PREORDER',
                targetId: Number(id),
                details: { action: 'REFUND', depositFee: preorder.deposit_fee },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã hủy & hoàn tiền cọc vào ví khách hàng' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
