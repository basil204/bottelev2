import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getBotToken } from '@/lib/telegram';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

function formatCurrency(val: number) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val) + ' đ';
}

export async function GET(request: Request) {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` LIKE 'auto_restock_%'"
        );

        const settingsMap: Record<string, string> = {};
        rows.forEach((r) => { settingsMap[r.key] = r.value; });

        const config = {
            isActive: settingsMap.auto_restock_active === '1',
            intervalHours: Number(settingsMap.auto_restock_interval) || 4,
            quietStart: settingsMap.auto_restock_quiet_start || '23:00',
            quietEnd: settingsMap.auto_restock_quiet_end || '07:30',
            targetType: settingsMap.auto_restock_target || 'channel',
            channelId: settingsMap.auto_restock_channel_id || '',
            channelLang: settingsMap.auto_restock_lang || 'vi',
            fakeRule: settingsMap.auto_restock_rule || 'random',
            productId: settingsMap.auto_restock_product_id || '0',
            customImage: settingsMap.auto_restock_custom_image || '',
            useProductImage: settingsMap.auto_restock_use_product_image === '1',
            minQty: Number(settingsMap.auto_restock_min_qty) || 15,
            maxQty: Number(settingsMap.auto_restock_max_qty) || 50,
            lastRun: settingsMap.auto_restock_last_run || 'Chưa chạy lần nào'
        };

        return NextResponse.json({ config });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            action,
            isActive,
            intervalHours,
            quietStart,
            quietEnd,
            targetType,
            channelId,
            channelLang,
            fakeRule,
            productId,
            customImage,
            useProductImage,
            minQty,
            maxQty
        } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (action === 'save_config') {
            const updates = [
                ['auto_restock_active', isActive ? '1' : '0'],
                ['auto_restock_interval', String(intervalHours || 4)],
                ['auto_restock_quiet_start', String(quietStart || '23:00')],
                ['auto_restock_quiet_end', String(quietEnd || '07:30')],
                ['auto_restock_target', String(targetType || 'channel')],
                ['auto_restock_channel_id', String(channelId || '')],
                ['auto_restock_lang', String(channelLang || 'vi')],
                ['auto_restock_rule', String(fakeRule || 'random')],
                ['auto_restock_product_id', String(productId || '0')],
                ['auto_restock_custom_image', String(customImage || '')],
                ['auto_restock_use_product_image', useProductImage ? '1' : '0'],
                ['auto_restock_min_qty', String(minQty || 15)],
                ['auto_restock_max_qty', String(maxQty || 50)]
            ];

            for (const [key, val] of updates) {
                await pool.query(
                    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
                    [key, val, val]
                );
            }

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SETTING',
                details: { type: 'AUTO_RESTOCK_CONFIG', isActive, intervalHours, channelId, targetType, productId, fakeRule },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã lưu cấu hình hẹn giờ Auto Restock Scheduler thành công!' });
        }

        if (action === 'test_run') {
            const token = await getBotToken();
            if (!token) {
                return NextResponse.json({ error: 'Chưa cấu hình Telegram Bot Token trong Cài đặt Hệ thống!' }, { status: 400 });
            }

            let botUsername = '';
            try {
                const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
                const meData = await meRes.json();
                if (meData.ok && meData.result?.username) {
                    botUsername = meData.result.username;
                }
            } catch (e) {
                console.error('getMe error:', e);
            }

            const [chanRows] = await pool.query<RowDataPacket[]>("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'auto_restock_%'");
            const dbMap: Record<string, string> = {};
            chanRows.forEach(r => { dbMap[r.key] = r.value; });

            const targetChan = (channelId !== undefined ? channelId : (dbMap.auto_restock_channel_id || '')).trim();
            const currentTargetType = targetType || dbMap.auto_restock_target || 'channel';
            const currentRule = fakeRule || dbMap.auto_restock_rule || 'random';
            const currentProdId = productId || dbMap.auto_restock_product_id || '0';

            let product: any = null;
            if (currentRule === 'specific' && currentProdId && currentProdId !== '0') {
                const [prods] = await pool.query<RowDataPacket[]>("SELECT * FROM products WHERE id = ?", [currentProdId]);
                if (prods && prods.length > 0) product = prods[0];
            }

            if (!product) {
                let prodQuery = "SELECT * FROM products WHERE is_active = 1";
                if (currentRule === 'min_stock') {
                    prodQuery += " ORDER BY stock ASC, RAND() LIMIT 1";
                } else {
                    prodQuery += " ORDER BY RAND() LIMIT 1";
                }
                const [prods] = await pool.query<RowDataPacket[]>(prodQuery);
                product = prods[0] || { id: 1, name: 'Sản phẩm thử nghiệm', price: 150000 };
            }

            const minQ = Number(minQty || dbMap.auto_restock_min_qty) || 15;
            const maxQ = Number(maxQty || dbMap.auto_restock_max_qty) || 50;
            const randQty = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ;

            const targetLang = ['vi', 'en', 'zh'].includes(channelLang) ? channelLang : 'vi';
            const tplKey = targetLang === 'en' ? 'template_restock_notify_en' : (targetLang === 'zh' ? 'template_restock_notify_zh' : 'template_restock_notify');
            const btnKey = targetLang === 'en' ? 'btn_view_and_buy_en' : (targetLang === 'zh' ? 'btn_view_and_buy_zh' : 'btn_view_and_buy');

            const [tplSettings] = await pool.query<RowDataPacket[]>(
                "SELECT `key`, `value` FROM settings WHERE `key` IN (?, ?, 'template_restock_notify', 'btn_view_and_buy', 'shop_name')",
                [tplKey, btnKey]
            );
            const sMap: Record<string, string> = {};
            tplSettings.forEach(r => { sMap[r.key] = r.value; });

            const defaultNotify: Record<string, string> = {
                vi: '🔥 <b>VỪA CẬP NHẬT THÊM HÀNG / BỔ SUNG KHO!</b>\n\n🛍️ <b>Sản phẩm:</b> <b>{name}</b>\n📦 <b>Vừa nhập thêm:</b> <b>+{quantity} tài khoản</b>\n📊 <b>Hiện có trong kho:</b> <b>{stock} tài khoản</b>\n💰 <b>Giá bán:</b> <b>{price}</b>\n\n⚡ <i>Kho đã được bổ sung đầy đủ, hãy bấm nút bên dưới để sở hữu ngay!</i>',
                en: '🔥 <b>STOCK RESTOCKED & READY!</b>\n\n🛍️ <b>Product:</b> <b>{name}</b>\n📦 <b>Restocked:</b> <b>+{quantity} accounts</b>\n📊 <b>Total Stock:</b> <b>{stock} accounts</b>\n💰 <b>Price:</b> <b>{price}</b>\n\n⚡ <i>Stock replenished, click below to buy now!</i>',
                zh: '🔥 <b>商品补货已入库！</b>\n\n🛍️ <b>商品:</b> <b>{name}</b>\n📦 <b>新入库:</b> <b>+{quantity} 个账号</b>\n📊 <b>当前总库存:</b> <b>{stock} 个</b>\n💰 <b>价格:</b> <b>{price}</b>\n\n⚡ <i>库存已补充充足，点击下方按钮立即选购！</i>'
            };

            const defaultBtn: Record<string, string> = {
                vi: '🛍️ Xem & Mua sản phẩm ngay',
                en: '🛍️ View & Buy Now',
                zh: '🛍️ 查看并立即购买'
            };

            let templateMsg = sMap[tplKey] || sMap.template_restock_notify || defaultNotify[targetLang] || defaultNotify.vi;

            const formattedPrice = formatCurrency(Number(product.price) || 0);
            const textMsg = templateMsg
                .split('{name}').join(product.name || '')
                .split('{quantity}').join(String(randQty))
                .split('{stock}').join(String(product.stock || randQty))
                .split('{price}').join(formattedPrice)
                .split('{shop_name}').join(sMap.shop_name || 'SHOP')
                .replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');

            const buttonText = sMap[btnKey] || sMap.btn_view_and_buy || defaultBtn[targetLang] || defaultBtn.vi;
            const buyUrl = botUsername ? `https://t.me/${botUsername}?start=buy_${product.id}` : undefined;
            const replyMarkup = buyUrl ? {
                inline_keyboard: [
                    [
                        { text: buttonText, url: buyUrl }
                    ]
                ]
            } : undefined;

            let imageUrlToUse = (customImage || dbMap.auto_restock_custom_image || '').trim();
            const shouldUseProdImg = useProductImage !== undefined ? useProductImage : (dbMap.auto_restock_use_product_image === '1');
            if (!imageUrlToUse && shouldUseProdImg && product.image_url && String(product.image_url).trim().startsWith('http')) {
                imageUrlToUse = product.image_url.trim();
            }

            let channelSuccess = false;
            let userSuccessCount = 0;
            let totalUsersCount = 0;

            const sendTelegramMessage = async (targetId: string) => {
                const endpoint = imageUrlToUse ? 'sendPhoto' : 'sendMessage';
                const payload: any = {
                    chat_id: targetId,
                    parse_mode: 'Markdown'
                };

                if (imageUrlToUse) {
                    payload.photo = imageUrlToUse;
                    payload.caption = textMsg;
                } else {
                    payload.text = textMsg;
                }

                if (replyMarkup) payload.reply_markup = replyMarkup;

                const tgRes = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const tgData = await tgRes.json();
                return tgData.ok;
            };

            if (targetChan && (currentTargetType === 'channel' || currentTargetType === 'both')) {
                try {
                    channelSuccess = await sendTelegramMessage(targetChan);
                } catch (e) {
                    console.error('Channel send error:', e);
                }
            }

            if (!targetChan || currentTargetType === 'users' || currentTargetType === 'both') {
                const [users] = await pool.query<RowDataPacket[]>("SELECT DISTINCT telegram_id FROM users WHERE telegram_id IS NOT NULL AND telegram_id != ''");
                totalUsersCount = users.length;
                for (const u of users) {
                    try {
                        const ok = await sendTelegramMessage(u.telegram_id);
                        if (ok) userSuccessCount++;
                    } catch (e) {
                        // ignore error per user
                    }
                }
            }

            const now = new Date();
            const nowStr = `${now.toLocaleTimeString('vi-VN')} ${now.toLocaleDateString('vi-VN')}`;
            const nowTs = String(Date.now());
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES ('auto_restock_last_run', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [nowStr, nowStr]
            );
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES ('auto_restock_last_run_timestamp', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [nowTs, nowTs]
            );

            let resultMsg = '';
            if (channelSuccess && userSuccessCount > 0) {
                resultMsg = `Đã phát sóng bài Auto Restock Scheduler cho "${product.name}" (+${randQty}) tới Kênh ${targetChan} VÀ ${userSuccessCount}/${totalUsersCount} khách hàng!`;
            } else if (channelSuccess) {
                resultMsg = `Đã phát sóng bài Auto Restock Scheduler cho "${product.name}" (+${randQty}) tới Kênh Telegram ${targetChan}!`;
            } else if (userSuccessCount > 0) {
                resultMsg = `Đã phát sóng bài Auto Restock Scheduler cho "${product.name}" (+${randQty}) tới ${userSuccessCount}/${totalUsersCount} khách hàng!`;
            } else {
                resultMsg = `Đã gửi bài Auto Restock thử nghiệm cho "${product.name}" (+${randQty} sản phẩm).`;
            }

            return NextResponse.json({
                success: true,
                message: resultMsg
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
