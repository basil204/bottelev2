import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';
import { broadcastToUsers } from '@/lib/telegramBroadcast';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { flashSaleId, customMessage, bannerImage, customEmojiId, buttonText } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!flashSaleId) {
            return NextResponse.json({ error: 'Missing flashSaleId' }, { status: 400 });
        }

        // Fetch Flash Sale and Product
        const [sales] = await pool.query<RowDataPacket[]>(`
            SELECT fs.*, p.name as product_name, p.price as original_price, p.image_url as product_image,
                   p.custom_emoji_id as prod_custom_emoji_id, p.telegram_custom_emoji_id
            FROM flash_sales fs
            LEFT JOIN products p ON fs.product_id = p.id
            WHERE fs.id = ?
        `, [flashSaleId]);

        if (!sales || sales.length === 0) {
            return NextResponse.json({ error: 'Không tìm thấy chương trình Flash Sale' }, { status: 404 });
        }

        const sale = sales[0];
        const [settingsRows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('bot_username', 'shop_name', 'template_flash_sale_notify', 'btn_flash_sale_buy')"
        );
        const sMap: Record<string, string> = {};
        settingsRows.forEach(r => { sMap[r.key] = r.value; });

        const botUsername = (sMap.bot_username || '').split(/[\s,]+/)[0].replace(/^@/, '') || '';
        const fmtMoney = (amount: number) => Number(amount).toLocaleString('vi-VN') + 'đ';

        let finalMessage = customMessage;
        if (!finalMessage || !finalMessage.trim()) {
            const origPrice = Number(sale.original_price) || 0;
            const salePrice = Number(sale.sale_price) || 0;
            const discountPct = Number(sale.discount_percent) || (origPrice > 0 ? Math.round(((origPrice - salePrice) / origPrice) * 100) : 0);

            let priceLine = `💰 <b>Giá gốc:</b> <s>${fmtMoney(origPrice)}</s> ➡️ <b>Giá Flash Sale:</b> <b>${fmtMoney(salePrice)}</b> (-${discountPct}%)`;
            if (sale.sale_type === 'BULK') {
                priceLine = `💰 <b>Giá gốc:</b> ${fmtMoney(origPrice)}\n🔥 <b>Flash Sale mua sỉ:</b> Mua từ <b>${sale.bulk_min_qty} cái</b> giá chỉ <b>${fmtMoney(sale.bulk_price)}/cái</b>`;
            }

            const startStr = new Date(sale.start_time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
            const endStr = new Date(sale.end_time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

            const defaultTpl = `⚡ <b>CHƯƠNG TRÌNH FLASH SALE ĐẶC BIỆT!</b>\n\n` +
                `🛍️ <b>Sản phẩm:</b> <b>{name}</b>\n` +
                `{price_line}\n` +
                `⏳ <b>Thời gian áp dụng:</b> {start_time} - {end_time}\n\n` +
                `⚡ <i>Số lượng ưu đãi có hạn. Hãy nhanh tay bấm nút bên dưới để sở hữu ngay!</i>`;

            const rawTpl = sMap.template_flash_sale_notify || defaultTpl;
            finalMessage = rawTpl
                .replace(/\{name\}/g, sale.product_name || `Sản phẩm #${sale.product_id}`)
                .replace(/\{price_line\}/g, priceLine)
                .replace(/\{start_time\}/g, startStr)
                .replace(/\{end_time\}/g, endStr)
                .replace(/\{time_range\}/g, `${startStr} - ${endStr}`)
                .replace(/\{discount_percent\}/g, String(discountPct))
                .replace(/\{original_price\}/g, fmtMoney(origPrice))
                .replace(/\{sale_price\}/g, fmtMoney(salePrice))
                .replace(/\{shop_name\}/g, sMap.shop_name || 'SHOP')
                .replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '<tg-emoji emoji-id="$1">⚡</tg-emoji>');
        }

        const defaultBtnText = (sMap.btn_flash_sale_buy || '⚡ Mua ngay giá Flash Sale')
            .replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '');

        const inlineKeyboard: any[][] = [];
        const buyBtnUrl = botUsername ? `https://t.me/${botUsername}?start=buy_${sale.product_id}` : undefined;
        const buyBtnCallback = `view_product_${sale.product_id}`;

        inlineKeyboard.push([
            buyBtnUrl
                ? { text: buttonText || defaultBtnText, url: buyBtnUrl }
                : { text: buttonText || defaultBtnText, callback_data: buyBtnCallback }
        ]);

        const finalBanner = bannerImage || sale.banner_image || sale.product_image || null;
        const finalCustomEmojiId = customEmojiId || sale.custom_emoji_id || sale.prod_custom_emoji_id || sale.telegram_custom_emoji_id;

        const broadcastStats = await broadcastToUsers({
            message: finalMessage,
            imageUrl: finalBanner,
            customEmojiId: finalCustomEmojiId,
            inlineKeyboard
        });

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'BROADCAST',
            targetType: 'PROMOTION',
            targetId: Number(flashSaleId),
            details: { flashSaleId, sent: broadcastStats.sent, total: broadcastStats.total },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({
            success: true,
            message: `Đã phát sóng Flash Sale thành công (${broadcastStats.sent}/${broadcastStats.total} users)`,
            stats: broadcastStats
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
