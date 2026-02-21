export const messages = {
    vi: {
        // Language selection
        select_language: '🌐 **Chọn ngôn ngữ / Select Language:**',
        lang_vi: '🇻🇳 Tiếng Việt',
        lang_en: '🇺🇸 English',
        lang_zh: '🇨🇳 中文',
        lang_switched: '🇻🇳 Ngôn ngữ đã được chuyển sang Tiếng Việt.',

        // Welcome & Menu
        welcome: '🎉 **Chào mừng bạn đến với bot!**\n\n👋 Xin chào! Chúng tôi rất vui được phục vụ bạn.',
        menu_title: '👇 **Menu Chức Năng**',
        deposit: '➕ Nạp tiền',
        buy_product: '🛒 Mua sản phẩm',
        history: '🧾 Lịch sử mua',
        change_language: '🌐 Ngôn ngữ',
        admin_group: '👥 Nhóm',
        join_group_msg: '👥 **Tham gia nhóm hỗ trợ:**\n\nBấm vào link bên dưới để tham gia nhóm:',
        balance: '💰 Số dư: {amount}',

        // User info
        user_info: '👤 **Thông tin tài khoản:**\n• ID: {id}\n• Số dư: {balance} (~${usdt})',
        guide: '💡 **Hướng dẫn sử dụng:**\n• Sử dụng menu bên dưới để điều hướng\n• Nạp tiền để mua sản phẩm',

        // Products
        product_list: '📦 **Danh sách sản phẩm:**',
        product_item: '🔹 {name} - {price} ({stock} còn lại)',
        product_detail: '📦 **{name}**\n\n💰 Giá: {price}\n📝 Mô tả: {description}\n📊 Còn lại: {stock}',
        buy_now: '🛒 Mua ngay',
        back_to_products: '⬅️ Quay lại',
        out_of_stock: '❌ Sản phẩm đã hết hàng!',
        insufficient_balance: '❌ Số dư không đủ!\n\n💰 Số dư hiện tại: {balance}\n💵 Giá sản phẩm: {price}\n\nVui lòng nạp thêm tiền.',
        enter_quantity: '🔢 Nhập số lượng muốn mua (1-{max}):',
        invalid_quantity: '❌ Số lượng không hợp lệ! Vui lòng nhập số từ 1 đến {max}.',
        purchase_success: '✅ **MUA HÀNG THÀNH CÔNG!**\n\n📦 Sản phẩm: {name}\n💰 Giá: {price}\n📊 Số lượng: {quantity}\n\n📝 **Thông tin tài khoản:**\n{accounts}',
        purchase_error: '❌ Có lỗi xảy ra khi mua hàng. Vui lòng thử lại.',

        // Deposit
        deposit_menu_title: '💲 **Chọn phương thức nạp tiền:**',
        deposit_bank: '🏦 Ngân hàng',
        deposit_usdt: '💲 USDT',
        bank_info: '🏦 **Thông tin chuyển khoản:**\n\n• Ngân hàng: {bank}\n• STK: {account}\n• Tên: {name}\n• Nội dung: {content}\n\n⚠️ Vui lòng chuyển đúng nội dung!',
        min_deposit: '⚠️ Số tiền nạp tối thiểu: {amount}',
        usdt_wallet: '🏦 Ví USDT (Wallet)',
        usdt_bybit: '📈 Bybit',
        usdt_network: '🌐 Mạng lưới (Network): **{network}**',
        usdt_wallet_addr: '💼 Địa chỉ ví:\n`{address}`\n(Click để copy)',
        usdt_note: '⚠️ **Lưu ý:**\n• Vui lòng chuyển đúng mạng lưới **{network}**.\n• Sau khi chuyển xong, vui lòng chụp ảnh hoá đơn và liên hệ Admin để được cộng tiền.',
        bybit_link: '🔗 Link chuyển: [Bấm vào đây]({link})',
        bybit_note_label: '📝 **Ghi chú (Note):** `{note}`\n(Vui lòng nhập ID này vào phần ghi chú khi chuyển khoản)',
        bybit_upload_guide: '⚠️ **Lưu ý:**\n• Sau khi chuyển xong, vui lòng **GỬI ẢNH HOÁ ĐƠN** vào đây để Admin duyệt.\n• Bấm nút ❌ **Huỷ** bên dưới nếu muốn huỷ bỏ.',
        cancel: '❌ Huỷ',
        canceled: '❌ Đã huỷ.',
        pending_warning: '⚠️ Bạn đang có yêu cầu nạp tiền đang chờ xử lý. Vui lòng chờ Admin duyệt trước khi tạo yêu cầu mới.',
        upload_success: '✅ Đã gửi ảnh xác nhận cho Admin. Vui lòng chờ phản hồi.',
        admin_config_missing: '⚠️ Hệ thống chưa cấu hình Admin để nhận ảnh.',
        photo_received: '📸 **Bằng chứng thanh toán mới**\n\n👤 User: {user} (ID: {id})\n🔢 Deposit ID: #{depositId}\n🕒 Thời gian: {time}',
        approve_btn: '✅ Duyệt',
        reject_btn: '❌ Từ chối',
        approved_msg: '✅ Nạp tiền thành công!\n\n💰 Số tiền: {amount}\n💵 Số dư hiện tại: {balance}\n📝 Mã giao dịch: #{depositId}',
        rejected_msg: '❌ Yêu cầu nạp tiền #{depositId} của bạn đã bị từ chối.',
        currency_rate: '💱 Tỷ giá: 1$ = {rate} VNĐ',

        // History
        no_orders: 'Chưa có đơn hàng.',
        order_item: '#{id} - {name} - {price} - {date}',

        // Common
        loading: 'Đang tải...',
        error: 'Có lỗi xảy ra. Vui lòng thử lại.',
        no_permission: 'Không có quyền truy cập.'
    },
    en: {
        // Language selection
        select_language: '🌐 **Chọn ngôn ngữ / Select Language:**',
        lang_vi: '🇻🇳 Tiếng Việt',
        lang_en: '🇺🇸 English',
        lang_zh: '🇨🇳 中文',
        lang_switched: '🇺🇸 Language switched to English.',

        // Welcome & Menu
        welcome: '🎉 **Welcome to the bot!**\n\n👋 Hello! We are happy to serve you.',
        menu_title: '👇 **Main Menu**',
        deposit: '➕ Deposit',
        buy_product: '🛒 Buy Products',
        history: '🧾 History',
        change_language: '🌐 Language',
        admin_group: '👥 Group',
        join_group_msg: '👥 **Join Support Group:**\n\nClick the link below to join:',
        balance: '💰 Balance: {amount}',

        // User info
        user_info: '👤 **Account Info:**\n• ID: {id}\n• Balance: {balance} (~${usdt})',
        guide: '💡 **How to use:**\n• Use the menu below to navigate\n• Deposit to buy products',

        // Products
        product_list: '📦 **Product List:**',
        product_item: '🔹 {name} - {price} ({stock} in stock)',
        product_detail: '📦 **{name}**\n\n💰 Price: {price}\n📝 Description: {description}\n📊 Stock: {stock}',
        buy_now: '🛒 Buy Now',
        back_to_products: '⬅️ Back',
        out_of_stock: '❌ Product is out of stock!',
        insufficient_balance: '❌ Insufficient balance!\n\n💰 Current balance: {balance}\n💵 Product price: {price}\n\nPlease deposit more.',
        enter_quantity: '🔢 Enter quantity to buy (1-{max}):',
        invalid_quantity: '❌ Invalid quantity! Please enter a number from 1 to {max}.',
        purchase_success: '✅ **PURCHASE SUCCESSFUL!**\n\n📦 Product: {name}\n💰 Price: {price}\n📊 Quantity: {quantity}\n\n📝 **Account Info:**\n{accounts}',
        purchase_error: '❌ An error occurred. Please try again.',

        // Deposit
        deposit_menu_title: '💲 **Select Deposit Method:**',
        deposit_bank: '🏦 Bank Transfer',
        deposit_usdt: '💲 USDT',
        bank_info: '🏦 **Bank Transfer Info:**\n\n• Bank: {bank}\n• Account: {account}\n• Name: {name}\n• Content: {content}\n\n⚠️ Please use the exact content!',
        min_deposit: '⚠️ Minimum deposit: {amount}',
        usdt_wallet: '🏦 USDT Wallet',
        usdt_bybit: '📈 Bybit',
        usdt_network: '🌐 Network: **{network}**',
        usdt_wallet_addr: '💼 Wallet Address:\n`{address}`\n(Click to copy)',
        usdt_note: '⚠️ **Note:**\n• Please send via **{network}** network.\n• After transfer, please send proof via photo to Admin.',
        bybit_link: '🔗 Transfer Link: [Click Here]({link})',
        bybit_note_label: '📝 **Note:** `{note}`\n(Please input this ID in the transfer note)',
        bybit_upload_guide: '⚠️ **Note:**\n• After transfer, please **UPLOAD RECEIPT PHOTO** here for approval.\n• Click ❌ **Cancel** below to cancel.',
        cancel: '❌ Cancel',
        canceled: '❌ Canceled.',
        pending_warning: '⚠️ You have a pending deposit request. Please wait for Admin approval before creating a new one.',
        upload_success: '✅ Receipt sent to Admin. Please wait for approval.',
        admin_config_missing: '⚠️ Admin not configured to receive photos.',
        photo_received: '📸 **New Payment Proof**\n\n👤 User: {user} (ID: {id})\n🔢 Deposit ID: #{depositId}\n🕒 Time: {time}',
        approve_btn: '✅ Approve',
        reject_btn: '❌ Reject',
        approved_msg: '✅ Deposit Successful!\n\n💰 Amount: {amount}\n💵 Current Balance: {balance}\n📝 Tx ID: #{depositId}',
        rejected_msg: '❌ Your deposit request #{depositId} has been rejected.',
        currency_rate: '💱 Rate: 1$ = {rate} VND',

        // History
        no_orders: 'No orders yet.',
        order_item: '#{id} - {name} - {price} - {date}',

        // Common
        loading: 'Loading...',
        error: 'An error occurred. Please try again.',
        no_permission: 'Access denied.'
    },
    zh: {
        // Language selection
        select_language: '🌐 **选择语言 / Select Language:**',
        lang_vi: '🇻🇳 Tiếng Việt',
        lang_en: '🇺🇸 English',
        lang_zh: '🇨🇳 中文',
        lang_switched: '🇨🇳 语言已切换为中文。',

        // Welcome & Menu
        welcome: '🎉 **欢迎来到机器人！**\n\n👋 您好！我们很高兴为您服务。',
        menu_title: '👇 **功能菜单**',
        deposit: '➕ 充值',
        buy_product: '🛒 购买产品',
        history: '🧾 购买记录',
        change_language: '🌐 语言',
        admin_group: '👥 群组',
        join_group_msg: '👥 **加入支持群组：**\n\n点击下方链接加入群组：',
        balance: '💰 余额: {amount}',

        // User info
        user_info: '👤 **账户信息：**\n• ID: {id}\n• 余额: {balance} (~${usdt})',
        guide: '💡 **使用指南：**\n• 使用下方菜单进行操作\n• 充值后可购买产品',

        // Products
        product_list: '📦 **产品列表：**',
        product_item: '🔹 {name} - {price} (库存 {stock})',
        product_detail: '📦 **{name}**\n\n💰 价格: {price}\n📝 描述: {description}\n📊 库存: {stock}',
        buy_now: '🛒 立即购买',
        back_to_products: '⬅️ 返回',
        out_of_stock: '❌ 产品已售罄！',
        insufficient_balance: '❌ 余额不足！\n\n💰 当前余额: {balance}\n💵 产品价格: {price}\n\n请先充值。',
        enter_quantity: '🔢 请输入购买数量 (1-{max})：',
        invalid_quantity: '❌ 数量无效！请输入 1 到 {max} 之间的数字。',
        purchase_success: '✅ **购买成功！**\n\n📦 产品: {name}\n💰 价格: {price}\n📊 数量: {quantity}\n\n📝 **账户信息：**\n{accounts}',
        purchase_error: '❌ 购买时出现错误，请重试。',

        // Deposit
        deposit_menu_title: '💲 **选择充值方式：**',
        deposit_bank: '🏦 银行转账',
        deposit_usdt: '💲 USDT',
        bank_info: '🏦 **转账信息：**\n\n• 银行: {bank}\n• 账号: {account}\n• 姓名: {name}\n• 备注: {content}\n\n⚠️ 请务必填写正确的备注内容！',
        min_deposit: '⚠️ 最低充值金额: {amount}',
        usdt_wallet: '🏦 USDT 钱包',
        usdt_bybit: '📈 Bybit',
        usdt_network: '🌐 网络: **{network}**',
        usdt_wallet_addr: '💼 钱包地址：\n`{address}`\n(点击复制)',
        usdt_note: '⚠️ **注意：**\n• 请通过 **{network}** 网络转账。\n• 转账完成后，请截图发送给管理员以完成充值。',
        bybit_link: '🔗 转账链接: [点击这里]({link})',
        bybit_note_label: '📝 **备注:** `{note}`\n(转账时请在备注中输入此ID)',
        bybit_upload_guide: '⚠️ **注意：**\n• 转账完成后，请在此处 **上传收据截图** 等待审核。\n• 点击 ❌ **取消** 按钮可取消操作。',
        cancel: '❌ 取消',
        canceled: '❌ 已取消。',
        pending_warning: '⚠️ 您有一笔待处理的充值请求。请等待管理员审核后再创建新请求。',
        upload_success: '✅ 截图已发送给管理员，请等待审核。',
        admin_config_missing: '⚠️ 系统尚未配置管理员接收图片。',
        photo_received: '📸 **新的付款凭证**\n\n👤 用户: {user} (ID: {id})\n🔢 充值ID: #{depositId}\n🕒 时间: {time}',
        approve_btn: '✅ 通过',
        reject_btn: '❌ 拒绝',
        approved_msg: '✅ 充值成功！\n\n💰 金额: {amount}\n💵 当前余额: {balance}\n📝 交易ID: #{depositId}',
        rejected_msg: '❌ 您的充值请求 #{depositId} 已被拒绝。',
        currency_rate: '💱 汇率: 1$ = {rate} 越南盾',

        // History
        no_orders: '暂无订单。',
        order_item: '#{id} - {name} - {price} - {date}',

        // Common
        loading: '加载中...',
        error: '出现错误，请重试。',
        no_permission: '无访问权限。'
    }
};

