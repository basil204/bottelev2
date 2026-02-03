import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listAllGoogleUsers, deleteAllGoogleUsers } from '@/lib/google-admin';
import pool from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

// GET - Lấy danh sách tất cả users từ Google Workspace
export async function GET() {
    try {
        const cookieStore = await cookies();
        const userRole = cookieStore.get('user_role')?.value;

        // Chỉ admin mới được xem
        if (userRole !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const result = await listAllGoogleUsers();

        return NextResponse.json({
            success: result.success,
            total: result.users?.length || 0,
            users: result.users,
            error: result.error
        });
    } catch (error) {
        console.error('Error listing Google users:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// DELETE - Xóa tất cả users từ Google Workspace
export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const userRole = cookieStore.get('user_role')?.value;

        // Chỉ admin mới được xóa
        if (userRole !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const { domain, confirmDelete } = body;

        // Yêu cầu xác nhận
        if (confirmDelete !== 'DELETE_ALL') {
            return NextResponse.json(
                { success: false, error: 'Confirmation required. Send confirmDelete: "DELETE_ALL"' },
                { status: 400 }
            );
        }

        console.log('[ADMIN] Starting delete all Google users...');

        // Xóa trên Google Workspace
        const result = await deleteAllGoogleUsers(domain);

        // Xóa trong database
        if (result.deleted > 0) {
            await pool.query<ResultSetHeader>(
                'DELETE FROM edu_emails WHERE 1=1'
            );
            console.log('[ADMIN] Cleared all emails from database');
        }

        return NextResponse.json({
            success: result.success,
            message: `Đã xóa ${result.deleted} accounts từ Google Workspace`,
            deleted: result.deleted,
            failed: result.failed,
            error: result.error
        });
    } catch (error) {
        console.error('Error deleting all Google users:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
