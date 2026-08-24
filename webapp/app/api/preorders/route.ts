import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const status = searchParams.get('status');
        const productId = searchParams.get('productId');

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'PREORDER',
            details: 'Viewed preorders list',
            request
        });

        // Ensure table exists dynamically
        await pool.query(`
            CREATE TABLE IF NOT EXISTS preorders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_code VARCHAR(100) NULL,
                user_id INT NULL,
                telegram_id BIGINT NULL,
                username VARCHAR(100) NULL,
                user_fullname VARCHAR(100) NULL,
                product_id INT NOT NULL,
                quantity INT DEFAULT 1,
                deposit_fee DECIMAL(15, 2) DEFAULT 0,
                total_price DECIMAL(15, 2) DEFAULT 0,
                payment_method VARCHAR(100) DEFAULT 'Admin Tạo Thủ Công',
                status VARCHAR(50) DEFAULT 'pending',
                fifo_position INT DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        const conditions: string[] = [];
        const params: any[] = [];

        if (status && status !== 'all') {
            conditions.push('preorders.status = ?');
            params.push(status);
        }

        if (productId && productId !== 'all') {
            conditions.push('preorders.product_id = ?');
            params.push(productId);
        }

        if (search && search.trim().length > 0) {
            const term = `%${search.trim()}%`;
            conditions.push('(preorders.invoice_code LIKE ? OR CAST(preorders.telegram_id AS CHAR) LIKE ? OR preorders.username LIKE ? OR products.name LIKE ?)');
            params.push(term, term, term, term);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT preorders.*,
                   products.name as product_name,
                   products.price as product_price,
                   users.username as user_username,
                   users.name as user_name
            FROM preorders
            LEFT JOIN products ON preorders.product_id = products.id
            LEFT JOIN users ON preorders.user_id = users.id OR preorders.telegram_id = users.telegram_id
            ${whereClause}
            ORDER BY preorders.created_at ASC
        `, params);

        // Stats summary
        const [statsRows] = await pool.query<RowDataPacket[]>(`
            SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingCount,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN quantity ELSE 0 END), 0) as pendingProductsCount,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedCount,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN deposit_fee ELSE 0 END), 0) as depositTotal
            FROM preorders
        `);

        const stats = statsRows[0] || {
            pendingCount: 0,
            pendingProductsCount: 0,
            completedCount: 0,
            depositTotal: 0
        };

        return NextResponse.json({
            data: rows,
            stats
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, productId, telegramId, quantity, paymentMethod, broadcastMessage, bannerImage } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (action === 'create') {
            if (!productId || !telegramId) {
                return NextResponse.json({ error: 'Vui lòng chọn sản phẩm và nhập Telegram User ID' }, { status: 400 });
            }

            // Get product price & info
            const [prodRows] = await pool.query<RowDataPacket[]>('SELECT * FROM products WHERE id = ?', [productId]);
            if (prodRows.length === 0) {
                return NextResponse.json({ error: 'Sản phẩm không tồn tại' }, { status: 404 });
            }
            const product = prodRows[0];

            // Get user info if exists
            const [userRows] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE telegram_id = ? OR id = ?', [telegramId, telegramId]);
            const user = userRows[0] || null;

            const qty = Number(quantity) || 1;
            const depositFee = Number(product.preorder_fee_vnd || product.price || 0) * qty;
            const totalPrice = Number(product.price || 0) * qty;
            const invoiceCode = `PRE-${Date.now()}`;

            // Calculate FIFO position
            const [fifoRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM preorders WHERE status = "pending" AND product_id = ?', [productId]);
            const fifoPos = Number(fifoRows[0]?.count || 0) + 1;

            const [insertRes]: any = await pool.query(`
                INSERT INTO preorders (
                    invoice_code, user_id, telegram_id, username, user_fullname,
                    product_id, quantity, deposit_fee, total_price, payment_method,
                    status, fifo_position
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            `, [
                invoiceCode, user?.id || null, Number(telegramId) || null, user?.username || null, user?.name || null,
                productId, qty, depositFee, totalPrice, paymentMethod || 'Admin Tạo Thủ Công', fifoPos
            ]);

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'CREATE',
                targetType: 'PREORDER',
                targetId: insertRes.insertId,
                details: { productId, telegramId, quantity: qty, paymentMethod },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Tạo đơn đặt trước thủ công thành công' });
        }

        if (action === 'broadcast') {
            if (!broadcastMessage || !broadcastMessage.trim()) {
                return NextResponse.json({ error: 'Nội dung thông báo không được để trống' }, { status: 400 });
            }

            // Log broadcast action
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'BROADCAST',
                targetType: 'PREORDER',
                details: { productId, broadcastMessage, bannerImage },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã gửi thông báo mở đặt trước tới toàn bộ khách hàng' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, action } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!id) return NextResponse.json({ error: 'Missing Preorder ID' }, { status: 400 });

        const [preorderRows] = await pool.query<RowDataPacket[]>('SELECT * FROM preorders WHERE id = ?', [id]);
        if (preorderRows.length === 0) {
            return NextResponse.json({ error: 'Đơn đặt trước không tồn tại' }, { status: 404 });
        }
        const preorder = preorderRows[0];

        if (action === 'complete') {
            await pool.query('UPDATE preorders SET status = "completed" WHERE id = ?', [id]);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PREORDER',
                targetId: Number(id),
                details: { action: 'COMPLETE' },
                ipAddress,
                userAgent,
                request
            });
            return NextResponse.json({ success: true, message: 'Đã hoàn tất đơn đặt trước' });
        }

        if (action === 'refund') {
            // Refund deposit_fee to user's balance
            if (preorder.telegram_id || preorder.user_id) {
                const depositVal = Number(preorder.deposit_fee || 0);
                if (depositVal > 0) {
                    await pool.query('UPDATE users SET balance = balance + ? WHERE id = ? OR telegram_id = ?', [
                        depositVal, preorder.user_id || 0, preorder.telegram_id || 0
                    ]);
                    try {
                        await pool.query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)', [
                            preorder.user_id || 0, depositVal, `Hoàn tiền cọc đơn đặt trước #${id}`
                        ]);
                    } catch (e) {
                        console.error('Balance log insert failed:', e);
                    }
                }
            }

            await pool.query('UPDATE preorders SET status = "refunded" WHERE id = ?', [id]);

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PREORDER',
                targetId: Number(id),
                details: { action: 'REFUND', depositFee: preorder.deposit_fee },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã hủy & hoàn tiền cọc vào ví khách hàng' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
