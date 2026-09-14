import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export interface MainKeyboardButton {
  id: string;
  text: string;
  text_vi?: string;
  text_en?: string;
  text_zh?: string;
  action: 'products' | 'support' | 'wallet' | 'deposit' | 'api' | 'warranty' | 'checkin' | 'lang' | 'history' | 'start' | 'custom_text';
  custom_text?: string;
  custom_text_vi?: string;
  custom_text_en?: string;
  custom_text_zh?: string;
  row: number;
  is_active: boolean;
}

export interface BotMenuInlineButton {
  id: string;
  text: string;
  text_vi?: string;
  text_en?: string;
  text_zh?: string;
  type: 'callback' | 'url';
  callback_data?: string;
  url?: string;
  row: number;
  is_active: boolean;
}

export const DEFAULT_WALLET_BUTTONS: BotMenuInlineButton[] = [
  { id: 'btn_wal_deposit', text: 'Nạp tiền vào ví', text_vi: 'Nạp tiền vào ví', text_en: 'Deposit Funds', text_zh: '充值到钱包', type: 'callback', callback_data: 'start_deposit', row: 1, is_active: true },
  { id: 'btn_wal_history', text: 'Lịch sử nạp tiền', text_vi: 'Lịch sử nạp tiền', text_en: 'Deposit History', text_zh: '充值记录', type: 'callback', callback_data: 'deposit_history', row: 1, is_active: true },
  { id: 'btn_wal_products', text: 'Danh mục sản phẩm', text_vi: 'Danh mục sản phẩm', text_en: 'View Products', text_zh: '查看商品分类', type: 'callback', callback_data: 'list_categories', row: 2, is_active: true }
];

export const DEFAULT_DEPOSIT_BUTTONS: BotMenuInlineButton[] = [
  { id: 'btn_dep_bank', text: 'Ngân hàng (Bank)', text_vi: 'Ngân hàng (Bank)', text_en: 'Bank Transfer', text_zh: '银行转账', type: 'callback', callback_data: 'deposit_select_bank', row: 1, is_active: true },
  { id: 'btn_dep_binance', text: 'Binance Pay (Tự động)', text_vi: 'Binance Pay (Tự động)', text_en: 'Binance Pay (Auto)', text_zh: '币安支付 (自动)', type: 'callback', callback_data: 'deposit_select_binance', row: 2, is_active: true },
  { id: 'btn_dep_usdt', text: 'USDT TRC20', text_vi: 'USDT TRC20', text_en: 'USDT TRC20', text_zh: 'USDT TRC20', type: 'callback', callback_data: 'deposit_select_usdt', row: 3, is_active: true }
];

export const DEFAULT_KEYBOARD_BUTTONS: MainKeyboardButton[] = [
  { id: 'btn_products', text: 'Sản phẩm', text_vi: 'Sản phẩm', text_en: 'Products', text_zh: '产品', action: 'products', row: 1, is_active: true },
  { id: 'btn_support', text: 'Hỗ trợ', text_vi: 'Hỗ trợ', text_en: 'Support', text_zh: '客服支持', action: 'support', row: 1, is_active: true },
  { id: 'btn_wallet', text: 'Ví', text_vi: 'Ví', text_en: 'Wallet', text_zh: '钱包', action: 'wallet', row: 2, is_active: true },
  { id: 'btn_api', text: 'API', text_vi: 'API', text_en: 'API', text_zh: 'API', action: 'api', row: 2, is_active: true },
  { id: 'btn_warranty', text: 'Bảo hành', text_vi: 'Bảo hành', text_en: 'Warranty', text_zh: '售后保修', action: 'warranty', row: 3, is_active: true },
  { id: 'btn_checkin', text: 'Điểm danh', text_vi: 'Điểm danh', text_en: 'Check-in', text_zh: '每日签到', action: 'checkin', row: 3, is_active: false },
  { id: 'btn_lang', text: 'Ngôn ngữ', text_vi: 'Ngôn ngữ', text_en: 'Language', text_zh: '语言切换', action: 'lang', row: 3, is_active: false }
];

export const DEFAULT_TEMPLATES: Record<string, { label: string; group: string; default_val: string; default_val_en?: string; default_val_zh?: string; description: string; vars: string[] }> = {
  template_main_keyboard_caption: {
    label: 'Tiêu Đề Kèm Bàn Phím Menu Chính',
    group: 'service',
    description: 'Lời nhắn gửi kèm bàn phím bấm cố định bên dưới (Reply Keyboard) khi khách xem Menu /start hoặc chuyển đổi ngôn ngữ.',
    vars: ['{name}', '{username}', '{id}', '{shop_name}'],
    default_val: '👇 <b>BÀN PHÍM MENU CHÍNH</b>',
    default_val_en: '👇 <b>MAIN MENU KEYBOARD</b>',
    default_val_zh: '👇 <b>主菜单键盘</b>'
  },
  template_binance_pay: {
    label: 'Nạp Tiền Binance Pay (Tự Động)',
    group: 'deposit',
    description: 'Nội dung hướng dẫn chuyển khoản Binance Pay, hiển thị UID, ghi chú (Memo), tỷ giá và các animated emoji.',
    vars: ['{userId}', '{payId}', '{memoCode}', '{exchangeRate}', '{minDeposit}', '{emoji:5201732344993576400}'],
    default_val: `{emoji:5201732344993576400} <b>NẠP TIỀN BINANCE PAY (TỰ ĐỘNG)</b>\n\n{emoji:6181477641489488618} <b>ID Khách hàng:</b> <code>{userId}</code>\n{emoji:5204021180310252946} <b>Tỷ giá quy đổi:</b> 1 USDT = {exchangeRate} VNĐ\n{emoji:5202112453894238347} <b>Nạp tối thiểu:</b> {minDeposit} USDT\n\n{emoji:6228570454651572625} <b>THÔNG TIN CHUYỂN TIỀN:</b>\n• Binance Pay ID / UID:\n<code>{payId}</code> <i>(Click để copy)</i>\n• Nội dung ghi chú (Note / Memo):\n<code>{memoCode}</code> <i>(Click để copy)</i>\n\n{emoji:5204082134486117389} <b>LƯU Ý QUAN TRỌNG:</b>\n• Bắt buộc điền đúng Ghi chú (Note) là <code>{memoCode}</code> khi chuyển tiền để hệ thống nhận diện và tự động cộng tiền.\n• Hệ thống quét tự động và cộng tiền vào ví trong vòng 10 - 30 giây sau khi chuyển thành công.`,
    default_val_en: `{emoji:5201732344993576400} <b>BINANCE PAY DEPOSIT (AUTOMATIC)</b>\n\n{emoji:6181477641489488618} <b>Customer ID:</b> <code>{userId}</code>\n{emoji:5204021180310252946} <b>Exchange Rate:</b> 1 USDT = {exchangeRate} VND\n{emoji:5202112453894238347} <b>Minimum Deposit:</b> {minDeposit} USDT\n\n{emoji:6228570454651572625} <b>PAYMENT DETAILS:</b>\n• Binance Pay ID / UID:\n<code>{payId}</code> <i>(Click to copy)</i>\n• Note / Memo:\n<code>{memoCode}</code> <i>(Click to copy)</i>\n\n{emoji:5204082134486117389} <b>IMPORTANT NOTE:</b>\n• You MUST enter the Note as <code>{memoCode}</code> when transferring for auto-credit.\n• System automatically scans and credits your wallet within 10 - 30 seconds.`,
    default_val_zh: `{emoji:5201732344993576400} <b>BINANCE PAY 自动充值</b>\n\n{emoji:6181477641489488618} <b>客户 ID:</b> <code>{userId}</code>\n{emoji:5204021180310252946} <b>汇率:</b> 1 USDT = {exchangeRate} VND\n{emoji:5202112453894238347} <b>最低充值:</b> {minDeposit} USDT\n\n{emoji:6228570454651572625} <b>付款信息:</b>\n• Binance Pay ID / UID:\n<code>{payId}</code> <i>(点击复制)</i>\n• 备注 (Note / Memo):\n<code>{memoCode}</code> <i>(点击复制)</i>\n\n{emoji:5204082134486117389} <b>重要提示:</b>\n• 转账时必须填写备注 <code>{memoCode}</code>，系统才能自动入账。\n• 系统将在转账成功后 10 - 30 秒内自动充值至您的钱包。`
  },
  template_bank_deposit: {
    label: 'Nạp Tiền Ngân Hàng (VietQR)',
    group: 'deposit',
    description: 'Lời nhắn gửi kèm ảnh mã QR ngân hàng tự động.',
    vars: ['{amount}', '{bankName}', '{accountNo}', '{content}'],
    default_val: `Đã tạo yêu cầu nạp {amount}.\n\nNgân hàng: **{bankName}**\nSố TK: \`{accountNo}\` (Click để copy)\nNội dung: \`{content}\` (Click để copy)\n\n**LƯU Ý:** Vui lòng nhập đúng nội dung chuyển khoản để được cộng tiền tự động. QR hết hạn sau 5 phút.`,
    default_val_en: `Deposit request created for {amount}.\n\nBank: **{bankName}**\nAccount No: \`{accountNo}\` (Click to copy)\nContent / Memo: \`{content}\` (Click to copy)\n\n**NOTE:** Please enter the exact transfer content for auto-credit. QR expires in 5 minutes.`,
    default_val_zh: `已创建充值订单 {amount}。\n\n银行: **{bankName}**\n账号: \`{accountNo}\` (点击复制)\n附言内容: \`{content}\` (点击复制)\n\n**注意:** 请准确填写转账附言以自动入账。二维码将在5分钟后失效。`
  },
  template_usdt_deposit: {
    label: 'Nạp Tiền USDT TRC20 (Binance Check)',
    group: 'deposit',
    description: 'Nội dung hướng dẫn nạp USDT TRC20, hỗ trợ kiểm tra on-chain tự động qua Binance API.',
    vars: ['{walletAddress}', '{exchangeRate}', '{emoji:5201732344993576400}'],
    default_val: `{emoji:5201732344993576400} <b>NẠP TIỀN USDT TRC20 (TỰ ĐỘNG QUA BINANCE)</b>\n\n{emoji:5204021180310252946} <b>Tỷ giá quy đổi:</b> 1 USDT = {exchangeRate} VNĐ\n{emoji:5202112453894238347} <b>Nạp tối thiểu:</b> 1 USDT\n\n{emoji:6228570454651572625} <b>ĐỊA CHỈ VÍ NHẬN USDT (TRC20):</b>\n<code>{walletAddress}</code> <i>(Click để copy)</i>\n\n🌐 <b>Mạng lưới (Network):</b> <code>TRC20 (TRON)</code>\n\n{emoji:5204082134486117389} <b>HƯỚNG DẪN NẠP TIỀN:</b>\n• Chuyển tiền đúng mạng lưới TRC20 đến địa chỉ ví ở trên.\n• Sau khi chuyển thành công, bạn chỉ cần copy mã <b>TxID (Transaction Hash)</b> gửi vào bot để hệ thống kiểm tra qua Binance và tự động cộng tiền ngay lập tức!`,
    default_val_en: `{emoji:5201732344993576400} <b>USDT TRC20 DEPOSIT (AUTO BINANCE CHECK)</b>\n\n{emoji:5204021180310252946} <b>Exchange Rate:</b> 1 USDT = {exchangeRate} VND\n{emoji:5202112453894238347} <b>Minimum Deposit:</b> 1 USDT\n\n{emoji:6228570454651572625} <b>USDT TRC20 WALLET ADDRESS:</b>\n<code>{walletAddress}</code> <i>(Click to copy)</i>\n\n🌐 <b>Network:</b> <code>TRC20 (TRON)</code>\n\n{emoji:5204082134486117389} <b>INSTRUCTIONS:</b>\n• Transfer USDT TRC20 to the address above.\n• After transfer, send your <b>TxID (Transaction Hash)</b> to the bot for instant automatic verification via Binance!`,
    default_val_zh: `{emoji:5201732344993576400} <b>USDT TRC20 充值（Binance 自动验证）</b>\n\n{emoji:5204021180310252946} <b>汇率:</b> 1 USDT = {exchangeRate} VND\n{emoji:5202112453894238347} <b>最低充值:</b> 1 USDT\n\n{emoji:6228570454651572625} <b>USDT TRC20 收款地址:</b>\n<code>{walletAddress}</code> <i>(点击复制)</i>\n\n🌐 <b>网络:</b> <code>TRC20 (TRON)</code>\n\n{emoji:5204082134486117389} <b>充值说明:</b>\n• 请使用 TRC20 网络向上述地址转账。\n• 转账成功后，将 <b>TxID（交易哈希）</b> 发送给机器人，系统将通过 Binance 立即自动入账！`
  },
  template_wallet_info: {
    label: 'Thông Tin Ví & Số Dư',
    group: 'user',
    description: 'Hiển thị khi khách bấm nút Ví /wallet.',
    vars: ['{customerName}', '{telegramId}', '{balance}', '{totalDeposited}', '{credit}'],
    default_val: `**THÔNG TIN VÍ & SỐ DƯ TÀI KHOẢN**\n\n**Khách hàng:** {customerName}\n**Telegram ID:** \`{telegramId}\`\n**Số dư khả dụng:** **{balance}**\n**Tổng tiền đã nạp:** {totalDeposited}\n**Điểm thưởng (Credit):** {credit}\n\n*Bấm các nút bên dưới để nạp tiền vào ví hoặc xem lịch sử giao dịch:*`,
    default_val_en: `**WALLET & ACCOUNT BALANCE**\n\n**Customer:** {customerName}\n**Telegram ID:** \`{telegramId}\`\n**Available Balance:** **{balance}**\n**Total Deposited:** {totalDeposited}\n**Reward Credit:** {credit}\n\n*Click buttons below to top up or view order history:*`,
    default_val_zh: `**钱包信息与账户余额**\n\n**客户:** {customerName}\n**Telegram ID:** \`{telegramId}\`\n**可用余额:** **{balance}**\n**累计充值:** {totalDeposited}\n**奖励积分:** {credit}\n\n*点击下方按钮进行充值或查看购买历史:*`
  },
  template_support_info: {
    label: 'Menu Hỗ Trợ Trực Tuyến',
    group: 'service',
    description: 'Hiển thị hướng dẫn khi khách mở phiên chat CSKH.',
    vars: [],
    default_val: `**HỖ TRỢ TRỰC TUYẾN / CHĂM SÓC KHÁCH HÀNG**\n\nBạn vui lòng gửi nội dung cần hỗ trợ hoặc thắc mắc vào đây.\nKỹ thuật viên sẽ đọc tin nhắn và phản hồi trực tiếp cho bạn qua Bot trong giây lát!\n\n*(Gõ \`Hủy\` nếu muốn đóng phiên chat hỗ trợ)*`,
    default_val_en: `**LIVE CUSTOMER SUPPORT**\n\nPlease type and send your support request or question here.\nA support technician will read and reply to you via Bot shortly!\n\n*(Type \`Cancel\` to exit support mode)*`,
    default_val_zh: `**在线客户支持**\n\n请在此输入并发送您的咨询或问题。\n客服人员将通过机器人快速回复您！\n\n*(发送 \`取消\` 可退出客服模式)*`
  },
  template_warranty_info: {
    label: 'Trung Tâm Bảo Hành',
    group: 'service',
    description: 'Hiển thị chính sách bảo hành & danh sách đơn gần nhất.',
    vars: ['{orderList}'],
    default_val: `**TRUNG TÂM BẢO HÀNH ĐƠN HÀNG**\n\n**Chính sách hỗ trợ & bảo hành:**\n• Hỗ trợ 1 đổi 1 hoặc hoàn tiền đối với tài khoản lỗi theo đúng điều khoản.\n• Vui lòng cung cấp **Mã đơn hàng** hoặc nội dung lỗi để được xử lý nhanh nhất.\n\n{orderList}\n\nBấm nút bên dưới để gửi yêu cầu bảo hành cho kỹ thuật viên:`,
    default_val_en: `**WARRANTY & ORDER SUPPORT**\n\n**Policy:**\n• 1-to-1 exchange or refund for defective accounts according to policy terms.\n• Please provide your **Order Code** for fastest resolution.\n\n{orderList}\n\nClick below to submit a warranty request:`,
    default_val_zh: `**订单售后与保修中心**\n\n**售后政策:**\n• 按照政策对异常账号提供 1 对 1 更换或退款。\n• 请提供 **订单编号** 以便最快处理。\n\n{orderList}\n\n点击下方提交保修申请:`
  },
  template_api_info: {
    label: 'Thông Tin Kết Nối API',
    group: 'service',
    description: 'Hiển thị API key và tài liệu kết nối.',
    vars: ['{userId}', '{telegramId}', '{apiKey}', '{balance}', '{statusText}'],
    default_val: `**THÔNG TIN KẾT NỐI API TỰ ĐỘNG**\n\n**ID Khách hàng:** \`{userId}\`\n**Telegram ID:** \`{telegramId}\`\n\n**API Key của bạn:**\n\`{apiKey}\`\n\n**Số dư API:** **{balance}**\n**Trạng thái:** {statusText}\n\n**Tài liệu API:**\n• Endpoint mua tài khoản tự động:\n\`POST /api/v1/order-edu\`\n• Header xác thực:\n\`x-api-key: {apiKey}\`\n\n*Vui lòng bảo mật API Key, không chia sẻ cho người khác!*`,
    default_val_en: `**API INTEGRATION INFORMATION**\n\n**Customer ID:** \`{userId}\`\n**Telegram ID:** \`{telegramId}\`\n\n**Your API Key:**\n\`{apiKey}\`\n\n**API Balance:** **{balance}**\n**Status:** {statusText}\n\n**API Documentation:**\n• Endpoint:\n\`POST /api/v1/order-edu\`\n• Header:\n\`x-api-key: {apiKey}\`\n\n*Keep your API key private!*`,
    default_val_zh: `**API 自动化对接信息**\n\n**客户 ID:** \`{userId}\`\n**Telegram ID:** \`{telegramId}\`\n\n**您的 API Key:**\n\`{apiKey}\`\n\n**API 余额:** **{balance}**\n**状态:** {statusText}\n\n**API 文档:**\n• 接口地址:\n\`POST /api/v1/order-edu\`\n• 请求头:\n\`x-api-key: {apiKey}\`\n\n*请妥善保管您的 API Key，切勿泄露给他人！*`
  },
  msg_template_purchase: {
    label: 'Bàn Giao Đơn Hàng Tự Động',
    group: 'orders',
    description: 'Gửi cho khách ngay khi mua tài khoản có sẵn trong kho.',
    vars: ['{order_code}', '{product_name}', '{price}', '{data}'],
    default_val: `**MUA HÀNG THÀNH CÔNG!**\n\n**Mã đơn:** \`#{order_code}\`\n**Sản phẩm:** {product_name}\n**Thanh toán:** {price} đ\n**Tài khoản / Dữ liệu:**\n\`\`\`\n{data}\n\`\`\`\n\nCảm ơn quý khách đã tin tưởng và ủng hộ shop!`,
    default_val_en: `**PURCHASE SUCCESSFUL!**\n\n**Order ID:** \`#{order_code}\`\n**Product:** {product_name}\n**Paid:** {price} VND\n**Credentials / Data:**\n\`\`\`\n{data}\n\`\`\`\n\nThank you for your order!`,
    default_val_zh: `**购买成功！**\n\n**订单编号:** \`#{order_code}\`\n**商品:** {product_name}\n**实付金额:** {price} VND\n**卡密/数据:**\n\`\`\`\n{data}\n\`\`\`\n\n感谢您的光临与支持！`
  },
  msg_template_delivery: {
    label: 'Bàn Giao Đơn Hàng Đặt Trước (Manual Order)',
    group: 'orders',
    description: 'Gửi cho khách khi Admin xử lý xong đơn đặt trước.',
    vars: ['{order_code}', '{product_name}', '{data}', '{note}'],
    default_val: `**ĐƠN HÀNG #{order_code} ĐÃ ĐƯỢC BÀN GIAO!**\n\n**Sản phẩm:** {product_name}\n**Dữ liệu bàn giao:**\n\`\`\`\n{data}\n\`\`\`\n**Ghi chú:** {note}\n\nCảm ơn bạn đã tin tưởng dịch vụ! Chúc bạn sử dụng vui vẻ.`,
    default_val_en: `**ORDER #{order_code} HAS BEEN DELIVERED!**\n\n**Product:** {product_name}\n**Credentials / Data:**\n\`\`\`\n{data}\n\`\`\`\n**Note:** {note}\n\nThank you for choosing our service!`,
    default_val_zh: `**订单 #{order_code} 已完成交付！**\n\n**商品名称:** {product_name}\n**交付数据:**\n\`\`\`\n{data}\n\`\`\`\n**备注:** {note}\n\n感谢您对我们服务的信任！祝您使用愉快。`
  },
  msg_template_order_placed: {
    label: 'Xác Nhận Đặt Trước Thành Công',
    group: 'orders',
    description: 'Gửi cho khách ngay khi đặt hàng order thành công chờ Admin duyệt.',
    vars: ['{order_code}', '{product_name}', '{price}', '{input_data}'],
    default_val: `**ĐƠN HÀNG ĐẶT TRƯỚC ĐÃ ĐƯỢC GHI NHẬN!**\n\n**Mã đơn:** \`#{order_code}\`\n**Sản phẩm:** {product_name}\n**Số tiền:** {price} đ\n**Thông tin đã gửi:**\n\`\`\`\n{input_data}\n\`\`\`\n\nĐơn hàng đang được Admin xử lý. Bạn sẽ nhận được thông báo ngay khi bàn giao!`,
    default_val_en: `**PRE-ORDER RECORDED!**\n\n**Order ID:** \`#{order_code}\`\n**Product:** {product_name}\n**Price:** {price} VND\n**Submitted info:**\n\`\`\`\n{input_data}\n\`\`\`\n\nYour order is being processed by Admin. You will be notified once ready!`,
    default_val_zh: `**预定订单已记录！**\n\n**订单编号:** \`#{order_code}\`\n**商品:** {product_name}\n**金额:** {price} VND\n**提交信息:**\n\`\`\`\n{input_data}\n\`\`\`\n\n管理员正在处理您的订单，交付后将立即通知您！`
  },
  msg_template_order_refund: {
    label: 'Thông Báo Hoàn Tiền Đơn Hàng',
    group: 'orders',
    description: 'Gửi cho khách khi đơn hàng bị hoàn tiền vào ví.',
    vars: ['{order_code}', '{product_name}', '{amount}', '{reason}'],
    default_val: `**ĐƠN HÀNG #{order_code} ĐÃ ĐƯỢC HOÀN TIỀN!**\n\n**Sản phẩm:** {product_name}\n**Số tiền hoàn vào ví:** +{amount} đ\n**Lý do hoàn tiền:** {reason}\n\nSố tiền đã được cộng lại vào số dư ví của bạn. Cảm ơn bạn!`,
    default_val_en: `**ORDER #{order_code} HAS BEEN REFUNDED!**\n\n**Product:** {product_name}\n**Refunded amount:** +{amount} VND\n**Reason:** {reason}\n\nThe funds have been returned to your wallet balance. Thank you!`,
    default_val_zh: `**订单 #{order_code} 已退款！**\n\n**商品:** {product_name}\n**退款金额:** +{amount} VND\n**退款原因:** {reason}\n\n款项已退回至您的钱包余额，谢谢！`
  },
  msg_template_deposit: {
    label: 'Thông Báo Duyệt Nạp Tiền Thủ Công',
    group: 'deposit',
    description: 'Gửi cho khách khi nạp tiền được duyệt.',
    vars: ['{deposit_id}', '{amount}', '{bonus}', '{total}', '{new_balance}'],
    default_val: `**YÊU CẦU NẠP TIỀN #{deposit_id} ĐÃ ĐƯỢC DUYỆT!**\n\n**Số tiền nạp:** {amount} đ\n**Khuyến mãi:** +{bonus} đ\n**Tổng thực nhận:** {total} đ\n**Số dư tài khoản hiện tại:** {new_balance} đ\n\nCảm ơn bạn đã nạp tiền vào hệ thống!`,
    default_val_en: `**DEPOSIT REQUEST #{deposit_id} APPROVED!**\n\n**Deposit Amount:** {amount} VND\n**Bonus:** +{bonus} VND\n**Total Credited:** {total} VND\n**Current Balance:** {new_balance} VND\n\nThank you for topping up!`,
    default_val_zh: `**充值订单 #{deposit_id} 已审核通过！**\n\n**充值金额:** {amount} VND\n**优惠赠送:** +{bonus} VND\n**实际到账:** {total} VND\n**当前账户余额:** {new_balance} VND\n\n感谢您的充值！`
  },
  msg_template_deposit_reject: {
    label: 'Thông Báo Từ Chối Nạp Tiền',
    group: 'deposit',
    description: 'Gửi cho khách khi nạp tiền bị từ chối.',
    vars: ['{deposit_id}', '{reason}'],
    default_val: `**YÊU CẦU NẠP TIỀN #{deposit_id} ĐÃ BỊ TỪ CHỐI!**\n\n**Lý do:** {reason}\n\nNếu có nhầm lẫn, vui lòng liên hệ Admin để được hỗ trợ kiểm tra lại.`,
    default_val_en: `**DEPOSIT REQUEST #{deposit_id} HAS BEEN REJECTED!**\n\n**Reason:** {reason}\n\nIf you have any questions, please contact Admin for assistance.`,
    default_val_zh: `**充值订单 #{deposit_id} 已被拒绝！**\n\n**原因:** {reason}\n\n如有疑问，请联系管理员协助核查。`
  },
  msg_support_received: {
    label: 'Xác Nhận Đã Nhận Tin Nhắn Hỗ Trợ',
    group: 'service',
    description: 'Tự động gửi cho khách ngay sau khi khách nhắn tin hỗ trợ / CSKH.',
    vars: ['{customer_name}', '{message_text}', '{time}'],
    default_val: `**SHOP ĐÃ NHẬN ĐƯỢC TIN NHẮN HỖ TRỢ CỦA BẠN!**\n\n**Khách hàng:** {customer_name}\n**Nội dung:**\n\`\`\`\n{message_text}\n\`\`\`\n**Thời gian:** {time}\n\nAdmin kỹ thuật đã nhận được tin nhắn và sẽ phản hồi trực tiếp cho bạn trong giây lát. Vui lòng chờ nhé!`,
    default_val_en: `**WE HAVE RECEIVED YOUR SUPPORT MESSAGE!**\n\n**Customer:** {customer_name}\n**Message:**\n\`\`\`\n{message_text}\n\`\`\`\n**Time:** {time}\n\nOur support technician has received your message and will reply shortly. Please stay tuned!`,
    default_val_zh: `**我们已收到您的客服咨询！**\n\n**客户:** {customer_name}\n**内容:**\n\`\`\`\n{message_text}\n\`\`\`\n**时间:** {time}\n\n客服技术人员已收到消息，稍后将直接回复您，请耐心等待！`
  },
  msg_template_warranty_request: {
    label: 'Xác Nhận Yêu Cầu Bảo Hành',
    group: 'service',
    description: 'Gửi cho khách khi gửi phiếu yêu cầu bảo hành đơn hàng.',
    vars: ['{order_code}', '{product_name}', '{reason}', '{time}'],
    default_val: `**HỆ THỐNG ĐÃ NHẬN YÊU CẦU BẢO HÀNH!**\n\n**Mã đơn hàng:** \`#{order_code}\`\n**Sản phẩm:** {product_name}\n**Lý do bảo hành:** {reason}\n**Thời gian gửi:** {time}\n\nKỹ thuật viên đang kiểm tra và sẽ phản hồi sớm nhất cho bạn. Vui lòng chờ nhé!`,
    default_val_en: `**WARRANTY REQUEST RECEIVED!**\n\n**Order ID:** \`#{order_code}\`\n**Product:** {product_name}\n**Reason:** {reason}\n**Time:** {time}\n\nOur technician is checking and will reply as soon as possible. Thank you!`,
    default_val_zh: `**已收到售后保修申请！**\n\n**订单编号:** \`#{order_code}\`\n**商品:** {product_name}\n**保修原因:** {reason}\n**提交时间:** {time}\n\n技术人员正在核查并会尽快回复您，请耐心等待！`
  },
  msg_template_support: {
    label: 'Phản Hồi CSKH Từ Admin',
    group: 'service',
    description: 'Tin nhắn gửi khách khi Admin trả lời ticket hỗ trợ từ Web Dashboard.',
    vars: ['{ticket_id}', '{product_name}', '{reply_text}', '{status}'],
    default_val: `**PHẢN HỒI TỪ ADMIN HỖ TRỢ / BẢO HÀNH**\n\n**Ticket ID:** #{ticket_id}\n**Sản phẩm:** {product_name}\n**Nội dung trả lời:**\n{reply_text}\n\n**Trạng thái:** {status}\n\nCảm ơn bạn đã liên hệ với chúng tôi!`,
    default_val_en: `**SUPPORT REPLY FROM ADMIN**\n\n**Ticket ID:** #{ticket_id}\n**Product:** {product_name}\n**Response:**\n{reply_text}\n\n**Status:** {status}\n\nThank you for contacting us!`,
    default_val_zh: `**来自管理员的客服回复**\n\n**工单 ID:** #{ticket_id}\n**商品:** {product_name}\n**回复内容:**\n{reply_text}\n\n**状态:** {status}\n\n感谢您联系我们！`
  },
  msg_template_welcome: {
    label: 'Lời Chào Mừng Thành Viên Mới',
    group: 'service',
    description: 'Lời chào mặc định khi thành viên lần đầu truy cập Bot.',
    vars: ['{first_name}'],
    default_val: `**CHÀO MỪNG {first_name} ĐẾN VỚI HỆ THỐNG BOT!**\n\nBot hỗ trợ mua sắm tài khoản, dịch vụ tự động & nạp tiền 24/7.\nVui lòng bấm vào Menu hoặc dùng các lệnh bên dưới để bắt đầu.`,
    default_val_en: `**WELCOME {first_name} TO OUR BOT SERVICE!**\n\n24/7 Automated Shop & Instant Wallet Deposit System.\nUse the menu buttons below to get started!`,
    default_val_zh: `**欢迎 {first_name} 使用我们的机器人服务！**\n\n24/7 自动发卡商城与自动充值系统。\n请点击下方菜单按钮开始使用！`
  },
  template_checkin_info: {
    label: 'Tin Nhắn Điểm Danh Nhận Quà',
    group: 'service',
    description: 'Nội dung phản hồi khi người dùng bấm nút Điểm danh mỗi ngày.',
    vars: ['{customer_name}', '{bonus}'],
    default_val: `**ĐIỂM DANH NHẬN THƯỞNG HẰNG NGÀY**\n\n**Khách hàng:** {customer_name}\nBạn đã điểm danh thành công hôm nay!\n**Phần thưởng:** +{bonus} đ vào số dư ví.\n\n*Hãy quay lại vào ngày mai để tiếp tục nhận quà nhé!*`,
    default_val_en: `**DAILY REWARD CHECK-IN**\n\n**Customer:** {customer_name}\nDaily check-in successful!\n**Reward:** +{bonus} VND credited to your wallet.\n\n*Come back tomorrow for more rewards!*`,
    default_val_zh: `**每日签到领奖励**\n\n**客户:** {customer_name}\n今日签到成功！\n**获得奖励:** +{bonus} VND 钱包余额。\n\n*明天记得继续来签到领奖哦！*`
  },
  template_deposit_history: {
    label: 'Tin Nhắn Lịch Sử Nạp Tiền',
    group: 'deposit',
    description: 'Nội dung hiển thị danh sách 10 giao dịch nạp tiền gần nhất của khách hàng.',
    vars: ['{deposit_list}'],
    default_val: `**LỊCH SỬ NẠP TIỀN GẦN ĐÂY**\n\n{deposit_list}\n\n*Nếu cần hỗ trợ tra soát giao dịch nạp tiền, vui lòng liên hệ CSKH.*`,
    default_val_en: `**RECENT DEPOSIT HISTORY**\n\n{deposit_list}\n\n*Contact customer support if you need transaction assistance.*`,
    default_val_zh: `**近期充值记录**\n\n{deposit_list}\n\n*如需协助核查充值，请联系在线客服。*`
  },

  // === NHÓM THÔNG BÁO SẢN PHẨM & KHO HÀNG ===
  template_new_product_notify: {
    label: 'Thông Báo Sản Phẩm Mới (Lên Kệ)',
    group: 'notify',
    description: 'Mẫu tin nhắn phát sóng tới khách hàng / kênh khi đăng bán sản phẩm mới.',
    vars: ['{name}', '{price}', '{description}', '{shop_name}', '{emoji:5201732344993576400}'],
    default_val: `🎉 <b>SẢN PHẨM MỚI VỪA LÊN KỆ!</b>\n\n🛍️ <b>Sản phẩm:</b> <b>{name}</b>\n💰 <b>Giá bán:</b> <b>{price}</b>\n\n📝 <b>Mô tả:</b>\n{description}\n\n👉 <i>Bấm nút bên dưới để xem chi tiết và đặt mua ngay!</i>`,
    default_val_en: `🎉 <b>NEW PRODUCT ARRIVED!</b>\n\n🛍️ <b>Product:</b> <b>{name}</b>\n💰 <b>Price:</b> <b>{price}</b>\n\n📝 <b>Description:</b>\n{description}\n\n👉 <i>Click the button below to view details and buy now!</i>`,
    default_val_zh: `🎉 <b>新品上架通知！</b>\n\n🛍️ <b>商品:</b> <b>{name}</b>\n💰 <b>价格:</b> <b>{price}</b>\n\n📝 <b>描述:</b>\n{description}\n\n👉 <i>点击下方按钮查看详情并立即购买！</i>`
  },
  template_restock_notify: {
    label: 'Thông Báo Bổ Sung Kho / Thêm Data',
    group: 'notify',
    description: 'Mẫu tin nhắn phát sóng khi nạp thêm tài khoản / nạp data vào kho sản phẩm (dùng chung cho cả thêm thủ công và Auto Restock).',
    vars: ['{name}', '{quantity}', '{stock}', '{price}', '{shop_name}', '{emoji:5201732344993576400}'],
    default_val: `🔥 <b>VỪA CẬP NHẬT THÊM HÀNG / BỔ SUNG KHO!</b>\n\n🛍️ <b>Sản phẩm:</b> <b>{name}</b>\n📦 <b>Vừa nhập thêm:</b> <b>+{quantity} tài khoản</b>\n📊 <b>Hiện có trong kho:</b> <b>{stock} tài khoản</b>\n💰 <b>Giá bán:</b> <b>{price}</b>\n\n⚡ <i>Kho đã được bổ sung đầy đủ, hãy bấm nút bên dưới để sở hữu ngay!</i>`,
    default_val_en: `🔥 <b>STOCK RESTOCKED & READY!</b>\n\n🛍️ <b>Product:</b> <b>{name}</b>\n📦 <b>Restocked:</b> <b>+{quantity} accounts</b>\n📊 <b>Total Stock:</b> <b>{stock} accounts</b>\n💰 <b>Price:</b> <b>{price}</b>\n\n⚡ <i>Stock replenished, click below to buy now!</i>`,
    default_val_zh: `🔥 <b>商品补货已入库！</b>\n\n🛍️ <b>商品:</b> <b>{name}</b>\n📦 <b>新入库:</b> <b>+{quantity} 个账号</b>\n📊 <b>当前总库存:</b> <b>{stock} 个</b>\n💰 <b>价格:</b> <b>{price}</b>\n\n⚡ <i>库存已补充充足，点击下方按钮立即选购！</i>`
  },
  btn_view_and_buy: {
    label: 'Nút: Xem & Mua sản phẩm ngay',
    group: 'notify',
    description: 'Nút đính kèm dưới thông báo sản phẩm mới và nạp kho. Hỗ trợ gắn Emoji động bằng cách gõ hoặc bấm {ID_EMOJI} (VD: {5375135722514685501} Mua ngay).',
    vars: [],
    default_val: '🛍️ Xem & Mua sản phẩm ngay',
    default_val_en: '🛍️ View & Buy Now',
    default_val_zh: '🛍️ 查看并立即购买'
  },

  // === NHÓM D: NÚT QUY TRÌNH NẠP TIỀN & THANH TOÁN ===
  btn_check_payment: {
    label: 'Nút: Kiểm tra thanh toán ngay',
    group: 'buttons_deposit_flow',
    description: 'Nút đính kèm dưới mã QR / hóa đơn nạp (check_payment, check_binance_payment, check_recent_trc20).',
    vars: [],
    default_val: 'Kiểm tra thanh toán ngay',
    default_val_en: 'Check Payment Now',
    default_val_zh: '立即查询付款'
  },
  btn_reload_qr: {
    label: 'Nút: Tải lại QR (1 lần)',
    group: 'buttons_deposit_flow',
    description: 'Nút tạo lại mã QR nạp tiền ngân hàng khi hết hạn (reload_qr).',
    vars: [],
    default_val: 'Tải lại QR (1 lần)',
    default_val_en: 'Reload QR Code (1x)',
    default_val_zh: '重新加载二维码 (1次)'
  },
  btn_cancel_qr: {
    label: 'Nút: Huỷ mã QR',
    group: 'buttons_deposit_flow',
    description: 'Nút huỷ phiên nạp tiền / QR hiện tại (cancel_qr).',
    vars: [],
    default_val: 'Huỷ mã QR',
    default_val_en: 'Cancel QR Code',
    default_val_zh: '取消二维码'
  },
  btn_back_deposit_options: {
    label: 'Nút: Quay lại Menu Nạp',
    group: 'buttons_deposit_flow',
    description: 'Nút quay lại danh sách chọn cổng nạp tiền (back_to_deposit_options).',
    vars: [],
    default_val: 'Quay lại Menu Nạp',
    default_val_en: 'Back to Deposit Menu',
    default_val_zh: '返回充值菜单'
  },
  btn_admin_approve_deposit: {
    label: 'Nút: Duyệt Nạp (Admin)',
    group: 'buttons_deposit_flow',
    description: 'Nút duyệt cộng tiền gửi riêng cho Admin (approve_usdt_deposit).',
    vars: [],
    default_val: 'Duyệt',
    default_val_en: 'Approve',
    default_val_zh: '审核通过'
  },
  btn_admin_reject_deposit: {
    label: 'Nút: Từ chối Nạp (Admin)',
    group: 'buttons_deposit_flow',
    description: 'Nút từ chối nạp tiền gửi riêng cho Admin (reject_usdt_deposit).',
    vars: [],
    default_val: 'Từ chối',
    default_val_en: 'Reject',
    default_val_zh: '拒绝'
  },

  // === NHÓM E: NÚT MUA HÀNG & DANH MỤC SẢN PHẨM ===
  btn_buy_now: {
    label: 'Nút: Mua ngay',
    group: 'buttons_shop_flow',
    description: 'Nút bấm bắt đầu mua sản phẩm (buy_now).',
    vars: [],
    default_val: 'Mua ngay',
    default_val_en: 'Buy Now',
    default_val_zh: '立即购买'
  },
  btn_confirm_buy: {
    label: 'Nút: Xác nhận mua',
    group: 'buttons_shop_flow',
    description: 'Nút xác nhận thanh toán trừ tiền ví để mua hàng (confirm_buy).',
    vars: [],
    default_val: 'Xác nhận mua',
    default_val_en: 'Confirm Purchase',
    default_val_zh: '确认购买'
  },
  btn_cancel_buy: {
    label: 'Nút: Hủy bỏ mua',
    group: 'buttons_shop_flow',
    description: 'Nút hủy bỏ giao dịch mua hàng đang chọn (cancel_buy).',
    vars: [],
    default_val: 'Hủy bỏ',
    default_val_en: 'Cancel',
    default_val_zh: '取消'
  },
  btn_qty_all: {
    label: 'Nút: Mua tất cả',
    group: 'buttons_shop_flow',
    description: 'Nút mua toàn bộ số lượng tồn kho của sản phẩm.',
    vars: [],
    default_val: 'Mua tất cả',
    default_val_en: 'Buy All Stock',
    default_val_zh: '购买全部库存'
  },
  btn_qty_custom: {
    label: 'Nút: Tự nhập số lượng',
    group: 'buttons_shop_flow',
    description: 'Nút mở chế độ nhập số lượng tuỳ ý từ bàn phím.',
    vars: [],
    default_val: 'Tự nhập số lượng',
    default_val_en: 'Custom Quantity',
    default_val_zh: '自定义数量'
  },
  btn_back_to_categories: {
    label: 'Nút: Quay lại danh mục',
    group: 'buttons_shop_flow',
    description: 'Nút quay lại danh sách nhóm sản phẩm (back_to_categories).',
    vars: [],
    default_val: 'Quay lại danh mục',
    default_val_en: 'Back to Categories',
    default_val_zh: '返回商品分类'
  },
  btn_prev_page: {
    label: 'Nút: Trang trước',
    group: 'buttons_shop_flow',
    description: 'Nút phân trang danh sách sản phẩm lùi lại (prev_page).',
    vars: [],
    default_val: 'Trang trước',
    default_val_en: 'Previous Page',
    default_val_zh: '上一页'
  },
  btn_next_page: {
    label: 'Nút: Trang sau',
    group: 'buttons_shop_flow',
    description: 'Nút phân trang danh sách sản phẩm kế tiếp (next_page).',
    vars: [],
    default_val: 'Trang sau',
    default_val_en: 'Next Page',
    default_val_zh: '下一页'
  },

  // === NHÓM F: NÚT SAU KHI MUA & ĐƠN HÀNG ===
  btn_download_txt: {
    label: 'Nút: Tải file txt',
    group: 'buttons_order_download',
    description: 'Nút gửi file tài khoản .txt về tin nhắn Telegram (dl).',
    vars: [],
    default_val: 'Tải file txt',
    default_val_en: 'Download TXT File',
    default_val_zh: '下载 TXT 文件'
  },
  btn_download_all: {
    label: 'Nút: Tải toàn bộ',
    group: 'buttons_order_download',
    description: 'Nút tải toàn bộ dữ liệu đơn hàng (dla).',
    vars: [],
    default_val: 'Tải toàn bộ',
    default_val_en: 'Download All',
    default_val_zh: '下载全部卡密'
  },
  btn_download_combo: {
    label: 'Nút: Tải định dạng combo',
    group: 'buttons_order_download',
    description: 'Nút tải định dạng User|Pass|Cookie|2FA combo (dlc).',
    vars: [],
    default_val: 'Tải định dạng combo',
    default_val_en: 'Download Combo Format',
    default_val_zh: '下载组合格式'
  },
  btn_view_order_detail: {
    label: 'Nút: Xem chi tiết đơn hàng',
    group: 'buttons_order_download',
    description: 'Nút tra cứu thông tin chi tiết đơn hàng (view_order).',
    vars: [],
    default_val: 'Xem chi tiết đơn hàng',
    default_val_en: 'View Order Details',
    default_val_zh: '查看订单详情'
  },

  // === NHÓM G: NÚT DỊCH VỤ, CSKH & KHÁC ===
  btn_start_warranty: {
    label: 'Nút: Gửi yêu cầu bảo hành',
    group: 'buttons_service_other',
    description: 'Nút mở giao diện gửi ticket bảo hành đơn lỗi (start_warranty).',
    vars: [],
    default_val: 'Gửi yêu cầu bảo hành',
    default_val_en: 'Request Warranty',
    default_val_zh: '提交售后保修'
  },
  btn_order_history: {
    label: 'Nút: Xem tất cả đơn hàng',
    group: 'buttons_service_other',
    description: 'Nút xem danh sách lịch sử đơn hàng của khách (order_history).',
    vars: [],
    default_val: 'Xem tất cả đơn hàng',
    default_val_en: 'View All Orders',
    default_val_zh: '查看所有历史订单'
  },
  btn_regenerate_api_key: {
    label: 'Nút: Tạo lại API Key',
    group: 'buttons_service_other',
    description: 'Nút cấp lại mã khóa API cho đại lý (regenerate_api_key).',
    vars: [],
    default_val: 'Tạo lại API Key',
    default_val_en: 'Regenerate API Key',
    default_val_zh: '重新生成 API Key'
  },
  btn_lang_vi: {
    label: 'Nút: Tiếng Việt',
    group: 'buttons_service_other',
    description: 'Nút chọn ngôn ngữ Tiếng Việt (select_lang_vi).',
    vars: [],
    default_val: 'Tiếng Việt',
    default_val_en: 'Tiếng Việt',
    default_val_zh: 'Tiếng Việt'
  },
  btn_lang_en: {
    label: 'Nút: English',
    group: 'buttons_service_other',
    description: 'Nút chọn ngôn ngữ English (select_lang_en).',
    vars: [],
    default_val: 'English',
    default_val_en: 'English',
    default_val_zh: 'English'
  },
  btn_lang_zh: {
    label: 'Nút: 中文',
    group: 'buttons_service_other',
    description: 'Nút chọn ngôn ngữ 中文 (select_lang_zh).',
    vars: [],
    default_val: '中文',
    default_val_en: '中文',
    default_val_zh: '中文'
  }
};

export async function GET() {
  try {
    await dbReady;
    const [rows] = await pool.query<RowDataPacket[]>('SELECT `key`, `value` FROM settings');

    const settingsMap: Record<string, string> = {};
    rows.forEach((r) => {
      settingsMap[r.key] = r.value;
    });

    // Parse main keyboard
    let mainKeyboard: MainKeyboardButton[] = DEFAULT_KEYBOARD_BUTTONS;
    if (settingsMap.bot_main_keyboard_config) {
      try {
        const parsed = JSON.parse(settingsMap.bot_main_keyboard_config);
        if (Array.isArray(parsed) && parsed.length > 0) {
          mainKeyboard = parsed;
        }
      } catch (e) {
        console.error('Error parsing bot_main_keyboard_config:', e);
      }
    }

    // Parse wallet buttons
    let walletButtons: BotMenuInlineButton[] = DEFAULT_WALLET_BUTTONS;
    if (settingsMap.wallet_buttons_config) {
      try {
        const parsed = JSON.parse(settingsMap.wallet_buttons_config);
        if (Array.isArray(parsed) && parsed.length > 0) {
          walletButtons = parsed;
        }
      } catch (e) {
        console.error('Error parsing wallet_buttons_config:', e);
      }
    }

    // Parse deposit buttons
    let depositButtons: BotMenuInlineButton[] = DEFAULT_DEPOSIT_BUTTONS;
    if (settingsMap.deposit_menu_buttons_config) {
      try {
        const parsed = JSON.parse(settingsMap.deposit_menu_buttons_config);
        if (Array.isArray(parsed) && parsed.length > 0) {
          depositButtons = parsed;
        }
      } catch (e) {
        console.error('Error parsing deposit_menu_buttons_config:', e);
      }
    }

    // Build templates map
    const templates: Record<string, { label: string; group: string; description: string; vars: string[]; value: string; value_vi: string; value_en: string; value_zh: string }> = {};
    for (const [key, meta] of Object.entries(DEFAULT_TEMPLATES)) {
      const valVi = settingsMap[key] !== undefined && settingsMap[key].trim() !== '' ? settingsMap[key] : meta.default_val;
      const valEn = settingsMap[`${key}_en`] !== undefined && settingsMap[`${key}_en`].trim() !== '' ? settingsMap[`${key}_en`] : (meta.default_val_en || meta.default_val);
      const valZh = settingsMap[`${key}_zh`] !== undefined && settingsMap[`${key}_zh`].trim() !== '' ? settingsMap[`${key}_zh`] : (meta.default_val_zh || meta.default_val);

      templates[key] = {
        label: meta.label,
        group: meta.group,
        description: meta.description,
        vars: meta.vars,
        value: valVi,
        value_vi: valVi,
        value_en: valEn,
        value_zh: valZh
      };
    }

    return NextResponse.json({
      success: true,
      main_keyboard: mainKeyboard,
      wallet_buttons: walletButtons,
      deposit_buttons: depositButtons,
      templates
    });
  } catch (error: any) {
    console.error('[BotTemplates GET Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const body = await request.json();
    const { main_keyboard, wallet_buttons, deposit_buttons, templates } = body;
    const { ipAddress, userAgent } = getRequestInfo(request);
    const adminName = await getAdminFromCookie(request);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      if (main_keyboard && Array.isArray(main_keyboard)) {
        const jsonStr = JSON.stringify(main_keyboard);
        await connection.query(
          'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          ['bot_main_keyboard_config', jsonStr, jsonStr]
        );
      }

      if (wallet_buttons && Array.isArray(wallet_buttons)) {
        const jsonStr = JSON.stringify(wallet_buttons);
        await connection.query(
          'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          ['wallet_buttons_config', jsonStr, jsonStr]
        );
      }

      if (deposit_buttons && Array.isArray(deposit_buttons)) {
        const jsonStr = JSON.stringify(deposit_buttons);
        await connection.query(
          'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          ['deposit_menu_buttons_config', jsonStr, jsonStr]
        );
      }

      if (templates && typeof templates === 'object') {
        for (const [key, val] of Object.entries(templates)) {
          if (typeof val === 'string') {
            await connection.query(
              'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
              [key, val, val]
            );
          }
        }
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    await logAdminAction({
      adminName: adminName || 'System',
      action: 'UPDATE',
      targetType: 'SETTING',
      details: { type: 'bot_templates_and_buttons_updated' },
      ipAddress,
      userAgent,
      request
    });

    return NextResponse.json({ success: true, message: 'Đã lưu cấu hình nút bấm & nội dung Bot thành công!' });
  } catch (error: any) {
    console.error('[BotTemplates POST Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
