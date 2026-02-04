import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * API Route để xem Admin Activity Logs
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const action = searchParams.get('action');
        const targetType = searchParams.get('target_type');
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM admin_logs WHERE 1=1';
        const params: any[] = [];

        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }

        if (targetType) {
            query += ' AND target_type = ?';
            params.push(targetType);
        }

        if (fromDate) {
            query += ' AND DATE(created_at) >= ?';
            params.push(fromDate);
        }

        if (toDate) {
            query += ' AND DATE(created_at) <= ?';
            params.push(toDate);
        }

        // Count total
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countRows] = await pool.query<RowDataPacket[]>(countQuery, params);
        const total = countRows[0]?.total || 0;

        // Get data with pagination
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = await pool.query<RowDataPacket[]>(query, params);

        // Get action stats
        const [actionStats] = await pool.query<RowDataPacket[]>(`
            SELECT action, COUNT(*) as count 
            FROM admin_logs 
            GROUP BY action 
            ORDER BY count DESC
        `);

        // Get target type stats
        const [targetStats] = await pool.query<RowDataPacket[]>(`
            SELECT target_type, COUNT(*) as count 
            FROM admin_logs 
            GROUP BY target_type 
            ORDER BY count DESC
        `);

        return NextResponse.json({
            success: true,
            data: rows,
            stats: {
                byAction: actionStats,
                byTargetType: targetStats
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching admin logs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
