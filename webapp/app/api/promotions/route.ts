import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';
import { broadcastToUsers } from '@/lib/telegramBroadcast';

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
                discount_percent INT DEFAULT 0,
                bulk_min_qty INT DEFAULT 0,
                bulk_price DECIMAL(15, 2) DEFAULT 0,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                custom_emoji_id VARCHAR(100) DEFAULT NULL,
                banner_image TEXT DEFAULT NULL,
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
                // Ignore duplicate column error
            }
        };

        await safeAddCol('sale_type', "VARCHAR(50) DEFAULT 'PRICE_SALE'");
        await safeAddCol('sale_price', 'DECIMAL(15, 2) DEFAULT 0');
        await safeAddCol('discount_percent', 'INT DEFAULT 0');
        await safeAddCol('bulk_min_qty', 'INT DEFAULT 0');
        await safeAddCol('bulk_price', 'DECIMAL(15, 2) DEFAULT 0');
        await safeAddCol('custom_emoji_id', 'VARCHAR(100) DEFAULT NULL');
        await safeAddCol('banner_image', 'TEXT DEFAULT NULL');
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
            SELECT fs.*, p.name as product_name, p.price as original_price, p.image_url as product_image
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
        const {
            productId, saleType, salePrice, discountPercent, bulkMinQty, bulkPrice,
            startTime, endTime, notifyTelegram, customEmojiId, bannerImage
        } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!productId || !startTime || !endTime) {
            return NextResponse.json({ error: 'Vui lòng chọn sản phẩm và thời gian Flash Sale' }, { status: 400 });
        }

        // Fetch product info
        const [prodRows] = await pool.query<RowDataPacket[]>('SELECT * FROM products WHERE id = ?', [productId]);
        const product = prodRows[0];
        if (!product) {
            return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
        }

        const origPrice = Number(product.price) || 0;
        let finalSalePrice = Number(salePrice) || 0;
        let numDiscountPercent = Number(discountPercent) || 0;

        if (saleType === 'PERCENTAGE' && numDiscountPercent > 0) {
            finalSalePrice = Math.round(origPrice * (1 - numDiscountPercent / 100));
        } else if (saleType === 'PRICE_SALE' && finalSalePrice > 0 && origPrice > 0) {
            numDiscountPercent = Math.round(((origPrice - finalSalePrice) / origPrice) * 100);
        }

        const [res]: any = await pool.query(`
            INSERT INTO flash_sales (
                product_id, sale_type, sale_price, discount_percent, bulk_min_qty, bulk_price,
                start_time, end_time, custom_emoji_id, banner_image, notify_telegram, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [
            Number(productId),
            saleType || 'PRICE_SALE',
            finalSalePrice,
            numDiscountPercent,
            Number(bulkMinQty) || 0,
            Number(bulkPrice) || 0,
            startTime,
            endTime,
            customEmojiId ? String(customEmojiId).trim() : null,
            bannerImage ? String(bannerImage).trim() : null,
            notifyTelegram ? 1 : 0
        ]);

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'PROMOTION',
            targetId: res.insertId,
            details: { productId, saleType, salePrice: finalSalePrice, discountPercent: numDiscountPercent, startTime, endTime },
            ipAddress,
            userAgent,
            request
        });

        // Tự động phát sóng Telegram nếu được chọn
        let broadcastStats = null;
        if (notifyTelegram) {
            const [botSettings] = await pool.query<RowDataPacket[]>(
                "SELECT `value` FROM settings WHERE `key` = 'bot_username' LIMIT 1"
            );
            const botUsername = botSettings[0]?.value || '';

            const fmtMoney = (amount: number) => Number(amount).toLocaleString('vi-VN') + 'đ';

            let priceLine = `💰 **Giá gốc:** <s>${fmtMoney(origPrice)}</s> ➡️ **Giá Flash Sale:** <b>${fmtMoney(finalSalePrice)}</b> (-${numDiscountPercent}%)`;
            if (saleType === 'BULK') {
                priceLine = `💰 **Giá gốc:** ${fmtMoney(origPrice)}\n🔥 **Flash Sale mua sỉ:** Mua từ <b>${bulkMinQty} cái</b> giá chỉ <b>${fmtMoney(bulkPrice)}/cái</b>`;
            }

            const startStr = new Date(startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
            const endStr = new Date(endTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

            const broadcastMessage = `⚡ <b>CHƯƠNG TRÌNH FLASH SALE ĐẶC BIỆT!</b>\n\n` +
                `🛍️ <b>Sản phẩm:</b> <b>${product.name}</b>\n` +
                `${priceLine}\n` +
                `⏳ <b>Thời gian áp dụng:</b> ${startStr} - ${endStr}\n\n` +
                `⚡ <i>Số lượng ưu đãi có hạn. Hãy nhanh tay bấm nút bên dưới để sở hữu ngay!</i>`;

            const inlineKeyboard: any[][] = [];
            const buyBtnUrl = botUsername ? `https://t.me/${botUsername}?start=buy_${product.id}` : undefined;
            const buyBtnCallback = `view_product_${product.id}`;

            inlineKeyboard.push([
                buyBtnUrl
                    ? { text: '⚡ Mua ngay giá Flash Sale', url: buyBtnUrl }
                    : { text: '⚡ Mua ngay giá Flash Sale', callback_data: buyBtnCallback }
            ]);

            const finalBanner = bannerImage || product.image_url || null;

            broadcastStats = await broadcastToUsers({
                message: broadcastMessage,
                imageUrl: finalBanner,
                customEmojiId: customEmojiId || product.custom_emoji_id || product.telegram_custom_emoji_id,
                inlineKeyboard
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Đã tạo chương trình Flash Sale thành công',
            broadcastStats
        });
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

        if (action === 'resume') {
            await pool.query('UPDATE flash_sales SET status = "active" WHERE id = ?', [id]);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'PROMOTION',
                targetId: Number(id),
                details: { action: 'RESUME' },
                ipAddress,
                userAgent,
                request
            });
            return NextResponse.json({ success: true, message: 'Đã kích hoạt lại Flash Sale' });
        }

        if (action === 'delete') {
            await pool.query('DELETE FROM flash_sales WHERE id = ?', [id]);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'DELETE',
                targetType: 'PROMOTION',
                targetId: Number(id),
                details: { action: 'DELETE' },
                ipAddress,
                userAgent,
                request
            });
            return NextResponse.json({ success: true, message: 'Đã xóa Flash Sale' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
