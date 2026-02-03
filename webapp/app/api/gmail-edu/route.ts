import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { deleteAccount, deleteMultipleAccounts } from '@/lib/googleAdminService';

/**
 * API Route cho quản lý Gmail EDU
 * GET - Lấy danh sách Gmail EDU
 * POST - Tạo Gmail EDU mới (sẽ được implement sau khi có Google Admin API từ backend)
 * DELETE - Xóa Gmail EDU (xóa trên Google + đánh dấu deleted trong database)
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

// DELETE - Xóa Gmail EDU (xóa trên Google + xóa hoàn toàn khỏi database)
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { id, ids } = body;

        // Hỗ trợ xóa nhiều accounts cùng lúc
        if (ids && Array.isArray(ids) && ids.length > 0) {
            // Lấy thông tin các accounts cần xóa
            const placeholders = ids.map(() => '?').join(',');
            const [accounts] = await pool.query<RowDataPacket[]>(
                `SELECT id, email FROM gmail_accounts WHERE id IN (${placeholders})`,
                ids
            );

            if (accounts.length === 0) {
                return NextResponse.json({ error: 'No accounts found' }, { status: 404 });
            }

            const emails = accounts.map(acc => acc.email);
            const accountMap = new Map(accounts.map(acc => [acc.email, acc.id]));

            // Xóa trên Google Admin
            const deleteResult = await deleteMultipleAccounts(emails);

            // Cập nhật status trong database cho các accounts đã xóa thành công
            const deletedIds: number[] = [];
            for (const email of deleteResult.deleted) {
                const accId = accountMap.get(email);
                if (accId) deletedIds.push(accId);
            }

            // Cũng cập nhật cho các accounts không tồn tại trên Google (notFound)
            for (const failedAcc of deleteResult.failed) {
                if (failedAcc.error.includes('Resource Not Found') || failedAcc.error.includes('notFound')) {
                    const accId = accountMap.get(failedAcc.email);
                    if (accId) deletedIds.push(accId);
                }
            }

            if (deletedIds.length > 0) {
                const deletePlaceholders = deletedIds.map(() => '?').join(',');
                await pool.query<ResultSetHeader>(
                    `DELETE FROM gmail_accounts WHERE id IN (${deletePlaceholders})`,
                    deletedIds
                );
            }

            return NextResponse.json({
                success: true,
                message: `Deleted ${deletedIds.length}/${ids.length} accounts`,
                deleted: deletedIds.length,
                failed: deleteResult.failed.filter(f => !f.error.includes('Resource Not Found') && !f.error.includes('notFound'))
            });
        }

        // Xóa 1 account
        if (!id) {
            return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
        }

        // Lấy thông tin account
        const [accounts] = await pool.query<RowDataPacket[]>(
            'SELECT id, email FROM gmail_accounts WHERE id = ?',
            [id]
        );

        if (accounts.length === 0) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const account = accounts[0];

        // Xóa trên Google Admin
        const deleteResult = await deleteAccount(account.email);

        if (!deleteResult.success) {
            // Nếu account không tồn tại trên Google, vẫn đánh dấu deleted trong DB
            if (deleteResult.error?.includes('Resource Not Found') || deleteResult.error?.includes('notFound')) {
                await pool.query<ResultSetHeader>(
                    'DELETE FROM gmail_accounts WHERE id = ?',
                    [id]
                );
                return NextResponse.json({
                    success: true,
                    message: 'Account not found on Google, deleted from database'
                });
            }
            return NextResponse.json({ error: deleteResult.error }, { status: 500 });
        }

        // Xóa hoàn toàn khỏi database
        await pool.query<ResultSetHeader>(
            'DELETE FROM gmail_accounts WHERE id = ?',
            [id]
        );

        return NextResponse.json({ success: true, message: 'Account deleted from Google and database' });
    } catch (error) {
        console.error('Error deleting Gmail account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
