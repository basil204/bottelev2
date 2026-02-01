import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * API Route cho quản lý Gmail EDU
 * GET - Lấy danh sách Gmail EDU
 * POST - Tạo Gmail EDU mới (sẽ được implement sau khi có Google Admin API từ backend)
 * DELETE - Xóa Gmail EDU
 */

// GET - Lấy danh sách Gmail EDU
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'edu';
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let sql = 'SELECT * FROM gmail_accounts WHERE 1=1';
        const params: (string | number)[] = [];

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        // Count total
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
        const total = countRows[0]?.total || 0;

        // Get data with pagination
        sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const [rows] = await pool.query<RowDataPacket[]>(sql, params);

        // Get stats
        const [statsRows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                type,
                status,
                COUNT(*) as count
            FROM gmail_accounts 
            WHERE type = ?
            GROUP BY type, status
        `, [type]);

        const stats = {
            total: 0,
            available: 0,
            sold: 0,
            deleted: 0
        };

        statsRows.forEach((row) => {
            stats.total += row.count;
            if (row.status === 'available') stats.available = row.count;
            if (row.status === 'sold') stats.sold = row.count;
            if (row.status === 'deleted') stats.deleted = row.count;
        });

        return NextResponse.json({
            success: true,
            data: rows,
            stats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching Gmail accounts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE - Xóa Gmail EDU từ database (không xóa trên Google - chỉ đánh dấu deleted)
export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
        }

        // Cập nhật status thành deleted
        await pool.query<ResultSetHeader>(
            'UPDATE gmail_accounts SET status = "deleted" WHERE id = ?',
            [id]
        );

        return NextResponse.json({ success: true, message: 'Account marked as deleted' });
    } catch (error) {
        console.error('Error deleting Gmail account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
