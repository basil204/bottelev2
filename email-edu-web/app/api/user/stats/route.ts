import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get total emails count
        const [totalResult] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM edu_emails WHERE user_id = ?',
            [parseInt(userId)]
        );

        // Get active emails count
        const [activeResult] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM edu_emails WHERE user_id = ? AND status = "active"',
            [parseInt(userId)]
        );

        // Get today's permanent emails count (only delete_at IS NULL means permanent)
        const [todayResult] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as count FROM edu_emails 
             WHERE user_id = ? 
             AND delete_at IS NULL
             AND DATE(created_at) = CURDATE()`,
            [parseInt(userId)]
        );

        // Get 2FA items count
        const [twoFaResult] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM twofa_items WHERE user_id = ?',
            [parseInt(userId)]
        );

        return NextResponse.json({
            success: true,
            stats: {
                totalEmails: totalResult[0]?.count || 0,
                activeEmails: activeResult[0]?.count || 0,
                todayCreated: todayResult[0]?.count || 0,
                twoFaCount: twoFaResult[0]?.count || 0
            }
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
