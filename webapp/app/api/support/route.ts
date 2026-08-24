import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendMessage } from '@/lib/telegram';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const telegramId = searchParams.get('telegramId');

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'SYSTEM',
            details: 'Viewed support and warranty requests list',
            request
        });

        // Ensure table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                telegram_id BIGINT NULL,
                order_id INT NULL,
                order_code VARCHAR(100) NULL,
                product_name VARCHAR(255) NULL,
                request_type VARCHAR(50) DEFAULT 'WARRANTY', -- WARRANTY | SUPPORT
                status VARCHAR(50) DEFAULT 'processing', -- processing | completed | pending
                customer_message TEXT NULL,
                admin_reply TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        const conditions: string[] = [];
        const params: any[] = [];

        if (telegramId) {
            conditions.push('(sr.telegram_id = ? OR u.telegram_id = ?)');
            params.push(telegramId, telegramId);
        }

        if (status && status !== 'all') {
            conditions.push('sr.status = ?');
            params.push(status);
        }

        if (type && type !== 'all') {
            conditions.push('sr.request_type = ?');
            params.push(type);
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            conditions.push('(sr.customer_message LIKE ? OR u.name LIKE ? OR u.username LIKE ? OR sr.order_code LIKE ?)');
            params.push(term, term, term, term);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT sr.*,
                   u.name as customer_name,
                   u.username as customer_username,
                   u.telegram_id as customer_telegram_id,
                   o.price as order_price,
                   o.note as order_note,
                   p.name as product_name_joined
            FROM support_requests sr
            LEFT JOIN users u ON sr.user_id = u.id OR sr.telegram_id = u.telegram_id
            LEFT JOIN orders o ON sr.order_id = o.id
            LEFT JOIN products p ON o.product_id = p.id
            ${whereClause}
            ORDER BY sr.created_at DESC
        `, params);

        return NextResponse.json({ data: rows });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, requestId, telegramId, replyText, markCompleted, orderId, newAccountData, warrantyNote } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (action === 'send_reply') {
            if (!telegramId || !replyText) {
                return NextResponse.json({ error: 'Vui lòng nhập nội dung tin nhắn' }, { status: 400 });
            }

            // Send message via Telegram bot
            try {
                await sendMessage(telegramId, replyText);
            } catch (e) {
                console.error('Telegram notification error:', e);
            }

            if (requestId) {
                const updateStatus = markCompleted ? 'completed' : 'processing';
                await pool.query('UPDATE support_requests SET admin_reply = ?, status = ? WHERE id = ?', [replyText, updateStatus, requestId]);
            }

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SYSTEM',
                targetId: requestId || telegramId,
                details: { action: 'SEND_REPLY', markCompleted, replyText },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn phản hồi tới khách hàng thành công!' });
        }

        if (action === 'process_warranty') {
            if (!orderId || !newAccountData) {
                return NextResponse.json({ error: 'Vui lòng chọn/nhập tài khoản bảo hành mới' }, { status: 400 });
            }

            // Fetch order info
            const [orderRows] = await pool.query<RowDataPacket[]>('SELECT o.*, u.telegram_id FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?', [orderId]);
            const order = orderRows[0];

            if (order) {
                // Log warranty in database or order note
                const note = `[BẢO HÀNH ${new Date().toLocaleDateString('vi-VN')}]: ${warrantyNote || 'Đổi tài khoản mới'}`;
                await pool.query('UPDATE orders SET note = ?, status = "completed" WHERE id = ?', [note, orderId]);

                // Send Telegram message with new account
                if (order.telegram_id) {
                    const msg = `✅ SHOP ĐÃ BẢO HÀNH ĐƠN HÀNG #${order.invoice_code || orderId}\n\n📦 Dữ liệu tài khoản mới:\n\`${newAccountData}\`\n\n📝 Ghi chú: ${warrantyNote || 'Đổi mới bảo hành'}`;
                    try {
                        await sendMessage(order.telegram_id, msg);
                    } catch (e) {
                        console.error('Telegram send warranty error:', e);
                    }
                }
            }

            return NextResponse.json({ success: true, message: 'Đã xử lý bảo hành và gửi dữ liệu cho khách hàng!' });
        }

        if (action === 'mark_completed') {
            if (!requestId) return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
            await pool.query('UPDATE support_requests SET status = "completed" WHERE id = ?', [requestId]);
            return NextResponse.json({ success: true, message: 'Đã đánh dấu xử lý xong' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
