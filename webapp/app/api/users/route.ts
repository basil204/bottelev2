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

            // 2. Create Balance Log
            const logReason = reason || (type === 'add' ? 'Admin allowed' : 'Admin deducted');
            await connection.query(
                'INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)',
                [id, type === 'add' ? amount : -amount, logReason]
            );

            // 3. Notify User
            // Get Bot Token from Settings first
            try {
                const [settings] = await connection.query<any[]>('SELECT `value` FROM settings WHERE `key` = "telegram_bot_token"');
                const dbToken = settings[0]?.value;

                const [userRows] = await connection.query<any[]>('SELECT telegram_id FROM users WHERE id = ?', [id]);
                const telegramId = userRows[0]?.telegram_id;

                if (telegramId) {
                    const { sendMessage } = await import('@/lib/telegram');
                    const actionText = type === 'add' ? 'được cộng' : 'bị trừ';
                    const message = `💰 Tài khoản của bạn vừa ${actionText} ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}.\n📝 Lý do: ${reason || 'Admin thay đổi'}`;

                    // Fire and forget notification to not block transaction? 
                    // Better to await it or at least start it. 
                    // Since it's an external API call, maybe better to do it AFTER commit but before return.
                    // But we are inside transaction. Let's move it after commit.
                }
            } catch (notifyError) {
                console.error("Failed to prepare notification:", notifyError);
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        // Notify User (Outside transaction to avoid holding lock during network call)
        try {
            // We need to re-fetch settings/user if we lost them, OR better, fetch them inside and pass out.
            // Let's refetch to be safe and simple, or just do it.
            const [settings] = await pool.query<any[]>('SELECT `value` FROM settings WHERE `key` = "telegram_bot_token"');
            const dbToken = settings[0]?.value;

            const [userRows] = await pool.query<any[]>('SELECT telegram_id FROM users WHERE id = ?', [id]);
            const telegramId = userRows[0]?.telegram_id;

            if (telegramId) {
                const { sendMessage } = await import('@/lib/telegram');
                const actionText = type === 'add' ? 'được cộng' : 'bị trừ';
                const message = `💰 Tài khoản của bạn vừa ${actionText} ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}.\n📝 Lý do: ${reason || 'Admin thay đổi'}`;
                await sendMessage(telegramId, message, dbToken);
            }
        } catch (e) {
            console.error("Notification failed", e);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
