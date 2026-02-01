import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

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
            'SELECT id, username, name, role, email_quota, emails_created, created_at FROM users WHERE id = ?',
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

// PUT - Change password
export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { currentPassword, newPassword, name } = await request.json();

        // Get current user
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, password FROM users WHERE id = ?',
            [parseInt(userId)]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'User không tồn tại' },
                { status: 400 }
            );
        }

        const user = rows[0];

        // If changing password
        if (currentPassword && newPassword) {
            // Verify current password
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return NextResponse.json(
                    { success: false, error: 'Mật khẩu hiện tại không đúng' },
                    { status: 400 }
                );
            }

            // Validate new password
            if (newPassword.length < 6) {
                return NextResponse.json(
                    { success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
                    { status: 400 }
                );
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            await pool.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, parseInt(userId)]
            );

            return NextResponse.json({
                success: true,
                message: 'Đổi mật khẩu thành công'
            });
        }

        // If updating name
        if (name !== undefined) {
            await pool.query(
                'UPDATE users SET name = ? WHERE id = ?',
                [name, parseInt(userId)]
            );

            return NextResponse.json({
                success: true,
                message: 'Cập nhật thông tin thành công'
            });
        }

        return NextResponse.json(
            { success: false, error: 'Không có dữ liệu cập nhật' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
