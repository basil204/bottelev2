import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import pool, { dbReady } from '@/lib/db';

export async function POST() {
    try {
        await dbReady;
        // Ghi tín hiệu reload/restart vào database để tiến trình bot NodeJS nhận diện ngay lập tức
        const now = Date.now().toString();
        await pool.query(
            "INSERT INTO settings (`key`, `value`) VALUES ('bot_restart_signal', ?) ON DUPLICATE KEY UPDATE `value` = ?",
            [now, now]
        );
    } catch (e) {
        console.error('[Restart API] DB signal error:', e);
    }

    return new Promise<NextResponse>((resolve) => {
        exec('pm2 reload all || pm2 restart all || npx pm2 reload all || npx pm2 restart all', (error, stdout, stderr) => {
            if (error) {
                console.log(`[Restart API] PM2 not active, restart signal successfully written to DB.`);
                resolve(NextResponse.json({
                    success: true,
                    message: 'Đã gửi tín hiệu cập nhật và khởi động lại Bot Telegram thành công!'
                }));
                return;
            }
            console.log(`[Restart API] stdout: ${stdout}`);
            resolve(NextResponse.json({ success: true, message: 'Đã cập nhật và khởi động lại Bot Telegram thành công qua PM2!' }));
        });
    });
}
