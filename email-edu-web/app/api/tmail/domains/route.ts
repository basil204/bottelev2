import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Lấy danh sách tMail domains
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
            'SELECT * FROM tmail_domains ORDER BY id ASC'
        );

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching tmail domains:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Thêm domain mới (Admin only)
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userRole = cookieStore.get('user_role')?.value;

        if (userRole !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Chỉ admin mới có quyền' },
                { status: 403 }
            );
        }

        const { domain } = await request.json();

        if (!domain) {
            return NextResponse.json(
                { success: false, error: 'Domain là bắt buộc' },
                { status: 400 }
            );
        }

        // Kiểm tra domain đã tồn tại
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM tmail_domains WHERE domain = ?',
            [domain]
        );

        if (existing.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Domain đã tồn tại' },
                { status: 400 }
            );
        }

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO tmail_domains (domain) VALUES (?)',
            [domain]
        );

        return NextResponse.json({
            success: true,
            data: {
                id: result.insertId,
                domain
            }
        });
    } catch (error) {
        console.error('Error adding tmail domain:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// PUT - Cập nhật domain (Admin only)
export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const userRole = cookieStore.get('user_role')?.value;

        if (userRole !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Chỉ admin mới có quyền' },
                { status: 403 }
            );
        }

        const { id, is_active } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID là bắt buộc' },
                { status: 400 }
            );
        }

        await pool.query<ResultSetHeader>(
            'UPDATE tmail_domains SET is_active = ? WHERE id = ?',
            [is_active ? 1 : 0, id]
        );

        return NextResponse.json({
            success: true,
            message: 'Đã cập nhật domain'
        });
    } catch (error) {
        console.error('Error updating tmail domain:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// DELETE - Xóa domain (Admin only)
export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const userRole = cookieStore.get('user_role')?.value;

        if (userRole !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Chỉ admin mới có quyền' },
                { status: 403 }
            );
        }

        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID là bắt buộc' },
                { status: 400 }
            );
        }

        await pool.query<ResultSetHeader>(
            'DELETE FROM tmail_domains WHERE id = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            message: 'Đã xóa domain'
        });
    } catch (error) {
        console.error('Error deleting tmail domain:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
