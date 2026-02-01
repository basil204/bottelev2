import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
    try {
        // Get total users
        const [usersResult] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM users WHERE role = "user"'
        );
        const totalUsers = usersResult[0]?.count || 0;

        // Get total emails
        const [emailsResult] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM edu_emails'
        );
        const totalEmails = emailsResult[0]?.count || 0;

        // Get active emails
        const [activeEmailsResult] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM edu_emails WHERE status = "active"'
        );
        const activeEmails = activeEmailsResult[0]?.count || 0;

        // Get total domains
        const [domainsResult] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM edu_domains WHERE is_active = 1'
        );
        const totalDomains = domainsResult[0]?.count || 0;

        return NextResponse.json({
            success: true,
            stats: {
                totalUsers,
                totalEmails,
                totalDomains,
                activeEmails
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
