import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const detailId = searchParams.get('detailId');
        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'CATEGORY' as any,
            details: 'Viewed categories list',
            request
        });

        if (detailId) {
            const [categoryRows] = await pool.query<RowDataPacket[]>(
                'SELECT id, name, priority, emoji, custom_emoji_id FROM categories WHERE id = ?', [detailId]
            );
            if (!categoryRows.length) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
            const [products] = await pool.query<RowDataPacket[]>(`
                SELECT p.id, p.name, p.code, p.price, p.type,
                       COUNT(DISTINCT a.id) AS total_accounts,
                       COUNT(DISTINCT CASE WHEN a.status = 'available' THEN a.id END) AS available_accounts,
                       COUNT(DISTINCT CASE WHEN a.status = 'sold' THEN a.id END) AS sold_accounts
                FROM products p
                LEFT JOIN accounts a ON a.product_id = p.id
                WHERE p.category_id = ?
                GROUP BY p.id
                ORDER BY p.priority DESC, p.id DESC
            `, [detailId]);
            return NextResponse.json({ category: categoryRows[0], products });
        }

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT
                c.*,
                COUNT(DISTINCT p.id) AS product_count,
                COUNT(DISTINCT a.id) AS all_accounts,
                COUNT(DISTINCT CASE WHEN a.status = 'available' THEN a.id END) AS total_accounts,
                COUNT(DISTINCT CASE WHEN a.status = 'sold' THEN a.id END) AS sold_accounts
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            LEFT JOIN accounts a ON a.product_id = p.id
            GROUP BY c.id
            ORDER BY c.priority DESC, c.id DESC
        `);
        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, priority, emoji, custom_emoji_id } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Tên thư mục là bắt buộc' }, { status: 400 });
        }

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO categories (name, priority, emoji, custom_emoji_id) VALUES (?, ?, ?, ?)',
            [name.trim(), priority || 0, emoji || null, custom_emoji_id || null]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'CATEGORY' as any,
            targetId: result.insertId,
            details: { name: name.trim(), priority: priority || 0, emoji, custom_emoji_id },
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
        const { id, name, priority, emoji, custom_emoji_id } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Tên thư mục là bắt buộc' }, { status: 400 });
        }

        await pool.query(
            'UPDATE categories SET name = ?, priority = ?, emoji = ?, custom_emoji_id = ? WHERE id = ?',
            [name.trim(), priority || 0, emoji || null, custom_emoji_id || null, id]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'CATEGORY' as any,
            targetId: id,
            details: { name: name.trim(), priority: priority || 0, emoji, custom_emoji_id },
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

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { reorder } = body;
        const adminName = await getAdminFromCookie(request);

        if (Array.isArray(reorder)) {
            for (const item of reorder) {
                if (item.id && item.priority !== undefined) {
                    await pool.query('UPDATE categories SET priority = ? WHERE id = ?', [item.priority, item.id]);
                }
            }
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'CATEGORY' as any,
                details: { reorder_count: reorder.length },
                request
            });
            return NextResponse.json({ success: true, message: 'Reordered categories successfully' });
        }
        return NextResponse.json({ error: 'No reorder payload' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
