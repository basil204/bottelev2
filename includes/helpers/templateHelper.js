import { query } from '../database/index.js';

export const DEFAULT_BOT_TEMPLATES = {
    msg_template_delivery: `✅ **ĐƠN HÀNG #{order_code} ĐÃ ĐƯỢC BÀN GIAO!**\n\n🎁 **Sản phẩm:** {product_name}\n📦 **Dữ liệu bàn giao:**\n\`\`\`\n{data}\n\`\`\`\n📝 **Ghi chú:** {note}\n\nCảm ơn bạn đã tin tưởng dịch vụ! CHÚC BẠN SỬ DỤNG VUI VẺ ❤️`,
    msg_template_purchase: `🎉 **MUA HÀNG THÀNH CÔNG!**\n\n🧾 **Mã đơn:** \`#{order_code}\`\n🎁 **Sản phẩm:** {product_name}\n💰 **Thanh toán:** {price} đ\n📦 **Tài khoản / Dữ liệu:**\n\`\`\`\n{data}\n\`\`\`\n\nCảm ơn quý khách đã tin tưởng và ủng hộ shop! ❤️`,
    msg_template_order_placed: `📝 **ĐƠN HÀNG ĐẶT TRƯỚC ĐÃ ĐƯỢC GHI NHẬN!**\n\n🧾 **Mã đơn:** \`#{order_code}\`\n🎁 **Sản phẩm:** {product_name}\n💰 **Số tiền:** {price} đ\n📌 **Thông tin đã gửi:**\n\`\`\`\n{input_data}\n\`\`\`\n\n⏳ Đơn hàng đang được Admin xử lý. Bạn sẽ nhận được thông báo ngay khi bàn giao! ❤️`,
    msg_template_new_order_admin: `🚨 **CÓ ĐƠN HÀNG ORDER MỚI CẦN XỬ LÝ!**\n\n🧾 **Mã đơn:** \`#{order_code}\`\n🎁 **Sản phẩm:** {product_name}\n💰 **Số tiền:** {price} đ\n👤 **Khách hàng:** @{username} (ID: \`{telegram_id}\`)\n📝 **Thông tin từ khách:**\n\`\`\`\n{input_data}\n\`\`\`\n\n👉 Vui lòng vào Web Dashboard để xử lý bàn giao cho khách!`,
    msg_template_order_refund: `💸 **ĐƠN HÀNG #{order_code} ĐÃ ĐƯỢC HOÀN TIỀN!**\n\n🎁 **Sản phẩm:** {product_name}\n💵 **Số tiền hoàn vào ví:** +{amount} đ\n📝 **Lý do hoàn tiền:** {reason}\n\nSố tiền đã được cộng lại vào số dư ví của bạn. Cảm ơn bạn! ❤️`,
    msg_template_deposit: `✅ **YÊU CẦU NẠP TIỀN #{deposit_id} ĐÃ ĐƯỢC DUYỆT!**\n\n💰 **Số tiền nạp:** {amount} đ\n🎁 **Khuyến mãi:** +{bonus} đ\n💵 **Tổng thực nhận:** {total} đ\n💳 **Số dư tài khoản hiện tại:** {new_balance} đ\n\nCảm ơn bạn đã nạp tiền vào hệ thống! ❤️`,
    msg_template_deposit_reject: `❌ **YÊU CẦU NẠP TIỀN #{deposit_id} ĐÃ BỊ TỪ CHỐI!**\n\n📝 **Lý do:** {reason}\n\nNếu có nhầm lẫn, vui lòng liên hệ Admin để được hỗ trợ kiểm tra lại.`,
    msg_support_received: `💬 **SHOP ĐÃ NHẬN ĐƯỢC TIN NHẮN HỖ TRỢ CỦA BẠN!**\n\n👤 **Khách hàng:** {customer_name}\n💬 **Nội dung:**\n\`\`\`\n{message_text}\n\`\`\`\n⏰ **Thời gian:** {time}\n\nAdmin kỹ thuật đã nhận được tin nhắn và sẽ phản hồi trực tiếp cho bạn trong giây lát. Vui lòng chờ nhé! ❤️`,
    msg_template_warranty_request: `🛡️ **HỆ THỐNG ĐÃ NHẬN YÊU CẦU BẢO HÀNH!**\n\n🧾 **Mã đơn hàng:** \`#{order_code}\`\n🎁 **Sản phẩm:** {product_name}\n📝 **Lý do bảo hành:** {reason}\n⏰ **Thời gian gửi:** {time}\n\nKỹ thuật viên đang kiểm tra và sẽ phản hồi sớm nhất cho bạn. Vui lòng chờ nhé! ❤️`,
    msg_template_support: `💬 **PHẢN HỒI TỪ ADMIN HỖ TRỢ / BẢO HÀNH**\n\n🎫 **Ticket ID:** #{ticket_id}\n🎁 **Sản phẩm:** {product_name}\n👨‍💻 **Nội dung trả lời:**\n{reply_text}\n\n📌 **Trạng thái:** {status}\n\nCảm ơn bạn đã liên hệ với chúng tôi! ❤️`,
    msg_template_chat_user_message: `📩 **TIN NHẮN HỖ TRỢ MỚI TỪ KHÁCH HÀNG!**\n\n👤 **Khách hàng:** {customer_name} (@{username})\n🆔 **Telegram ID:** \`{telegram_id}\`\n💬 **Nội dung tin nhắn:**\n\`\`\`\n{message_text}\n\`\`\`\n\n👉 Vui lòng mở trang Live Chat trên Web Admin để phản hồi khách!`,
    msg_template_welcome: `👋 **CHÀO MỪNG {first_name} ĐẾN VỚI HỆ THỐNG BOT!**\n\n🤖 Bot hỗ trợ mua sắm tài khoản, dịch vụ tự động & nạp tiền 24/7.\n👉 Vui lòng bấm vào Menu hoặc dùng các lệnh bên dưới để bắt đầu.`
};

/**
 * Helper render variables into template string
 */
export function renderBotTemplate(templateStr, vars = {}) {
    let result = templateStr;
    for (const [key, val] of Object.entries(vars)) {
        const pattern = new RegExp(`\\{${key}\\}`, 'g');
        result = result.replace(pattern, String(val ?? ''));
    }
    // Tự động chuyển đổi các cú pháp {5375135722514685501} hoặc {id:5375135722514685501} thành thẻ <tg-emoji>
    result = result.replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');
    return result;
}

/**
 * Get active template from DB or default
 */
export async function getBotTemplate(key) {
    const defaultVal = DEFAULT_BOT_TEMPLATES[key] || '';
    try {
        const rows = await query('SELECT `value` FROM settings WHERE `key` = ?', [key]);
        if (rows && rows.length > 0 && rows[0].value && rows[0].value.trim() !== '') {
            return rows[0].value;
        }
    } catch (err) {
        console.error(`Error loading template ${key} from DB:`, err.message);
    }
    return defaultVal;
}
