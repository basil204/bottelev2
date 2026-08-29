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
            `SELECT p.*, 
                    COALESCE(p.emoji, p.telegram_emoji) AS emoji,
                    COALESCE(p.custom_emoji_id, p.telegram_custom_emoji_id) AS custom_emoji_id,
                    c.name as category_name,
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

        if (!id) return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });

        if (is_active !== undefined) {
            await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PRODUCT',
                targetId: id,
                details: { is_active },
                request
            });
            return NextResponse.json({ success: true, is_active });
        }

        if (sold_count !== undefined) {
            const target = Math.max(0, parseInt(sold_count) || 0);
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
            name, price, description, type, code, priority, check_live, is_active, require_email, category_id, low_stock_threshold,
            delivery_type, prompt_message, item_structure, account_prefix, file_delivery_mode,
            telegram_file_id, telegram_file_unique_id, access_duration_enabled, access_duration_days,
            preorder_enabled, preorder_fee_vnd, preorder_fee_usdt, preorder_max_per_user, preorder_total_limit,
            image_url, emoji, custom_emoji_id, telegram_emoji, telegram_custom_emoji_id
        } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        let finalCategoryId = category_id;
        if (!finalCategoryId) {
            const [defaultCats] = await pool.query<RowDataPacket[]>('SELECT id FROM categories WHERE name = "Khác"');
            if (defaultCats.length > 0) {
                finalCategoryId = defaultCats[0].id;
            }
        }

        const finalEmoji = (emoji || telegram_emoji || '').trim() || null;
        const finalCustomEmojiId = (custom_emoji_id || telegram_custom_emoji_id || '').trim() || null;
        const numIsActive = is_active !== undefined ? (is_active ? 1 : 0) : 1;
        const numRequireEmail = require_email ? 1 : 0;
        let finalType = type || 'stock';
        if (delivery_type === 'Nhập tay (Hỏi đáp, giao thủ công)' || (delivery_type && delivery_type.includes('Nhập tay'))) {
            finalType = 'order';
        }

        const [result] = await pool.query<ResultSetHeader>(
            `INSERT INTO products (
                name, price, description, type, code, priority, check_live, is_active, require_email, category_id, low_stock_threshold,
                delivery_type, prompt_message, item_structure, account_prefix, file_delivery_mode,
                telegram_file_id, telegram_file_unique_id, access_duration_enabled, access_duration_days,
                preorder_enabled, preorder_fee_vnd, preorder_fee_usdt, preorder_max_per_user, preorder_total_limit,
                image_url, emoji, custom_emoji_id, telegram_emoji, telegram_custom_emoji_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, price, description, finalType, code || null, priority || 0, check_live || 0, numIsActive, numRequireEmail, finalCategoryId || null, Math.max(0, Math.trunc(Number(low_stock_threshold ?? 5))),
                delivery_type || null, prompt_message || null, item_structure || null, account_prefix || null, file_delivery_mode || null,
                telegram_file_id || null, telegram_file_unique_id || null, access_duration_enabled ? 1 : 0, access_duration_days || 30,
                preorder_enabled ? 1 : 0, preorder_fee_vnd || 0, preorder_fee_usdt || 0, preorder_max_per_user || 5, preorder_total_limit || 100,
                image_url || null, finalEmoji, finalCustomEmojiId, finalEmoji, finalCustomEmojiId
            ]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'PRODUCT',
            targetId: result.insertId,
            details: { name, price, type: finalType, is_active: numIsActive, require_email: numRequireEmail, category_id: finalCategoryId, delivery_type, emoji: finalEmoji, custom_emoji_id: finalCustomEmojiId },
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
            id, name, price, description, type, code, priority, check_live, is_active, require_email, category_id, low_stock_threshold,
            delivery_type, prompt_message, item_structure, account_prefix, file_delivery_mode,
            telegram_file_id, telegram_file_unique_id, access_duration_enabled, access_duration_days,
            preorder_enabled, preorder_fee_vnd, preorder_fee_usdt, preorder_max_per_user, preorder_total_limit,
            image_url, emoji, custom_emoji_id, telegram_emoji, telegram_custom_emoji_id
        } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) {
            return NextResponse.json({ error: 'Thiếu ID sản phẩm (id is required)' }, { status: 400 });
        }

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Tên sản phẩm không được để trống' }, { status: 400 });
        }

        let finalCategoryId = category_id;
        if (!finalCategoryId) {
            const [defaultCats] = await pool.query<RowDataPacket[]>('SELECT id FROM categories WHERE name = "Khác"');
            if (defaultCats.length > 0) {
                finalCategoryId = defaultCats[0].id;
            }
        }

        const numPrice = Number(price) || 0;
        const numPriority = Number(priority) || 0;
        const numCheckLive = Number(check_live) || 0;
        const numIsActive = is_active !== undefined ? (is_active ? 1 : 0) : 1;
        const numRequireEmail = require_email ? 1 : 0;
        const numLowStockThreshold = Math.max(0, Math.trunc(Number(low_stock_threshold ?? 5)));
        const finalEmoji = (emoji || telegram_emoji || '').trim() || null;
        const finalCustomEmojiId = (custom_emoji_id || telegram_custom_emoji_id || '').trim() || null;
        let finalType = type || 'stock';
        if (delivery_type === 'Nhập tay (Hỏi đáp, giao thủ công)' || (delivery_type && delivery_type.includes('Nhập tay'))) {
            finalType = 'order';
        }

        await pool.query(
            `UPDATE products SET 
                name = ?, price = ?, description = ?, type = ?, code = ?, priority = ?, check_live = ?, is_active = ?, require_email = ?, category_id = ?, low_stock_threshold = ?,
                delivery_type = ?, prompt_message = ?, item_structure = ?, account_prefix = ?, file_delivery_mode = ?,
                telegram_file_id = ?, telegram_file_unique_id = ?, access_duration_enabled = ?, access_duration_days = ?,
                preorder_enabled = ?, preorder_fee_vnd = ?, preorder_fee_usdt = ?, preorder_max_per_user = ?, preorder_total_limit = ?,
                image_url = ?, emoji = ?, custom_emoji_id = ?, telegram_emoji = ?, telegram_custom_emoji_id = ?
            WHERE id = ?`,
            [
                name.trim(), numPrice, description || null, finalType, code || null, numPriority, numCheckLive, numIsActive, numRequireEmail, finalCategoryId || null, numLowStockThreshold,
                delivery_type || null, prompt_message || null, item_structure || null, account_prefix || null, file_delivery_mode || null,
                telegram_file_id || null, telegram_file_unique_id || null, access_duration_enabled ? 1 : 0, access_duration_days || 30,
                preorder_enabled ? 1 : 0, preorder_fee_vnd || 0, preorder_fee_usdt || 0, preorder_max_per_user || 5, preorder_total_limit || 100,
                image_url || null, finalEmoji, finalCustomEmojiId, finalEmoji, finalCustomEmojiId, id
            ]
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'PRODUCT',
            targetId: id,
            details: { name, price: numPrice, type: type || 'stock', is_active: numIsActive, require_email: numRequireEmail, category_id: finalCategoryId, emoji: finalEmoji, custom_emoji_id: finalCustomEmojiId },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true, message: 'Cập nhật sản phẩm thành công' });
    } catch (error: any) {
        console.error('[PRODUCTS_PUT_ERR]', error);
        return NextResponse.json({ error: error?.message || 'Lỗi khi cập nhật sản phẩm' }, { status: 500 });
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

