import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const status = searchParams.get('status');

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'SYSTEM',
            details: 'Viewed retargeting campaigns',
            request
        });

        // Ensure table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS retargeting_campaigns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                product_id INT NULL,
                plan_id VARCHAR(100) NULL,
                original_price DECIMAL(15, 2) DEFAULT 0,
                discount_price DECIMAL(15, 2) DEFAULT 0,
                valid_hours INT DEFAULT 24,
                effect_tag VARCHAR(50) DEFAULT '{effect:fire}',
                msg_template TEXT NULL,
                btn_label VARCHAR(255) DEFAULT '⚡ Mua ngay với giá ưu đãi',
                banner_file_id VARCHAR(255) NULL,
                status VARCHAR(50) DEFAULT 'running', -- draft | running | completed
                reached_count INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Safe auto migrations for existing table columns
        const safeAddCol = async (colName: string, colDef: string) => {
            try {
                await pool.query(`ALTER TABLE retargeting_campaigns ADD COLUMN ${colName} ${colDef}`);
            } catch (e: any) {
                // Ignore duplicate column error ER_DUP_FIELDNAME (1060)
            }
        };

        await safeAddCol('product_id', 'INT NULL');
        await safeAddCol('plan_id', 'VARCHAR(100) NULL');
        await safeAddCol('original_price', 'DECIMAL(15, 2) DEFAULT 0');
        await safeAddCol('discount_price', 'DECIMAL(15, 2) DEFAULT 0');
        await safeAddCol('valid_hours', 'INT DEFAULT 24');
        await safeAddCol('effect_tag', "VARCHAR(50) DEFAULT '{effect:fire}'");
        await safeAddCol('msg_template', 'TEXT NULL');
        await safeAddCol('btn_label', "VARCHAR(255) DEFAULT '⚡ Mua ngay với giá ưu đãi'");
        await safeAddCol('banner_file_id', 'VARCHAR(255) NULL');
        await safeAddCol('status', "VARCHAR(50) DEFAULT 'running'");
        await safeAddCol('reached_count', 'INT DEFAULT 0');

        let whereClause = '';
        const params: any[] = [];

        if (status && status !== 'all') {
            whereClause = 'WHERE status = ?';
            params.push(status);
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            whereClause += whereClause ? ' AND (name LIKE ? OR CAST(id AS CHAR) LIKE ?)' : 'WHERE (name LIKE ? OR CAST(id AS CHAR) LIKE ?)';
            params.push(term, term);
        }

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT rc.*, p.name as product_name
            FROM retargeting_campaigns rc
            LEFT JOIN products p ON rc.product_id = p.id
            ${whereClause}
            ORDER BY rc.created_at DESC
        `, params);

        const stats = {
            totalCount: rows.length,
            completedCount: rows.filter(r => r.status === 'completed').length,
            runningCount: rows.filter(r => r.status === 'running').length,
            draftCount: rows.filter(r => r.status === 'draft').length,
            reachedCount: rows.reduce((acc, curr) => acc + (curr.reached_count || 0), 0)
        };

        return NextResponse.json({ data: rows, stats });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, productId, planId, originalPrice, discountPrice, validHours, effectTag, msgTemplate, btnLabel, bannerFileId, status } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!name || !discountPrice) {
            return NextResponse.json({ error: 'Vui lòng nhập Tên chiến dịch và Mức giá ưu đãi' }, { status: 400 });
        }

        const [res]: any = await pool.query(`
            INSERT INTO retargeting_campaigns (
                name, product_id, plan_id, original_price, discount_price,
                valid_hours, effect_tag, msg_template, btn_label, banner_file_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name.trim(),
            productId ? Number(productId) : null,
            planId || null,
            Number(originalPrice) || 0,
            Number(discountPrice) || 0,
            Number(validHours) || 24,
            effectTag || '{effect:fire}',
            msgTemplate || null,
            btnLabel || '⚡ Mua ngay với giá ưu đãi',
            bannerFileId || null,
            status || 'running'
        ]);

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'SYSTEM',
            targetId: res.insertId,
            details: { name, discountPrice, status },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true, message: 'Đã tạo/chạy chiến dịch re-targeting thành công!' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
