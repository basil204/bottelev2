import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = Number(searchParams.get('page')) || 1;
        const limit = Number(searchParams.get('limit')) || 10;
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const id = searchParams.get('id');

        const offset = (page - 1) * limit;

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'ORDER',
            details: 'Viewed orders list',
            request
        });

        // Single order query
        if (id) {
            const [rows] = await pool.query<RowDataPacket[]>(`
                SELECT orders.*, 
                       users.username, users.telegram_id, users.name as user_fullname,
                       COALESCE(products.name, orders.note, 'Sản phẩm') as product_name,
                       products.price as product_price,
                       products.delivery_type as delivery_type,
                       products.type as product_type
                FROM orders
                LEFT JOIN users ON orders.user_id = users.id
                LEFT JOIN products ON orders.product_id = products.id
                WHERE orders.id = ?
            `, [id]);
            if (rows.length === 0) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
            return NextResponse.json(rows[0]);
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (status && status !== 'all') {
            conditions.push('orders.status = ?');
            params.push(status);
        }

        if (search && search.trim().length > 0) {
            const term = `%${search.trim()}%`;
            conditions.push('(orders.id LIKE ? OR orders.invoice_code LIKE ? OR orders.email LIKE ? OR orders.note LIKE ? OR users.username LIKE ? OR CAST(users.telegram_id AS CHAR) LIKE ? OR products.name LIKE ?)');
            params.push(term, term, term, term, term, term, term);
        }

        if (startDate) {
            conditions.push('orders.created_at >= ?');
            params.push(`${startDate} 00:00:00`);
        }

        if (endDate) {
            conditions.push('orders.created_at <= ?');
            params.push(`${endDate} 23:59:59`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT orders.*, 
                   users.username, users.telegram_id, users.name as user_fullname,
                   COALESCE(products.name, orders.note, 'Sản phẩm') as product_name,
                   products.price as product_price,
                   products.delivery_type as delivery_type,
                   products.type as product_type
            FROM orders
            LEFT JOIN users ON orders.user_id = users.id
            LEFT JOIN products ON orders.product_id = products.id
            ${whereClause}
            ORDER BY orders.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const [countResult] = await pool.query<RowDataPacket[]>(`
            SELECT COUNT(*) as total FROM orders
            LEFT JOIN users ON orders.user_id = users.id
            LEFT JOIN products ON orders.product_id = products.id
            ${whereClause}
        `, params);

        const total = Number(countResult[0]?.total || 0);

        return NextResponse.json({
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, status, warrantyData, warrantyReason, resendTelegram } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) return NextResponse.json({ error: 'Missing Order ID' }, { status: 400 });

        const adminName = await getAdminFromCookie(request);

        if (resendTelegram) {
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'ORDER',
                targetId: Number(id),
                details: { action: 'RESEND_TELEGRAM' },
                ipAddress,
                userAgent,
                request
            });
            return NextResponse.json({ success: true, message: 'Đã gửi lại dữ liệu cho khách hàng' });
        }

        if (body.refundWallet) {
            const [orderRows] = await pool.query<RowDataPacket[]>('SELECT * FROM orders WHERE id = ?', [id]);
            if (orderRows.length === 0) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
            const order = orderRows[0];

            if (order.user_id && Number(order.price) > 0) {
                await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [order.price, order.user_id]);
                try {
                    await pool.query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)', [
                        order.user_id, order.price, `Hoàn 100% tiền đặt trước đơn hàng #${id}`
                    ]);
                } catch (e) {
                    console.error('Error inserting balance log:', e);
                }
            }

            await pool.query('UPDATE orders SET status = "cancelled" WHERE id = ?', [id]);

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'ORDER',
                targetId: Number(id),
                details: { action: 'REFUND_PREORDER', amount: order.price },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: `Đã hoàn 100% (${new Intl.NumberFormat('vi-VN').format(order.price)} đ) tiền vào ví khách hàng!` });
        }

        if (status) {
            await pool.query('UPDATE orders SET status = ?, completed_at = IF(? = "completed", NOW(), completed_at) WHERE id = ?', [status, status, id]);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'ORDER',
                targetId: Number(id),
                details: { status },
                ipAddress,
                userAgent,
                request
            });
            return NextResponse.json({ success: true, message: 'Cập nhật trạng thái thành công' });
        }

        if (warrantyData) {
            // Append new warranty account info into orders.email or note
            const [orderRows] = await pool.query<RowDataPacket[]>('SELECT email FROM orders WHERE id = ?', [id]);
            const currentEmail = orderRows[0]?.email || '';
            const updatedEmail = currentEmail ? `${currentEmail}\n[BẢO HÀNH ${new Date().toLocaleDateString('vi-VN')}]: ${warrantyData.trim()}` : warrantyData.trim();

            await pool.query('UPDATE orders SET email = ?, note = COALESCE(CONCAT(COALESCE(note, ""), " | Bảo hành: ", ?), ?) WHERE id = ?', [
                updatedEmail, warrantyReason || 'Đổi tài khoản mới', warrantyReason || 'Bảo hành tài khoản mới', id
            ]);

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'ORDER',
                targetId: Number(id),
                details: { action: 'WARRANTY_EXCHANGE', warrantyData, warrantyReason },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã thực hiện bảo hành thành công' });
        }

        return NextResponse.json({ error: 'No valid action provided' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
