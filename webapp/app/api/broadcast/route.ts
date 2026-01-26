import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { message } = body;

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            return NextResponse.json({ error: 'Telegram Bot Token not configured' }, { status: 500 });
        }

        // 1. Get all users with telegram_id
        const [users] = await pool.query<any[]>('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL');

        if (users.length === 0) {
            return NextResponse.json({ success: true, sent: 0, failed: 0, message: 'No users found to send message.' });
        }

        let sentCount = 0;
        let failedCount = 0;

        // 2. Send message to each user
        // We use Promise.all to send in parallel, but maybe chunking is better to avoid rate limits?
        // Telegram limits: 30 messages per second.
        // For simplicity, we'll just await sequentially or in small batches. 
        // Let's do parallel for now as user base assumed small, but with catch.

        const promises = users.map(async (user) => {
            try {
                const res = await fetch(`${TELEGRAM_API_URL}${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: user.telegram_id,
                        text: message,
                        parse_mode: 'HTML'
                    })
                });

                if (res.ok) {
                    sentCount++;
                } else {
                    console.error(`Failed to send to ${user.telegram_id}:`, await res.text());
                    failedCount++;
                }
            } catch (err) {
                console.error(`Error sending to ${user.telegram_id}:`, err);
                failedCount++;
            }
        });

        await Promise.all(promises);

        return NextResponse.json({
            success: true,
            sent: sentCount,
            failed: failedCount,
            total: users.length
        });

    } catch (error) {
        console.error('Broadcast Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
