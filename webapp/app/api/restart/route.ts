import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST() {
    return new Promise<NextResponse>((resolve) => {
        exec('pm2 restart 1', (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                resolve(NextResponse.json({ error: 'Failed to restart bot' }, { status: 500 }));
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            resolve(NextResponse.json({ success: true, message: 'Bot restarted successfully' }));
        });
    });
}
