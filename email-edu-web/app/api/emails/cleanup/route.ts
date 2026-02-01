import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { deleteGoogleUser, checkUserLoginStatus } from '@/lib/google-admin';

// GET - Lấy thông tin emails đã xóa sẽ bị cleanup
export async function GET() {
    try {
        const cookieStore = await cookies();
        const userRole = cookieStore.get('user_role')?.value;

        // Get cleanup days setting
        const [settingsRows] = await pool.query<RowDataPacket[]>(
            "SELECT `value` FROM settings WHERE `key` = 'auto_cleanup_days'"
        );
        const cleanupDays = parseInt(settingsRows[0]?.value || '3');

        // Get emails that will be cleaned up
        const [emails] = await pool.query<RowDataPacket[]>(
            `SELECT id, email, deleted_at, 
             TIMESTAMPDIFF(HOUR, deleted_at, NOW()) as hours_since_deleted,
             TIMESTAMPDIFF(HOUR, NOW(), DATE_ADD(deleted_at, INTERVAL ? DAY)) as hours_remaining
             FROM edu_emails 
             WHERE status = 'deleted' AND deleted_at IS NOT NULL
             ORDER BY deleted_at ASC`,
            [cleanupDays]
        );

        // Count emails that are ready for cleanup (older than X days)
        const readyForCleanup = emails.filter((e: any) => e.hours_remaining <= 0);

        return NextResponse.json({
            success: true,
            cleanup_days: cleanupDays,
            total_deleted: emails.length,
            ready_for_cleanup: readyForCleanup.length,
            emails: userRole === 'admin' ? emails : undefined
        });
    } catch (error) {
        console.error('Error fetching cleanup info:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Thực hiện cleanup (xóa vĩnh viễn emails đã xóa quá X ngày + đã login)
export async function POST() {
    try {
        const cookieStore = await cookies();
        const userRole = cookieStore.get('user_role')?.value;

        // Chỉ admin mới được cleanup
        if (userRole !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get cleanup days setting
        const [settingsRows] = await pool.query<RowDataPacket[]>(
            "SELECT `value` FROM settings WHERE `key` = 'auto_cleanup_days'"
        );
        const cleanupDays = parseInt(settingsRows[0]?.value || '3');

        // Get emails older than X days with status deleted
        const [emailsToCheck] = await pool.query<RowDataPacket[]>(
            `SELECT id, email FROM edu_emails 
             WHERE status = 'deleted' 
             AND deleted_at IS NOT NULL 
             AND deleted_at <= DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [cleanupDays]
        );

        const results = {
            total: emailsToCheck.length,
            deleted: 0,
            skipped: 0,
            failed: 0,
            skippedEmails: [] as string[],
            errors: [] as string[]
        };

        // Check each email for login status before deleting
        for (const emailRow of emailsToCheck) {
            try {
                // Kiểm tra xem user đã login chưa
                const loginStatus = await checkUserLoginStatus(emailRow.email);

                if (!loginStatus.hasLoggedIn) {
                    // Chưa login -> skip, không xóa
                    results.skipped++;
                    results.skippedEmails.push(`${emailRow.email} (chưa login)`);
                    continue;
                }

                // Đã login -> xóa email
                // Try to delete from Google
                await deleteGoogleUser(emailRow.email);

                // Delete from database permanently
                await pool.query<ResultSetHeader>(
                    'DELETE FROM edu_emails WHERE id = ?',
                    [emailRow.id]
                );

                results.deleted++;
            } catch (error: any) {
                results.failed++;
                results.errors.push(`${emailRow.email}: ${error.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Đã xóa ${results.deleted}/${results.total} emails (${results.skipped} chưa login, ${results.failed} lỗi)`,
            ...results
        });
    } catch (error) {
        console.error('Error during cleanup:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
