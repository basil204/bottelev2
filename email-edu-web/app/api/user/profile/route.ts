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

        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, email, name, role, email_quota, emails_created, created_at FROM users WHERE id = ?',
            [parseInt(userId)]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'User không tồn tại' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            user: rows[0]
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
