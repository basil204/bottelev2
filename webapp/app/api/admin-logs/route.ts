import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { verifyJWT } from '@/lib-edge/jwt';

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

/**
 * DELETE - Xóa log (chỉ super_admin mới có quyền)
 */
export async function DELETE(request: Request) {
    try {
        // Check if user is super_admin
        const cookieHeader = request.headers.get('cookie') || '';
        const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);

        if (!tokenMatch) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const token = decodeURIComponent(tokenMatch[1]);
        const payload = await verifyJWT(token);

        if (!payload || payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Chỉ Super Admin mới có quyền xóa log' }, { status: 403 });
        }

        const { id, ids, deleteAll } = await request.json();

        if (deleteAll) {
            // Delete all logs
            await pool.query<ResultSetHeader>('DELETE FROM admin_logs');
            return NextResponse.json({ success: true, message: 'Đã xóa tất cả log' });
        } else if (ids && Array.isArray(ids) && ids.length > 0) {
            // Bulk delete
            await pool.query<ResultSetHeader>('DELETE FROM admin_logs WHERE id IN (?)', [ids]);
            return NextResponse.json({ success: true, message: `Đã xóa ${ids.length} log` });
        } else if (id) {
            // Single delete
            await pool.query<ResultSetHeader>('DELETE FROM admin_logs WHERE id = ?', [id]);
            return NextResponse.json({ success: true, message: 'Đã xóa log' });
        }

        return NextResponse.json({ error: 'Thiếu tham số' }, { status: 400 });
    } catch (error) {
        console.error('Error deleting admin logs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
