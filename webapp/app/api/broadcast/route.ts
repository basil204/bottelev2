import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, productName, productPrice, addedCount, totalStock } = body;

        // Get shop name and bot token from settings
        const [settings] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('shop_name', 'telegram_bot_token')"
        );

        let shopName = 'SHOP';
        let botToken = '';

        settings.forEach((row: any) => {
            if (row.key === 'shop_name') shopName = row.value || 'SHOP';
            if (row.key === 'telegram_bot_token') botToken = row.value;
        });

        if (!botToken) {
            return NextResponse.json({ error: 'Bot token not configured' }, { status: 400 });
        }

        // Get all users
        const [users] = await pool.query<RowDataPacket[]>('SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL');

        if (!users || users.length === 0) {
            return NextResponse.json({ success: true, sent: 0, message: 'No users to notify' });
        }

        // Build message based on type
        let broadcastMessage = '';

        if (type === 'new_product') {
            broadcastMessage = `📢 ${shopName} thông báo có sản phẩm mới!\n\n` +
                `🎁 Sản phẩm: ${productName}\n` +
                `💰 Giá: ${Number(productPrice).toLocaleString('vi-VN')}đ\n\n` +
                `👉 Gõ /start để vào bot mua ngay nhé!`;
        } else if (type === 'stock_added') {
            broadcastMessage = `📢 ${shopName} thông báo có hàng mới!\n\n` +
                `🎁 Sản phẩm: ${productName}\n` +
                `➕ Vừa thêm: ${addedCount} tài khoản\n` +
                `📦 Tồn hiện tại: ${totalStock} tài khoản\n\n` +
                `👉 Gõ /start để vào bot mua ngay nhé!`;
        } else if (type === 'custom' || body.message) {
            // Support custom message for notifications page
            const customMessage = body.message;
            if (!customMessage || !customMessage.trim()) {
                return NextResponse.json({ error: 'Message is required for custom broadcast' }, { status: 400 });
            }
            broadcastMessage = `📢 ${shopName} thông báo:\n\n${customMessage}`;
        } else {
            return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
        }

        // Send to all users
        let sentCount = 0;
        let failCount = 0;

        for (const user of users) {
            try {
                const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: user.telegram_id,
                        text: broadcastMessage,
                        parse_mode: 'HTML'
                    })
                });

                if (response.ok) {
                    sentCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }

        return NextResponse.json({
            success: true,
            sent: sentCount,
            failed: failCount,
            total: users.length
        });

    } catch (error) {
        console.error('Broadcast Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
