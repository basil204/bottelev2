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
            details: 'Viewed coupons list',
            request
        });

        // Ensure table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS coupons (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                discount_type VARCHAR(50) DEFAULT 'FIXED',
                discount_value DECIMAL(15, 2) DEFAULT 0,
                min_order_value DECIMAL(15, 2) DEFAULT 0,
                max_discount DECIMAL(15, 2) NULL,
                max_uses INT NULL,
                used_count INT DEFAULT 0,
                product_id INT NULL,
                start_time DATETIME NULL,
                end_time DATETIME NULL,
                is_active TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        let whereClause = '';
        const params: any[] = [];

        if (search && search.trim()) {
            whereClause = 'WHERE c.code LIKE ? OR p.name LIKE ? OR CAST(c.id AS CHAR) LIKE ?';
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT c.*, p.name as product_name
            FROM coupons c
            LEFT JOIN products p ON c.product_id = p.id
            ${whereClause}
            ORDER BY c.created_at DESC
        `, params);

        const now = new Date();
        let totalCount = rows.length;
        let activeCount = 0;
        let scheduledCount = 0;
        let expiredCount = 0;
        let outOfStockCount = 0;

        const formattedRows = rows.map(coupon => {
            const startTime = coupon.start_time ? new Date(coupon.start_time) : null;
            const endTime = coupon.end_time ? new Date(coupon.end_time) : null;
            const isOutOfStock = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses;

            let computedStatus = 'ACTIVE';

            if (!coupon.is_active) {
                computedStatus = 'TẮT';
            } else if (isOutOfStock) {
                computedStatus = 'HẾT LƯỢT';
                outOfStockCount++;
            } else if (startTime && now < startTime) {
                computedStatus = 'SẮP CHẠY';
                scheduledCount++;
            } else if (endTime && now > endTime) {
                computedStatus = 'HẾT HẠN';
                expiredCount++;
            } else {
                computedStatus = 'ACTIVE';
                activeCount++;
            }

            return {
                ...coupon,
                computed_status: computedStatus
            };
        });

        const stats = {
            totalCount,
            activeCount,
            scheduledCount,
            expiredCount,
            outOfStockCount
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
        const { code, discountType, discountValue, minOrderValue, maxDiscount, maxUses, productId, startTime, endTime, isActive } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!code || !discountValue) {
            return NextResponse.json({ error: 'Vui lòng nhập Mã giảm giá và Giá trị giảm' }, { status: 400 });
        }

        const [res]: any = await pool.query(`
            INSERT INTO coupons (
                code, discount_type, discount_value, min_order_value, max_discount,
                max_uses, product_id, start_time, end_time, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            code.trim().toUpperCase(),
            discountType || 'FIXED',
            Number(discountValue) || 0,
            Number(minOrderValue) || 0,
            maxDiscount ? Number(maxDiscount) : null,
            maxUses ? Number(maxUses) : null,
            productId ? Number(productId) : null,
            startTime ? startTime : null,
            endTime ? endTime : null,
            isActive ? 1 : 0
        ]);

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'PROMOTION',
            targetId: res.insertId,
            details: { code, discountType, discountValue },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true, message: 'Đã tạo mã giảm giá thành công' });
    } catch (error: any) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: 'Mã giảm giá này đã tồn tại' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await pool.query('DELETE FROM coupons WHERE id = ?', [id]);
        return NextResponse.json({ success: true, message: 'Đã xóa mã giảm giá' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
