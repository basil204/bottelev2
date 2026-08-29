import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { createEduAccount, generateRandomPassword, generateRandomUsername } from '@/lib/googleAdminService';

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
            SELECT k.id as key_id, k.is_active, k.permissions, u.id as user_id, u.telegram_id, u.username, u.name, u.balance
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
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('gmail_edu_price', 'gmail_edu_domain', 'gmail_edu_enabled')"
        );

        const settingsMap: Record<string, string> = {};
        settingsRows.forEach(r => { settingsMap[r.key] = r.value; });

        const isEnabled = settingsMap.gmail_edu_enabled !== 'false';
        if (!isEnabled) {
            return NextResponse.json({
                success: false,
                error: 'Tính năng mua Gmail EDU hiện đang bị tạm khóa bởi Admin'
            }, { status: 400 });
        }

        const pricePerUnit = Number(settingsMap.gmail_edu_price) || 10000;
        const defaultDomain = (body.domain && String(body.domain).trim()) 
            ? String(body.domain).trim() 
            : (settingsMap.gmail_edu_domain || 'suafpoly.app');

        const quantity = Math.min(Math.max(1, Number(body.quantity) || 1), 50);
        const domain = defaultDomain;
        const type = body.type === 'non' ? 'non' : 'edu';
        const customPassword = body.password ? String(body.password).trim() : null;

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
            const password = customPassword || generateRandomPassword();

            // Call Google Admin API
            const createRes = await createEduAccount(username, domain, password);

            if (!createRes.success) {
                console.error(`[API_ORDER_EDU] Failed to create account for ${username}@${domain}:`, createRes.error);
                failedCreation.push(createRes.error || 'Google Admin API Error');
                continue;
            }

            const email = createRes.email;

            // Insert into gmail_accounts DB table
            await pool.query(`
                INSERT INTO gmail_accounts (email, password, type, domain, status, delete_at, created_at)
                VALUES (?, ?, ?, ?, 'available', DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())
            `, [email, password, type, domain]);

            createdAccounts.push({
                email,
                password,
                type,
                domain,
                auto_delete: '1h_after_login'
            });

            if (i < quantity - 1) {
                await new Promise(r => setTimeout(r, 1000));
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
        } catch (e) {}

        // Update API Key last_used_at
        await pool.query('UPDATE user_api_keys SET last_used_at = NOW() WHERE id = ?', [keyInfo.key_id]);

        // Create Order Record
        const accountsFormatted = createdAccounts.map(a => `${a.email}|${a.password}`).join('\n');
        const [orderRes] = await pool.query<ResultSetHeader>(`
            INSERT INTO orders (user_id, price, email, note, status)
            VALUES (?, ?, ?, ?, 'completed')
        `, [keyInfo.user_id, actualTotalCost, accountsFormatted, `API Order Gmail EDU (${createdAccounts.length} tài khoản)`]);

        const invoiceCode = `HD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(orderRes.insertId).padStart(4, '0')}`;

        try {
            await pool.query('UPDATE orders SET invoice_code = ? WHERE id = ?', [invoiceCode, orderRes.insertId]);
        } catch (e) {}

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
