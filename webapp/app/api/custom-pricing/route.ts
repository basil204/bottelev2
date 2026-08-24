import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ data: [] });
        }

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT cp.*, p.name as product_name
            FROM custom_pricing cp
            LEFT JOIN products p ON cp.product_id = p.id
            WHERE cp.user_id = ? OR cp.user_id IN (SELECT id FROM users WHERE telegram_id = ?)
            ORDER BY cp.created_at DESC
        `, [userId, userId]);

        return NextResponse.json({ data: rows });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, productId, planId, customPrice, scope, isActive } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!userId || !productId || !customPrice) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        // Find user by ID or telegram_id
        const [userRows] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE id = ? OR telegram_id = ?', [userId, userId]);
        const targetUserId = userRows[0]?.id || Number(userId);

        const [res]: any = await pool.query(`
            INSERT INTO custom_pricing (user_id, product_id, plan_id, custom_price, scope, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            targetUserId,
            Number(productId),
            planId || null,
            Number(customPrice),
            scope || 'ALL_ORDERS',
            isActive ? 1 : 0
        ]);

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'PRODUCT',
            targetId: res.insertId,
            details: { targetUserId, productId, customPrice, scope },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true, message: 'Đã tạo giá riêng cho khách hàng' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, action, customPrice, scope, isActive } = body;

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        if (action === 'toggle_active') {
            await pool.query('UPDATE custom_pricing SET is_active = NOT is_active WHERE id = ?', [id]);
            return NextResponse.json({ success: true, message: 'Đã thay đổi trạng thái giá riêng' });
        }

        if (action === 'update') {
            await pool.query(
                'UPDATE custom_pricing SET custom_price = ?, scope = ?, is_active = ? WHERE id = ?',
                [Number(customPrice) || 0, scope || 'ALL_ORDERS', isActive ? 1 : 0, id]
            );
            return NextResponse.json({ success: true, message: 'Đã cập nhật giá riêng' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await pool.query('DELETE FROM custom_pricing WHERE id = ?', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
