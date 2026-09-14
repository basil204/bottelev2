import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const limit = Number(searchParams.get('limit')) || 30;

        let query = `
            SELECT bl.*, u.username, u.telegram_id, u.balance as current_balance
            FROM balance_logs bl
            LEFT JOIN users u ON bl.user_id = u.id
        `;
        const params: any[] = [];

        if (userId && userId !== 'all') {
            query += ` WHERE bl.user_id = ? OR bl.user_id IN (SELECT id FROM users WHERE telegram_id = ?)`;
            params.push(userId, userId);
        }

        query += ` ORDER BY bl.created_at DESC LIMIT ?`;
        params.push(limit);

        const [rows] = await pool.query<RowDataPacket[]>(query, params);

        return NextResponse.json({ data: rows });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
