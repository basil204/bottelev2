import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { logAdminAction, getAdminFromCookie, getRequestInfo } from '@/lib/adminLog';


export async function GET(request: Request) {
    try {
        await dbReady;
        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'USER',
            details: 'Viewed users list',
            request
        });

        const { searchParams } = new URL(request.url);

        const page = Number(searchParams.get('page')) || 1;
        const limit = Number(searchParams.get('limit')) || 10;
        const search = searchParams.get('search') || '';
        const offset = (page - 1) * limit;

        let query = `SELECT u.*, COALESCE(d.total_deposited, 0) AS total_deposited
                     FROM users u
                     LEFT JOIN (
                       SELECT user_id, SUM(amount) AS total_deposited
                       FROM deposits WHERE status = 'approved' GROUP BY user_id
                     ) d ON d.user_id = u.id`;
        let countQuery = 'SELECT COUNT(*) as total FROM users u';
        let params: any[] = [];

        if (search) {
            const searchClause = ' WHERE u.username LIKE ? OR u.telegram_id LIKE ? OR u.customer_tag LIKE ? OR u.admin_note LIKE ?';
            query += searchClause;
            countQuery += searchClause;
            params = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
        }

        query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.query<any[]>(query, params);
        const [countResult] = await pool.query<any[]>(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : []);
        const total = countResult[0].total;

        const [rankRows] = await pool.query<any[]>("SELECT `value` FROM settings WHERE `key` = 'deposit_rank_promotions' LIMIT 1");
        let ranks: { name: string; min_total: number; bonus_percentage: number }[] = [];
        try {
            const parsed = JSON.parse(rankRows[0]?.value || '[]');
            if (Array.isArray(parsed)) ranks = parsed.sort((a, b) => Number(a.min_total || 0) - Number(b.min_total || 0));
        } catch {
            ranks = [];
        }

        const usersWithRank = rows.map(user => {
            const deposited = Number(user.total_deposited || 0);
            const currentRank = [...ranks].reverse().find(rank => deposited >= Number(rank.min_total || 0));
            const nextRank = ranks.find(rank => deposited < Number(rank.min_total || 0));
            const currentFloor = Number(currentRank?.min_total || 0);
            const nextTarget = Number(nextRank?.min_total || 0);
            const rankProgress = nextRank
                ? Math.min(100, Math.max(0, ((deposited - currentFloor) / Math.max(1, nextTarget - currentFloor)) * 100))
                : (currentRank ? 100 : 0);
            return {
                ...user,
                rank_name: currentRank?.name || 'Chưa có rank',
                rank_bonus_percentage: Number(currentRank?.bonus_percentage || 0),
                next_rank_name: nextRank?.name || null,
                next_rank_min: nextRank?.min_total || null,
                rank_progress: Math.round(rankProgress)
            };
        });

        const [walletTotalRows] = await pool.query<any[]>('SELECT COALESCE(SUM(balance), 0) as total_balance FROM users');
        const [todayUsersRows] = await pool.query<any[]>('SELECT COUNT(*) as today_count FROM users WHERE DATE(created_at) = CURDATE()');

        return NextResponse.json({
            data: usersWithRank,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            stats: {
                totalUsers: total,
                todayRegisteredUsers: Number(todayUsersRows[0]?.today_count || 0),
                totalWalletBalance: Number(walletTotalRows[0]?.total_balance || 0),
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        await dbReady;
        const body = await request.json();
        const { id, amount, type, reason, customer_tag, admin_note } = body; // type: 'add' or 'subtract'
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (type === 'admin_metadata') {
            await pool.query('UPDATE users SET customer_tag = ?, admin_note = ? WHERE id = ?', [String(customer_tag || '').trim() || null, String(admin_note || '').trim() || null, id]);
            await logAdminAction({
                action: 'UPDATE', targetType: 'USER', targetId: id,
                details: { customer_tag: customer_tag || null, admin_note: admin_note || null }, request
            });
            return NextResponse.json({ success: true });
        }

        if (type === 'toggle_ban') {
            const [uRows] = await pool.query<any[]>('SELECT is_banned FROM users WHERE id = ?', [id]);
            const currentIsBanned = Boolean(uRows[0]?.is_banned);
            const newIsBanned = !currentIsBanned;
            await pool.query('UPDATE users SET is_banned = ? WHERE id = ?', [newIsBanned ? 1 : 0, id]);
            await logAdminAction({
                action: 'UPDATE', targetType: 'USER', targetId: id,
                details: { is_banned: newIsBanned }, request
            });
            return NextResponse.json({ success: true, is_banned: newIsBanned });
        }

        if (!amount || !['add', 'subtract'].includes(type)) {
            return NextResponse.json({ error: 'Invalid balance update' }, { status: 400 });
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

        // Log admin action
        await logAdminAction({
            action: 'UPDATE',
            targetType: 'USER',
            targetId: id,
            details: { type, amount, reason: reason || 'Admin thay đổi' },
            request
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
