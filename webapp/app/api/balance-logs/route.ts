import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const limit = Number(searchParams.get('limit')) || 20;

        if (!userId) {
            return NextResponse.json({ data: [] });
        }

        // Get balance logs with order info if reason contains order ID
        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT bl.*, u.username, u.telegram_id, u.balance as current_balance
            FROM balance_logs bl
            LEFT JOIN users u ON bl.user_id = u.id
            WHERE bl.user_id = ? OR bl.user_id IN (SELECT id FROM users WHERE telegram_id = ?)
            ORDER BY bl.created_at DESC
            LIMIT ?
        `, [userId, userId, limit]);

        return NextResponse.json({ data: rows });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
