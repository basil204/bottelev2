import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'PRODUCT',
            details: 'Viewed products list',
            request
        });

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.*, c.name as category_name,
                    GREATEST(0, COALESCE(s.real_sold, 0) + COALESCE(p.sold_adjustment, 0)) AS sold_count,
                    COALESCE(s.real_sold, 0) AS real_sold
             FROM products p 
             LEFT JOIN categories c ON p.category_id = c.id 
             LEFT JOIN (
                SELECT product_id, COUNT(*) AS real_sold
                FROM accounts WHERE status = 'sold' GROUP BY product_id
             ) s ON s.product_id = p.id
             ORDER BY p.priority DESC, p.id DESC`
        );
        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { id, sold_count } = await request.json();
        const target = Math.max(0, Math.trunc(Number(sold_count)));
        if (!id || !Number.isFinite(target)) {
            return NextResponse.json({ error: 'Invalid product or sold count' }, { status: 400 });
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS real_sold FROM accounts WHERE product_id = ? AND status = 'sold'`,
            [id]
        );
        const realSold = Number(rows[0]?.real_sold || 0);
        await pool.query('UPDATE products SET sold_adjustment = ? WHERE id = ?', [target - realSold, id]);

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'PRODUCT',
            targetId: id,
            details: { sold_count: target, real_sold: realSold },
            request
        });

        return NextResponse.json({ success: true, sold_count: target, real_sold: realSold });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, price, description, type, code, priority, check_live, category_id } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        let finalCategoryId = category_id;
        if (!finalCategoryId) {
            const [defaultCats] = await pool.query<RowDataPacket[]>('SELECT id FROM categories WHERE name = "Khác"');
            if (defaultCats.length > 0) {
                finalCategoryId = defaultCats[0].id;
            }
        }

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO products (name, price, description, type, code, priority, check_live, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, price, description, type || 'stock', code || null, priority || 0, check_live || 0, finalCategoryId || null]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'PRODUCT',
            targetId: result.insertId,
            details: { name, price, type: type || 'stock', category_id: finalCategoryId },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ id: result.insertId, message: 'Product created' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, price, description, type, code, priority, check_live, category_id } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        let finalCategoryId = category_id;
        if (!finalCategoryId) {
            const [defaultCats] = await pool.query<RowDataPacket[]>('SELECT id FROM categories WHERE name = "Khác"');
            if (defaultCats.length > 0) {
                finalCategoryId = defaultCats[0].id;
            }
        }

        await pool.query(
            'UPDATE products SET name = ?, price = ?, description = ?, type = ?, code = ?, priority = ?, check_live = ?, category_id = ? WHERE id = ?',
            [name, price, description, type, code || null, priority || 0, check_live || 0, finalCategoryId || null, id]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'PRODUCT',
            targetId: id,
            details: { name, price, type, category_id: finalCategoryId },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ message: 'Product updated' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const reason = searchParams.get('reason');
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        if (!reason || reason.trim().length === 0) return NextResponse.json({ error: 'Lý do xóa là bắt buộc' }, { status: 400 });


        await pool.query('DELETE FROM products WHERE id = ?', [id]);

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'DELETE',
            targetType: 'PRODUCT',
            targetId: id,
            details: { reason },
            ipAddress,
            userAgent,
            request

        });

        return NextResponse.json({ message: 'Product deleted' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

