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

        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM products ORDER BY priority DESC, id DESC');
        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, price, description, type, code, priority, check_live } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO products (name, price, description, type, code, priority, check_live) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, price, description, type || 'stock', code || null, priority || 0, check_live || 0]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'PRODUCT',
            targetId: result.insertId,
            details: { name, price, type: type || 'stock' },
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
        const { id, name, price, description, type, code, priority, check_live } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        await pool.query(
            'UPDATE products SET name = ?, price = ?, description = ?, type = ?, code = ?, priority = ?, check_live = ? WHERE id = ?',
            [name, price, description, type, code || null, priority || 0, check_live || 0, id]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'PRODUCT',
            targetId: id,
            details: { name, price, type },
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

