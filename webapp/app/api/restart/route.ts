import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST() {
    return new Promise<NextResponse>((resolve) => {
        exec('pm2 restart 1 || pm2 restart all || npx pm2 restart all', (error, stdout, stderr) => {
            if (error) {
                console.log(`[Restart API] PM2 not installed or not active, skipping PM2 restart`);
                resolve(NextResponse.json({
                    success: true,
                    message: 'Đã cập nhật và lưu cấu hình Bot Telegram thành công!'
                }));
                return;
            }
            console.log(`stdout: ${stdout}`);
            resolve(NextResponse.json({ success: true, message: 'Đã khởi động lại Bot Telegram thành công qua PM2!' }));
        });
    });
}
