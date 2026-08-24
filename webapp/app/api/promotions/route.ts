import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'PROMOTION',
            details: 'Viewed flash sales list',
            request
        });

        // Ensure table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS flash_sales (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                sale_type VARCHAR(50) DEFAULT 'PRICE_SALE',
                sale_price DECIMAL(15, 2) DEFAULT 0,
                bulk_min_qty INT DEFAULT 0,
                bulk_price DECIMAL(15, 2) DEFAULT 0,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                notify_telegram TINYINT(1) DEFAULT 1,
                status VARCHAR(50) DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Safe auto migrations for existing table columns
        const safeAddCol = async (colName: string, colDef: string) => {
            try {
                await pool.query(`ALTER TABLE flash_sales ADD COLUMN ${colName} ${colDef}`);
            } catch (e: any) {
                // Ignore duplicate column error (1060)
            }
        };

        await safeAddCol('sale_type', "VARCHAR(50) DEFAULT 'PRICE_SALE'");
        await safeAddCol('sale_price', 'DECIMAL(15, 2) DEFAULT 0');
        await safeAddCol('bulk_min_qty', 'INT DEFAULT 0');
        await safeAddCol('bulk_price', 'DECIMAL(15, 2) DEFAULT 0');
        await safeAddCol('notify_telegram', 'TINYINT(1) DEFAULT 1');
        await safeAddCol('status', "VARCHAR(50) DEFAULT 'active'");

        let whereClause = '';
        const params: any[] = [];
        if (search && search.trim()) {
            whereClause = 'WHERE p.name LIKE ? OR CAST(fs.id AS CHAR) LIKE ?';
            const term = `%${search.trim()}%`;
            params.push(term, term);
        }

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT fs.*, p.name as product_name, p.price as original_price
            FROM flash_sales fs
            LEFT JOIN products p ON fs.product_id = p.id
            ${whereClause}
            ORDER BY fs.created_at DESC
        `, params);

        const now = new Date();

        // Calculate dynamic statuses & summary stats
        let totalCount = rows.length;
        let runningCount = 0;
        let scheduledCount = 0;
        let expiredCount = 0;
        let stoppedCount = 0;

        const formattedRows = rows.map(sale => {
            const startTime = new Date(sale.start_time);
            const endTime = new Date(sale.end_time);
            let computedStatus = 'ĐANG CHẠY';

            if (sale.status === 'stopped') {
                computedStatus = 'ĐÃ DỪNG';
                stoppedCount++;
            } else if (now < startTime) {
                computedStatus = 'SẮP CHẠY';
                scheduledCount++;
            } else if (now > endTime) {
                computedStatus = 'HẾT HẠN';
                expiredCount++;
            } else {
                computedStatus = 'ĐANG CHẠY';
                runningCount++;
            }

            return {
                ...sale,
                computed_status: computedStatus
            };
        });

        const stats = {
            totalCount,
            runningCount,
            scheduledCount,
            expiredCount,
            stoppedCount
        };

        return NextResponse.json({
            data: formattedRows,
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
        const { productId, saleType, salePrice, bulkMinQty, bulkPrice, startTime, endTime, notifyTelegram } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!productId || !startTime || !endTime) {
            return NextResponse.json({ error: 'Vui lòng chọn sản phẩm và thời gian Flash Sale' }, { status: 400 });
        }

        const [res]: any = await pool.query(`
            INSERT INTO flash_sales (
                product_id, sale_type, sale_price, bulk_min_qty, bulk_price,
                start_time, end_time, notify_telegram, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [
            Number(productId),
            saleType || 'PRICE_SALE',
            Number(salePrice) || 0,
            Number(bulkMinQty) || 0,
            Number(bulkPrice) || 0,
            startTime,
            endTime,
            notifyTelegram ? 1 : 0
        ]);

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'PROMOTION',
            targetId: res.insertId,
            details: { productId, saleType, salePrice, startTime, endTime },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true, message: 'Đã tạo chương trình Flash Sale thành công' });
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

        if (!id) return NextResponse.json({ error: 'Missing Flash Sale ID' }, { status: 400 });

        if (action === 'stop') {
            await pool.query('UPDATE flash_sales SET status = "stopped" WHERE id = ?', [id]);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PROMOTION',
                targetId: Number(id),
                details: { action: 'STOP' },
                ipAddress,
                userAgent,
                request
            });
            return NextResponse.json({ success: true, message: 'Đã dừng Flash Sale' });
        }

        if (action === 'delete') {
            await pool.query('DELETE FROM flash_sales WHERE id = ?', [id]);
            return NextResponse.json({ success: true, message: 'Đã xóa Flash Sale' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
