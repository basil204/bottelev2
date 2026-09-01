import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';


// GET - List all account types with counts
export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT at.*, 
                   COUNT(sa.id) AS account_count,
                   SUM(CASE WHEN sa.sale_status = 'in_stock' THEN 1 ELSE 0 END) AS in_stock_count,
                   SUM(CASE WHEN sa.sale_status = 'sold' THEN 1 ELSE 0 END) AS sold_count
            FROM account_types at
            LEFT JOIN stored_accounts sa ON sa.account_type_id = at.id
            GROUP BY at.id
            ORDER BY at.name ASC
        `);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching account types:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// PUT - Rename or Reassign account type
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, action, target_type_id } = body;

        // Chuyển toàn bộ tài khoản từ loại id sang target_type_id
        if (action === 'reassign') {
            if (!id || !target_type_id) {
                return NextResponse.json({ success: false, error: 'Thiếu ID loại nguồn hoặc loại đích' }, { status: 400 });
            }
            await pool.query('UPDATE stored_accounts SET account_type_id = ? WHERE account_type_id = ?', [target_type_id, id]);
            return NextResponse.json({ success: true, message: 'Đã chuyển toàn bộ tài khoản sang loại mới thành công!' });
        }

        if (!id || !name?.trim()) {
            return NextResponse.json(
                { success: false, error: 'ID và tên loại tài khoản là bắt buộc' },
                { status: 400 }
            );
        }

        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE account_types SET name = ? WHERE id = ?',
            [name.trim(), id]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, error: 'Không tìm thấy loại tài khoản' },
                { status: 404 }
            );
        }

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'ACCOUNT_TYPE',
            targetId: id,
            details: { name: name.trim() },
            request
        });

        return NextResponse.json({ success: true, message: 'Đã cập nhật loại tài khoản' });
    } catch (error) {
        console.error('Error updating account type:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Create new account type or seed presets
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, seed } = body;

        if (seed) {
            const presets = [
                '🤖 ChatGPT Plus / Team',
                '🎬 CapCut Pro Workspace',
                '📧 Gmail EDU (Office 365)',
                '🎨 Canva Pro VIP',
                '🍿 Netflix 4K Ultra HD',
                '🎵 Spotify Premium',
                '✈️ Telegram Premium',
                '🔑 Key Active / License Code'
            ];

            let addedCount = 0;
            for (const item of presets) {
                const [existing] = await pool.query<RowDataPacket[]>(
                    'SELECT id FROM account_types WHERE LOWER(name) = LOWER(?)',
                    [item]
                );
                if (existing.length === 0) {
                    await pool.query('INSERT INTO account_types (name) VALUES (?)', [item]);
                    addedCount++;
                }
            }

            return NextResponse.json({
                success: true,
                message: `Đã khởi tạo ${addedCount} loại tài khoản mẫu!`
            });
        }

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
        const { id, reason } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID không hợp lệ' },
                { status: 400 }
            );
        }

        if (!reason || reason.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: 'Lý do xóa là bắt buộc' },
                { status: 400 }
            );
        }

        const [usageRows] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) AS account_count FROM stored_accounts WHERE account_type_id = ?',
            [id]
        );

        if (Number(usageRows[0]?.account_count || 0) > 0) {
            return NextResponse.json(
                { success: false, error: 'Không thể xóa loại đang chứa tài khoản. Hãy chuyển hoặc xóa các tài khoản trước.' },
                { status: 409 }
            );
        }

        const [result] = await pool.query<ResultSetHeader>('DELETE FROM account_types WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, error: 'Không tìm thấy loại tài khoản' },
                { status: 404 }
            );
        }

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'DELETE',
            targetType: 'ACCOUNT_TYPE',
            targetId: id,
            details: { reason },
            request
        });


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
