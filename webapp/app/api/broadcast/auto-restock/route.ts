import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getBotToken } from '@/lib/telegram';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

function formatCurrency(val: number) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val) + ' đ';
}

export async function GET(request: Request) {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` LIKE 'auto_restock_%'"
        );

        const settingsMap: Record<string, string> = {};
        rows.forEach((r) => { settingsMap[r.key] = r.value; });

        const config = {
            isActive: settingsMap.auto_restock_active === '1',
            intervalHours: Number(settingsMap.auto_restock_interval) || 4,
            quietStart: settingsMap.auto_restock_quiet_start || '23:00',
            quietEnd: settingsMap.auto_restock_quiet_end || '07:30',
            targetType: settingsMap.auto_restock_target || 'channel',
            channelId: settingsMap.auto_restock_channel_id || '',
            channelLang: settingsMap.auto_restock_lang || 'vi',
            fakeRule: settingsMap.auto_restock_rule || 'random',
            minQty: Number(settingsMap.auto_restock_min_qty) || 15,
            maxQty: Number(settingsMap.auto_restock_max_qty) || 50,
            lastRun: settingsMap.auto_restock_last_run || 'Chưa chạy lần nào'
        };

        return NextResponse.json({ config });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, isActive, intervalHours, quietStart, quietEnd, targetType, channelId, channelLang, fakeRule, minQty, maxQty } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (action === 'save_config') {
            const updates = [
                ['auto_restock_active', isActive ? '1' : '0'],
                ['auto_restock_interval', String(intervalHours || 4)],
                ['auto_restock_quiet_start', String(quietStart || '23:00')],
                ['auto_restock_quiet_end', String(quietEnd || '07:30')],
                ['auto_restock_target', String(targetType || 'channel')],
                ['auto_restock_channel_id', String(channelId || '')],
                ['auto_restock_lang', String(channelLang || 'vi')],
                ['auto_restock_rule', String(fakeRule || 'random')],
                ['auto_restock_min_qty', String(minQty || 15)],
                ['auto_restock_max_qty', String(maxQty || 50)]
            ];

            for (const [key, val] of updates) {
                await pool.query(
                    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
                    [key, val, val]
                );
            }

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SETTING',
                details: { type: 'AUTO_RESTOCK_CONFIG', isActive, intervalHours, channelId, targetType },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã lưu cấu hình hẹn giờ thông báo kho ảo thành công!' });
        }

        if (action === 'test_run') {
            // Get Bot Token
            const token = await getBotToken();
            if (!token) {
                return NextResponse.json({ error: 'Chưa cấu hình Telegram Bot Token trong Cài đặt Hệ thống!' }, { status: 400 });
            }

            // Get Bot Username for deep-linking
            let botUsername = '';
            try {
                const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
                const meData = await meRes.json();
                if (meData.ok && meData.result?.username) {
                    botUsername = meData.result.username;
                }
            } catch (e) {
                console.error('getMe error:', e);
            }

            // Get DB settings
            const [chanRows] = await pool.query<RowDataPacket[]>("SELECT `key`, `value` FROM settings WHERE `key` IN ('auto_restock_channel_id', 'telegram_group_link', 'auto_restock_min_qty', 'auto_restock_max_qty', 'auto_restock_target')");
            const dbMap: Record<string, string> = {};
            chanRows.forEach(r => { dbMap[r.key] = r.value; });

            const targetChan = (channelId !== undefined ? channelId : (dbMap.auto_restock_channel_id || '')).trim();
            const currentTargetType = targetType || dbMap.auto_restock_target || 'channel';

            // Pick a random product
            const [prods] = await pool.query<RowDataPacket[]>("SELECT * FROM products WHERE is_active = 1 ORDER BY RAND() LIMIT 1");
            const product = prods[0] || { id: 1, name: 'Sản phẩm VIP #4', price: 150000 };

            const minQ = Number(minQty || dbMap.auto_restock_min_qty) || 15;
            const maxQ = Number(maxQty || dbMap.auto_restock_max_qty) || 50;
            const randQty = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ;

            const textMsg =
                `🔥 *THÔNG BÁO NHẬP KHO HÀNG (TEST)*\n\n` +
                `📦 Sản phẩm: *${product.name}*\n` +
                `⚡ Vừa về thêm: *+${randQty}* sản phẩm (Đơn giá: ${formatCurrency(Number(product.price) || 0)})\n` +
                `👉 Bấm nút bên dưới để vào mua ngay kẻo hết hàng!`;

            const buyUrl = botUsername ? `https://t.me/${botUsername}?start=buy_${product.id}` : undefined;
            const replyMarkup = buyUrl ? {
                inline_keyboard: [
                    [
                        { text: '⚡ Mua ngay sản phẩm này', url: buyUrl }
                    ]
                ]
            } : undefined;

            let channelSuccess = false;
            let userSuccessCount = 0;
            let totalUsersCount = 0;

            // 1. Send to Channel if channel is provided
            if (targetChan) {
                try {
                    const payload: any = {
                        chat_id: targetChan,
                        text: textMsg,
                        parse_mode: 'Markdown'
                    };
                    if (replyMarkup) payload.reply_markup = replyMarkup;

                    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const tgData = await tgRes.json();
                    if (tgData.ok) channelSuccess = true;
                } catch (e) {
                    console.error('Channel send error:', e);
                }
            }

            // 2. Send to ALL users if channel is empty OR targetType is 'users' / 'both'
            if (!targetChan || currentTargetType === 'users' || currentTargetType === 'both') {
                const [users] = await pool.query<RowDataPacket[]>("SELECT DISTINCT telegram_id FROM users WHERE telegram_id IS NOT NULL AND telegram_id != ''");
                totalUsersCount = users.length;
                for (const u of users) {
                    try {
                        const payload: any = {
                            chat_id: u.telegram_id,
                            text: textMsg,
                            parse_mode: 'Markdown'
                        };
                        if (replyMarkup) payload.reply_markup = replyMarkup;

                        const uRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const uData = await uRes.json();
                        if (uData.ok) userSuccessCount++;
                    } catch (e) {
                        // ignore error per user
                    }
                }
            }

            // Record last run timestamp
            const nowStr = `${new Date().toLocaleTimeString('vi-VN')} ${new Date().toLocaleDateString('vi-VN')}`;
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES ('auto_restock_last_run', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [nowStr, nowStr]
            );

            let resultMsg = '';
            if (channelSuccess && userSuccessCount > 0) {
                resultMsg = `Đã phát sóng kèm nút Mua ngay tới Kênh ${targetChan} VÀ ${userSuccessCount}/${totalUsersCount} người dùng CSDL!`;
            } else if (channelSuccess) {
                resultMsg = `Đã phát sóng kèm nút Mua ngay tới Kênh Telegram ${targetChan}!`;
            } else if (userSuccessCount > 0) {
                resultMsg = `Đã phát sóng thông báo kho ảo kèm nút Mua ngay tới ${userSuccessCount}/${totalUsersCount} người dùng trong CSDL!`;
            } else {
                resultMsg = `Đã hoàn thành gửi thử nghiệm thông báo kho ảo ("${product.name}" +${randQty} item).`;
            }

            return NextResponse.json({
                success: true,
                message: resultMsg
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
