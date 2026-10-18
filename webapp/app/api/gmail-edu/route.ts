import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';
import {
    createEduAccount,
    deleteAccount,
    deleteMultipleAccounts,
    initializeAuth,
    generateRandomPassword,
    generateRandomUsername,
    DEFAULT_EDU_DOMAIN
} from '@/lib/googleAdminService';

// Ensure table exists
async function ensureGmailTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gmail_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                type VARCHAR(50) DEFAULT 'edu',
                domain VARCHAR(255) DEFAULT 'nttp.edu.pl',
                status VARCHAR(50) DEFAULT 'available',
                sold_to_user_id INT DEFAULT NULL,
                sold_price DECIMAL(15, 2) DEFAULT NULL,
                order_id VARCHAR(50) DEFAULT NULL,
                delete_at TIMESTAMP NULL DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_gmail_status (status),
                INDEX idx_gmail_domain (domain),
                INDEX idx_gmail_sold_user (sold_to_user_id),
                INDEX idx_gmail_delete_at (delete_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Add missing columns if upgrading
        const [cols] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM gmail_accounts');
        const colNames = cols.map((c) => c.Field);
        if (!colNames.includes('sold_to_user_id')) {
            await pool.query('ALTER TABLE gmail_accounts ADD COLUMN sold_to_user_id INT DEFAULT NULL');
        }
        if (!colNames.includes('sold_price')) {
            await pool.query('ALTER TABLE gmail_accounts ADD COLUMN sold_price DECIMAL(15, 2) DEFAULT NULL');
        }
        if (!colNames.includes('order_id')) {
            await pool.query('ALTER TABLE gmail_accounts ADD COLUMN order_id VARCHAR(50) DEFAULT NULL');
        }
    } catch (e: any) {
        console.error('[GMAIL_EDU_API] ensure table error:', e.message);
    }
}

// GET: Lấy danh sách tài khoản, thống kê & cấu hình
export async function GET(request: Request) {
    try {
        await ensureGmailTable();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || 'all';
        const domain = searchParams.get('domain') || 'all';
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
        const offset = (page - 1) * limit;

        // 1. Thống kê tổng quan
        const [statsRows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                COUNT(*) as total_accounts,
                COUNT(CASE WHEN status = 'sold' THEN 1 END) as total_sold,
                COUNT(CASE WHEN status = 'available' OR status = 'in_stock' THEN 1 END) as total_available,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as total_error,
                COALESCE(SUM(CASE WHEN status = 'sold' THEN sold_price ELSE 0 END), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN status = 'sold' AND DATE(created_at) = CURDATE() THEN sold_price ELSE 0 END), 0) as today_revenue,
                COUNT(CASE WHEN status = 'sold' AND DATE(created_at) = CURDATE() THEN 1 END) as today_sold
            FROM gmail_accounts
        `);

        // 2. Lấy cấu hình settings
        const [settingsRows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('gmail_edu_price', 'gmail_edu_domain', 'gmail_edu_enabled', 'buy_gmail_edu', 'gmail_edu_delete_hours', 'gmail_edu_password_type', 'gmail_edu_custom_password', 'gmail_edu_max_user_limit', 'gmail_edu_max_order_qty')"
        );
        const settings: Record<string, any> = {
            price: 10000,
            domain: DEFAULT_EDU_DOMAIN || 'nttp.edu.pl',
            enabled: true,
            delete_hours: 1,
            password_type: 'random',
            custom_password: '',
            max_user_limit: 0,
            max_order_qty: 20
        };
        settingsRows.forEach((r) => {
            if (r.key === 'gmail_edu_price') settings.price = Number(r.value) || 10000;
            if (r.key === 'gmail_edu_domain') settings.domain = r.value || DEFAULT_EDU_DOMAIN;
            if (r.key === 'gmail_edu_enabled' || r.key === 'buy_gmail_edu') settings.enabled = r.value !== 'false';
            if (r.key === 'gmail_edu_delete_hours') settings.delete_hours = Number(r.value) || 1;
            if (r.key === 'gmail_edu_password_type') settings.password_type = r.value || 'random';
            if (r.key === 'gmail_edu_custom_password') settings.custom_password = r.value || '';
            if (r.key === 'gmail_edu_max_user_limit') settings.max_user_limit = Number(r.value) || 0;
            if (r.key === 'gmail_edu_max_order_qty') settings.max_order_qty = Number(r.value) || 20;
        });

        // 3. Kiểm tra kết nối Google API
        let googleApiConnected = false;
        let googleApiError = '';
        try {
            await initializeAuth();
            googleApiConnected = true;
        } catch (err: any) {
            googleApiError = err.message || 'Lỗi khởi tạo credentials Google';
        }

        // 4. Lấy danh sách domains duy nhất
        const [domainRows] = await pool.query<RowDataPacket[]>(
            'SELECT DISTINCT domain FROM gmail_accounts WHERE domain IS NOT NULL AND domain != ""'
        );
        const domains = domainRows.map((r) => r.domain);

        // 5. Query danh sách accounts có filter & search
        let whereClause = '1=1';
        const params: any[] = [];

        if (status !== 'all') {
            if (status === 'available') {
                whereClause += ' AND (status = "available" OR status = "in_stock")';
            } else {
                whereClause += ' AND status = ?';
                params.push(status);
            }
        }

        if (domain !== 'all') {
            whereClause += ' AND domain = ?';
            params.push(domain);
        }

        if (search.trim()) {
            whereClause += ' AND (email LIKE ? OR order_id LIKE ? OR sold_to_user_id LIKE ?)';
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
        }

        const [countResult] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM gmail_accounts WHERE ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        const [accounts] = await pool.query<RowDataPacket[]>(
            `SELECT g.*, u.username as buyer_username, u.name as buyer_name, u.telegram_id as buyer_telegram_id
             FROM gmail_accounts g
             LEFT JOIN users u ON (g.sold_to_user_id = u.id OR g.sold_to_user_id = u.telegram_id)
             WHERE ${whereClause}
             ORDER BY g.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return NextResponse.json({
            success: true,
            stats: statsRows[0] || {},
            settings,
            googleApi: {
                connected: googleApiConnected,
                error: googleApiError
            },
            domains,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            accounts
        });
    } catch (error: any) {
        console.error('[GMAIL_EDU_API_GET_ERR]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: Tạo tài khoản Gmail EDU trực tiếp qua Google Admin SDK
export async function POST(request: Request) {
    try {
        await ensureGmailTable();
        const body = await request.json();
        const { action } = body;

        // Action: test_connection
        if (action === 'test_connection') {
            try {
                await initializeAuth();
                return NextResponse.json({
                    success: true,
                    message: 'Kết nối Google Workspace Admin API thành công 100%!'
                });
            } catch (e: any) {
                return NextResponse.json({
                    success: false,
                    error: `Lỗi kết nối Google Admin API: ${e.message}`
                }, { status: 400 });
            }
        }

        // Action: create_accounts (Tạo số lượng tài khoản)
        const quantity = Math.min(50, Math.max(1, parseInt(body.quantity || '1', 10)));
        const prefix = body.prefix ? String(body.prefix).trim() : '';
        const customPassword = body.password ? String(body.password).trim() : null;
        const targetDomain = body.domain ? String(body.domain).trim() : DEFAULT_EDU_DOMAIN;
        const targetUserId = body.sold_to_user_id ? Number(body.sold_to_user_id) : null;
        const targetOrderId = body.order_id ? String(body.order_id).trim() : null;
        const status = body.status || (targetUserId ? 'sold' : 'available');

        // Lấy đơn giá hiện tại
        const [priceRow] = await pool.query<RowDataPacket[]>(
            "SELECT `value` FROM settings WHERE `key` = 'gmail_edu_price'"
        );
        const unitPrice = Number(priceRow[0]?.value) || 10000;

        const createdAccounts: Array<{ email: string; password: string; id?: string }> = [];
        const failedAccounts: Array<{ username: string; error: string }> = [];

        for (let i = 0; i < quantity; i++) {
            const uname = generateRandomUsername(prefix);
            const pwd = customPassword || generateRandomPassword(12);

            const res = await createEduAccount(uname, targetDomain, pwd);
            if (!res.success) {
                failedAccounts.push({ username: uname, error: res.error || 'Lỗi không xác định' });
                continue;
            }

            const email = res.email;
            const finalPass = res.password || pwd;

            try {
                await pool.query(`
                    INSERT INTO gmail_accounts (email, password, type, domain, status, sold_to_user_id, sold_price, order_id, is_logged_in, first_login_at, delete_at, created_at)
                    VALUES (?, ?, 'edu', ?, ?, ?, ?, ?, 0, NULL, NULL, NOW())
                `, [email, finalPass, targetDomain, status, targetUserId, targetUserId ? unitPrice : null, targetOrderId]);

                createdAccounts.push({ email, password: finalPass, id: res.id });
            } catch (dbErr: any) {
                console.error('[GMAIL_EDU_POST_DB_ERR]', dbErr.message);
            }

            if (i < quantity - 1) {
                await new Promise((r) => setTimeout(r, 400));
            }
        }

        const adminUsername = (await getAdminFromCookie(request)) || 'system';
        const reqInfo = getRequestInfo(request);
        await logAdminAction({
            adminName: adminUsername,
            action: 'CREATE',
            targetType: 'GMAIL_ACCOUNT',
            details: `Tạo thành công ${createdAccounts.length}/${quantity} tài khoản Gmail EDU trên domain ${targetDomain}`,
            ...reqInfo
        });

        return NextResponse.json({
            success: createdAccounts.length > 0,
            createdCount: createdAccounts.length,
            failedCount: failedAccounts.length,
            accounts: createdAccounts,
            failed: failedAccounts
        });
    } catch (error: any) {
        console.error('[GMAIL_EDU_POST_ERR]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT: Cập nhật cấu hình hoặc cập nhật trạng thái tài khoản
export async function PUT(request: Request) {
    try {
        const body = await request.json();

        // 1. Cập nhật Settings
        if (body.type === 'settings') {
            const { price, domain, enabled, delete_hours, password_type, custom_password, max_user_limit, max_order_qty } = body;

            if (price !== undefined) {
                await pool.query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('gmail_edu_price', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [String(price), String(price)]
                );
            }
            if (domain !== undefined) {
                await pool.query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('gmail_edu_domain', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [String(domain), String(domain)]
                );
            }
            if (enabled !== undefined) {
                const enVal = enabled ? 'true' : 'false';
                await pool.query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('gmail_edu_enabled', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [enVal, enVal]
                );
                await pool.query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('buy_gmail_edu', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [enVal, enVal]
                );
            }
            if (delete_hours !== undefined) {
                await pool.query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('gmail_edu_delete_hours', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [String(delete_hours), String(delete_hours)]
                );
            }
            if (password_type !== undefined) {
                await pool.query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('gmail_edu_password_type', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [String(password_type), String(password_type)]
                );
            }
            if (custom_password !== undefined) {
                await pool.query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('gmail_edu_custom_password', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [String(custom_password), String(custom_password)]
                );
            }
            if (max_user_limit !== undefined) {
                await pool.query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('gmail_edu_max_user_limit', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [String(max_user_limit), String(max_user_limit)]
                );
            }
            if (max_order_qty !== undefined) {
                await pool.query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('gmail_edu_max_order_qty', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [String(max_order_qty), String(max_order_qty)]
                );
            }

            const adminUsername = (await getAdminFromCookie(request)) || 'system';
            const reqInfo = getRequestInfo(request);
            await logAdminAction({
                adminName: adminUsername,
                action: 'UPDATE',
                targetType: 'SETTING',
                details: `Cập nhật cài đặt Gmail EDU: Giá = ${price}đ, Domain = ${domain}, Bật = ${enabled}`,
                ...reqInfo
            });

            return NextResponse.json({ success: true, message: 'Đã lưu cài đặt Gmail EDU thành công!' });
        }

        // 2. Cập nhật từng tài khoản (VD: đổi status, note, password)
        if (body.type === 'account' && body.id) {
            const { id, status, password, note } = body;
            const updates: string[] = [];
            const params: any[] = [];

            if (status !== undefined) {
                updates.push('status = ?');
                params.push(status);
            }
            if (password !== undefined && password.trim()) {
                updates.push('password = ?');
                params.push(password.trim());
            }

            if (updates.length > 0) {
                params.push(id);
                await pool.query(`UPDATE gmail_accounts SET ${updates.join(', ')} WHERE id = ?`, params);
            }

            return NextResponse.json({ success: true, message: 'Cập nhật tài khoản thành công!' });
        }

        return NextResponse.json({ success: false, error: 'Yêu cầu không hợp lệ' }, { status: 400 });
    } catch (error: any) {
        console.error('[GMAIL_EDU_PUT_ERR]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE: Xóa tài khoản khỏi database & tùy chọn xóa trên Google Admin SDK
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const deleteFromGoogle = searchParams.get('delete_from_google') === 'true';

        let body: any = {};
        try {
            body = await request.json();
        } catch {}

        const ids: number[] = body.ids || (id ? [Number(id)] : []);

        if (!ids.length) {
            return NextResponse.json({ success: false, error: 'Chưa chọn tài khoản để xóa' }, { status: 400 });
        }

        // Lấy danh sách email trước khi xóa
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, email FROM gmail_accounts WHERE id IN (?)`,
            [ids]
        );

        const emails = rows.map((r) => r.email);

        // Xóa trên Google Workspace nếu được yêu cầu
        if (deleteFromGoogle && emails.length > 0) {
            try {
                await deleteMultipleAccounts(emails);
            } catch (gErr: any) {
                console.error('[GMAIL_EDU_DELETE_GOOGLE_ERR]', gErr.message);
            }
        }

        // Xóa khỏi Database
        await pool.query(`DELETE FROM gmail_accounts WHERE id IN (?)`, [ids]);

        const adminUsername = (await getAdminFromCookie(request)) || 'system';
        const reqInfo = getRequestInfo(request);
        await logAdminAction({
            adminName: adminUsername,
            action: 'DELETE',
            targetType: 'GMAIL_ACCOUNT',
            details: `Đã xóa ${ids.length} tài khoản Gmail EDU: ${emails.slice(0, 3).join(', ')}${emails.length > 3 ? '...' : ''}`,
            ...reqInfo
        });

        return NextResponse.json({
            success: true,
            deletedCount: ids.length,
            message: `Đã xóa thành công ${ids.length} tài khoản!`
        });
    } catch (error: any) {
        console.error('[GMAIL_EDU_DELETE_ERR]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
