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
            `SELECT p.*, c.name as category_name 
             FROM products p 
             LEFT JOIN categories c ON p.category_id = c.id 
             ORDER BY p.priority DESC, p.id DESC`
        );
        return NextResponse.json(rows);
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

