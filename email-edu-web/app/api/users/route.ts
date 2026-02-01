import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';

// GET - Lấy danh sách users
export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, username, name, role, email_quota, emails_created, created_at FROM users ORDER BY id DESC'
        );

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Tạo user mới
export async function POST(request: Request) {
    try {
        const { username, password, name, role, email_quota } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, error: 'Username và password là bắt buộc' },
                { status: 400 }
            );
        }

        // Check if username exists
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existing.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Username đã tồn tại' },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO users (username, password, name, role, email_quota) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, name || username, role || 'user', email_quota || 10]
        );

        return NextResponse.json({
            success: true,
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// PUT - Cập nhật quota user
export async function PUT(request: Request) {
    try {
        const { id, email_quota } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID là bắt buộc' },
                { status: 400 }
            );
        }

        await pool.query<ResultSetHeader>(
            'UPDATE users SET email_quota = ? WHERE id = ?',
            [email_quota, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// DELETE - Xóa user
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID là bắt buộc' },
                { status: 400 }
            );
        }

        await pool.query<ResultSetHeader>(
            'DELETE FROM users WHERE id = ?',
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
