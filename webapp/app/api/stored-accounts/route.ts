import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getAdminFromCookie, getRequestInfo } from '@/lib/adminLog';


// GET - List stored accounts with filters
export async function GET(request: Request) {
    try {
        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'STORED_ACCOUNT',
            details: 'Viewed stored accounts list',
            request
        });

        const { searchParams } = new URL(request.url);

        const typeId = searchParams.get('type');
        const paymentStatus = searchParams.get('payment_status');
        const saleStatus = searchParams.get('sale_status');
        const botStatus = searchParams.get('bot_status');

        let query = `
            SELECT sa.*, at.name as type_name, u.username as buyer_username 
            FROM stored_accounts sa
            LEFT JOIN account_types at ON sa.account_type_id = at.id
            LEFT JOIN users u ON sa.sold_to_user_id = u.id
            WHERE 1=1
        `;
        const params: (string | number)[] = [];

        if (typeId) {
            query += ' AND sa.account_type_id = ?';
            params.push(typeId);
        }

        if (paymentStatus) {
            query += ' AND sa.payment_status = ?';
            params.push(paymentStatus);
        }

        if (saleStatus) {
            query += ' AND sa.sale_status = ?';
            params.push(saleStatus);
        }

        if (botStatus) {
            query += ' AND sa.bot_status = ?';
            params.push(botStatus);
        }

        query += ' ORDER BY sa.created_at DESC';

        const [rows] = await pool.query<RowDataPacket[]>(query, params);

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching stored accounts:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Create new stored account(s)
export async function POST(request: Request) {
    try {
        const { account_type_id, data, note, code } = await request.json();
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!account_type_id) {
            return NextResponse.json(
                { success: false, error: 'Vui lòng chọn loại tài khoản' },
                { status: 400 }
            );
        }

        if (!data?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Thông tin tài khoản không được để trống' },
                { status: 400 }
            );
        }

        // Support bulk import: split by newlines
        const accounts = data.split('\n').map((line: string) => line.trim()).filter((line: string) => line);
        let insertCount = 0;
        let skipCount = 0;

        for (const accountData of accounts) {
            // Check if account already exists with same type and data
            const [existing] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM stored_accounts WHERE account_type_id = ? AND data = ?',
                [account_type_id, accountData]
            );

            if (existing.length > 0) {
                // Skip duplicate
                skipCount++;
                continue;
            }

            await pool.query<ResultSetHeader>(
                'INSERT INTO stored_accounts (account_type_id, data, note, code) VALUES (?, ?, ?, ?)',
                [account_type_id, accountData, note || null, code || null]
            );
            insertCount++;
        }

        // Log action
        if (insertCount > 0) {
            await logAdminAction({
                action: 'CREATE',
                targetType: 'STORED_ACCOUNT',
                details: { account_type_id, count: insertCount, skipped: skipCount },
                request
            });
        }

        return NextResponse.json({
            success: true,
            message: `Đã thêm ${insertCount} tài khoản${skipCount > 0 ? `, bỏ qua ${skipCount} tài khoản trùng` : ''}`,
            count: insertCount,
            skipped: skipCount
        });
    } catch (error) {
        console.error('Error creating stored account:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// PUT - Update account status
export async function PUT(request: Request) {
    try {
        const { id, payment_status, sale_status, bot_status, note, code } = await request.json();
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID không hợp lệ' },
                { status: 400 }
            );
        }

        // Build dynamic update query
        const updates: string[] = [];
        const params: (string | number | null)[] = [];
        const changedFields: Record<string, unknown> = {};

        if (payment_status !== undefined) {
            updates.push('payment_status = ?');
            params.push(payment_status);
            changedFields.payment_status = payment_status;

            // Auto-set paid_at when changing to 'paid'
            if (payment_status === 'paid') {
                updates.push('paid_at = NOW()');
            } else if (payment_status === 'pending') {
                updates.push('paid_at = NULL');
            }
        }

        if (sale_status !== undefined) {
            updates.push('sale_status = ?');
            params.push(sale_status);
            changedFields.sale_status = sale_status;

            // Auto-set sold_at when changing to 'sold'
            if (sale_status === 'sold') {
                updates.push('sold_at = NOW()');
            } else if (sale_status === 'in_stock') {
                updates.push('sold_at = NULL');
            }
        }

        if (bot_status !== undefined) {
            updates.push('bot_status = ?');
            params.push(bot_status);
            changedFields.bot_status = bot_status;
        }

        if (note !== undefined) {
            updates.push('note = ?');
            params.push(note);
            changedFields.note = note;
        }

        if (code !== undefined) {
            updates.push('code = ?');
            params.push(code);
            changedFields.code = code;
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Không có dữ liệu cập nhật' },
                { status: 400 }
            );
        }

        params.push(id);
        await pool.query(
            `UPDATE stored_accounts SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        // Log action
        await logAdminAction({
            action: 'UPDATE',
            targetType: 'STORED_ACCOUNT',
            targetId: id,
            details: changedFields,
            request
        });

        return NextResponse.json({
            success: true,
            message: 'Đã cập nhật tài khoản'
        });
    } catch (error) {
        console.error('Error updating stored account:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// DELETE - Delete stored account(s)
export async function DELETE(request: Request) {
    try {
        const { id, ids, reason } = await request.json();
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!reason || reason.trim().length === 0) {
            return NextResponse.json({ success: false, error: 'Lý do xóa là bắt buộc' }, { status: 400 });
        }


        if (ids && Array.isArray(ids) && ids.length > 0) {
            // Bulk delete
            await pool.query(
                'DELETE FROM stored_accounts WHERE id IN (?)',
                [ids]
            );

            // Log action
            await logAdminAction({
                action: 'DELETE',
                targetType: 'STORED_ACCOUNT',
                details: { count: ids.length, ids, reason },
                request
            });


            return NextResponse.json({
                success: true,
                message: `Đã xóa ${ids.length} tài khoản`
            });
        } else if (id) {
            // Single delete
            await pool.query('DELETE FROM stored_accounts WHERE id = ?', [id]);

            // Log action
            await logAdminAction({
                action: 'DELETE',
                targetType: 'STORED_ACCOUNT',
                targetId: id,
                details: { reason },
                request
            });


            return NextResponse.json({
                success: true,
                message: 'Đã xóa tài khoản'
            });
        }

        return NextResponse.json(
            { success: false, error: 'ID không hợp lệ' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Error deleting stored account:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
