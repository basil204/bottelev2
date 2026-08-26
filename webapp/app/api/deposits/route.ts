import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendMessage } from '@/lib/telegram';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';


export async function GET(request: Request) {
    try {
        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'DEPOSIT',
            details: 'Viewed deposit requests list',
            request
        });

        const { searchParams } = new URL(request.url);

        const page = Number(searchParams.get('page')) || 1;
        const limit = Number(searchParams.get('limit')) || 10;
        const type = searchParams.get('type'); // 'usdt' | 'bank' | null (all)
        const status = searchParams.get('status'); // 'pending' | 'approved' | 'rejected' | null (all)
        const search = searchParams.get('search');
        const offset = (page - 1) * limit;

        const whereConditions: string[] = [];
        const params: any[] = [];

        if (type && ['usdt', 'bank'].includes(type)) {
            whereConditions.push('d.type = ?');
            params.push(type);
        }

        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            whereConditions.push('d.status = ?');
            params.push(status);
        }

        if (search) {
            const numSearch = Number(search);
            if (!isNaN(numSearch) && numSearch > 0) {
                whereConditions.push('(u.username LIKE ? OR u.telegram_id LIKE ? OR d.id = ? OR d.user_id = ?)');
                params.push(`%${search}%`, `%${search}%`, numSearch, numSearch);
            } else {
                whereConditions.push('(u.username LIKE ? OR u.telegram_id LIKE ?)');
                params.push(`%${search}%`, `%${search}%`);
            }
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const [rows] = await pool.query(`
            SELECT d.*, u.username, u.telegram_id
            FROM deposits d 
            LEFT JOIN users u ON d.user_id = u.id 
            ${whereClause}
            ORDER BY CASE WHEN d.status = 'pending' THEN 0 ELSE 1 END, d.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        let countQuery = `SELECT COUNT(*) as total FROM deposits d LEFT JOIN users u ON d.user_id = u.id ${whereClause}`;
        const [countResult] = await pool.query<any[]>(countQuery, params);
        const total = countResult[0]?.total || 0;

        return NextResponse.json({
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { depositId, action } = body; // action: 'approve' | 'reject'

        if (!depositId || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        // Log starting action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: action === 'approve' ? 'APPROVE' : 'REJECT',
            targetType: 'DEPOSIT',
            targetId: depositId,
            details: `Processing deposit ${action}: ID ${depositId}`,
            request
        });

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [depositRows] = await connection.query<any[]>('SELECT * FROM deposits WHERE id = ?', [depositId]);
            const deposit = depositRows[0];

            if (!deposit) {
                await connection.rollback();
                return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
            }

            if (deposit.status !== 'pending') {
                await connection.rollback();
                return NextResponse.json({ error: 'Deposit already processed' }, { status: 400 });
            }

            if (action === 'approve') {
                const { amount } = body;
                if (amount && typeof amount === 'number' && amount > 0) {
                    // Update amount first
                    await connection.query('UPDATE deposits SET amount = ? WHERE id = ?', [amount, depositId]);
                    deposit.amount = amount; // Update local variable for later calculations
                }

                // Update deposit status
                await connection.query('UPDATE deposits SET status = ? WHERE id = ?', ['approved', depositId]);

                // Query promotion (Simplified logic or fetch active promotion from DB if needed, 
                // for now assuming full amount added, ignoring specific promotion logic unless replicated)
                // Integrating full promotion logic here might be complex without duplicating code.
                // Let's assume for admin manual approval, we just add the amount, or minimal promotion support.
                // To support full promotion, we'd need to fetch settings. 

                // Let's fetch settings to check for basic promotion
                const [settingsRows] = await connection.query<any[]>("SELECT `key`, `value` FROM settings WHERE `key` IN ('deposit_promotion_percent', 'deposit_rank_promotions')");
                const settingsMap = Object.fromEntries(settingsRows.map(row => [row.key, row.value]));
                let promoPercent = Number(settingsMap.deposit_promotion_percent) || 0;
                try {
                    const ranks = JSON.parse(settingsMap.deposit_rank_promotions || '[]');
                    const [totalRows] = await connection.query<any[]>("SELECT COALESCE(SUM(amount), 0) AS total FROM deposits WHERE user_id = ? AND status = 'approved' AND id <> ?", [deposit.user_id, depositId]);
                    const totalDeposited = Number(totalRows[0]?.total || 0);
                    const matchedRank = Array.isArray(ranks) ? ranks
                        .filter(rank => totalDeposited >= Number(rank.min_total || 0) && Number(rank.bonus_percentage || 0) > 0)
                        .sort((a, b) => Number(b.min_total || 0) - Number(a.min_total || 0))[0] : null;
                    if (matchedRank) promoPercent = Number(matchedRank.bonus_percentage);
                } catch {
                    // Keep the general promotion when rank settings are invalid.
                }

                let finalAmount = deposit.amount;
                let bonusAmount = 0;

                if (promoPercent > 0) {
                    bonusAmount = Math.floor(deposit.amount * promoPercent / 100);
                    finalAmount += bonusAmount;
                }

                // Update user balance
                await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [finalAmount, deposit.user_id]);

                // Create balance log
                await connection.query(
                    'INSERT INTO balance_logs (user_id, amount, reason, created_at) VALUES (?, ?, ?, NOW())',
                    [deposit.user_id, finalAmount, `deposit_approved_${depositId}`]
                );

                await connection.commit();

                // Notify User
                const [userRows] = await pool.query<any[]>('SELECT telegram_id FROM users WHERE id = ?', [deposit.user_id]);
                const telegramId = userRows[0]?.telegram_id;
                if (telegramId) {
                    let msg = `✅ Yêu cầu nạp tiền #${depositId} đã được duyệt.\n💰 Số tiền nạp: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(deposit.amount)}`;
                    if (bonusAmount > 0) {
                        msg += `\n🎁 Khuyến mãi: +${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(bonusAmount)}`;
                    }
                    msg += `\n💵 Tổng cộng: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(finalAmount)}`;
                    await sendMessage(telegramId, msg);
                }

            } else {
                // Reject
                await connection.query('UPDATE deposits SET status = ? WHERE id = ?', ['rejected', depositId]);
                await connection.commit();
                // Notify User
                const [userRows] = await pool.query<any[]>('SELECT telegram_id FROM users WHERE id = ?', [deposit.user_id]);
                const telegramId = userRows[0]?.telegram_id;
                if (telegramId) {
                    await sendMessage(telegramId, `❌ Yêu cầu nạp tiền #${depositId} đã bị từ chối.`);
                }
            }

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
