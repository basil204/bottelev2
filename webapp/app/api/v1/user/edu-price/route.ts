import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

async function authenticateApiKey(request: Request) {
    const { searchParams } = new URL(request.url);
    let apiKey = request.headers.get('x-api-key') || searchParams.get('api_key');

    const authHeader = request.headers.get('authorization');
    if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.replace('Bearer ', '').trim();
    }

    if (!apiKey) {
        return { error: 'Thiếu API Key. Vui lòng truyền X-API-Key qua Header hoặc api_key qua Query Parameter.', status: 401 };
    }

    const cleanApiKey = String(apiKey).trim();
    const [keyRows] = await pool.query<RowDataPacket[]>(`
        SELECT k.id as key_id, k.name as key_name, k.is_active, k.permissions, k.last_used_at,
               u.id as user_id, u.telegram_id, u.username, u.name, u.balance, u.is_banned
        FROM user_api_keys k
        INNER JOIN users u ON (k.user_id = u.id OR k.user_id = u.telegram_id)
        WHERE LOWER(TRIM(k.api_key)) = LOWER(TRIM(?)) LIMIT 1
    `, [cleanApiKey]);

    if (!keyRows.length) {
        return { error: 'API Key không tồn tại hoặc đã bị vô hiệu hóa.', status: 401 };
    }

    const keyInfo = keyRows[0];
    if (!keyInfo.is_active) {
        return { error: 'API Key của bạn đang bị vô hiệu hóa. Vui lòng liên hệ Admin.', status: 403 };
    }

    if (keyInfo.is_banned) {
        return { error: 'Tài khoản người dùng đã bị khóa.', status: 403 };
    }

    pool.query('UPDATE user_api_keys SET last_used_at = NOW() WHERE id = ?', [keyInfo.key_id]).catch(() => { });

    return { user: keyInfo };
}

// GET /api/v1/user/edu-price
export async function GET(request: Request) {
    try {
        const auth = await authenticateApiKey(request);
        if (auth.error) {
            return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
        }
        const user = auth.user!;

        const { searchParams } = new URL(request.url);
        const targetUserIdInput = searchParams.get('user_id') || searchParams.get('userId') || searchParams.get('telegram_id') || user.user_id;

        const [uRows] = await pool.query<RowDataPacket[]>(
            'SELECT id, telegram_id, username, name FROM users WHERE id = ? OR telegram_id = ? LIMIT 1',
            [targetUserIdInput, targetUserIdInput]
        );

        if (!uRows.length) {
            return NextResponse.json({ success: false, error: 'Không tìm thấy người dùng.' }, { status: 404 });
        }
        const targetUser = uRows[0];

        // Lấy giá mặc định hệ thống
        let defaultEduPrice = 10000;
        try {
            const [sRows] = await pool.query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'gmail_edu_price' LIMIT 1");
            if (sRows.length > 0 && sRows[0].value) {
                defaultEduPrice = Number(sRows[0].value) || 10000;
            }
        } catch (e) { }

        let effectiveEduPrice = defaultEduPrice;
        let hasCustomEduPrice = false;
        let customEduPriceRow: any = null;
        try {
            const [cpRows] = await pool.query<RowDataPacket[]>(`
                SELECT id, custom_price, scope, is_active, updated_at FROM custom_pricing 
                WHERE (user_id = ? OR user_id = (SELECT id FROM users WHERE telegram_id = ? LIMIT 1))
                  AND (product_id = -1 OR plan_id = 'gmail_edu' OR plan_id = 'gmail' OR scope = 'GMAIL_EDU')
                ORDER BY id DESC LIMIT 1
            `, [targetUser.id, targetUser.id]);

            if (cpRows.length > 0) {
                customEduPriceRow = cpRows[0];
                if (Boolean(customEduPriceRow.is_active)) {
                    effectiveEduPrice = Number(customEduPriceRow.custom_price);
                    hasCustomEduPrice = true;
                }
            }
        } catch (e) { }

        return NextResponse.json({
            success: true,
            data: {
                user_id: targetUser.id,
                telegram_id: targetUser.telegram_id,
                username: targetUser.username,
                default_price: defaultEduPrice,
                effective_price: effectiveEduPrice,
                has_custom_price: hasCustomEduPrice,
                custom_price: customEduPriceRow ? Number(customEduPriceRow.custom_price) : null,
                scope: customEduPriceRow ? customEduPriceRow.scope : 'ALL_ORDERS',
                is_active: customEduPriceRow ? Boolean(customEduPriceRow.is_active) : false,
                pricing_id: customEduPriceRow ? customEduPriceRow.id : null
            }
        });
    } catch (error: any) {
        console.error('[GET_USER_EDU_PRICE_ERROR]', error);
        return NextResponse.json({ success: false, error: 'Lỗi lấy thông tin giá Email EDU' }, { status: 500 });
    }
}

// POST /api/v1/user/edu-price
export async function POST(request: Request) {
    try {
        const auth = await authenticateApiKey(request);
        if (auth.error) {
            return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
        }
        const user = auth.user!;

        const body = await request.json().catch(() => ({}));
        const targetUserIdInput = body.user_id || body.userId || body.telegram_id || body.telegramId || user.user_id;
        const price = body.price !== undefined ? body.price : body.custom_price;
        const scope = body.scope || 'ALL_ORDERS';
        const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
        const action = body.action;

        const [uRows] = await pool.query<RowDataPacket[]>(
            'SELECT id, telegram_id, username, name FROM users WHERE id = ? OR telegram_id = ? LIMIT 1',
            [targetUserIdInput, targetUserIdInput]
        );

        if (!uRows.length) {
            return NextResponse.json({ success: false, error: 'Không tìm thấy người dùng trong hệ thống.' }, { status: 404 });
        }
        const targetUser = uRows[0];

        // Quyền thiết lập cho người khác
        if (targetUser.id !== user.user_id && user.permissions !== 'all') {
            return NextResponse.json({ success: false, error: 'Bạn không có quyền thiết lập giá cho người dùng khác.' }, { status: 403 });
        }

        if (action === 'delete') {
            await pool.query(
                `DELETE FROM custom_pricing WHERE user_id = ? AND (product_id = -1 OR plan_id = 'gmail_edu' OR scope = 'GMAIL_EDU')`,
                [targetUser.id]
            );
            return NextResponse.json({
                success: true,
                message: 'Đã xóa giá riêng Email EDU thành công, tài khoản sẽ áp dụng giá mặc định hệ thống.'
            });
        }

        if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
            return NextResponse.json({ success: false, error: 'Giá Email EDU không hợp lệ. Vui lòng nhập số tiền >= 0 VNĐ.' }, { status: 400 });
        }

        const numPrice = Number(price);
        const [existing] = await pool.query<RowDataPacket[]>(`
            SELECT id FROM custom_pricing 
            WHERE user_id = ? AND (product_id = -1 OR plan_id = 'gmail_edu' OR scope = 'GMAIL_EDU')
            ORDER BY id DESC LIMIT 1
        `, [targetUser.id]);

        let id: number;
        if (existing.length > 0) {
            id = existing[0].id;
            await pool.query(`
                UPDATE custom_pricing 
                SET custom_price = ?, scope = ?, is_active = ?, plan_id = 'gmail_edu', updated_at = NOW()
                WHERE id = ?
            `, [numPrice, scope, isActive, id]);
        } else {
            const [insRes] = await pool.query<ResultSetHeader>(`
                INSERT INTO custom_pricing (user_id, product_id, plan_id, custom_price, scope, is_active)
                VALUES (?, -1, 'gmail_edu', ?, ?, ?)
            `, [targetUser.id, numPrice, scope, isActive]);
            id = insRes.insertId;
        }

        return NextResponse.json({
            success: true,
            message: `Đã thiết lập giá Email EDU ${numPrice.toLocaleString('vi-VN')} đ cho người dùng thành công!`,
            data: {
                id,
                user_id: targetUser.id,
                username: targetUser.username,
                custom_price: numPrice,
                scope,
                is_active: Boolean(isActive)
            }
        });
    } catch (error: any) {
        console.error('[SET_USER_EDU_PRICE_ERROR]', error);
        return NextResponse.json({ success: false, error: 'Lỗi thiết lập giá Email EDU cho người dùng' }, { status: 500 });
    }
}
