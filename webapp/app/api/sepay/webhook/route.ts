import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { logAdminAction } from '@/lib/adminLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function extractToken(text: string): string | null {
    if (!text) return null;
    const cleanText = text.replace(/\s+mb$/i, '').trim();
    const match = cleanText.toUpperCase().match(/([A-Z]{4}[0-9]{4})/);
    if (match) return match[1];

    // Match NAP123456 or user id pattern
    const napMatch = cleanText.toUpperCase().match(/NAP\s*([0-9]+)/);
    if (napMatch) return `NAP${napMatch[1]}`;

    return null;
}

export async function POST(request: Request) {
    try {
        await dbReady;
        const body = await request.json().catch(() => ({}));

        // SePay Webhook payload format:
        // {
        //   id: 12345,
        //   gateway: "MBBank",
        //   transactionDate: "2024-03-01 12:00:00",
        //   accountNumber: "0123456789",
        //   code: "NAP1234",
        //   content: "NAP1234",
        //   transferType: "in",
        //   transferAmount: 50000,
        //   referenceCode: "FT...",
        //   description: "..."
        // }

        const transferType = String(body.transferType || '').toLowerCase();
        const amount = Number(body.transferAmount || body.amount_in || body.amount || 0);

        if (transferType !== 'in' && amount <= 0) {
            return NextResponse.json({ success: true, message: 'Ignored non-credit transaction' });
        }

        const rawContent = String(body.content || body.description || body.code || body.transaction_content || '');
        const txId = body.id || body.referenceCode || body.reference_number || Date.now();
        const gateway = body.gateway || body.bank_brand_name || 'SEPAY';
        const ref = `SEPAY-${txId}`;

        // Check if already processed
        const [existingRefRows] = await pool.query<any[]>(
            'SELECT id, status FROM deposits WHERE tx_ref = ? LIMIT 1',
            [ref]
        );
        if (existingRefRows && existingRefRows.length > 0 && existingRefRows[0].status === 'approved') {
            return NextResponse.json({ success: true, message: 'Transaction already processed' });
        }

        const token = extractToken(rawContent);
        let user: any = null;

        // 1. Try finding user by Telegram ID embedded in content (e.g. NAP 12345678)
        const tgIdMatch = rawContent.match(/(?:NAP|TG|USER)?\s*([0-9]{6,12})/i);
        if (tgIdMatch) {
            const tgId = Number(tgIdMatch[1]);
            const [uRows] = await pool.query<any[]>(
                'SELECT * FROM users WHERE telegram_id = ? OR id = ? LIMIT 1',
                [tgId, tgId]
            );
            if (uRows.length > 0) user = uRows[0];
        }

        // 2. If not found by direct ID, check token in bank_incoming_transactions or username
        if (!user && token) {
            const [uRows2] = await pool.query<any[]>(
                'SELECT * FROM users WHERE username = ? LIMIT 1',
                [token.toLowerCase()]
            );
            if (uRows2.length > 0) user = uRows2[0];
        }

        if (!user) {
            console.log(`[SEPAY_WEBHOOK] Received payment of ${amount} đ with content "${rawContent}", but could not resolve user.`);
            return NextResponse.json({
                success: true,
                message: 'Webhook received. No matching user found in content.'
            });
        }

        // Apply Promotion if any
        let finalAmount = amount;
        let bonusAmount = 0;
        try {
            const [rankRows] = await pool.query<any[]>("SELECT `value` FROM settings WHERE `key` = 'deposit_rank_promotions' LIMIT 1");
            const ranks = JSON.parse(rankRows[0]?.value || '[]');
            const [depRows] = await pool.query<any[]>('SELECT SUM(amount) as total FROM deposits WHERE user_id = ? AND status = "approved"', [user.id]);
            const totalDep = Number(depRows[0]?.total || 0);

            if (Array.isArray(ranks)) {
                const currentRank = [...ranks].reverse().find(r => totalDep >= Number(r.min_total || 0));
                if (currentRank && Number(currentRank.bonus_percentage) > 0) {
                    bonusAmount = Math.round((amount * Number(currentRank.bonus_percentage)) / 100);
                    finalAmount = amount + bonusAmount;
                }
            }
        } catch {}

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Create or update deposit
            await connection.query(
                'INSERT INTO deposits (user_id, amount, tx_ref, status) VALUES (?, ?, ?, "approved")',
                [user.id, amount, ref]
            );

            // Update user balance
            await connection.query(
                'UPDATE users SET balance = balance + ? WHERE id = ?',
                [finalAmount, user.id]
            );

            // Log balance
            await connection.query(
                'INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)',
                [user.id, finalAmount, `deposit:${ref}${bonusAmount > 0 ? ` (+${bonusAmount} bonus)` : ''}`]
            );

            await connection.commit();
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }

        // Send Telegram Notification to user
        try {
            const [settings] = await pool.query<any[]>('SELECT `value` FROM settings WHERE `key` = "telegram_bot_token"');
            const dbToken = settings[0]?.value;

            if (user.telegram_id && dbToken) {
                const { sendMessage } = await import('@/lib/telegram');
                const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
                let msg = `✅ <b>NẠP TIỀN TỰ ĐỘNG THÀNH CÔNG (SEPAY)!</b>\n\n` +
                          `💰 <b>Số tiền:</b> +${formattedAmount}\n` +
                          `🏦 <b>Cổng thanh toán:</b> SePay (${gateway})\n` +
                          `🔖 <b>Mã giao dịch:</b> <code>${ref}</code>\n`;
                if (bonusAmount > 0) {
                    msg += `🎁 <b>Thưởng VIP:</b> +${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(bonusAmount)}\n`;
                }
                msg += `\nCảm ơn bạn đã tin tưởng và sử dụng dịch vụ!`;

                await sendMessage(user.telegram_id, msg, dbToken);
            }
        } catch (tErr) {
            console.warn('[SEPAY_WEBHOOK] Telegram notify error:', tErr);
        }

        return NextResponse.json({
            success: true,
            message: `Nạp tiền SePay thành công cho user ${user.username || user.telegram_id || user.id}!`,
            userId: user.id,
            amount: finalAmount
        });

    } catch (error: any) {
        console.error('[SEPAY_WEBHOOK_ERROR]:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
