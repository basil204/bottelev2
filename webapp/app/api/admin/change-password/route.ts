import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Vui lòng điền đầy đủ thông tin!' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự!' }, { status: 400 });
        }

        // Get current password from DB
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT `value` FROM settings WHERE `key` = 'admin_password'"
        );

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: 'Không tìm thấy cấu hình mật khẩu!' }, { status: 500 });
        }

        const dbPassword = rows[0].value;

        // Verify current password
        if (currentPassword !== dbPassword) {
            return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng!' }, { status: 401 });
        }

        // Update password
        await pool.query(
            "UPDATE settings SET `value` = ? WHERE `key` = 'admin_password'",
            [newPassword]
        );

        return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công!' });

    } catch (error) {
        console.error('Change Password Error:', error);
        return NextResponse.json({ error: 'Lỗi server!' }, { status: 500 });
    }
}
