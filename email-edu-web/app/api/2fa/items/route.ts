import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';

// GET - Lấy danh sách 2FA items của user
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
            'SELECT * FROM twofa_items WHERE user_id = ? ORDER BY created_at DESC',
            [parseInt(userId)]
        );

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching 2FA items:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Thêm 2FA item mới
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { name, secret } = await request.json();

        if (!name || !secret) {
            return NextResponse.json(
                { success: false, error: 'Tên và secret là bắt buộc' },
                { status: 400 }
            );
        }

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO twofa_items (user_id, name, secret) VALUES (?, ?, ?)',
            [parseInt(userId), name, secret]
        );

        return NextResponse.json({
            success: true,
            data: {
                id: result.insertId,
                name,
                secret
            }
        });
    } catch (error) {
        console.error('Error creating 2FA item:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// DELETE - Xóa 2FA item
export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID là bắt buộc' },
                { status: 400 }
            );
        }

        // Chỉ xóa item của user hiện tại
        await pool.query<ResultSetHeader>(
            'DELETE FROM twofa_items WHERE id = ? AND user_id = ?',
            [id, parseInt(userId)]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting 2FA item:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
