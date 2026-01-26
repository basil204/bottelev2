import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = Number(searchParams.get('page')) || 1;
        const limit = Number(searchParams.get('limit')) || 10;
        const offset = (page - 1) * limit;

        const [rows] = await pool.query(`
      SELECT * FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

        const [countResult] = await pool.query<any[]>('SELECT COUNT(*) as total FROM users');
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

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, amount, type, reason } = body; // type: 'add' or 'subtract'

        if (!id || !amount || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Update User Balance
            const updateQuery = type === 'add'
                ? 'UPDATE users SET balance = balance + ? WHERE id = ?'
                : 'UPDATE users SET balance = balance - ? WHERE id = ?';

            await connection.query(updateQuery, [amount, id]);

            // 2. Create Balance Log
            const logReason = reason || (type === 'add' ? 'Admin allowed' : 'Admin deducted');
            await connection.query(
                'INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)',
                [id, type === 'add' ? amount : -amount, logReason]
            );

            await connection.commit();
            return NextResponse.json({ success: true });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
