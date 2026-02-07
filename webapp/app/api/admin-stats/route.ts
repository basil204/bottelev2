import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month'); // MM
        const year = searchParams.get('year') || new Date().getFullYear().toString();

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'SYSTEM',
            details: `Viewed admin purchase statistics for ${month}/${year}`,
            request
        });

        let dateFilter = '';
        const params: any[] = [];

        if (month && month !== 'all') {
            dateFilter = 'AND MONTH(o.created_at) = ? AND YEAR(o.created_at) = ?';
            params.push(parseInt(month), parseInt(year));
        } else {
            dateFilter = 'AND YEAR(o.created_at) = ?';
            params.push(parseInt(year));
        }

        // Query to get stats for each admin linked via telegram_id
        const query = `
            SELECT 
                aa.id as admin_id,
                aa.fullname as admin_name,
                aa.username,
                aa.telegram_id,
                COUNT(o.id) as total_orders,
                COALESCE(SUM(o.price), 0) as total_spent
            FROM admin_accounts aa
            INNER JOIN users u ON aa.telegram_id = u.telegram_id
            INNER JOIN orders o ON u.id = o.user_id
            WHERE o.status = 'completed' ${dateFilter}
            GROUP BY aa.id, aa.fullname, aa.username, aa.telegram_id
            ORDER BY total_spent DESC
        `;

        const [rows] = await pool.query<RowDataPacket[]>(query, params);

        return NextResponse.json(rows);
    } catch (error) {
        console.error('[ADMIN_STATS_API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
