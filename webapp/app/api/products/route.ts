import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        await dbReady;
        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'PRODUCT',
            details: 'Viewed products list',
            request
        });

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT p.*, c.name as category_name,
                    GREATEST(0, COALESCE(s.real_sold, 0) + COALESCE(p.sold_adjustment, 0)) AS sold_count,
                    COALESCE(s.real_sold, 0) AS real_sold
             FROM products p 
             LEFT JOIN categories c ON p.category_id = c.id 
             LEFT JOIN (
                SELECT product_id, COUNT(*) AS real_sold
                FROM accounts WHERE status = 'sold' GROUP BY product_id
             ) s ON s.product_id = p.id
             ORDER BY p.priority DESC, p.id DESC`
        );
        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        await dbReady;
        const body = await request.json();
        const { id, is_active, sold_count, reorder } = body;
        const adminName = await getAdminFromCookie(request);

        // Handle reorder batch
        if (Array.isArray(reorder)) {
            for (const item of reorder) {
                if (item.id && item.priority !== undefined) {
                    await pool.query('UPDATE products SET priority = ? WHERE id = ?', [item.priority, item.id]);
                }
            }
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PRODUCT',
                details: { reorder_count: reorder.length },
                request
            });
            return NextResponse.json({ success: true, message: 'Reordered products successfully' });
        }

        if (!id) {
            return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
        }

        // Handle Status (is_active) toggle switch
        if (is_active !== undefined) {
            const nextActive = is_active ? 1 : 0;
            await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [nextActive, id]);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PRODUCT',
                targetId: id,
                details: { is_active: nextActive },
                request
            });
            return NextResponse.json({ success: true, id, is_active: nextActive });
        }

        // Handle sold_count adjustment
        if (sold_count !== undefined) {
            const target = Math.max(0, Math.trunc(Number(sold_count)));
            if (!Number.isFinite(target)) {
                return NextResponse.json({ error: 'Invalid sold count' }, { status: 400 });
            }

            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT COUNT(*) AS real_sold FROM accounts WHERE product_id = ? AND status = 'sold'`,
                [id]
            );
            const realSold = Number(rows[0]?.real_sold || 0);
            await pool.query('UPDATE products SET sold_adjustment = ? WHERE id = ?', [target - realSold, id]);

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PRODUCT',
                targetId: id,
                details: { sold_count: target, real_sold: realSold },
                request
            });

            return NextResponse.json({ success: true, sold_count: target, real_sold: realSold });
        }

        return NextResponse.json({ error: 'No valid patch fields provided' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbReady;
        const body = await request.json();
        const {
            name, price, description, type, code, priority, check_live, category_id, low_stock_threshold,
            delivery_type, prompt_message, item_structure, account_prefix, file_delivery_mode,
            telegram_file_id, telegram_file_unique_id, access_duration_enabled, access_duration_days,
            preorder_enabled, preorder_fee_vnd, preorder_fee_usdt, preorder_max_per_user, preorder_total_limit,
            image_url
        } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        let finalCategoryId = category_id;
        if (!finalCategoryId) {
            const [defaultCats] = await pool.query<RowDataPacket[]>('SELECT id FROM categories WHERE name = "Khác"');
            if (defaultCats.length > 0) {
                finalCategoryId = defaultCats[0].id;
            }
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO products (
                name, price, description, type, code, priority, check_live, category_id, low_stock_threshold,
                delivery_type, prompt_message, item_structure, account_prefix, file_delivery_mode,
                telegram_file_id, telegram_file_unique_id, access_duration_enabled, access_duration_days,
                preorder_enabled, preorder_fee_vnd, preorder_fee_usdt, preorder_max_per_user, preorder_total_limit,
                image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, price, description, type || 'stock', code || null, priority || 0, check_live || 0, finalCategoryId || null, Math.max(0, Math.trunc(Number(low_stock_threshold ?? 5))),
                delivery_type || null, prompt_message || null, item_structure || null, account_prefix || null, file_delivery_mode || null,
                telegram_file_id || null, telegram_file_unique_id || null, access_duration_enabled ? 1 : 0, access_duration_days || 30,
                preorder_enabled ? 1 : 0, preorder_fee_vnd || 0, preorder_fee_usdt || 0, preorder_max_per_user || 5, preorder_total_limit || 100,
                image_url || null
            ]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'PRODUCT',
            targetId: result.insertId,
            details: { name, price, type: type || 'stock', category_id: finalCategoryId, delivery_type },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ id: result.insertId, message: 'Product created' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        await dbReady;
        const body = await request.json();
        const {
            id, name, price, description, type, code, priority, check_live, category_id, low_stock_threshold,
            delivery_type, prompt_message, item_structure, account_prefix, file_delivery_mode,
            telegram_file_id, telegram_file_unique_id, access_duration_enabled, access_duration_days,
            preorder_enabled, preorder_fee_vnd, preorder_fee_usdt, preorder_max_per_user, preorder_total_limit,
            image_url
        } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        let finalCategoryId = category_id;
        if (!finalCategoryId) {
            const [defaultCats] = await pool.query<RowDataPacket[]>('SELECT id FROM categories WHERE name = "Khác"');
            if (defaultCats.length > 0) {
                finalCategoryId = defaultCats[0].id;
            }
        }

        await pool.query(
            `UPDATE products SET 
                name = ?, price = ?, description = ?, type = ?, code = ?, priority = ?, check_live = ?, category_id = ?, low_stock_threshold = ?,
                delivery_type = ?, prompt_message = ?, item_structure = ?, account_prefix = ?, file_delivery_mode = ?,
                telegram_file_id = ?, telegram_file_unique_id = ?, access_duration_enabled = ?, access_duration_days = ?,
                preorder_enabled = ?, preorder_fee_vnd = ?, preorder_fee_usdt = ?, preorder_max_per_user = ?, preorder_total_limit = ?,
                image_url = ?
            WHERE id = ?`,
            [
                name, price, description, type, code || null, priority || 0, check_live || 0, finalCategoryId || null, Math.max(0, Math.trunc(Number(low_stock_threshold ?? 5))),
                delivery_type || null, prompt_message || null, item_structure || null, account_prefix || null, file_delivery_mode || null,
                telegram_file_id || null, telegram_file_unique_id || null, access_duration_enabled ? 1 : 0, access_duration_days || 30,
                preorder_enabled ? 1 : 0, preorder_fee_vnd || 0, preorder_fee_usdt || 0, preorder_max_per_user || 5, preorder_total_limit || 100,
                image_url || null, id
            ]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'PRODUCT',
            targetId: id,
            details: { name, price, type, category_id: finalCategoryId, delivery_type },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ message: 'Product updated' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const reason = searchParams.get('reason');
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        if (!reason || reason.trim().length === 0) return NextResponse.json({ error: 'Lý do xóa là bắt buộc' }, { status: 400 });


        await pool.query('DELETE FROM products WHERE id = ?', [id]);

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'DELETE',
            targetType: 'PRODUCT',
            targetId: id,
            details: { reason },
            ipAddress,
            userAgent,
            request

        });

        return NextResponse.json({ message: 'Product deleted' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

