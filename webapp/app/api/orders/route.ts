import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';


export async function GET(request: Request) {
    try {
        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'ORDER',
            details: 'Viewed orders list',
            request
        });

        const { searchParams } = new URL(request.url);

        const page = Number(searchParams.get('page')) || 1;
        const limit = Number(searchParams.get('limit')) || 10;
        const offset = (page - 1) * limit;

        const [rows] = await pool.query(`
      SELECT orders.*, users.username, COALESCE(products.name, orders.note, 'Sản phẩm') as product_name
      FROM orders
      LEFT JOIN users ON orders.user_id = users.id
      LEFT JOIN products ON orders.product_id = products.id
      ORDER BY orders.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

        const [countResult] = await pool.query<any[]>('SELECT COUNT(*) as total FROM orders');
        const total = countResult[0].total;

        return NextResponse.json({
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
