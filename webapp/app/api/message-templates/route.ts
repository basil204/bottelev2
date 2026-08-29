import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { DEFAULT_TEMPLATES, renderTemplate } from '@/lib/templateHelper';
import { sendMessage } from '@/lib/telegram';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'test_send') {
            const telegramId = searchParams.get('telegramId');
            const key = searchParams.get('key');
            let content = searchParams.get('content');

            if (!telegramId || !key) {
                return NextResponse.json({ error: 'Missing telegramId or key' }, { status: 400 });
            }

            const def = DEFAULT_TEMPLATES[key];
            if (!content) {
                const [rows] = await pool.query<RowDataPacket[]>('SELECT `value` FROM settings WHERE `key` = ?', [key]);
                content = (rows.length > 0 && rows[0].value) ? rows[0].value : (def?.defaultTemplate || 'Test message');
            }

            // Create sample variables for test preview
            const sampleVars: Record<string, string | number> = {
                order_code: 'TEST9999',
                product_name: 'Tài khoản ChatGPT Plus (Gói dùng thử)',
                data: 'username: demo_user@email.com\npassword: DemoPassword123!\n2fa: 2FA_KEY_DEMO_SAMPLE',
                note: 'Bàn giao tài khoản dùng thử - bảo hành 30 ngày',
                price: '150.000',
                username: 'khach_hang_vip',
                deposit_id: '8888',
                amount: '500.000',
                bonus: '50.000',
                total: '550.000',
                new_balance: '1.250.000',
                reason: 'Nội dung chuyển khoản không khớp với mã yêu cầu',
                ticket_id: '501',
                reply_text: 'Chào bạn, bên mình đã kiểm tra và gửi lại thông tin mới nhất vào tài khoản của bạn rồi nhé.',
                status: 'Đã hoàn tất',
                first_name: 'Nguyễn Văn A',
                telegram_id: String(telegramId),
                time: new Date().toLocaleString('vi-VN')
            };

            const rendered = renderTemplate(content || '', sampleVars);
            await sendMessage(Number(telegramId), `[DEMO TEST PREVIEW]\n\n${rendered}`);

            return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn chạy thử qua Telegram!' });
        }

        if (action === 'get_announcement') {
            const [rows] = await pool.query<RowDataPacket[]>(
                'SELECT `key`, `value` FROM settings WHERE `key` IN ("system_announcement_bar", "system_announcement_active")'
            );
            let text = '🔥 HỆ THỐNG BOT & WEB DỊCH VỤ TỰ ĐỘNG XỬ LÝ 24/7. HỖ TRỢ KHÁCH HÀNG BẢO HÀNH NHANH CHÓNG!';
            let active = true;

            rows.forEach(r => {
                if (r.key === 'system_announcement_bar' && r.value) text = r.value;
                if (r.key === 'system_announcement_active') active = r.value === 'true' || r.value === '1';
            });

            return NextResponse.json({ success: true, announcement: text, active });
        }

        // Fetch custom templates from DB settings table
        const keys = Object.keys(DEFAULT_TEMPLATES);
        const placeholders = keys.map(() => '?').join(',');
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (${placeholders})`,
            keys
        );

        const dbValuesMap: Record<string, string> = {};
        rows.forEach(r => {
            dbValuesMap[r.key] = r.value;
        });

        // Merge DB values into template definitions
        const templates = Object.values(DEFAULT_TEMPLATES).map(def => {
            const customValue = dbValuesMap[def.key];
            return {
                ...def,
                currentTemplate: customValue !== undefined && customValue !== null ? customValue : def.defaultTemplate,
                isCustomized: customValue !== undefined && customValue !== null && customValue !== def.defaultTemplate
            };
        });

        return NextResponse.json({ success: true, templates });
    } catch (error) {
        console.error('Error fetching message templates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { key, content, templates, action, text, active } = body;

        if (action === 'save_announcement') {
            if (text !== undefined) {
                await pool.query(
                    'INSERT INTO settings (`key`, `value`) VALUES ("system_announcement_bar", ?) ON DUPLICATE KEY UPDATE `value` = ?',
                    [text, text]
                );
            }
            if (active !== undefined) {
                const actStr = active ? 'true' : 'false';
                await pool.query(
                    'INSERT INTO settings (`key`, `value`) VALUES ("system_announcement_active", ?) ON DUPLICATE KEY UPDATE `value` = ?',
                    [actStr, actStr]
                );
            }
            return NextResponse.json({ success: true, message: 'Đã cập nhật Thanh Thông Báo thành công!' });
        }

        const adminName = await getAdminFromCookie(request);

        // Single key update
        if (key && content !== undefined) {
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [key, content, content]
            );

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SYSTEM',
                details: `Updated message template for ${key}`,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã lưu mẫu tin nhắn thành công!' });
        }

        // Batch update
        if (Array.isArray(templates)) {
            for (const item of templates) {
                if (item.key && item.content !== undefined) {
                    await pool.query(
                        "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
                        [item.key, item.content, item.content]
                    );
                }
            }

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SYSTEM',
                details: 'Batch updated message templates',
                request
            });

            return NextResponse.json({ success: true, message: 'Đã lưu tất cả mẫu tin nhắn thành công!' });
        }

        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    } catch (error) {
        console.error('Error saving message templates:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');

        if (!key) return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });

        await pool.query('DELETE FROM settings WHERE `key` = ?', [key]);

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'DELETE',
            targetType: 'SYSTEM',
            details: `Reset message template ${key} to default`,
            request
        });

        return NextResponse.json({ success: true, message: 'Đã khôi phục mẫu tin nhắn về mặc định!' });
    } catch (error) {
        console.error('Error resetting template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
