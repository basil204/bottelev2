import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = Number(searchParams.get('page')) || 1;
        const limit = Number(searchParams.get('limit')) || 10;
        const search = searchParams.get('search') || '';
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM users';
        let countQuery = 'SELECT COUNT(*) as total FROM users';
        let params: any[] = [];

        if (search) {
            const searchClause = ' WHERE username LIKE ? OR telegram_id LIKE ?';
            query += searchClause;
            countQuery += searchClause;
            params = [`%${search}%`, `%${search}%`];
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.query(query, params);
        const [countResult] = await pool.query<any[]>(countQuery, search ? [`%${search}%`, `%${search}%`] : []);
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

        // Notify User
        try {
            const [userRows] = await pool.query<any[]>('SELECT telegram_id FROM users WHERE id = ?', [id]);
            const telegramId = userRows[0]?.telegram_id;
            if (telegramId) {
                const { sendMessage } = await import('@/lib/telegram');
                const actionText = type === 'add' ? 'được cộng' : 'bị trừ';
                const message = `💰 Tài khoản của bạn vừa ${actionText} ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}.\n📝 Lý do: ${reason || 'Admin thay đổi'}`;
                await sendMessage(telegramId, message);
            }
        } catch (notifyError) {
            console.error("Failed to notify user:", notifyError);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
