import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';

// Helper to parse a single line of account data
export function parseAccountLine(
    line: string,
    defaultIsPlus: boolean = false
): { email: string; password: string; twofa_secret: string; is_plus: number; note: string } | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    let parts: string[] = [];

    if (trimmed.includes('\t')) {
        parts = trimmed.split('\t').map(p => p.trim());
    } else if (trimmed.includes('|')) {
        parts = trimmed.split('|').map(p => p.trim());
    } else if (trimmed.includes(':') && !trimmed.startsWith('http')) {
        parts = trimmed.split(':').map(p => p.trim());
    } else {
        parts = [trimmed];
    }

    if (parts.length < 2) {
        // Only 1 part, cannot determine password
        return null;
    }

    const email = parts[0];
    const password = parts[1];
    let twofa_secret = '';
    let is_plus = defaultIsPlus ? 1 : 0;
    let note = '';

    if (parts.length === 3) {
        // email|password|2fa OR email|password|plus
        const third = parts[2].toLowerCase();
        if (third === 'plus' || third === '1' || third === 'true') {
            is_plus = 1;
        } else if (third === 'free' || third === '0' || third === 'false') {
            is_plus = 0;
        } else {
            twofa_secret = parts[2];
        }
    } else if (parts.length === 4) {
        // email|password|2fa|plus OR email|password|mail_kp|2fa
        const fourth = parts[3].toLowerCase();
        if (fourth === 'plus' || fourth === '1' || fourth === 'true') {
            twofa_secret = parts[2];
            is_plus = 1;
        } else if (fourth === 'free' || fourth === '0' || fourth === 'false') {
            twofa_secret = parts[2];
            is_plus = 0;
        } else {
            // maybe mail_kp at 2, 2fa at 3
            note = parts[2];
            twofa_secret = parts[3];
        }
    } else if (parts.length >= 5) {
        // email|password|mail_kp|2fa|plus
        note = parts[2];
        twofa_secret = parts[3];
        const fifth = parts[4].toLowerCase();
        if (fifth === 'plus' || fifth === '1' || fifth === 'true') {
            is_plus = 1;
        } else if (fifth === 'free' || fifth === '0' || fifth === 'false') {
            is_plus = 0;
        }
    }

    // Clean up 2FA secret (remove spaces)
    if (twofa_secret) {
        twofa_secret = twofa_secret.replace(/\s+/g, '').toUpperCase();
    }

    return {
        email,
        password,
        twofa_secret,
        is_plus,
        note
    };
}

/**
 * GET /api/chatgpt-accounts
 * Lấy danh sách tài khoản ChatGPT với bộ lọc và thống kê
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const search = searchParams.get('search')?.trim() || '';
        const isPlusParam = searchParams.get('is_plus'); // 'all' | '1' | '0'
        const status = searchParams.get('status') || 'all'; // 'all' | 'live' | 'die' | 'wrong_pass' | 'twofa_error' | 'uncheck'
        const saleStatus = searchParams.get('sale_status') || 'all'; // 'all' | 'in_stock' | 'sold' | 'used' | 'reserved'
        const sortBy = searchParams.get('sort_by') || 'created_at';
        const sortOrder = searchParams.get('sort_order')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '25') : 25;
        const offset = (page - 1) * limit;

        // Build WHERE clause
        let whereSql = 'WHERE 1=1';
        const params: any[] = [];

        if (search) {
            whereSql += ' AND (email LIKE ? OR note LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (isPlusParam !== null && isPlusParam !== undefined && isPlusParam !== 'all') {
            whereSql += ' AND is_plus = ?';
            params.push(isPlusParam === '1' ? 1 : 0);
        }

        if (status !== 'all') {
            whereSql += ' AND status = ?';
            params.push(status);
        }

        if (saleStatus !== 'all') {
            whereSql += ' AND sale_status = ?';
            params.push(saleStatus);
        }

        // Validate sort column
        const allowedSortCols: Record<string, string> = {
            id: 'id',
            email: 'email',
            is_plus: 'is_plus',
            status: 'status',
            sale_status: 'sale_status',
            last_checked_at: 'last_checked_at',
            plus_updated_at: 'plus_updated_at',
            created_at: 'created_at'
        };
        const sortCol = allowedSortCols[sortBy] || 'created_at';

        // Count total matching
        const [countRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM chatgpt_accounts ${whereSql}`,
            params
        );
        const total = countRows[0]?.total || 0;

        // Fetch paginated data
        let querySql = `
            SELECT id, email, password, twofa_secret, is_plus, plan_type, status, sale_status, note, last_checked_at, plus_updated_at, created_at, updated_at
            FROM chatgpt_accounts
            ${whereSql}
            ORDER BY ${sortCol} ${sortOrder}
        `;

        if (limit > 0) {
            querySql += ` LIMIT ? OFFSET ?`;
            params.push(limit, offset);
        }

        const [rows] = await pool.query<RowDataPacket[]>(querySql, params);

        // Calculate aggregate statistics
        const [statsRows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_plus = 1 THEN 1 ELSE 0 END) as plus_count,
                SUM(CASE WHEN is_plus = 0 THEN 1 ELSE 0 END) as free_count,
                SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) as live_count,
                SUM(CASE WHEN status = 'die' THEN 1 ELSE 0 END) as die_count,
                SUM(CASE WHEN status = 'uncheck' THEN 1 ELSE 0 END) as uncheck_count,
                SUM(CASE WHEN status IN ('wrong_pass', 'twofa_error') THEN 1 ELSE 0 END) as error_count,
                SUM(CASE WHEN sale_status = 'in_stock' THEN 1 ELSE 0 END) as in_stock_count,
                SUM(CASE WHEN sale_status = 'sold' THEN 1 ELSE 0 END) as sold_count
            FROM chatgpt_accounts
        `);

        const stats = statsRows[0] || {
            total: 0,
            plus_count: 0,
            free_count: 0,
            live_count: 0,
            die_count: 0,
            uncheck_count: 0,
            error_count: 0,
            in_stock_count: 0,
            sold_count: 0
        };

        return NextResponse.json({
            success: true,
            data: rows,
            pagination: {
                page,
                limit: limit > 0 ? limit : total,
                total,
                totalPages: limit > 0 ? Math.ceil(total / limit) : 1
            },
            stats: {
                total: Number(stats.total) || 0,
                plus_count: Number(stats.plus_count) || 0,
                free_count: Number(stats.free_count) || 0,
                live_count: Number(stats.live_count) || 0,
                die_count: Number(stats.die_count) || 0,
                uncheck_count: Number(stats.uncheck_count) || 0,
                error_count: Number(stats.error_count) || 0,
                in_stock_count: Number(stats.in_stock_count) || 0,
                sold_count: Number(stats.sold_count) || 0
            }
        });
    } catch (error: any) {
        console.error('[ChatGPT Accounts API] GET error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
    }
}

/**
 * POST /api/chatgpt-accounts
 * Thêm tài khoản đơn lẻ hoặc nhập SLL
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            raw_text,
            accounts: accountsList,
            email,
            password,
            twofa_secret,
            is_plus = 0,
            default_is_plus = false,
            skip_duplicates = true,
            note = '',
            sale_status = 'in_stock'
        } = body;

        let accountsToInsert: Array<{
            email: string;
            password: string;
            twofa_secret: string;
            is_plus: number;
            note: string;
            sale_status?: string;
        }> = [];

        if (raw_text && typeof raw_text === 'string') {
            // Bulk text import
            const lines = raw_text.split(/\r?\n/);
            for (const line of lines) {
                const parsed = parseAccountLine(line, Boolean(default_is_plus));
                if (parsed) {
                    accountsToInsert.push({
                        ...parsed,
                        note: parsed.note || note || '',
                        sale_status
                    });
                }
            }
        } else if (Array.isArray(accountsList) && accountsList.length > 0) {
            // Array of account objects
            accountsToInsert = accountsList.map(acc => ({
                email: acc.email?.trim(),
                password: acc.password?.trim(),
                twofa_secret: acc.twofa_secret?.trim() || '',
                is_plus: acc.is_plus ? 1 : 0,
                note: acc.note || note || '',
                sale_status: acc.sale_status || sale_status
            })).filter(acc => acc.email && acc.password);
        } else if (email && password) {
            // Single account import
            accountsToInsert.push({
                email: email.trim(),
                password: password.trim(),
                twofa_secret: twofa_secret?.trim() || '',
                is_plus: is_plus ? 1 : 0,
                note: note || '',
                sale_status
            });
        }

        if (accountsToInsert.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Không tìm thấy tài khoản hợp lệ để thêm' },
                { status: 400 }
            );
        }

        let insertedCount = 0;
        let skippedCount = 0;
        let updatedCount = 0;

        for (const acc of accountsToInsert) {
            // Check if email already exists
            const [existing] = await pool.query<RowDataPacket[]>(
                'SELECT id FROM chatgpt_accounts WHERE email = ?',
                [acc.email]
            );

            if (existing.length > 0) {
                if (skip_duplicates) {
                    skippedCount++;
                    continue;
                } else {
                    // Update existing
                    await pool.query(
                        `UPDATE chatgpt_accounts 
                         SET password = ?, twofa_secret = ?, is_plus = ?, plan_type = ?, note = COALESCE(NULLIF(?, ''), note), plus_updated_at = CASE WHEN ? = 1 THEN NOW() ELSE plus_updated_at END
                         WHERE id = ?`,
                        [
                            acc.password,
                            acc.twofa_secret || null,
                            acc.is_plus,
                            acc.is_plus ? 'plus' : 'free',
                            acc.note || null,
                            acc.is_plus,
                            existing[0].id
                        ]
                    );
                    updatedCount++;
                    continue;
                }
            }

            // Insert new account
            await pool.query<ResultSetHeader>(
                `INSERT INTO chatgpt_accounts (email, password, twofa_secret, is_plus, plan_type, status, sale_status, note, plus_updated_at)
                 VALUES (?, ?, ?, ?, ?, 'uncheck', ?, ?, ?)`,
                [
                    acc.email,
                    acc.password,
                    acc.twofa_secret || null,
                    acc.is_plus,
                    acc.is_plus ? 'plus' : 'free',
                    acc.sale_status || 'in_stock',
                    acc.note || null,
                    acc.is_plus ? new Date() : null
                ]
            );
            insertedCount++;
        }

        // Admin log
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'CHATGPT_ACCOUNT',
            details: {
                inserted: insertedCount,
                skipped: skippedCount,
                updated: updatedCount,
                total_submitted: accountsToInsert.length
            },
            request
        });

        return NextResponse.json({
            success: true,
            message: `Đã thêm thành công ${insertedCount} tài khoản${skippedCount > 0 ? `, bỏ qua ${skippedCount} trùng lặp` : ''}${updatedCount > 0 ? `, cập nhật ${updatedCount}` : ''}`,
            inserted_count: insertedCount,
            skipped_count: skippedCount,
            updated_count: updatedCount,
            total_submitted: accountsToInsert.length
        });
    } catch (error: any) {
        console.error('[ChatGPT Accounts API] POST error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
    }
}

/**
 * PUT /api/chatgpt-accounts
 * Cập nhật tài khoản (Đơn lẻ hoặc hàng loạt: toggle is_plus, đổi status, đổi kho, sửa thông tin)
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id,
            ids,
            is_plus,
            status,
            sale_status,
            email,
            password,
            twofa_secret,
            note
        } = body;

        const targetIds: number[] = ids && Array.isArray(ids) && ids.length > 0
            ? ids.map(Number)
            : (id ? [Number(id)] : []);

        if (targetIds.length === 0) {
            return NextResponse.json({ success: false, error: 'Vui lòng cung cấp ID tài khoản' }, { status: 400 });
        }

        const updates: string[] = [];
        const params: any[] = [];

        if (is_plus !== undefined) {
            const plusVal = is_plus ? 1 : 0;
            updates.push('is_plus = ?');
            params.push(plusVal);

            updates.push('plan_type = ?');
            params.push(plusVal ? 'plus' : 'free');

            if (plusVal === 1) {
                updates.push('plus_updated_at = NOW()');
            }
        }

        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);

            if (status === 'live' || status === 'die' || status === 'wrong_pass' || status === 'twofa_error') {
                updates.push('last_checked_at = NOW()');
            }
        }

        if (sale_status !== undefined) {
            updates.push('sale_status = ?');
            params.push(sale_status);
        }

        if (email !== undefined) {
            updates.push('email = ?');
            params.push(email.trim());
        }

        if (password !== undefined) {
            updates.push('password = ?');
            params.push(password.trim());
        }

        if (twofa_secret !== undefined) {
            updates.push('twofa_secret = ?');
            params.push(twofa_secret?.trim() ? twofa_secret.trim().replace(/\s+/g, '').toUpperCase() : null);
        }

        if (note !== undefined) {
            updates.push('note = ?');
            params.push(note);
        }

        if (updates.length === 0) {
            return NextResponse.json({ success: false, error: 'Không có dữ liệu thay đổi' }, { status: 400 });
        }

        const placeholders = targetIds.map(() => '?').join(',');
        params.push(...targetIds);

        await pool.query(
            `UPDATE chatgpt_accounts SET ${updates.join(', ')} WHERE id IN (${placeholders})`,
            params
        );

        // Admin log
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'CHATGPT_ACCOUNT',
            details: { count: targetIds.length, ids: targetIds, fields: Object.keys(body) },
            request
        });

        return NextResponse.json({
            success: true,
            message: `Đã cập nhật ${targetIds.length} tài khoản thành công`
        });
    } catch (error: any) {
        console.error('[ChatGPT Accounts API] PUT error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
    }
}

/**
 * DELETE /api/chatgpt-accounts
 * Xóa tài khoản (Đơn lẻ, danh sách đã chọn, hoặc xóa tất cả tài khoản die)
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ids, delete_all_die, reason } = body;

        let deletedCount = 0;

        if (delete_all_die) {
            const [result] = await pool.query<ResultSetHeader>(
                "DELETE FROM chatgpt_accounts WHERE status = 'die'"
            );
            deletedCount = result.affectedRows;
        } else if (ids && Array.isArray(ids) && ids.length > 0) {
            const targetIds = ids.map(Number);
            const placeholders = targetIds.map(() => '?').join(',');
            const [result] = await pool.query<ResultSetHeader>(
                `DELETE FROM chatgpt_accounts WHERE id IN (${placeholders})`,
                targetIds
            );
            deletedCount = result.affectedRows;
        } else if (id) {
            const [result] = await pool.query<ResultSetHeader>(
                'DELETE FROM chatgpt_accounts WHERE id = ?',
                [Number(id)]
            );
            deletedCount = result.affectedRows;
        } else {
            return NextResponse.json({ success: false, error: 'Không tìm thấy ID tài khoản để xóa' }, { status: 400 });
        }

        // Admin log
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'DELETE',
            targetType: 'CHATGPT_ACCOUNT',
            details: { count: deletedCount, reason: reason || 'Admin deleted' },
            request
        });

        return NextResponse.json({
            success: true,
            message: `Đã xóa thành công ${deletedCount} tài khoản`,
            deleted_count: deletedCount
        });
    } catch (error: any) {
        console.error('[ChatGPT Accounts API] DELETE error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
    }
}
