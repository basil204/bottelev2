import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { sendMessage } from '@/lib/telegram';
import { getTemplateFromDb, renderTemplate } from '@/lib/templateHelper';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const search = searchParams.get('search');
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const telegramId = searchParams.get('telegramId');
        const filterTab = searchParams.get('tab') || 'all'; // all | unreplied | unread | replied

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'SYSTEM',
            details: `Viewed support / chat (action: ${action || 'list'})`,
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

        // 1. CHAT CONVERSATIONS LIST (Realtime categorized list)
        if (action === 'chat_conversations') {
            let searchClause = '';
            const searchParamsList: any[] = [];
            if (search && search.trim()) {
                const q = `%${search.trim()}%`;
                searchClause = 'AND (u.name LIKE ? OR u.username LIKE ? OR CAST(u.telegram_id AS CHAR) LIKE ? OR sr_latest.customer_message LIKE ?)';
                searchParamsList.push(q, q, q, q);
            }

            // Query users with their latest interaction & unreplied count
            const [conversations] = await pool.query<RowDataPacket[]>(`
                SELECT 
                    u.id as user_id,
                    u.telegram_id,
                    u.name,
                    u.username,
                    u.balance,
                    sr_latest.id as last_ticket_id,
                    sr_latest.customer_message as last_customer_message,
                    sr_latest.admin_reply as last_admin_reply,
                    sr_latest.status as last_status,
                    sr_latest.request_type as last_request_type,
                    sr_latest.created_at as last_message_time,
                    sr_latest.updated_at as last_reply_time,
                    COALESCE(unrep.unreplied_count, 0) as unreplied_count,
                    COALESCE(total_msg.total_messages, 0) as total_messages
                FROM users u
                LEFT JOIN (
                    -- Get the latest message row per user
                    SELECT sr.*
                    FROM support_requests sr
                    INNER JOIN (
                        SELECT COALESCE(telegram_id, user_id) as tid, MAX(id) as max_id
                        FROM support_requests
                        GROUP BY COALESCE(telegram_id, user_id)
                    ) latest_ids ON sr.id = latest_ids.max_id
                ) sr_latest ON (u.telegram_id = sr_latest.telegram_id OR u.id = sr_latest.user_id)
                LEFT JOIN (
                    -- Count unanswered requests per user
                    SELECT COALESCE(telegram_id, user_id) as tid, COUNT(*) as unreplied_count
                    FROM support_requests
                    WHERE (admin_reply IS NULL OR admin_reply = '')
                      AND status != 'completed'
                    GROUP BY COALESCE(telegram_id, user_id)
                ) unrep ON (u.telegram_id = unrep.tid OR u.id = unrep.tid)
                LEFT JOIN (
                    -- Total messages per user
                    SELECT COALESCE(telegram_id, user_id) as tid, COUNT(*) as total_messages
                    FROM support_requests
                    GROUP BY COALESCE(telegram_id, user_id)
                ) total_msg ON (u.telegram_id = total_msg.tid OR u.id = total_msg.tid)
                WHERE (sr_latest.id IS NOT NULL OR u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
                ${searchClause}
                ORDER BY 
                    (unrep.unreplied_count > 0) DESC,
                    COALESCE(sr_latest.created_at, u.created_at) DESC
                LIMIT 100
            `, searchParamsList);

            // Calculate overview KPI counts
            let totalUnreplied = 0;
            let totalNewToday = 0;

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const filteredList = (conversations as any[]).filter(c => {
                const latestIsAdmin = Boolean(c.last_admin_reply && c.last_admin_reply.trim() !== '');
                const isUnreplied = !latestIsAdmin && Boolean(c.last_customer_message) && c.last_status !== 'completed';
                const lastTime = c.last_message_time ? new Date(c.last_message_time) : null;
                const isToday = lastTime && lastTime >= todayStart;

                if (isUnreplied) {
                    totalUnreplied++;
                    if (isToday) totalNewToday++;
                }

                if (filterTab === 'unreplied') return isUnreplied;
                if (filterTab === 'unread' || filterTab === 'newest') return isUnreplied;
                if (filterTab === 'replied') return latestIsAdmin || c.last_status === 'completed';
                return true;
            });

            return NextResponse.json({
                data: filteredList,
                stats: {
                    total: conversations.length,
                    unreplied: totalUnreplied,
                    newToday: totalNewToday
                }
            });
        }

        // 2. CHAT HISTORY FOR A SPECIFIC USER (Sequential chronological message stream)
        if (action === 'chat_history' || telegramId) {
            const tid = telegramId;
            if (!tid) return NextResponse.json({ data: [] });

            const [rows] = await pool.query<RowDataPacket[]>(`
                SELECT id, user_id, telegram_id, order_id, order_code, request_type, status,
                       customer_message, admin_reply, created_at, updated_at
                FROM support_requests
                WHERE telegram_id = ? OR user_id = ?
                ORDER BY created_at ASC, id ASC
            `, [tid, tid]);

            const messages: any[] = [];
            rows.forEach((r) => {
                if (r.customer_message) {
                    messages.push({
                        id: `cust_${r.id}`,
                        ticket_id: r.id,
                        sender: 'user',
                        text: r.customer_message,
                        status: r.status,
                        request_type: r.request_type,
                        order_id: r.order_id,
                        order_code: r.order_code,
                        created_at: r.created_at
                    });
                }
                if (r.admin_reply) {
                    messages.push({
                        id: `admin_${r.id}`,
                        ticket_id: r.id,
                        sender: 'admin',
                        text: r.admin_reply,
                        status: r.status,
                        created_at: r.updated_at || r.created_at
                    });
                }
            });

            return NextResponse.json({ data: messages, raw_tickets: rows });
        }

        // 3. DEFAULT: TICKET / WARRANTY LIST
        const conditions: string[] = [];
        const params: any[] = [];

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
            ORDER BY 
                (sr.status = 'completed') ASC,
                sr.created_at ASC
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
                // If replyText is raw user text, format with support template if available
                let finalMsg = replyText;
                if (!replyText.includes('PHẢN HỒI TỪ ADMIN') && !replyText.startsWith('✅')) {
                    const templateStr = await getTemplateFromDb('msg_template_support');
                    finalMsg = renderTemplate(templateStr, {
                        ticket_id: requestId || 'SUPPORT',
                        product_name: 'Hỗ trợ dịch vụ',
                        reply_text: replyText,
                        status: markCompleted ? 'Đã hoàn tất' : 'Đang hỗ trợ'
                    });
                }
                await sendMessage(telegramId, finalMsg);
            } catch (e) {
                console.error('Telegram notification error:', e);
            }

            const updateStatus = markCompleted ? 'completed' : 'processing';

            if (requestId) {
                await pool.query('UPDATE support_requests SET admin_reply = ?, status = ? WHERE id = ?', [replyText, updateStatus, requestId]);
            } else {
                // Find user id if possible
                const [uRows] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE telegram_id = ?', [telegramId]);
                const uid = uRows[0]?.id || null;

                // Insert new row representing this live chat response
                await pool.query(
                    'INSERT INTO support_requests (user_id, telegram_id, request_type, status, admin_reply, created_at, updated_at) VALUES (?, ?, "SUPPORT", ?, ?, NOW(), NOW())',
                    [uid, telegramId, updateStatus, replyText]
                );
            }

            // Update all previous unanswered requests for this customer to indicate admin has responded
            if (telegramId) {
                await pool.query(
                    'UPDATE support_requests SET admin_reply = COALESCE(admin_reply, ?), status = ? WHERE (telegram_id = ? OR user_id = ?) AND (admin_reply IS NULL OR admin_reply = "")',
                    [replyText, updateStatus, telegramId, telegramId]
                );
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

        if (action === 'create_ticket') {
            const { orderCode, productName, customerMessage, requestType } = body;
            if (!telegramId) return NextResponse.json({ error: 'Missing telegramId' }, { status: 400 });

            const [uRows] = await pool.query<RowDataPacket[]>('SELECT id, username FROM users WHERE telegram_id = ?', [telegramId]);
            const uid = uRows[0]?.id || null;

            const [res] = await pool.query<ResultSetHeader>(
                `INSERT INTO support_requests (user_id, telegram_id, order_code, product_name, request_type, customer_message, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, "processing", NOW())`,
                [uid, telegramId, orderCode || null, productName || null, requestType || 'WARRANTY', customerMessage || null]
            );

            const templateStr = await getTemplateFromDb('msg_template_warranty_request');
            const confirmMsg = renderTemplate(templateStr, {
                order_code: orderCode || 'N/A',
                product_name: productName || 'Sản phẩm bảo hành',
                reason: customerMessage || 'Yêu cầu hỗ trợ/bảo hành',
                time: new Date().toLocaleString('vi-VN'),
                username: uRows[0]?.username || ''
            });

            try {
                await sendMessage(telegramId, confirmMsg);
            } catch (e) {
                console.error('Error sending warranty request confirmation:', e);
            }

            return NextResponse.json({ success: true, id: res.insertId, message: 'Đã tạo yêu cầu bảo hành thành công!' });
        }

        if (action === 'mark_all_read' || action === 'mark_completed') {
            if (telegramId) {
                await pool.query('UPDATE support_requests SET status = "completed" WHERE (telegram_id = ? OR user_id = ?) AND status != "completed"', [telegramId, telegramId]);
            } else if (requestId) {
                await pool.query('UPDATE support_requests SET status = "completed" WHERE id = ?', [requestId]);
            }
            return NextResponse.json({ success: true, message: 'Đã đánh dấu xử lý xong' });
        }

        if (action === 'process_warranty') {
            if (!orderId || !newAccountData) {
                return NextResponse.json({ error: 'Vui lòng chọn/nhập tài khoản bảo hành mới' }, { status: 400 });
            }

            const [orderRows] = await pool.query<RowDataPacket[]>('SELECT o.*, u.telegram_id FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?', [orderId]);
            const order = orderRows[0];

            if (order) {
                const note = `[BẢO HÀNH ${new Date().toLocaleDateString('vi-VN')}]: ${warrantyNote || 'Đổi tài khoản mới'}`;
                await pool.query('UPDATE orders SET note = ?, status = "completed" WHERE id = ?', [note, orderId]);

                if (order.telegram_id) {
                    const templateStr = await getTemplateFromDb('msg_template_delivery');
                    const msg = renderTemplate(templateStr, {
                        order_code: order.invoice_code || `#${orderId}`,
                        product_name: 'Đơn hàng bảo hành',
                        data: newAccountData,
                        note: warrantyNote || 'Đổi mới bảo hành thành công',
                        price: new Intl.NumberFormat('vi-VN').format(order.price || 0),
                        username: ''
                    });
                    try {
                        await sendMessage(order.telegram_id, msg);
                    } catch (e) {
                        console.error('Telegram send warranty error:', e);
                    }
                }
            }

            return NextResponse.json({ success: true, message: 'Đã xử lý bảo hành và gửi dữ liệu cho khách hàng!' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
