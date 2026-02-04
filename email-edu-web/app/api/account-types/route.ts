import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - List all account types
export async function GET() {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const userRole = cookieStore.get('user_role')?.value;

        if (!userId || userRole !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM account_types ORDER BY name ASC'
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching account types:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Create new account type
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const userRole = cookieStore.get('user_role')?.value;

        if (!userId || userRole !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { name } = await request.json();

        if (!name?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Tên loại tài khoản không được để trống' },
                { status: 400 }
            );
        }

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO account_types (name) VALUES (?)',
            [name.trim()]
        );

        return NextResponse.json({
            success: true,
            message: 'Đã thêm loại tài khoản',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating account type:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// DELETE - Delete account type
export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const userRole = cookieStore.get('user_role')?.value;

        if (!userId || userRole !== 'admin') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID không hợp lệ' },
                { status: 400 }
            );
        }

        await pool.query('DELETE FROM account_types WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'Đã xóa loại tài khoản'
        });
    } catch (error) {
        console.error('Error deleting account type:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
