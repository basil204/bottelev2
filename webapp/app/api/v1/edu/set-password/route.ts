import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { updateAccountPassword } from '@/lib/googleAdminService';

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        let apiKey = request.headers.get('x-api-key') || searchParams.get('api_key');

        const authHeader = request.headers.get('authorization');
        if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
            apiKey = authHeader.replace('Bearer ', '').trim();
        }

        let body: any = {};
        try {
            body = await request.json();
        } catch {
            body = {};
        }

        if (!apiKey && body.api_key) {
            apiKey = body.api_key;
        }

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: 'Thiếu API Key. Vui lòng truyền X-API-Key qua Header hoặc api_key qua Query/Body.'
            }, { status: 401 });
        }

        // Validate API Key
        const cleanApiKey = String(apiKey).trim();
        const [keyRows] = await pool.query<RowDataPacket[]>(`
            SELECT k.id as key_id, k.is_active, k.permissions, u.id as user_id, u.telegram_id, u.username, u.name, u.balance, u.is_banned
            FROM user_api_keys k
            INNER JOIN users u ON (k.user_id = u.id OR k.user_id = u.telegram_id)
            WHERE LOWER(TRIM(k.api_key)) = LOWER(TRIM(?)) LIMIT 1
        `, [cleanApiKey]);

        if (!keyRows.length) {
            return NextResponse.json({
                success: false,
                error: 'API Key không tồn tại trong hệ thống.'
            }, { status: 401 });
        }

        const keyInfo = keyRows[0];
        if (!keyInfo.is_active) {
            return NextResponse.json({
                success: false,
                error: 'API Key của bạn đang bị vô hiệu hóa. Vui lòng liên hệ Admin.'
            }, { status: 403 });
        }

        if (keyInfo.is_banned) {
            return NextResponse.json({
                success: false,
                error: 'Tài khoản người dùng đã bị khóa.'
            }, { status: 403 });
        }

        // Check Permissions (Scope)
        const userPerms = keyInfo.permissions || 'all';
        if (userPerms !== 'all') {
            const scopes = userPerms.split(',').map((s: string) => s.trim().toLowerCase());
            if (!scopes.includes('all') && !scopes.includes('order_edu')) {
                return NextResponse.json({
                    success: false,
                    error: 'API Key của bạn không có quyền đổi mật khẩu Gmail EDU (Thiếu quyền: order_edu).'
                }, { status: 403 });
            }
        }

        const rawEmail = body.email || searchParams.get('email');
        const rawPassword = body.password || body.new_password || searchParams.get('password');

        if (!rawEmail || !rawPassword) {
            return NextResponse.json({
                success: false,
                error: 'Vui lòng cung cấp email và password mới (tối thiểu 8 ký tự).'
            }, { status: 400 });
        }

        const cleanEmail = String(rawEmail).trim().toLowerCase();
        const cleanPassword = String(rawPassword).trim();

        if (cleanPassword.length < 8) {
            return NextResponse.json({
                success: false,
                error: 'Mật khẩu mới phải có tối thiểu 8 ký tự theo tiêu chuẩn bảo mật Google Workspace.'
            }, { status: 400 });
        }

        // 1. Kiểm tra tài khoản trong database
        const [accountRows] = await pool.query<RowDataPacket[]>(
            'SELECT id, email, password, sold_to_user_id, status FROM gmail_accounts WHERE LOWER(TRIM(email)) = ? LIMIT 1',
            [cleanEmail]
        );

        let isOwner = false;
        let isSystemAdmin = false;

        // Check system admin
        const [adminRows] = await pool.query<RowDataPacket[]>(
            "SELECT `value` FROM settings WHERE `key` = 'admin_ids' LIMIT 1"
        );
        if (adminRows && adminRows.length > 0) {
            const adminIds = adminRows[0].value ? adminRows[0].value.split(',').map((s: string) => s.trim()) : [];
            if (adminIds.includes(String(keyInfo.user_id)) || adminIds.includes(String(keyInfo.telegram_id))) {
                isSystemAdmin = true;
            }
        }

        if (accountRows && accountRows.length > 0) {
            const acc = accountRows[0];
            if (
                acc.sold_to_user_id === keyInfo.user_id ||
                (keyInfo.telegram_id && acc.sold_to_user_id === keyInfo.telegram_id) ||
                isSystemAdmin
            ) {
                isOwner = true;
            }
        } else {
            // Check orders table
            const [orderRows] = await pool.query<RowDataPacket[]>(
                'SELECT id, email FROM orders WHERE user_id = ? AND email LIKE ? LIMIT 1',
                [keyInfo.user_id, `%${cleanEmail}%`]
            );
            if ((orderRows && orderRows.length > 0) || isSystemAdmin) {
                isOwner = true;
            }
        }

        if (!isOwner) {
            return NextResponse.json({
                success: false,
                error: 'Bạn không có quyền thay đổi mật khẩu của tài khoản email này hoặc tài khoản không tồn tại trong hệ thống.'
            }, { status: 403 });
        }

        // 2. Gọi Google Workspace Admin API để đổi mật khẩu
        const updateRes = await updateAccountPassword(cleanEmail, cleanPassword);
        if (!updateRes.success) {
            return NextResponse.json({
                success: false,
                error: `Không thể đổi mật khẩu trên Google Workspace: ${updateRes.error || 'Lỗi hệ thống'}`
            }, { status: 500 });
        }

        // 3. Cập nhật mật khẩu trong database
        if (accountRows && accountRows.length > 0) {
            await pool.query(
                'UPDATE gmail_accounts SET password = ? WHERE id = ?',
                [cleanPassword, accountRows[0].id]
            );
        }

        // Cập nhật trong orders nếu có
        try {
            const [userOrders] = await pool.query<RowDataPacket[]>(
                'SELECT id, email FROM orders WHERE user_id = ? AND email LIKE ?',
                [keyInfo.user_id, `%${cleanEmail}%`]
            );
            for (const ord of userOrders) {
                if (ord.email && ord.email.includes(cleanEmail)) {
                    const lines = ord.email.split('\n');
                    const updatedLines = lines.map((line: string) => {
                        const parts = line.split('|');
                        if (parts[0] && parts[0].trim().toLowerCase() === cleanEmail) {
                            parts[1] = cleanPassword;
                            return parts.join('|');
                        }
                        return line;
                    });
                    await pool.query('UPDATE orders SET email = ? WHERE id = ?', [updatedLines.join('\n'), ord.id]);
                }
            }
        } catch (ordErr: any) {
            console.error('[UPDATE_ORDER_PASS_ERR]', ordErr.message);
        }

        // Update API Key last_used_at
        await pool.query('UPDATE user_api_keys SET last_used_at = NOW() WHERE id = ?', [keyInfo.key_id]);

        return NextResponse.json({
            success: true,
            message: 'Đặt lại mật khẩu cho tài khoản Gmail EDU thành công!',
            data: {
                email: cleanEmail,
                password: cleanPassword,
                updated_at: new Date().toISOString()
            }
        });
    } catch (error: any) {
        console.error('[NEXTJS_API_EDU_SET_PASSWORD_ERROR]', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Lỗi hệ thống khi xử lý đổi mật khẩu Gmail EDU'
        }, { status: 500 });
    }
}
