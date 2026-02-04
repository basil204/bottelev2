import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * API Route cho thống kê doanh thu Gmail EDU
 * Lấy danh sách Gmail EDU đã bán với thông tin người mua và filter theo ngày
 */

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filter = searchParams.get('filter') || 'all'; // all, today, week, month, custom
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        let dateCondition = '';
        const params: any[] = [];

        switch (filter) {
            case 'today':
                dateCondition = 'AND DATE(g.sold_at) = CURDATE()';
                break;
            case 'week':
                dateCondition = 'AND g.sold_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
                break;
            case 'month':
                dateCondition = 'AND MONTH(g.sold_at) = MONTH(CURRENT_DATE()) AND YEAR(g.sold_at) = YEAR(CURRENT_DATE())';
                break;
            case 'custom':
                if (fromDate && toDate) {
                    dateCondition = 'AND DATE(g.sold_at) >= ? AND DATE(g.sold_at) <= ?';
                    params.push(fromDate, toDate);
                } else if (fromDate) {
                    dateCondition = 'AND DATE(g.sold_at) >= ?';
                    params.push(fromDate);
                } else if (toDate) {
                    dateCondition = 'AND DATE(g.sold_at) <= ?';
                    params.push(toDate);
                }
                break;
            default:
                dateCondition = '';
        }

        // Get Gmail EDU price from settings
        const [priceRows] = await pool.query<RowDataPacket[]>(
            "SELECT `value` FROM settings WHERE `key` = 'gmail_edu_price'"
        );
        const gmailPrice = Number(priceRows[0]?.value) || 10000;

        // Get sold Gmail EDU with buyer info
        const query = `
            SELECT 
                g.id,
                g.email,
                g.sold_at,
                g.sold_to_user_id,
                g.sold_price,
                u.username as buyer_username,
                u.telegram_id as buyer_telegram_id,
                COALESCE(g.sold_price, ?) as price
            FROM gmail_accounts g
            LEFT JOIN users u ON g.sold_to_user_id = u.id
            WHERE g.status = 'sold' ${dateCondition}
            ORDER BY g.sold_at DESC
            LIMIT ? OFFSET ?
        `;

        const queryParams = [gmailPrice, ...params, limit, offset];
        const [rows] = await pool.query<RowDataPacket[]>(query, queryParams);

        // Get total count and revenue
        const countQuery = `
            SELECT 
                COUNT(*) as total,
                SUM(COALESCE(g.sold_price, ?)) as total_revenue
            FROM gmail_accounts g
            WHERE g.status = 'sold' ${dateCondition}
        `;
        const [countRows] = await pool.query<RowDataPacket[]>(countQuery, [gmailPrice, ...params]);
        const total = countRows[0]?.total || 0;
        const totalRevenue = countRows[0]?.total_revenue || (total * gmailPrice);

        // Get summary by date
        const summaryQuery = `
            SELECT 
                DATE(g.sold_at) as date,
                COUNT(*) as count
            FROM gmail_accounts g
            WHERE g.status = 'sold' ${dateCondition}
            GROUP BY DATE(g.sold_at)
            ORDER BY date DESC
            LIMIT 30
        `;
        const [summaryRows] = await pool.query<RowDataPacket[]>(summaryQuery, params);

        return NextResponse.json({
            success: true,
            data: rows,
            summary: {
                totalSold: total,
                totalRevenue,
                pricePerAccount: gmailPrice,
                filter,
                fromDate: fromDate || null,
                toDate: toDate || null
            },
            dailySummary: summaryRows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching Gmail EDU revenue:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
