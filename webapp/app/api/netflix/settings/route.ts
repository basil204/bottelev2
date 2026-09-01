import { NextRequest, NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { getAdminFromCookie } from '@/lib/adminLog';

const DEFAULT_MSG_MENU = `🎬 **TỰ ĐỘNG NHẬN NETFLIX 30 NGÀY (GET 30 DAYS)**\n\n💰 **Đơn giá:** \`{price}\` / 1 Email\n🛡 **Cơ chế an toàn:** Tích hợp Proxy sạch & Cookie chống checkpoint\n⚡ **Trạng thái:** Hoạt động ổn định\n⏳ **Hàng chờ hiện tại:** \`{pending_count}\` yêu cầu đang chờ\n🎉 **Đã hoàn tất:** \`{success_count}\` lượt thành công\n\n👉 Bấm **⚡ BẮT ĐẦU NHẬN NETFLIX** bên dưới rồi nhập địa chỉ Email của bạn. Hệ thống sẽ tự động thao tác từ A - Z!`;

const DEFAULT_MSG_PROMPT = `📝 **VUI LÒNG NHẬP EMAIL CỦA BẠN ĐỂ NHẬN NETFLIX 30 NGÀY**\n\n💰 **Đơn giá:** \`{price}\` (Trừ thẳng vào số dư Bot)\n\n👉 Vui lòng gửi địa chỉ Email hợp lệ vào khung chat bên dưới:\n*(Ví dụ: \`example@hotmail.com\` hoặc \`yourname@gmail.com\`)*\n\nGõ /cancel hoặc nút **❌ Huỷ** để dừng thao tác.`;

const DEFAULT_MSG_PROCESSING = `⏳ **ĐANG XỬ LÝ NHẬN NETFLIX 30 NGÀY...**\n\n🆔 **Mã yêu cầu:** \`#{task_id}\`\n📧 **Email:** \`{email}\`\n📊 **Vị trí hàng chờ:** Số \`{queue_pos}\`\n💰 **Đã trừ:** \`{price}\`\n\n🛡️ *Hệ thống đang chạy ngầm với Proxy an toàn. Tiến trình sẽ được cập nhật liên tục tại đây...*`;

const DEFAULT_MSG_SUCCESS = `🎉 **NHẬN NETFLIX 30 NGÀY THÀNH CÔNG!**\n\n📧 **Email đăng ký:** \`{email}\`\n💰 **Đơn giá:** \`{price}\`\n🕒 **Thời gian hoàn tất:** {time}\n\n✨ Bạn có thể đăng nhập Netflix hoặc kiểm tra hòm thư Email để bắt đầu sử dụng gói dùng thử 30 ngày ngay!`;

const DEFAULT_MSG_FAILED = `❌ **NHẬN NETFLIX 30 NGÀY THẤT BẠI!**\n\n📧 **Email:** \`{email}\`\n⚠️ **Lý do:** \`{reason}\`{refund_note}\n\n👉 Vui lòng thử lại với một Email khác hoặc liên hệ Admin để được hỗ trợ.`;

export async function GET(request: NextRequest) {
  try {
    await dbReady;
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [rows] = await pool.query<any[]>(
      "SELECT `key`, `value` FROM settings WHERE `key` LIKE 'netflix_%'"
    );

    const settingsMap: Record<string, string> = {};
    rows.forEach(r => {
      settingsMap[r.key] = r.value;
    });

    return NextResponse.json({
      success: true,
      data: {
        enabled: settingsMap['netflix_enabled'] !== 'false',
        price: Number(settingsMap['netflix_price'] || 25000),
        headless: settingsMap['netflix_headless'] !== 'false',
        concurrency: Number(settingsMap['netflix_concurrency'] || 1),
        proxies: settingsMap['netflix_proxies'] || '',
        cookies: settingsMap['netflix_cookies'] || '',
        custom_emoji_id: settingsMap['netflix_custom_emoji_id'] || '',
        msg_menu: settingsMap['netflix_msg_menu'] || DEFAULT_MSG_MENU,
        msg_prompt: settingsMap['netflix_msg_prompt'] || DEFAULT_MSG_PROMPT,
        msg_processing: settingsMap['netflix_msg_processing'] || DEFAULT_MSG_PROCESSING,
        msg_success: settingsMap['netflix_msg_success'] || DEFAULT_MSG_SUCCESS,
        msg_failed: settingsMap['netflix_msg_failed'] || DEFAULT_MSG_FAILED
      }
    });
  } catch (err: any) {
    console.error('[API_NETFLIX_SETTINGS_GET]', err);
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
      enabled, price, headless, concurrency, proxies, cookies, custom_emoji_id,
      msg_menu, msg_prompt, msg_processing, msg_success, msg_failed
    } = body;

    const updates: [string, string][] = [
      ['netflix_enabled', enabled !== false ? 'true' : 'false'],
      ['netflix_price', String(Math.max(0, Number(price) || 0))],
      ['netflix_headless', headless !== false ? 'true' : 'false'],
      ['netflix_concurrency', String(Math.max(1, Number(concurrency) || 1))],
      ['netflix_proxies', typeof proxies === 'string' ? proxies.trim() : ''],
      ['netflix_cookies', typeof cookies === 'string' ? cookies.trim() : (cookies ? JSON.stringify(cookies) : '')],
      ['netflix_custom_emoji_id', typeof custom_emoji_id === 'string' ? custom_emoji_id.trim() : ''],
      ['netflix_msg_menu', typeof msg_menu === 'string' ? msg_menu.trim() : DEFAULT_MSG_MENU],
      ['netflix_msg_prompt', typeof msg_prompt === 'string' ? msg_prompt.trim() : DEFAULT_MSG_PROMPT],
      ['netflix_msg_processing', typeof msg_processing === 'string' ? msg_processing.trim() : DEFAULT_MSG_PROCESSING],
      ['netflix_msg_success', typeof msg_success === 'string' ? msg_success.trim() : DEFAULT_MSG_SUCCESS],
      ['netflix_msg_failed', typeof msg_failed === 'string' ? msg_failed.trim() : DEFAULT_MSG_FAILED]
    ];

    for (const [k, v] of updates) {
      await pool.query(
        "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
        [k, v, v]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cập nhật cấu hình & lời nhắn Netflix thành công!'
    });
  } catch (err: any) {
    console.error('[API_NETFLIX_SETTINGS_POST]', err);
    return NextResponse.json({ error: err.message || 'Database error' }, { status: 500 });
  }
}
