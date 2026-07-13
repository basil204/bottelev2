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
            targetType: 'CATEGORY' as any,
            details: 'Viewed categories list',
            request
        });

        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM categories ORDER BY priority DESC, id DESC');
        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, priority } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Tên thư mục là bắt buộc' }, { status: 400 });
        }

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO categories (name, priority) VALUES (?, ?)',
            [name.trim(), priority || 0]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'CATEGORY' as any,
            targetId: result.insertId,
            details: { name: name.trim(), priority: priority || 0 },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ id: result.insertId, message: 'Category created' });
    } catch (error: any) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'Thư mục này đã tồn tại' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, priority } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Tên thư mục là bắt buộc' }, { status: 400 });
        }

        await pool.query(
            'UPDATE categories SET name = ?, priority = ? WHERE id = ?',
            [name.trim(), priority || 0, id]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'CATEGORY' as any,
            targetId: id,
            details: { name: name.trim(), priority: priority || 0 },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ message: 'Category updated' });
    } catch (error: any) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'Tên thư mục này đã tồn tại' }, { status: 400 });
        }
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
        if (!reason || reason.trim().length === 0) {
            return NextResponse.json({ error: 'Lý do xóa là bắt buộc' }, { status: 400 });
        }

        // Check if there are products using this category
        const [products] = await pool.query<RowDataPacket[]>('SELECT id FROM products WHERE category_id = ?', [id]);
        if (products.length > 0) {
            return NextResponse.json(
                { error: 'Không thể xóa thư mục này vì đang có sản phẩm thuộc về nó. Vui lòng chuyển các sản phẩm đó sang thư mục khác trước.' },
                { status: 400 }
            );
        }

        // Do not allow deleting the default category 'Khác'
        const [categoryRows] = await pool.query<RowDataPacket[]>('SELECT name FROM categories WHERE id = ?', [id]);
        if (categoryRows.length > 0 && categoryRows[0].name === 'Khác') {
            return NextResponse.json({ error: 'Không thể xóa thư mục mặc định "Khác".' }, { status: 400 });
        }

        await pool.query('DELETE FROM categories WHERE id = ?', [id]);

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'DELETE',
            targetType: 'CATEGORY' as any,
            targetId: Number(id),
            details: { reason },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ message: 'Category deleted' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
