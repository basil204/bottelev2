import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { createEduAccount, generateRandomPassword, generateRandomUsername, DEFAULT_EDU_DOMAIN } from '@/lib/googleAdminService';

// Handler POST đặt Gmail EDU bằng User API Key
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
            SELECT k.id as key_id, k.is_active, k.permissions, u.id as user_id, u.telegram_id, u.username, u.name, u.balance, u.is_banned, u.edu_limit
            FROM user_api_keys k
            INNER JOIN users u ON (k.user_id = u.id OR k.user_id = u.telegram_id)
            WHERE LOWER(TRIM(k.api_key)) = LOWER(TRIM(?)) LIMIT 1
        `, [cleanApiKey]);

        if (!keyRows.length) {
            return NextResponse.json({
                success: false,
                error: 'API Key không tồn tại trong hệ thống'
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
                    error: 'API Key của bạn không có quyền tạo/đặt Gmail EDU (Thiếu quyền: order_edu).'
                }, { status: 403 });
            }
        }

        // Get Gmail EDU settings
        const [settingsRows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('gmail_edu_price', 'gmail_edu_domain', 'gmail_edu_enabled', 'buy_gmail_edu', 'gmail_edu_password_type', 'gmail_edu_custom_password', 'gmail_edu_max_user_limit', 'gmail_edu_max_order_qty', 'gmail_edu_delete_hours')"
        );

        const settingsMap: Record<string, string> = {};
        settingsRows.forEach(r => { settingsMap[r.key] = r.value; });

        const isEnabled = settingsMap.gmail_edu_enabled !== 'false' && settingsMap.buy_gmail_edu !== 'false';
        if (!isEnabled) {
            return NextResponse.json({
                success: false,
                error: 'Tính năng mua Gmail EDU hiện đang bị tạm khóa bởi Admin.'
            }, { status: 400 });
        }

        let pricePerUnit = Number(settingsMap.gmail_edu_price) || 10000;
        try {
            const [cpRows] = await pool.query<RowDataPacket[]>(
                `SELECT custom_price, scope FROM custom_pricing 
                 WHERE (user_id = ? OR user_id = (SELECT id FROM users WHERE telegram_id = ? LIMIT 1))
                   AND (product_id = -1 OR plan_id = 'gmail_edu' OR plan_id = 'gmail' OR scope = 'GMAIL_EDU')
                   AND is_active = 1
                 ORDER BY id DESC LIMIT 1`,
                [keyInfo.user_id, keyInfo.user_id]
            );
            if (cpRows && cpRows.length > 0) {
                pricePerUnit = Number(cpRows[0].custom_price);
            }
        } catch (cpErr: any) {
            if (cpErr.code !== 'ER_NO_SUCH_TABLE') {
                console.error('[GMAIL_EDU_NEXTJS_CUSTOM_PRICE_ERR]', cpErr.message);
            }
        }

        const defaultDomain = (body.domain && String(body.domain).trim())
            ? String(body.domain).trim()
            : (settingsMap.gmail_edu_domain || DEFAULT_EDU_DOMAIN || 'nttp.edu.pl');

        const maxOrderQty = Math.max(1, Number(settingsMap.gmail_edu_max_order_qty) || 20);
        const reqQty = Number(body.quantity) || 1;
        if (reqQty > maxOrderQty) {
            return NextResponse.json({
                success: false,
                error: `Số lượng đặt vượt quá giới hạn tối đa (${maxOrderQty} tài khoản/đơn).`
            }, { status: 400 });
        }
        const quantity = Math.min(Math.max(1, reqQty), maxOrderQty);

        // Kiểm tra giới hạn mua tài khoản cho người dùng
        const userLimit = (keyInfo.edu_limit !== null && keyInfo.edu_limit !== undefined)
            ? Number(keyInfo.edu_limit)
            : (Number(settingsMap.gmail_edu_max_user_limit) || 0);

        if (userLimit > 0) {
            const [countRows] = await pool.query<RowDataPacket[]>(
                "SELECT COUNT(*) as total FROM gmail_accounts WHERE sold_to_user_id = ? AND status != 'error'",
                [keyInfo.user_id]
            );
            const totalBought = Number(countRows[0]?.total || 0);
            if (totalBought + quantity > userLimit) {
                return NextResponse.json({
                    success: false,
                    error: `Vượt quá giới hạn mua tài khoản Gmail EDU. Bạn đã mua ${totalBought}/${userLimit} tài khoản.`
                }, { status: 400 });
            }
        }

        const domain = defaultDomain;
        const type = body.type === 'non' ? 'non' : 'edu';

        // Hỗ trợ đặt mật khẩu cho email EDU qua body hoặc query (password, pass, custom_password)
        const reqPassword = body.password || body.pass || body.custom_password || searchParams.get('password') || searchParams.get('pass');
        let customPassword = null;
        if (reqPassword) {
            const cleanReqPass = String(reqPassword).trim();
            if (cleanReqPass.length < 8) {
                return NextResponse.json({
                    success: false,
                    error: 'Mật khẩu tùy chỉnh cho Gmail EDU phải có tối thiểu 8 ký tự theo tiêu chuẩn bảo mật Google Workspace.'
                }, { status: 400 });
            }
            customPassword = cleanReqPass;
        }

        // Hỗ trợ mảng passwords cho nhiều tài khoản
        const passwordsList = Array.isArray(body.passwords) ? body.passwords : [];
        if (passwordsList.length > 0) {
            for (const p of passwordsList) {
                if (p && String(p).trim().length < 8) {
                    return NextResponse.json({
                        success: false,
                        error: `Mật khẩu '${p}' trong danh sách passwords không hợp lệ. Phải có tối thiểu 8 ký tự.`
                    }, { status: 400 });
                }
            }
        }

        const totalCost = pricePerUnit * quantity;
        const currentBalance = Number(keyInfo.balance) || 0;

        if (currentBalance < totalCost) {
            return NextResponse.json({
                success: false,
                error: `Số dư không đủ. Cần: ${totalCost.toLocaleString('vi-VN')} VNĐ, Số dư hiện có: ${currentBalance.toLocaleString('vi-VN')} VNĐ.`
            }, { status: 400 });
        }

        // Process creation via Google Admin API
        const createdAccounts: any[] = [];
        const failedCreation: string[] = [];

        for (let i = 0; i < quantity; i++) {
            const username = generateRandomUsername(body.prefix || body.username);
            // Quy luật: Nếu người dùng set pass thì tạo đúng mật khẩu đó, nếu không set pass thì random ngẫu nhiên
            const userProvidedPass = (passwordsList[i] && String(passwordsList[i]).trim()) || customPassword;
            const password = userProvidedPass || generateRandomPassword(12);

            // Call Google Admin API
            const createRes = await createEduAccount(username, domain, password);

            if (!createRes.success) {
                console.error(`[API_ORDER_EDU] Failed to create account for ${username}@${domain}:`, createRes.error);
                failedCreation.push(createRes.error || 'Google Admin API Error');
                continue;
            }

            const email = createRes.email;
            const finalPass = createRes.password || password;

            // Insert into gmail_accounts DB table with delayed deletion (active on first login)
            await pool.query(`
                INSERT INTO gmail_accounts (email, password, type, domain, status, sold_to_user_id, sold_price, is_logged_in, first_login_at, delete_at, created_at)
                VALUES (?, ?, ?, ?, 'sold', ?, ?, 0, NULL, NULL, NOW())
            `, [email, finalPass, type, domain, keyInfo.user_id, pricePerUnit]);

            createdAccounts.push({
                email,
                password: finalPass,
                type,
                domain,
                google_id: createRes.id,
                auto_delete: 'after_first_login'
            });

            if (i < quantity - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        if (createdAccounts.length === 0) {
            return NextResponse.json({
                success: false,
                error: `Không thể tạo tài khoản trên Google Admin API: ${failedCreation[0] || 'Lỗi hệ thống'}`
            }, { status: 500 });
        }

        const actualTotalCost = pricePerUnit * createdAccounts.length;

        // Deduct user balance
        await pool.query('UPDATE users SET balance = balance - ? WHERE id = ?', [actualTotalCost, keyInfo.user_id]);

        // Add balance log
        try {
            await pool.query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)', [
                keyInfo.user_id, -actualTotalCost, `buy_gmail_edu_api_${createdAccounts.length}_items`
            ]);
        } catch (e) { }

        // Update API Key last_used_at
        await pool.query('UPDATE user_api_keys SET last_used_at = NOW() WHERE id = ?', [keyInfo.key_id]);

        // Create Order Record
        const accountsFormatted = createdAccounts.map(a => `${a.email}|${a.password}`).join('\n');
        const [orderRes] = await pool.query<ResultSetHeader>(`
            INSERT INTO orders (user_id, price, email, note, status, api_key_id, source)
            VALUES (?, ?, ?, ?, 'completed', ?, 'api')
        `, [keyInfo.user_id, actualTotalCost, accountsFormatted, `API Order Gmail EDU (${createdAccounts.length} tài khoản)`, keyInfo.key_id]);

        const invoiceCode = `HD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(orderRes.insertId).padStart(4, '0')}`;

        try {
            await pool.query('UPDATE orders SET invoice_code = ? WHERE id = ?', [invoiceCode, orderRes.insertId]);
            await pool.query('UPDATE gmail_accounts SET order_id = ? WHERE sold_to_user_id = ? AND order_id IS NULL', [invoiceCode, keyInfo.user_id]);
        } catch (e) { }

        const newBalance = currentBalance - actualTotalCost;

        return NextResponse.json({
            success: true,
            message: 'Đặt Gmail EDU qua API thành công!',
            invoice_code: invoiceCode,
            quantity: createdAccounts.length,
            total_cost: actualTotalCost,
            price_per_unit: pricePerUnit,
            remaining_balance: newBalance,
            data: createdAccounts
        });
    } catch (error: any) {
        console.error('[API_ORDER_EDU_ERROR]', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Lỗi xử lý hệ thống'
        }, { status: 500 });
    }
}
