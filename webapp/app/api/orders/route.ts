import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = Number(searchParams.get('page')) || 1;
        const limit = Number(searchParams.get('limit')) || 10;
        const offset = (page - 1) * limit;

        const [rows] = await pool.query(`
      SELECT orders.*, users.username, products.name as product_name
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
