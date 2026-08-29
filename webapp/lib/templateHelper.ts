import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export interface TemplateDefinition {
    key: string;
    title: string;
    description: string;
    category: 'order' | 'deposit' | 'support' | 'bot';
    defaultTemplate: string;
    variables: { code: string; label: string }[];
}

export const DEFAULT_TEMPLATES: Record<string, TemplateDefinition> = {
    msg_template_delivery: {
        key: 'msg_template_delivery',
        title: 'Bàn giao đơn hàng / Bảo hành',
        description: 'Gửi cho khách hàng khi Admin bàn giao tài khoản hoặc hoàn tất bảo hành đơn hàng',
        category: 'order',
        defaultTemplate: `✅ **ĐƠN HÀNG #{order_code} ĐÃ ĐƯỢC BÀN GIAO!**\n\n🎁 **Sản phẩm:** {product_name}\n📦 **Dữ liệu bàn giao:**\n\`\`\`\n{data}\n\`\`\`\n📝 **Ghi chú:** {note}\n\nCảm ơn bạn đã tin tưởng dịch vụ! CHÚC BẠN SỬ DỤNG VUI VẺ ❤️`,
        variables: [
            { code: '{order_code}', label: 'Mã đơn hàng' },
            { code: '{product_name}', label: 'Tên sản phẩm' },
            { code: '{data}', label: 'Dữ liệu tài khoản / nội dung bàn giao' },
            { code: '{note}', label: 'Ghi chú bàn giao' },
            { code: '{price}', label: 'Giá sản phẩm' },
            { code: '{username}', label: 'Tên người dùng' }
        ]
    },
    msg_template_purchase: {
        key: 'msg_template_purchase',
        title: 'Thông báo mua hàng thành công',
        description: 'Gửi tự động cho khách hàng ngay khi hoàn tất thanh toán mua sản phẩm',
        category: 'order',
        defaultTemplate: `🎉 **MUA HÀNG THÀNH CÔNG!**\n\n🧾 **Mã đơn:** \`#{order_code}\`\n🎁 **Sản phẩm:** {product_name}\n💰 **Thanh toán:** {price} đ\n📦 **Tài khoản / Dữ liệu:**\n\`\`\`\n{data}\n\`\`\`\n\nCảm ơn quý khách đã tin tưởng và ủng hộ shop! ❤️`,
        variables: [
            { code: '{order_code}', label: 'Mã đơn hàng' },
            { code: '{product_name}', label: 'Tên sản phẩm' },
            { code: '{price}', label: 'Tổng tiền' },
            { code: '{data}', label: 'Nội dung tài khoản nhận được' },
            { code: '{time}', label: 'Thời gian mua' }
        ]
    },
    msg_template_order_placed: {
        key: 'msg_template_order_placed',
        title: 'Thông báo đặt hàng / Hàng Order (Cho Khách)',
        description: 'Gửi cho khách hàng khi họ tạo thành công đơn hàng đặt trước (Order/Nhập tay)',
        category: 'order',
        defaultTemplate: `📝 **ĐƠN HÀNG ĐẶT TRƯỚC ĐÃ ĐƯỢC GHI NHẬN!**\n\n🧾 **Mã đơn:** \`#{order_code}\`\n🎁 **Sản phẩm:** {product_name}\n💰 **Số tiền:** {price} đ\n📌 **Thông tin đã gửi:**\n\`\`\`\n{input_data}\n\`\`\`\n\n⏳ Đơn hàng đang được Admin xử lý. Bạn sẽ nhận được thông báo ngay khi bàn giao! ❤️`,
        variables: [
            { code: '{order_code}', label: 'Mã đơn hàng' },
            { code: '{product_name}', label: 'Tên sản phẩm' },
            { code: '{price}', label: 'Giá sản phẩm' },
            { code: '{input_data}', label: 'Thông tin khách nhập' },
            { code: '{time}', label: 'Thời gian đặt' }
        ]
    },
    msg_template_new_order_admin: {
        key: 'msg_template_new_order_admin',
        title: 'Thông báo đơn hàng mới (Cho Admin)',
        description: 'Gửi cho Admin Telegram khi có khách vừa tạo đơn hàng Order / Đặt hàng mới',
        category: 'order',
        defaultTemplate: `🚨 **CÓ ĐƠN HÀNG ORDER MỚI CẦN XỬ LÝ!**\n\n🧾 **Mã đơn:** \`#{order_code}\`\n🎁 **Sản phẩm:** {product_name}\n💰 **Số tiền:** {price} đ\n👤 **Khách hàng:** @{username} (ID: \`{telegram_id}\`)\n📝 **Thông tin từ khách:**\n\`\`\`\n{input_data}\n\`\`\`\n\n👉 Vui lòng vào Web Dashboard để xử lý bàn giao cho khách!`,
        variables: [
            { code: '{order_code}', label: 'Mã đơn hàng' },
            { code: '{product_name}', label: 'Tên sản phẩm' },
            { code: '{price}', label: 'Tổng số tiền' },
            { code: '{input_data}', label: 'Dữ liệu khách gửi' },
            { code: '{username}', label: 'Username khách' },
            { code: '{telegram_id}', label: 'Telegram ID khách' }
        ]
    },
    msg_template_order_refund: {
        key: 'msg_template_order_refund',
        title: 'Thông báo hoàn tiền / Hủy đơn hàng',
        description: 'Gửi cho khách khi Admin thực hiện hủy đơn hàng và hoàn lại tiền vào ví',
        category: 'order',
        defaultTemplate: `💸 **ĐƠN HÀNG #{order_code} ĐÃ ĐƯỢC HOÀN TIỀN!**\n\n🎁 **Sản phẩm:** {product_name}\n💵 **Số tiền hoàn vào ví:** +{amount} đ\n📝 **Lý do hoàn tiền:** {reason}\n\nSố tiền đã được cộng lại vào số dư ví của bạn. Cảm ơn bạn! ❤️`,
        variables: [
            { code: '{order_code}', label: 'Mã đơn hàng' },
            { code: '{product_name}', label: 'Tên sản phẩm' },
            { code: '{amount}', label: 'Số tiền hoàn lại' },
            { code: '{reason}', label: 'Lý do hủy/hoàn tiền' }
        ]
    },
    msg_template_deposit: {
        key: 'msg_template_deposit',
        title: 'Duyệt nạp tiền thành công',
        description: 'Gửi cho khách hàng khi giao dịch nạp tiền (Bank/USDT/Manual) được duyệt thành công',
        category: 'deposit',
        defaultTemplate: `✅ **YÊU CẦU NẠP TIỀN #{deposit_id} ĐÃ ĐƯỢC DUYỆT!**\n\n💰 **Số tiền nạp:** {amount} đ\n🎁 **Khuyến mãi:** +{bonus} đ\n💵 **Tổng thực nhận:** {total} đ\n💳 **Số dư tài khoản hiện tại:** {new_balance} đ\n\nCảm ơn bạn đã nạp tiền vào hệ thống! ❤️`,
        variables: [
            { code: '{deposit_id}', label: 'Mã giao dịch nạp' },
            { code: '{amount}', label: 'Số tiền nạp' },
            { code: '{bonus}', label: 'Tiền thưởng khuyến mãi' },
            { code: '{total}', label: 'Tổng cộng cộng vào ví' },
            { code: '{new_balance}', label: 'Số dư mới' }
        ]
    },
    msg_template_deposit_reject: {
        key: 'msg_template_deposit_reject',
        title: 'Từ chối yêu cầu nạp tiền',
        description: 'Gửi cho khách hàng khi yêu cầu nạp tiền không hợp lệ hoặc bị từ chối',
        category: 'deposit',
        defaultTemplate: `❌ **YÊU CẦU NẠP TIỀN #{deposit_id} ĐÃ BỊ TỪ CHỐI!**\n\n📝 **Lý do:** {reason}\n\nNếu có nhầm lẫn, vui lòng liên hệ Admin để được hỗ trợ kiểm tra lại.`,
        variables: [
            { code: '{deposit_id}', label: 'Mã giao dịch nạp' },
            { code: '{reason}', label: 'Lý do từ chối' }
        ]
    },
    msg_support_received: {
        key: 'msg_support_received',
        title: 'Xác nhận nhận tin nhắn hỗ trợ (Cho Khách)',
        description: 'Gửi tự động cho khách khi họ gửi tin nhắn thắc mắc/hỗ trợ tới Bot Telegram',
        category: 'support',
        defaultTemplate: `💬 **SHOP ĐÃ NHẬN ĐƯỢC TIN NHẮN HỖ TRỢ CỦA BẠN!**\n\n👤 **Khách hàng:** {customer_name}\n💬 **Nội dung:**\n\`\`\`\n{message_text}\n\`\`\`\n⏰ **Thời gian:** {time}\n\nAdmin kỹ thuật đã nhận được tin nhắn và sẽ phản hồi trực tiếp cho bạn trong giây lát. Vui lòng chờ nhé! ❤️`,
        variables: [
            { code: '{customer_name}', label: 'Tên khách hàng' },
            { code: '{username}', label: 'Username' },
            { code: '{telegram_id}', label: 'Telegram ID' },
            { code: '{message_text}', label: 'Nội dung tin nhắn khách gửi' },
            { code: '{time}', label: 'Thời gian gửi' }
        ]
    },
    msg_template_warranty_request: {
        key: 'msg_template_warranty_request',
        title: 'Khách gửi yêu cầu bảo hành (Xác nhận cho Khách)',
        description: 'Gửi tự động cho khách hàng khi họ gửi yêu cầu/ticket bảo hành mới',
        category: 'support',
        defaultTemplate: `🛡️ **HỆ THỐNG ĐÃ NHẬN YÊU CẦU BẢO HÀNH!**\n\n🧾 **Mã đơn hàng:** \`#{order_code}\`\n🎁 **Sản phẩm:** {product_name}\n📝 **Lý do bảo hành:** {reason}\n⏰ **Thời gian gửi:** {time}\n\nKỹ thuật viên đang kiểm tra và sẽ phản hồi sớm nhất cho bạn. Vui lòng chờ nhé! ❤️`,
        variables: [
            { code: '{order_code}', label: 'Mã đơn hàng' },
            { code: '{product_name}', label: 'Tên sản phẩm' },
            { code: '{reason}', label: 'Nội dung/Lý do bảo hành' },
            { code: '{time}', label: 'Thời gian gửi' }
        ]
    },
    msg_template_support: {
        key: 'msg_template_support',
        title: 'Trả lời Ticket Hỗ trợ / Bảo hành (Cho Khách)',
        description: 'Gửi cho khách hàng khi Admin phản hồi ticket hỗ trợ hoặc yêu cầu bảo hành từ Web',
        category: 'support',
        defaultTemplate: `💬 **PHẢN HỒI TỪ ADMIN HỖ TRỢ / BẢO HÀNH**\n\n🎫 **Ticket ID:** #{ticket_id}\n🎁 **Sản phẩm:** {product_name}\n👨‍💻 **Nội dung trả lời:**\n{reply_text}\n\n📌 **Trạng thái:** {status}\n\nCảm ơn bạn đã liên hệ với chúng tôi! ❤️`,
        variables: [
            { code: '{ticket_id}', label: 'ID Ticket' },
            { code: '{product_name}', label: 'Tên sản phẩm liên quan' },
            { code: '{reply_text}', label: 'Nội dung phản hồi của Admin' },
            { code: '{status}', label: 'Trạng thái xử lý' }
        ]
    },
    msg_template_chat_user_message: {
        key: 'msg_template_chat_user_message',
        title: 'Thông báo tin nhắn hỗ trợ từ khách (Cho Admin)',
        description: 'Gửi cho Admin khi khách gửi tin nhắn hỗ trợ / chat trực tiếp qua Telegram Bot',
        category: 'support',
        defaultTemplate: `📩 **TIN NHẮN HỖ TRỢ MỚI TỪ KHÁCH HÀNG!**\n\n👤 **Khách hàng:** {customer_name} (@{username})\n🆔 **Telegram ID:** \`{telegram_id}\`\n💬 **Nội dung tin nhắn:**\n\`\`\`\n{message_text}\n\`\`\`\n\n👉 Vui lòng mở trang Live Chat trên Web Admin để phản hồi khách!`,
        variables: [
            { code: '{customer_name}', label: 'Tên khách hàng' },
            { code: '{username}', label: 'Username khách' },
            { code: '{telegram_id}', label: 'Telegram ID khách' },
            { code: '{message_text}', label: 'Nội dung tin nhắn' }
        ]
    },
    msg_template_welcome: {
        key: 'msg_template_welcome',
        title: 'Chào mừng khách hàng mới (Bot Start)',
        description: 'Gửi khi người dùng bấm /start hoặc mở tương tác đầu tiên với Telegram Bot',
        category: 'bot',
        defaultTemplate: `👋 **CHÀO MỪNG {first_name} ĐẾN VỚI HỆ THỐNG BOT!**\n\n🤖 Bot hỗ trợ mua sắm tài khoản, dịch vụ tự động & nạp tiền 24/7.\n👉 Vui lòng bấm vào Menu hoặc dùng các lệnh bên dưới để bắt đầu.`,
        variables: [
            { code: '{first_name}', label: 'Tên khách hàng' },
            { code: '{username}', label: 'Username Telegram' },
            { code: '{telegram_id}', label: 'Telegram ID' }
        ]
    }
};

/**
 * Replace placeholders like {order_code} with dynamic values in template string
 */
export function renderTemplate(templateStr: string, vars: Record<string, string | number>): string {
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
 * Fetch template from DB or fallback to default value
 */
export async function getTemplateFromDb(key: string): Promise<string> {
    const def = DEFAULT_TEMPLATES[key];
    const defaultVal = def ? def.defaultTemplate : '';
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT `value` FROM settings WHERE `key` = ?', [key]);
        if (rows.length > 0 && rows[0].value && rows[0].value.trim() !== '') {
            return rows[0].value;
        }
    } catch (err) {
        console.error(`Error loading template ${key} from DB:`, err);
    }
    return defaultVal;
}
