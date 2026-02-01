import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Lấy danh sách domains
export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM edu_domains ORDER BY id DESC'
        );

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching domains:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Thêm domain mới
export async function POST(request: Request) {
    try {
        const { domain } = await request.json();

        if (!domain) {
            return NextResponse.json(
                { success: false, error: 'Domain là bắt buộc' },
                { status: 400 }
            );
        }

        // Check if domain exists
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM edu_domains WHERE domain = ?',
            [domain]
        );

        if (existing.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Domain đã tồn tại' },
                { status: 400 }
            );
        }

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO edu_domains (domain) VALUES (?)',
            [domain]
        );

        return NextResponse.json({
            success: true,
            id: result.insertId
        });
    } catch (error) {
        console.error('Error adding domain:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// PUT - Cập nhật domain
export async function PUT(request: Request) {
    try {
        const { id, is_active } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID là bắt buộc' },
                { status: 400 }
            );
        }

        await pool.query<ResultSetHeader>(
            'UPDATE edu_domains SET is_active = ? WHERE id = ?',
            [is_active, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating domain:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// DELETE - Xóa domain (cascade delete emails)
export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID là bắt buộc' },
                { status: 400 }
            );
        }

        // Count emails using this domain
        const [emailsUsingDomain] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as count FROM edu_emails WHERE domain_id = ?',
            [id]
        );

        const emailCount = emailsUsingDomain[0].count;

        // Delete related emails first (cascade)
        if (emailCount > 0) {
            await pool.query<ResultSetHeader>(
                'DELETE FROM edu_emails WHERE domain_id = ?',
                [id]
            );
        }

        // Then delete the domain
        await pool.query<ResultSetHeader>(
            'DELETE FROM edu_domains WHERE id = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            message: emailCount > 0
                ? `Đã xóa domain và ${emailCount} email liên quan`
                : 'Đã xóa domain'
        });
    } catch (error) {
        console.error('Error deleting domain:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
