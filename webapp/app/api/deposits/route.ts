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
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params: any[] = [];
        if (type && ['usdt', 'bank'].includes(type)) {
            whereClause = 'WHERE d.type = ?';
            params.push(type);
        }

        const [rows] = await pool.query(`
            SELECT d.*, u.username 
            FROM deposits d 
            LEFT JOIN users u ON d.user_id = u.id 
            ${whereClause}
            ORDER BY d.created_at DESC 
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        let countQuery = 'SELECT COUNT(*) as total FROM deposits d';
        if (whereClause) countQuery += ` ${whereClause}`;
        const [countResult] = await pool.query<any[]>(countQuery, params);
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
                const [settingsRows] = await connection.query<any[]>("SELECT `value` FROM settings WHERE `key` = 'deposit_promotion_percent'");
                const promoPercent = Number(settingsRows[0]?.value) || 0;

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
