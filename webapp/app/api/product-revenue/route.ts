import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filter = searchParams.get('filter') || 'all'; // all, today, week, month, custom
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');

        let dateCondition = '';
        const params: any[] = [];

        switch (filter) {
            case 'today':
                dateCondition = 'AND DATE(o.created_at) = CURDATE()';
                break;
            case 'week':
                dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
                break;
            case 'month':
                dateCondition = 'AND MONTH(o.created_at) = MONTH(CURRENT_DATE()) AND YEAR(o.created_at) = YEAR(CURRENT_DATE())';
                break;
            case 'custom':
                if (fromDate && toDate) {
                    dateCondition = 'AND DATE(o.created_at) >= ? AND DATE(o.created_at) <= ?';
                    params.push(fromDate, toDate);
                } else if (fromDate) {
                    dateCondition = 'AND DATE(o.created_at) >= ?';
                    params.push(fromDate);
                } else if (toDate) {
                    dateCondition = 'AND DATE(o.created_at) <= ?';
                    params.push(toDate);
                }
                break;
            default:
                // 'all' - no date filter
                dateCondition = '';
        }

        const query = `
            SELECT 
                p.id as product_id,
                p.name as product_name,
                COUNT(o.id) as order_count,
                COALESCE(SUM(o.price), 0) as total_revenue
            FROM products p
            LEFT JOIN orders o ON p.id = o.product_id AND o.status = 'completed' ${dateCondition}
            GROUP BY p.id, p.name
            ORDER BY total_revenue DESC
        `;

        const [productRevenue] = await pool.query<RowDataPacket[]>(query, params);

        // Calculate totals
        const totalOrders = productRevenue.reduce((sum: number, p: any) => sum + Number(p.order_count), 0);
        const totalRevenue = productRevenue.reduce((sum: number, p: any) => sum + Number(p.total_revenue), 0);

        return NextResponse.json({
            productRevenue,
            summary: {
                totalOrders,
                totalRevenue,
                filter,
                fromDate: fromDate || null,
                toDate: toDate || null
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
