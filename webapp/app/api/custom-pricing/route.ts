import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const productId = searchParams.get('productId');

        if (productId) {
            const [rows] = await pool.query<RowDataPacket[]>(`
                SELECT cp.*, p.name as product_name, p.price as original_price,
                       u.username, u.telegram_id, u.name as user_name
                FROM custom_pricing cp
                JOIN products p ON cp.product_id = p.id
                LEFT JOIN users u ON cp.user_id = u.id
                WHERE cp.product_id = ?
                ORDER BY cp.created_at DESC
            `, [productId]);
            return NextResponse.json({ data: rows });
        }

        if (userId) {
            const [rows] = await pool.query<RowDataPacket[]>(`
                SELECT cp.*, IF(cp.product_id = -1 OR cp.plan_id = 'gmail_edu', '🎓 Gmail EDU (Dịch vụ đặc biệt)', p.name) as product_name,
                       p.price as original_price
                FROM custom_pricing cp
                LEFT JOIN products p ON cp.product_id = p.id
                WHERE cp.user_id = ? OR cp.user_id IN (SELECT id FROM users WHERE telegram_id = ?)
                ORDER BY cp.created_at DESC
            `, [userId, userId]);
            return NextResponse.json({ data: rows });
        }

        return NextResponse.json({ data: [] });
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

        if (!userId || !productId || customPrice === undefined || customPrice === null) {
            return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        // Find user by ID or telegram_id
        const [userRows] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE id = ? OR telegram_id = ?', [userId, userId]);
        const targetUserId = userRows[0]?.id || Number(userId);

        const isGmailEdu = String(productId) === '-1' || productId === 'gmail_edu' || planId === 'gmail_edu';
        const targetProductId = isGmailEdu ? -1 : Number(productId);
        const targetPlanId = isGmailEdu ? 'gmail_edu' : (planId || null);
        const activeVal = isActive !== undefined ? (isActive ? 1 : 0) : 1;

        // Check if existing rule already exists for this user and product
        const [existing] = await pool.query<RowDataPacket[]>(`
            SELECT id FROM custom_pricing 
            WHERE user_id = ? AND product_id = ?
            LIMIT 1
        `, [targetUserId, targetProductId]);

        let targetId: number;
        if (existing && existing.length > 0) {
            targetId = existing[0].id;
            await pool.query(`
                UPDATE custom_pricing 
                SET custom_price = ?, scope = ?, is_active = ?, plan_id = ?
                WHERE id = ?
            `, [Number(customPrice), scope || 'ALL_ORDERS', activeVal, targetPlanId, targetId]);
        } else {
            const [res]: any = await pool.query(`
                INSERT INTO custom_pricing (user_id, product_id, plan_id, custom_price, scope, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                targetUserId,
                targetProductId,
                targetPlanId,
                Number(customPrice),
                scope || 'ALL_ORDERS',
                activeVal
            ]);
            targetId = res.insertId;
        }

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'PRODUCT',
            targetId,
            details: { targetUserId, productId, customPrice, scope },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true, message: 'Đã lưu giá riêng cho khách hàng' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, action, customPrice, scope, isActive } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        if (action === 'toggle_active') {
            await pool.query('UPDATE custom_pricing SET is_active = NOT is_active WHERE id = ?', [id]);
            return NextResponse.json({ success: true, message: 'Đã thay đổi trạng thái giá riêng' });
        }

        if (action === 'update') {
            const updates: string[] = [];
            const params: any[] = [];

            if (customPrice !== undefined) {
                updates.push('custom_price = ?');
                params.push(Number(customPrice));
            }
            if (scope !== undefined) {
                updates.push('scope = ?');
                params.push(scope);
            }
            if (isActive !== undefined) {
                updates.push('is_active = ?');
                params.push(isActive ? 1 : 0);
            }

            if (updates.length > 0) {
                params.push(id);
                await pool.query(`UPDATE custom_pricing SET ${updates.join(', ')} WHERE id = ?`, params);
            }

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PRODUCT',
                targetId: id,
                details: { customPrice, scope, isActive },
                ipAddress,
                userAgent,
                request
            });

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
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await pool.query('DELETE FROM custom_pricing WHERE id = ?', [id]);

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'DELETE',
            targetType: 'PRODUCT',
            targetId: Number(id),
            details: { id },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true, message: 'Đã xóa giá riêng thành công' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
