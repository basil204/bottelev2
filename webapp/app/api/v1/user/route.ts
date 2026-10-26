import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        let apiKey = request.headers.get('x-api-key') || searchParams.get('api_key');

        const authHeader = request.headers.get('authorization');
        if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
            apiKey = authHeader.replace('Bearer ', '').trim();
        }

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: 'Thiếu API Key. Vui lòng truyền X-API-Key qua Header hoặc api_key qua Query Parameter.'
            }, { status: 401 });
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
            return NextResponse.json({
                success: false,
                error: 'API Key không tồn tại hoặc đã bị vô hiệu hóa.'
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

        // Update last_used_at
        pool.query('UPDATE user_api_keys SET last_used_at = NOW() WHERE id = ?', [keyInfo.key_id]).catch(() => { });

        const historyLimit = Math.min(100, Math.max(1, parseInt(searchParams.get('history_limit') || searchParams.get('limit') || '10', 10)));

        // Thống kê đơn hàng mua bằng API Key của người dùng
        const [statsRows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                COUNT(*) as total_api_orders,
                COALESCE(SUM(price), 0) as total_api_spent,
                MAX(created_at) as last_api_purchase_at
            FROM orders
            WHERE user_id = ? AND (api_key_id IS NOT NULL OR source = 'api' OR note LIKE '%API%')
        `, [keyInfo.user_id]);

        const stats = statsRows && statsRows.length > 0 ? statsRows[0] : { total_api_orders: 0, total_api_spent: 0, last_api_purchase_at: null };

        // Lấy danh sách lịch sử mua hàng qua API Key gần đây
        const [historyRows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                o.id,
                o.invoice_code,
                o.product_id,
                COALESCE(p.name, o.note, 'Dịch vụ') as product_name,
                o.price,
                o.status,
                o.email as delivery_data,
                o.note,
                o.created_at,
                o.api_key_id,
                COALESCE(o.source, 'api') as source
            FROM orders o
            LEFT JOIN products p ON p.id = o.product_id
            WHERE o.user_id = ? AND (o.api_key_id IS NOT NULL OR o.source = 'api' OR o.note LIKE '%API%')
            ORDER BY o.id DESC
            LIMIT ?
        `, [keyInfo.user_id, historyLimit]);

        return NextResponse.json({
            success: true,
            data: {
                user_id: keyInfo.user_id,
                telegram_id: keyInfo.telegram_id,
                username: keyInfo.username,
                name: keyInfo.name,
                balance: Number(keyInfo.balance) || 0,
                api_key_info: {
                    key_id: keyInfo.key_id,
                    key_name: keyInfo.key_name,
                    permissions: keyInfo.permissions || 'all',
                    is_active: Boolean(keyInfo.is_active),
                    last_used_at: keyInfo.last_used_at || null
                },
                api_purchase_stats: {
                    total_orders: Number(stats.total_api_orders) || 0,
                    total_spent: Number(stats.total_api_spent) || 0,
                    last_purchase_at: stats.last_api_purchase_at || null
                },
                purchase_history: (historyRows || []).map((o: any) => ({
                    id: o.id,
                    invoice_code: o.invoice_code,
                    product_id: o.product_id,
                    product_name: o.product_name,
                    price: Number(o.price) || 0,
                    status: o.status,
                    note: o.note,
                    delivery_data: o.delivery_data,
                    created_at: o.created_at
                }))
            }
        });
    } catch (error: any) {
        console.error('[NEXTJS_API_V1_USER_ERROR]', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Lỗi hệ thống khi lấy thông tin người dùng và lịch sử API Key'
        }, { status: 500 });
    }
}
