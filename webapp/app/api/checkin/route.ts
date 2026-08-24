import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'SYSTEM',
            details: 'Viewed checkin settings and logs',
            request
        });

        // Ensure tables exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS checkin_rewards (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                streak_days INT DEFAULT 1,
                sort_order INT DEFAULT 0,
                reward_type VARCHAR(50) DEFAULT 'Ví',
                reward_amount DECIMAL(15, 2) DEFAULT 0,
                reward_message TEXT NULL,
                is_active TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS checkin_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                telegram_id BIGINT NULL,
                username VARCHAR(100) NULL,
                checkin_date DATE NULL,
                streak INT DEFAULT 1,
                total_checkins INT DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS checkin_claims (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                telegram_id BIGINT NULL,
                reward_id INT NULL,
                reward_name VARCHAR(100) NULL,
                reward_amount DECIMAL(15, 2) DEFAULT 0,
                streak INT DEFAULT 1,
                status VARCHAR(50) DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure telegram_id column exists
        try {
            await pool.query('ALTER TABLE checkin_logs ADD COLUMN telegram_id BIGINT NULL');
        } catch (e) {}
        try {
            await pool.query('ALTER TABLE checkin_claims ADD COLUMN telegram_id BIGINT NULL');
        } catch (e) {}

        // Fetch rewards
        const [rewards] = await pool.query<RowDataPacket[]>('SELECT * FROM checkin_rewards ORDER BY sort_order ASC, created_at DESC');

        // Fetch pending claims
        const [claims] = await pool.query<RowDataPacket[]>(`
            SELECT cc.*, u.username, u.name as user_name
            FROM checkin_claims cc
            LEFT JOIN users u ON cc.user_id = u.id OR (cc.telegram_id IS NOT NULL AND cc.telegram_id = u.telegram_id)
            WHERE cc.status = 'pending'
            ORDER BY cc.created_at DESC
        `);

        // Fetch recent checkin logs
        const [logs] = await pool.query<RowDataPacket[]>(`
            SELECT cl.*, u.name as user_name
            FROM checkin_logs cl
            LEFT JOIN users u ON cl.user_id = u.id OR (cl.telegram_id IS NOT NULL AND cl.telegram_id = u.telegram_id)
            ORDER BY cl.created_at DESC
            LIMIT 20
        `);

        const stats = {
            status: 'Bật',
            timezone: 'UTC+7',
            rewardCount: rewards.length,
            activeCount: rewards.filter(r => r.is_active).length,
            pendingClaimsCount: claims.length
        };

        return NextResponse.json({
            stats,
            rewards,
            claims,
            logs
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, name, streakDays, sortOrder, rewardType, rewardAmount, rewardMessage, isActive, rewardId } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (action === 'create_reward') {
            if (!name) {
                return NextResponse.json({ error: 'Vui lòng nhập tên mốc thưởng' }, { status: 400 });
            }

            const [res]: any = await pool.query(`
                INSERT INTO checkin_rewards (
                    name, streak_days, sort_order, reward_type, reward_amount, reward_message, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                name,
                Number(streakDays) || 1,
                Number(sortOrder) || 0,
                rewardType || 'Ví',
                Number(rewardAmount) || 0,
                rewardMessage || null,
                isActive ? 1 : 0
            ]);

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'CREATE',
                targetType: 'SYSTEM',
                targetId: res.insertId,
                details: { name, streakDays, rewardAmount },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã tạo mốc thưởng điểm danh' });
        }

        if (action === 'delete_reward') {
            if (!rewardId) return NextResponse.json({ error: 'Missing rewardId' }, { status: 400 });
            await pool.query('DELETE FROM checkin_rewards WHERE id = ?', [rewardId]);
            return NextResponse.json({ success: true });
        }

        if (action === 'send_claims') {
            // Process pending claims: add balance to users & update claim status
            const [claims] = await pool.query<RowDataPacket[]>('SELECT * FROM checkin_claims WHERE status = "pending"');

            for (const claim of claims) {
                if (claim.reward_amount > 0 && (claim.user_id || claim.telegram_id)) {
                    await pool.query('UPDATE users SET balance = balance + ? WHERE id = ? OR telegram_id = ?', [
                        claim.reward_amount, claim.user_id || 0, claim.telegram_id || 0
                    ]);
                    try {
                        await pool.query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)', [
                            claim.user_id || 0, claim.reward_amount, `Thưởng điểm danh Mốc ${claim.streak} ngày`
                        ]);
                    } catch (e) {
                        console.error('Balance log error:', e);
                    }
                }
            }

            await pool.query('UPDATE checkin_claims SET status = "completed" WHERE status = "pending"');

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SYSTEM',
                details: { action: 'SEND_ALL_CLAIMS', count: claims.length },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: `Đã gửi tất cả ${claims.length} phần thưởng claim thành công!` });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
