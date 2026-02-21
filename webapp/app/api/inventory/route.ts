import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getAdminFromCookie, getRequestInfo } from '@/lib/adminLog';


export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        if (!productId) {
            return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
        }

        // Get total count
        const [countResult] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as total FROM accounts WHERE product_id = ?',
            [productId]
        );
        const total = countResult[0]?.total || 0;
        const totalPages = Math.ceil(total / limit);

        // Get paginated accounts
        const [accounts] = await pool.query<RowDataPacket[]>(
            'SELECT id, username, password, status FROM accounts WHERE product_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
            [productId, limit, offset]
        );

        return NextResponse.json({
            accounts,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');
        const accountIds = searchParams.get('accountIds'); // comma-separated IDs for bulk delete
        const productId = searchParams.get('productId');
        const status = searchParams.get('status'); // 'available' | 'sold' | 'all'
        const reason = searchParams.get('reason');

        if (!reason || reason.trim().length === 0) {
            return NextResponse.json({ error: 'Lý do xóa là bắt buộc' }, { status: 400 });
        }

        const { ipAddress, userAgent } = getRequestInfo(request);


        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            let deletedCount = 0;
            let targetProductId = productId;

            // Xóa nhiều tài khoản theo IDs (checkbox selection)
            if (accountIds) {
                const ids = accountIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                if (ids.length > 0) {
                    // Lấy product_id từ account đầu tiên
                    const [accountRows] = await connection.query<RowDataPacket[]>(
                        'SELECT product_id FROM accounts WHERE id = ?',
                        [ids[0]]
                    );
                    if (accountRows.length > 0) {
                        targetProductId = accountRows[0].product_id;
                        const placeholders = ids.map(() => '?').join(',');
                        const [result] = await connection.query<any>(
                            `DELETE FROM accounts WHERE id IN (${placeholders})`,
                            ids
                        );
                        deletedCount = result.affectedRows;
                    }
                }
            }
            // Xóa từng tài khoản
            else if (accountId) {
                // Lấy product_id trước khi xóa
                const [accountRows] = await connection.query<RowDataPacket[]>(
                    'SELECT product_id FROM accounts WHERE id = ?',
                    [accountId]
                );
                if (accountRows.length > 0) {
                    targetProductId = accountRows[0].product_id;
                    await connection.query('DELETE FROM accounts WHERE id = ?', [accountId]);
                    deletedCount = 1;
                }
            }
            // Xóa hàng loạt theo status
            else if (productId && status) {
                if (status === 'all') {
                    const [result] = await connection.query<any>(
                        'DELETE FROM accounts WHERE product_id = ?',
                        [productId]
                    );
                    deletedCount = result.affectedRows;
                } else {
                    const [result] = await connection.query<any>(
                        'DELETE FROM accounts WHERE product_id = ? AND status = ?',
                        [productId, status]
                    );
                    deletedCount = result.affectedRows;
                }
            } else {
                await connection.rollback();
                return NextResponse.json({ error: 'Missing accountId, accountIds or productId with status' }, { status: 400 });
            }

            // Sync stock
            if (targetProductId) {
                const [stockResult] = await connection.query<RowDataPacket[]>(
                    'SELECT COUNT(*) as cnt FROM accounts WHERE product_id = ? AND status = "available"',
                    [targetProductId]
                );
                const totalStock = stockResult[0]?.cnt || 0;
                await connection.query(
                    'UPDATE products SET stock = ? WHERE id = ?',
                    [totalStock, targetProductId]
                );
            }

            await connection.commit();

            // Log action
            const adminName = await getAdminFromCookie(request);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'DELETE',
                targetType: 'PRODUCT', // Inventory is linked to product
                details: {
                    accountId,
                    accountIds,
                    productId,
                    status,
                    deletedCount,
                    reason
                },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, deletedCount });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, data } = body; // data: string "user|pass\nuser2|pass2"

        if (!productId || !data) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const lines = data.split('\n').filter((line: string) => line.trim().length > 0);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Lấy tất cả username đã tồn tại cho product này (bao gồm cả sold và available)
            const [existingRows] = await connection.query<RowDataPacket[]>(
                'SELECT username FROM accounts WHERE product_id = ?',
                [productId]
            );
            const existingUsernames = new Set(existingRows.map((r: RowDataPacket) => r.username));

            const addedAccounts: string[] = [];
            const skippedAccounts: string[] = [];

            for (const line of lines) {
                const parts = line.split('|').map((s: string) => s.trim());
                let username: string | undefined, password: string | undefined, twofa: string | undefined, extra_data: string | undefined;

                // 1 part: key
                if (parts.length === 1) {
                    username = parts[0];
                    password = parts[0];
                }
                // 2 parts: user|pass
                else if (parts.length === 2) {
                    username = parts[0];
                    password = parts[1];
                }
                // 3 parts: user|pass|twofa OR user|pass|extra
                else if (parts.length === 3) {
                    username = parts[0];
                    password = parts[1];
                    const part3 = parts[2];
                    if (part3.includes('@')) {
                        extra_data = part3;
                    } else {
                        twofa = part3;
                    }
                }
                // 4 parts: user|pass|extra|twofa
                else if (parts.length >= 4) {
                    username = parts[0];
                    password = parts[1];
                    extra_data = parts[2];
                    twofa = parts[3];
                }

                if (username && password) {
                    // Kiểm tra trùng lặp
                    if (existingUsernames.has(username)) {
                        skippedAccounts.push(username);
                        continue;
                    }

                    await connection.query(
                        'INSERT INTO accounts (product_id, username, password, twofa, extra_data, status) VALUES (?, ?, ?, ?, ?, "available")',
                        [productId, username, password, twofa || null, extra_data || null]
                    );
                    addedAccounts.push(username);
                    // Thêm vào set để tránh trùng trong cùng 1 batch
                    existingUsernames.add(username);
                }
            }

            // Update product stock
            const [stockResult] = await connection.query<RowDataPacket[]>(
                'SELECT COUNT(*) as cnt FROM accounts WHERE product_id = ? AND status = "available"',
                [productId]
            );
            const totalStock = stockResult[0]?.cnt || 0;

            await connection.query(
                'UPDATE products SET stock = ? WHERE id = ?',
                [totalStock, productId]
            );

            await connection.commit();
            return NextResponse.json({
                success: true,
                count: addedAccounts.length,
                skipped: skippedAccounts.length,
                totalStock
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

