import { query } from '../database/index.js';

export const DEFAULT_BOT_TEMPLATES = {
    // --- VIETNAMESE (MẶC ĐỊNH) ---
    msg_template_delivery: `**ĐƠN HÀNG #{order_code} ĐÃ ĐƯỢC BÀN GIAO!**\n\n**Sản phẩm:** {product_name}\n**Dữ liệu bàn giao:**\n\`\`\`\n{data}\n\`\`\`\n**Ghi chú:** {note}\n\nCảm ơn bạn đã tin tưởng dịch vụ! Chúc bạn sử dụng vui vẻ.`,
    msg_template_purchase: `**MUA HÀNG THÀNH CÔNG!**\n\n**Mã đơn:** \`#{order_code}\`\n**Sản phẩm:** {product_name}\n**Thanh toán:** {price} đ\n**Tài khoản / Dữ liệu:**\n\`\`\`\n{data}\n\`\`\`\n\nCảm ơn quý khách đã tin tưởng và ủng hộ shop!`,
    msg_template_order_placed: `**ĐƠN HÀNG ĐẶT TRƯỚC ĐÃ ĐƯỢC GHI NHẬN!**\n\n**Mã đơn:** \`#{order_code}\`\n**Sản phẩm:** {product_name}\n**Số tiền:** {price} đ\n**Thông tin đã gửi:**\n\`\`\`\n{input_data}\n\`\`\`\n\nĐơn hàng đang được Admin xử lý. Bạn sẽ nhận được thông báo ngay khi bàn giao!`,
    msg_template_new_order_admin: `**CÓ ĐƠN HÀNG ORDER MỚI CẦN XỬ LÝ!**\n\n**Mã đơn:** \`#{order_code}\`\n**Sản phẩm:** {product_name}\n**Số tiền:** {price} đ\n**Khách hàng:** @{username} (ID: \`{telegram_id}\`)\n**Thông tin từ khách:**\n\`\`\`\n{input_data}\n\`\`\`\n\nVui lòng vào Web Dashboard để xử lý bàn giao cho khách!`,
    msg_template_order_refund: `**ĐƠN HÀNG #{order_code} ĐÃ ĐƯỢC HOÀN TIỀN!**\n\n**Sản phẩm:** {product_name}\n**Số tiền hoàn vào ví:** +{amount} đ\n**Lý do hoàn tiền:** {reason}\n\nSố tiền đã được cộng lại vào số dư ví của bạn. Cảm ơn bạn!`,
    msg_template_deposit: `**YÊU CẦU NẠP TIỀN #{deposit_id} ĐÃ ĐƯỢC DUYỆT!**\n\n**Số tiền nạp:** {amount} đ\n**Khuyến mãi:** +{bonus} đ\n**Tổng thực nhận:** {total} đ\n**Số dư tài khoản hiện tại:** {new_balance} đ\n\nCảm ơn bạn đã nạp tiền vào hệ thống!`,
    msg_template_deposit_reject: `**YÊU CẦU NẠP TIỀN #{deposit_id} ĐÃ BỊ TỪ CHỐI!**\n\n**Lý do:** {reason}\n\nNếu có nhầm lẫn, vui lòng liên hệ Admin để được hỗ trợ kiểm tra lại.`,
    msg_support_received: `**SHOP ĐÃ NHẬN ĐƯỢC TIN NHẮN HỖ TRỢ CỦA BẠN!**\n\n**Khách hàng:** {customer_name}\n**Nội dung:**\n\`\`\`\n{message_text}\n\`\`\`\n**Thời gian:** {time}\n\nAdmin kỹ thuật đã nhận được tin nhắn và sẽ phản hồi trực tiếp cho bạn trong giây lát. Vui lòng chờ nhé!`,
    msg_template_warranty_request: `**HỆ THỐNG ĐÃ NHẬN YÊU CẦU BẢO HÀNH!**\n\n**Mã đơn hàng:** \`#{order_code}\`\n**Sản phẩm:** {product_name}\n**Lý do bảo hành:** {reason}\n**Thời gian gửi:** {time}\n\nKỹ thuật viên đang kiểm tra và sẽ phản hồi sớm nhất cho bạn. Vui lòng chờ nhé!`,
    msg_template_support: `**PHẢN HỒI TỪ ADMIN HỖ TRỢ / BẢO HÀNH**\n\n**Ticket ID:** #{ticket_id}\n**Sản phẩm:** {product_name}\n**Nội dung trả lời:**\n{reply_text}\n\n**Trạng thái:** {status}\n\nCảm ơn bạn đã liên hệ với chúng tôi!`,
    msg_template_chat_user_message: `**TIN NHẮN HỖ TRỢ MỚI TỪ KHÁCH HÀNG!**\n\n**Khách hàng:** {customer_name} (@{username})\n**Telegram ID:** \`{telegram_id}\`\n**Nội dung tin nhắn:**\n\`\`\`\n{message_text}\n\`\`\`\n\nVui lòng mở trang Live Chat trên Web Admin để phản hồi khách!`,
    msg_template_welcome: `**CHÀO MỪNG {first_name} ĐẾN VỚI HỆ THỐNG BOT!**\n\nBot hỗ trợ mua sắm tài khoản, dịch vụ tự động & nạp tiền 24/7.\nVui lòng bấm vào Menu hoặc dùng các lệnh bên dưới để bắt đầu.`,
    template_binance_pay: `{emoji:5201732344993576400} <b>NẠP TIỀN BINANCE PAY (TỰ ĐỘNG)</b>\n\n{emoji:6181477641489488618} <b>ID Khách hàng:</b> <code>{userId}</code>\n{emoji:5204021180310252946} <b>Tỷ giá quy đổi:</b> 1 USDT = {exchangeRate} VNĐ\n{emoji:5202112453894238347} <b>Nạp tối thiểu:</b> {minDeposit} USDT\n\n{emoji:6228570454651572625} <b>THÔNG TIN CHUYỂN TIỀN:</b>\n• Binance Pay ID / UID:\n<code>{payId}</code> <i>(Click để copy)</i>\n• Nội dung ghi chú (Note / Memo):\n<code>{memoCode}</code> <i>(Click để copy)</i>\n\n{emoji:5204082134486117389} <b>LƯU Ý QUAN TRỌNG:</b>\n• Bắt buộc điền đúng Ghi chú (Note) là <code>{memoCode}</code> khi chuyển tiền để hệ thống nhận diện và tự động cộng tiền.\n• Hệ thống quét tự động và cộng tiền vào ví trong vòng 10 - 30 giây sau khi chuyển thành công.`,
    template_bank_deposit: `Đã tạo yêu cầu nạp {amount}.\n\nNgân hàng: **{bankName}**\nSố TK: \`{accountNo}\` (Click để copy)\nNội dung: \`{content}\` (Click để copy)\n\n**LƯU Ý:** Vui lòng nhập đúng nội dung chuyển khoản để được cộng tiền tự động. QR hết hạn sau 5 phút.`,
    template_usdt_deposit: `{emoji:5201732344993576400} <b>NẠP TIỀN USDT TRC20 (TỰ ĐỘNG QUA BINANCE)</b>\n\n{emoji:5204021180310252946} <b>Tỷ giá quy đổi:</b> 1 USDT = {exchangeRate} VNĐ\n{emoji:5202112453894238347} <b>Nạp tối thiểu:</b> 1 USDT\n\n{emoji:6228570454651572625} <b>ĐỊA CHỈ VÍ NHẬN USDT (TRC20):</b>\n<code>{walletAddress}</code> <i>(Click để copy)</i>\n\n🌐 <b>Mạng lưới (Network):</b> <code>TRC20 (TRON)</code>\n\n{emoji:5204082134486117389} <b>HƯỚNG DẪN NẠP TIỀN:</b>\n• Chuyển tiền đúng mạng lưới TRC20 đến địa chỉ ví ở trên.\n• Sau khi chuyển thành công, bạn chỉ cần copy mã <b>TxID (Transaction Hash)</b> gửi vào bot để hệ thống kiểm tra qua Binance và tự động cộng tiền ngay lập tức!`,
    template_wallet_info: `**THÔNG TIN VÍ & SỐ DƯ TÀI KHOẢN**\n\n**Khách hàng:** {customerName}\n**Telegram ID:** \`{telegramId}\`\n**Số dư khả dụng:** **{balance}**\n**Tổng tiền đã nạp:** {totalDeposited}\n**Điểm thưởng (Credit):** {credit}\n\n*Bấm các nút bên dưới để nạp tiền vào ví hoặc xem lịch sử giao dịch:*`,
    template_support_info: `**HỖ TRỢ TRỰC TUYẾN / CHĂM SÓC KHÁCH HÀNG**\n\nBạn vui lòng gửi nội dung cần hỗ trợ hoặc thắc mắc vào đây.\nKỹ thuật viên sẽ đọc tin nhắn và phản hồi trực tiếp cho bạn qua Bot trong giây lát!\n\n*(Gõ \`Hủy\` nếu muốn đóng phiên chat hỗ trợ)*`,
    template_warranty_info: `**TRUNG TÂM BẢO HÀNH ĐƠN HÀNG**\n\n**Chính sách hỗ trợ & bảo hành:**\n• Hỗ trợ 1 đổi 1 hoặc hoàn tiền đối với tài khoản lỗi theo đúng điều khoản.\n• Vui lòng cung cấp **Mã đơn hàng** hoặc nội dung lỗi để được xử lý nhanh nhất.\n\n{orderList}\n\nBấm nút bên dưới để gửi yêu cầu bảo hành cho kỹ thuật viên:`,
    template_api_info: `**THÔNG TIN KẾT NỐI API TỰ ĐỘNG**\n\n**ID Khách hàng:** \`{userId}\`\n**Telegram ID:** \`{telegramId}\`\n\n**API Key của bạn:**\n\`{apiKey}\`\n\n**Số dư API:** **{balance}**\n**Trạng thái:** {statusText}\n\n**Tài liệu API:**\n• Endpoint mua tài khoản tự động:\n\`POST /api/v1/order-edu\`\n• Header xác thực:\n\`x-api-key: {apiKey}\`\n\n*Vui lòng bảo mật API Key, không chia sẻ cho người khác!*`,
    template_checkin_info: `**ĐIỂM DANH NHẬN THƯỞNG HẰNG NGÀY**\n\n**Khách hàng:** {customer_name}\nBạn đã điểm danh thành công hôm nay!\n**Phần thưởng:** +{bonus} đ vào số dư ví.\n\n*Hãy quay lại vào ngày mai để tiếp tục nhận quà nhé!*`,
    template_deposit_history: `**LỊCH SỬ NẠP TIỀN GẦN ĐÂY**\n\n{deposit_list}\n\n*Nếu cần hỗ trợ tra soát giao dịch nạp tiền, vui lòng liên hệ CSKH.*`,

    // --- ENGLISH ---
    msg_template_delivery_en: `**ORDER #{order_code} HAS BEEN DELIVERED!**\n\n**Product:** {product_name}\n**Credentials / Data:**\n\`\`\`\n{data}\n\`\`\`\n**Note:** {note}\n\nThank you for choosing our service!`,
    msg_template_purchase_en: `**PURCHASE SUCCESSFUL!**\n\n**Order ID:** \`#{order_code}\`\n**Product:** {product_name}\n**Paid:** {price} VND\n**Credentials / Data:**\n\`\`\`\n{data}\n\`\`\`\n\nThank you for your order!`,
    msg_template_order_placed_en: `**PRE-ORDER RECORDED!**\n\n**Order ID:** \`#{order_code}\`\n**Product:** {product_name}\n**Price:** {price} VND\n**Submitted info:**\n\`\`\`\n{input_data}\n\`\`\`\n\nYour order is being processed by Admin. You will be notified once ready!`,
    msg_template_order_refund_en: `**ORDER #{order_code} HAS BEEN REFUNDED!**\n\n**Product:** {product_name}\n**Refunded amount:** +{amount} VND\n**Reason:** {reason}\n\nThe funds have been returned to your wallet balance. Thank you!`,
    msg_template_deposit_en: `**DEPOSIT REQUEST #{deposit_id} APPROVED!**\n\n**Deposit Amount:** {amount} VND\n**Bonus:** +{bonus} VND\n**Total Credited:** {total} VND\n**Current Balance:** {new_balance} VND\n\nThank you for topping up!`,
    msg_template_deposit_reject_en: `**DEPOSIT REQUEST #{deposit_id} HAS BEEN REJECTED!**\n\n**Reason:** {reason}\n\nIf you have any questions, please contact Admin for assistance.`,
    msg_support_received_en: `**WE HAVE RECEIVED YOUR SUPPORT MESSAGE!**\n\n**Customer:** {customer_name}\n**Message:**\n\`\`\`\n{message_text}\n\`\`\`\n**Time:** {time}\n\nOur support technician has received your message and will reply shortly. Please stay tuned!`,
    msg_template_welcome_en: `**WELCOME {first_name} TO OUR BOT SERVICE!**\n\n24/7 Automated Shop & Instant Wallet Deposit System.\nUse the menu buttons below to get started!`,
    template_binance_pay_en: `{emoji:5201732344993576400} <b>BINANCE PAY DEPOSIT (AUTOMATIC)</b>\n\n{emoji:6181477641489488618} <b>Customer ID:</b> <code>{userId}</code>\n{emoji:5204021180310252946} <b>Exchange Rate:</b> 1 USDT = {exchangeRate} VND\n{emoji:5202112453894238347} <b>Minimum Deposit:</b> {minDeposit} USDT\n\n{emoji:6228570454651572625} <b>PAYMENT DETAILS:</b>\n• Binance Pay ID / UID:\n<code>{payId}</code> <i>(Click to copy)</i>\n• Note / Memo:\n<code>{memoCode}</code> <i>(Click to copy)</i>\n\n{emoji:5204082134486117389} <b>IMPORTANT NOTE:</b>\n• You MUST enter the Note as <code>{memoCode}</code> when transferring for auto-credit.\n• System automatically scans and credits your wallet within 10 - 30 seconds.`,
    template_bank_deposit_en: `Deposit request created for {amount}.\n\nBank: **{bankName}**\nAccount No: \`{accountNo}\` (Click to copy)\nContent / Memo: \`{content}\` (Click to copy)\n\n**NOTE:** Please enter the exact transfer content for auto-credit. QR expires in 5 minutes.`,
    template_usdt_deposit_en: `{emoji:5201732344993576400} <b>USDT TRC20 DEPOSIT (AUTO BINANCE CHECK)</b>\n\n{emoji:5204021180310252946} <b>Exchange Rate:</b> 1 USDT = {exchangeRate} VND\n{emoji:5202112453894238347} <b>Minimum Deposit:</b> 1 USDT\n\n{emoji:6228570454651572625} <b>USDT TRC20 WALLET ADDRESS:</b>\n<code>{walletAddress}</code> <i>(Click to copy)</i>\n\n🌐 <b>Network:</b> <code>TRC20 (TRON)</code>\n\n{emoji:5204082134486117389} <b>INSTRUCTIONS:</b>\n• Transfer USDT TRC20 to the address above.\n• After transfer, send your <b>TxID (Transaction Hash)</b> to the bot for instant automatic verification via Binance!`,
    template_wallet_info_en: `**WALLET & ACCOUNT BALANCE**\n\n**Customer:** {customerName}\n**Telegram ID:** \`{telegramId}\`\n**Available Balance:** **{balance}**\n**Total Deposited:** {totalDeposited}\n**Reward Credit:** {credit}\n\n*Click buttons below to top up or view order history:*`,
    template_support_info_en: `**LIVE CUSTOMER SUPPORT**\n\nPlease type and send your support request or question here.\nA support technician will read and reply to you via Bot shortly!\n\n*(Type \`Cancel\` to exit support mode)*`,
    template_warranty_info_en: `**WARRANTY & ORDER SUPPORT**\n\n**Policy:**\n• 1-to-1 exchange or refund for defective accounts according to policy terms.\n• Please provide your **Order Code** for fastest resolution.\n\n{orderList}\n\nClick below to submit a warranty request:`,
    template_api_info_en: `**API INTEGRATION INFORMATION**\n\n**Customer ID:** \`{userId}\`\n**Telegram ID:** \`{telegramId}\`\n\n**Your API Key:**\n\`{apiKey}\`\n\n**API Balance:** **{balance}**\n**Status:** {statusText}\n\n**API Documentation:**\n• Endpoint:\n\`POST /api/v1/order-edu\`\n• Header:\n\`x-api-key: {apiKey}\`\n\n*Keep your API key private!*`,
    template_checkin_info_en: `**DAILY REWARD CHECK-IN**\n\n**Customer:** {customer_name}\nDaily check-in successful!\n**Reward:** +{bonus} VND credited to your wallet.\n\n*Come back tomorrow for more rewards!*`,
    template_deposit_history_en: `**RECENT DEPOSIT HISTORY**\n\n{deposit_list}\n\n*Contact customer support if you need transaction assistance.*`,

    // --- CHINESE (中文) ---
    msg_template_delivery_zh: `**订单 #{order_code} 已完成交付！**\n\n**商品名称:** {product_name}\n**交付数据:**\n\`\`\`\n{data}\n\`\`\`\n**备注:** {note}\n\n感谢您对我们服务的信任！祝您使用愉快。`,
    msg_template_purchase_zh: `**购买成功！**\n\n**订单编号:** \`#{order_code}\`\n**商品:** {product_name}\n**实付金额:** {price} VND\n**卡密/数据:**\n\`\`\`\n{data}\n\`\`\`\n\n感谢您的光临与支持！`,
    msg_template_order_placed_zh: `**预定订单已记录！**\n\n**订单编号:** \`#{order_code}\`\n**商品:** {product_name}\n**金额:** {price} VND\n**提交信息:**\n\`\`\`\n{input_data}\n\`\`\`\n\n管理员正在处理您的订单，交付后将立即通知您！`,
    msg_template_order_refund_zh: `**订单 #{order_code} 已退款！**\n\n**商品:** {product_name}\n**退款金额:** +{amount} VND\n**退款原因:** {reason}\n\n款项已退回至您的钱包余额，谢谢！`,
    msg_template_deposit_zh: `**充值订单 #{deposit_id} 已审核通过！**\n\n**充值金额:** {amount} VND\n**优惠赠送:** +{bonus} VND\n**实际到账:** {total} VND\n**当前账户余额:** {new_balance} VND\n\n感谢您的充值！`,
    msg_template_deposit_reject_zh: `**充值订单 #{deposit_id} 已被拒绝！**\n\n**原因:** {reason}\n\n如有疑问，请联系管理员协助核查。`,
    msg_support_received_zh: `**我们已收到您的客服咨询！**\n\n**客户:** {customer_name}\n**内容:**\n\`\`\`\n{message_text}\n\`\`\`\n**时间:** {time}\n\n客服技术人员已收到消息，稍后将直接回复您，请耐心等待！`,
    msg_template_welcome_zh: `**欢迎 {first_name} 使用我们的机器人服务！**\n\n24/7 自动发卡商城与自动充值系统。\n请点击下方菜单按钮开始使用！`,
    template_binance_pay_zh: `{emoji:5201732344993576400} <b>BINANCE PAY 自动充值</b>\n\n{emoji:6181477641489488618} <b>客户 ID:</b> <code>{userId}</code>\n{emoji:5204021180310252946} <b>汇率:</b> 1 USDT = {exchangeRate} VND\n{emoji:5202112453894238347} <b>最低充值:</b> {minDeposit} USDT\n\n{emoji:6228570454651572625} <b>付款信息:</b>\n• Binance Pay ID / UID:\n<code>{payId}</code> <i>(点击复制)</i>\n• 备注 (Note / Memo):\n<code>{memoCode}</code> <i>(点击复制)</i>\n\n{emoji:5204082134486117389} <b>重要提示:</b>\n• 转账时必须填写备注 <code>{memoCode}</code>，系统才能自动入账。\n• 系统将在转账成功后 10 - 30 秒内自动充值至您的钱包。`,
    template_bank_deposit_zh: `已创建充值订单 {amount}。\n\n银行: **{bankName}**\n账号: \`{accountNo}\` (点击复制)\n附言内容: \`{content}\` (点击复制)\n\n**注意:** 请准确填写转账附言以自动入账。二维码将在5分钟后失效。`,
    template_usdt_deposit_zh: `{emoji:5201732344993576400} <b>USDT TRC20 充值（Binance 自动验证）</b>\n\n{emoji:5204021180310252946} <b>汇率:</b> 1 USDT = {exchangeRate} VND\n{emoji:5202112453894238347} <b>最低充值:</b> 1 USDT\n\n{emoji:6228570454651572625} <b>USDT TRC20 收款地址:</b>\n<code>{walletAddress}</code> <i>(点击复制)</i>\n\n🌐 <b>网络:</b> <code>TRC20 (TRON)</code>\n\n{emoji:5204082134486117389} <b>充值说明:</b>\n• 请使用 TRC20 网络向上述地址转账。\n• 转账成功后，将 <b>TxID（交易哈希）</b> 发送给机器人，系统将通过 Binance 立即自动入账！`,
    template_wallet_info_zh: `**钱包信息与账户余额**\n\n**客户:** {customerName}\n**Telegram ID:** \`{telegramId}\`\n**可用余额:** **{balance}**\n**累计充值:** {totalDeposited}\n**奖励积分:** {credit}\n\n*点击下方按钮进行充值或查看购买历史:*`,
    template_support_info_zh: `**在线客户支持**\n\n请在此输入并发送您的咨询或问题。\n客服人员将通过机器人快速回复您！\n\n*(发送 \`取消\` 可退出客服模式)*`,
    template_warranty_info_zh: `**订单售后与保修中心**\n\n**售后政策:**\n• 按照政策对异常账号提供 1 对 1 更换或退款。\n• 请提供 **订单编号** 以便最快处理。\n\n{orderList}\n\n点击下方提交保修申请:`,
    template_api_info_zh: `**API 自动化对接信息**\n\n**客户 ID:** \`{userId}\`\n**Telegram ID:** \`{telegramId}\`\n\n**您的 API Key:**\n\`{apiKey}\`\n\n**API 余额:** **{balance}**\n**状态:** {statusText}\n\n**API 文档:**\n• 接口地址:\n\`POST /api/v1/order-edu\`\n• 请求头:\n\`x-api-key: {apiKey}\`\n\n*请妥善保管您的 API Key，切勿泄露给他人！*`,
    template_checkin_info_zh: `**每日签到领奖励**\n\n**客户:** {customer_name}\n今日签到成功！\n**获得奖励:** +{bonus} VND 钱包余额。\n\n*明天记得继续来签到领奖哦！*`,
    template_deposit_history_zh: `**近期充值记录**\n\n{deposit_list}\n\n*如需协助核查充值，请联系在线客服。*`,
    template_main_keyboard_caption: '👇 <b>BÀN PHÍM MENU CHÍNH</b>',
    template_main_keyboard_caption_en: '👇 <b>MAIN MENU KEYBOARD</b>',
    template_main_keyboard_caption_zh: '👇 <b>主菜单键盘</b>',

    template_new_product_notify: `🎉 <b>SẢN PHẨM MỚI VỪA LÊN KỆ!</b>\n\n🛍️ <b>Sản phẩm:</b> <b>{name}</b>\n💰 <b>Giá bán:</b> <b>{price}</b>\n\n📝 <b>Mô tả:</b>\n{description}\n\n👉 <i>Bấm nút bên dưới để xem chi tiết và đặt mua ngay!</i>`,
    template_new_product_notify_en: `🎉 <b>NEW PRODUCT ARRIVED!</b>\n\n🛍️ <b>Product:</b> <b>{name}</b>\n💰 <b>Price:</b> <b>{price}</b>\n\n📝 <b>Description:</b>\n{description}\n\n👉 <i>Click the button below to view details and buy now!</i>`,
    template_new_product_notify_zh: `🎉 <b>新品上架通知！</b>\n\n🛍️ <b>商品:</b> <b>{name}</b>\n💰 <b>价格:</b> <b>{price}</b>\n\n📝 <b>描述:</b>\n{description}\n\n👉 <i>点击下方按钮查看详情并立即购买！</i>`,

    template_restock_notify: `🔥 <b>VỪA CẬP NHẬT THÊM HÀNG / BỔ SUNG KHO!</b>\n\n🛍️ <b>Sản phẩm:</b> <b>{name}</b>\n📦 <b>Vừa nhập thêm:</b> <b>+{quantity} tài khoản</b>\n📊 <b>Hiện có trong kho:</b> <b>{stock} tài khoản</b>\n💰 <b>Giá bán:</b> <b>{price}</b>\n\n⚡ <i>Kho đã được bổ sung đầy đủ, hãy bấm nút bên dưới để sở hữu ngay!</i>`,
    template_restock_notify_en: `🔥 <b>STOCK RESTOCKED & READY!</b>\n\n🛍️ <b>Product:</b> <b>{name}</b>\n📦 <b>Restocked:</b> <b>+{quantity} accounts</b>\n📊 <b>Total Stock:</b> <b>{stock} accounts</b>\n💰 <b>Price:</b> <b>{price}</b>\n\n⚡ <i>Stock replenished, click below to buy now!</i>`,
    template_restock_notify_zh: `🔥 <b>商品补货已入库！</b>\n\n🛍️ <b>商品:</b> <b>{name}</b>\n📦 <b>新入库:</b> <b>+{quantity} 个账号</b>\n📊 <b>当前总库存:</b> <b>{stock} 个</b>\n💰 <b>价格:</b> <b>{price}</b>\n\n⚡ <i>库存已补充充足，点击下方按钮立即选购！</i>`,

    btn_view_and_buy: '🛍️ Xem & Mua sản phẩm ngay',
    btn_view_and_buy_en: '🛍️ View & Buy Now',
    btn_view_and_buy_zh: '🛍️ 查看并立即购买',

    // Default Main Keyboard Buttons Config (Multilingual without icons)
    bot_main_keyboard_config: JSON.stringify([
        { id: 'btn_products', text: 'Sản phẩm', text_vi: 'Sản phẩm', text_en: 'Products', text_zh: '产品', action: 'products', row: 1, is_active: true },
        { id: 'btn_support', text: 'Hỗ trợ', text_vi: 'Hỗ trợ', text_en: 'Support', text_zh: '客服支持', action: 'support', row: 1, is_active: true },
        { id: 'btn_wallet', text: 'Ví', text_vi: 'Ví', text_en: 'Wallet', text_zh: '钱包', action: 'wallet', row: 2, is_active: true },
        { id: 'btn_api', text: 'API', text_vi: 'API', text_en: 'API', text_zh: 'API', action: 'api', row: 2, is_active: true },
        { id: 'btn_warranty', text: 'Bảo hành', text_vi: 'Bảo hành', text_en: 'Warranty', text_zh: '售后保修', action: 'warranty', row: 3, is_active: true },
        { id: 'btn_checkin', text: 'Điểm danh', text_vi: 'Điểm danh', text_en: 'Check-in', text_zh: '每日签到', action: 'checkin', row: 3, is_active: false },
        { id: 'btn_lang', text: 'Ngôn ngữ', text_vi: 'Ngôn ngữ', text_en: 'Language', text_zh: '语言切换', action: 'lang', row: 3, is_active: false }
    ])
};

// Cache for templates
const templateCache = new Map();
let lastTemplateFetch = 0;

/**
 * Helper render variables into template string
 */
export function renderBotTemplate(templateStr, vars = {}) {
    let result = templateStr || '';
    for (const [key, val] of Object.entries(vars)) {
        const pattern = new RegExp(`\\{${key}\\}`, 'g');
        result = result.replace(pattern, String(val ?? ''));
    }
    // Tự động chuyển đổi các cú pháp {emoji:5375135722514685501} hoặc {5375135722514685501} thành thẻ <tg-emoji>
    result = result.replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '<tg-emoji emoji-id="$1">⭐</tg-emoji>');
    return result;
}

/**
 * Get active template from DB or default with cache and language support
 */
export async function getBotTemplate(key, lang = 'vi') {
    const langSuffix = lang === 'en' ? '_en' : (lang === 'zh' ? '_zh' : '');
    const localizedKey = langSuffix ? `${key}${langSuffix}` : key;
    const cacheKey = `${key}_${lang || 'vi'}`;

    const now = Date.now();
    
    // Check local cache (valid for 10 seconds)
    if (templateCache.has(cacheKey) && (now - lastTemplateFetch < 10000)) {
        return templateCache.get(cacheKey);
    }

    try {
        // Query both localized key and fallback key in 1 query
        const queryKeys = langSuffix ? [localizedKey, key] : [key];
        const rows = await query(
            `SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (${queryKeys.map(() => '?').join(',')})`,
            queryKeys
        );

        if (rows && rows.length > 0) {
            const map = {};
            rows.forEach(r => { map[r.key] = r.value; });

            if (langSuffix && map[localizedKey] && map[localizedKey].trim() !== '') {
                templateCache.set(cacheKey, map[localizedKey]);
                return map[localizedKey];
            }

            if (map[key] && map[key].trim() !== '') {
                // If localized not found in DB, check default localized template first
                if (langSuffix && DEFAULT_BOT_TEMPLATES[localizedKey]) {
                    templateCache.set(cacheKey, DEFAULT_BOT_TEMPLATES[localizedKey]);
                    return DEFAULT_BOT_TEMPLATES[localizedKey];
                }
                templateCache.set(cacheKey, map[key]);
                return map[key];
            }
        }
    } catch (err) {
        console.error(`Error loading template ${localizedKey} from DB:`, err.message);
    }
    
    const fallbackVal = DEFAULT_BOT_TEMPLATES[localizedKey] || DEFAULT_BOT_TEMPLATES[key] || '';
    templateCache.set(cacheKey, fallbackVal);
    return fallbackVal;
}

/**
 * Clear template cache
 */
export function clearTemplateCache() {
    templateCache.clear();
    lastTemplateFetch = 0;
}

