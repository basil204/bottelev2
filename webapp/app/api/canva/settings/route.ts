import { NextRequest, NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { getAdminFromCookie } from '@/lib/adminLog';

const DEFAULT_MSG_MENU = `🎨 **TỰ ĐỘNG MỜI CANVA PRO / ĐỘI NHÓM**\n\n💰 **Đơn giá:** \`{price}\` / 1 Tài khoản\n👥 **Đội khả dụng:** \`{teams_available}\` đội\n📊 **Còn trống:** \`{slots_available}\` slots\n⏳ **Hàng chờ hiện tại:** \`{pending_count}\` yêu cầu\n🎉 **Đã hoàn tất:** \`{success_count}\` lượt\n\n👉 Bấm **⚡ BẮT ĐẦU MỜI CANVA PRO** bên dưới rồi nhập địa chỉ Email Canva của bạn. Hệ thống sẽ tự động mời vào đội và gửi link tham gia ngay!`;

const DEFAULT_MSG_PROMPT = `📝 **VUI LÒNG NHẬP EMAIL CỦA BẠN ĐỂ NHẬN LỜI MỜI CANVA PRO**\n\n💰 **Đơn giá:** \`{price}\` (Trừ thẳng vào số dư Bot)\n\n👉 Vui lòng gửi địa chỉ Email tài khoản Canva của bạn vào khung chat bên dưới:\n*(Ví dụ: \`example@gmail.com\`)*\n\nGõ /cancel hoặc nút **❌ Huỷ** để dừng thao tác.`;

const DEFAULT_MSG_PROCESSING = `⏳ **ĐANG XỬ LÝ MỜI CANVA PRO...**\n\n🆔 **Mã đơn:** \`#{task_id}\`\n📧 **Email:** \`{email}\`\n📊 **Vị trí hàng chờ:** Số \`{queue_pos}\`\n💰 **Đã trừ:** \`{price}\`\n\n🛡️ *Hệ thống đang tự động thao tác gửi lời mời qua Canva Team API. Vui lòng đợi trong giây lát...*`;

const DEFAULT_MSG_SUCCESS = `🎉 **MỜI CANVA PRO THÀNH CÔNG!**\n\n📧 **Email nhận:** \`{email}\`\n🏢 **Tên Đội Canva:** \`{team_name}\`\n💰 **Đơn giá:** \`{price}\`\n🕒 **Thời gian:** {time}\n\n🔗 **LINK THAM GIA ĐỘI CANVA PRO:**\n👉 [BẤM VÀO ĐÂY ĐỂ VÀO ĐỘI]({invite_link})\n*(Hoặc copy link: \`{invite_link}\`)*\n\n✨ Bạn có thể bấm link trên hoặc kiểm tra hòm thư Email để chấp nhận vào nhóm Canva Pro ngay!`;

const DEFAULT_MSG_FAILED = `❌ **MỜI CANVA PRO THẤT BẠI!**\n\n📧 **Email:** \`{email}\`\n⚠️ **Lý do:** \`{reason}\`{refund_note}\n\n👉 Vui lòng thử lại hoặc liên hệ Admin để được hỗ trợ.`;

export async function GET(request: NextRequest) {
  try {
    await dbReady;
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [rows] = await pool.query<any[]>(
      "SELECT `key`, `value` FROM settings WHERE `key` LIKE 'canva_%'"
    );

    const settingsMap: Record<string, string> = {};
    rows.forEach(r => {
      settingsMap[r.key] = r.value;
    });

    return NextResponse.json({
      success: true,
      data: {
        apiUrl: settingsMap['canva_api_url'] || 'http://localhost:1568',
        enabled: settingsMap['canva_enabled'] !== 'false',
        price: Number(settingsMap['canva_price'] || 15000),
        price_designer: Number(settingsMap['canva_price_designer'] || settingsMap['canva_price'] || 20000),
        price_member: Number(settingsMap['canva_price_member'] || settingsMap['canva_price'] || 15000),
        headless: settingsMap['canva_headless'] !== 'false',
        concurrency: Number(settingsMap['canva_concurrency'] || 1),
        defaultRole: settingsMap['canva_default_role'] || 'designer',
        proxies: settingsMap['canva_proxies'] || '',
        custom_emoji_id: settingsMap['canva_custom_emoji_id'] || '',
        msg_menu: settingsMap['canva_msg_menu'] || DEFAULT_MSG_MENU,
        msg_prompt: settingsMap['canva_msg_prompt'] || DEFAULT_MSG_PROMPT,
        msg_processing: settingsMap['canva_msg_processing'] || DEFAULT_MSG_PROCESSING,
        msg_success: settingsMap['canva_msg_success'] || DEFAULT_MSG_SUCCESS,
        msg_failed: settingsMap['canva_msg_failed'] || DEFAULT_MSG_FAILED
      }
    });
  } catch (err: any) {
    console.error('[API_CANVA_SETTINGS_GET]', err);
    return NextResponse.json({ error: err.message || 'Database error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbReady;
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      apiUrl, api_url, enabled, price, price_designer, priceDesigner, price_member, priceMember,
      headless, concurrency, defaultRole, proxies, custom_emoji_id,
      msg_menu, msg_prompt, msg_processing, msg_success, msg_failed
    } = body;

    const finalApiUrl = (apiUrl || api_url || 'http://localhost:1568').trim();
    const finalPriceDesigner = Number(price_designer !== undefined ? price_designer : (priceDesigner !== undefined ? priceDesigner : 20000));
    const finalPriceMember = Number(price_member !== undefined ? price_member : (priceMember !== undefined ? priceMember : (price || 15000)));

    const updates: [string, string][] = [
      ['canva_api_url', finalApiUrl],
      ['canva_enabled', enabled !== false ? 'true' : 'false'],
      ['canva_price', String(Math.max(0, finalPriceMember))],
      ['canva_price_designer', String(Math.max(0, finalPriceDesigner))],
      ['canva_price_member', String(Math.max(0, finalPriceMember))],
      ['canva_headless', headless !== false ? 'true' : 'false'],
      ['canva_concurrency', String(Math.max(1, Number(concurrency) || 1))],
      ['canva_default_role', defaultRole || 'member'],
      ['canva_proxies', typeof proxies === 'string' ? proxies.trim() : ''],
      ['canva_custom_emoji_id', typeof custom_emoji_id === 'string' ? custom_emoji_id.trim() : ''],
      ['canva_msg_menu', typeof msg_menu === 'string' ? msg_menu.trim() : DEFAULT_MSG_MENU],
      ['canva_msg_prompt', typeof msg_prompt === 'string' ? msg_prompt.trim() : DEFAULT_MSG_PROMPT],
      ['canva_msg_processing', typeof msg_processing === 'string' ? msg_processing.trim() : DEFAULT_MSG_PROCESSING],
      ['canva_msg_success', typeof msg_success === 'string' ? msg_success.trim() : DEFAULT_MSG_SUCCESS],
      ['canva_msg_failed', typeof msg_failed === 'string' ? msg_failed.trim() : DEFAULT_MSG_FAILED]
    ];

    for (const [k, v] of updates) {
      await pool.query(
        "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
        [k, v, v]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cập nhật cấu hình & lời nhắn Canva Pro thành công!'
    });
  } catch (err: any) {
    console.error('[API_CANVA_SETTINGS_POST]', err);
    return NextResponse.json({ error: err.message || 'Database error' }, { status: 500 });
  }
}
