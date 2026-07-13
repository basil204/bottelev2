import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                o.id as order_id,
                o.invoice_code,
                o.email as account_data,
                o.price,
                o.created_at as sold_at,
                o.user_id,
                u.username as buyer_username,
                u.telegram_id as buyer_telegram_id,
                p.id as product_id,
                COALESCE(p.name, o.note, 'Sản phẩm') as product_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN products p ON o.product_id = p.id
            WHERE o.status = 'completed'
        `;

        const params: any[] = [];

        if (productId) {
            query += ' AND o.product_id = ?';
            params.push(productId);
        }

        // Filter by user ID or telegram ID
        const userId = searchParams.get('userId');
        const telegramId = searchParams.get('telegramId');

        if (userId) {
            query += ' AND o.user_id = ?';
            params.push(userId);
        }

        if (telegramId) {
            query += ' AND u.telegram_id LIKE ?';
            params.push(`%${telegramId}%`);
        }

        query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.query<RowDataPacket[]>(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.status = 'completed'
        `;
        const countParams: any[] = [];

        if (productId) {
            countQuery += ' AND o.product_id = ?';
            countParams.push(productId);
        }

        if (userId) {
            countQuery += ' AND o.user_id = ?';
            countParams.push(userId);
        }

        if (telegramId) {
            countQuery += ' AND u.telegram_id LIKE ?';
            countParams.push(`%${telegramId}%`);
        }

        const [countResult] = await pool.query<RowDataPacket[]>(countQuery, countParams);
        const total = countResult[0]?.total || 0;
        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });
    } catch (error) {
        console.error('Error fetching sold inventory:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
