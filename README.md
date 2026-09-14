# 🤖 Bot Bán Hàng Telegram & Web Management System

Hệ thống quản lý bán hàng tự động đa kênh qua **Telegram Bot** và **Web Admin Dashboard** hiện đại, hỗ trợ tự động giao hàng sẵn kho, xử lý dịch vụ Order nâng cấp, thanh toán VietQR / USDT (TRC20, Bybit), khuyến mại nạp tiền, giá riêng theo khách hàng và quản lý tài khoản email EDU.

---

## 📋 Tổng Quan Kiến Trúc

Dự án bao gồm 3 thành phần dịch vụ chính:

| Thành phần | Mô tả | Cổng mặc định (Port) |
|------------|-------|----------------------|
| **Telegram Bot Engine** | Bot bán hàng tự động, xử lý giao hàng instant & dịch vụ Order | - |
| **Webapp (Next.js Admin)** | Dashboard quản trị viên, quản lý sản phẩm, đơn hàng, người dùng, khuyến mại | **8693** |
| **Email EDU Web Engine** | Hệ thống tạo và quản lý Email Google Workspace EDU / tMail | **3000** |

---

## 🔥 Tính Năng Nổi Bật

### 🤖 1. Telegram Bot Bán Hàng Tự Động
- ✅ **Phân loại sản phẩm thông minh**:
  - **Sản phẩm sẵn kho (`stock`/`auto`)**: Phát tự động tài khoản/mã/2FA lập tức sau khi trừ số dư.
  - **Sản phẩm Order (`order`/`manual`)**: Tự động gửi câu hỏi yêu cầu khách nhập Email/Thông tin nâng cấp, đẩy về trạng thái **Pending** để Admin xử lý 1-click.
- ✅ **Giá riêng theo khách hàng (`custom_pricing`)**: Tự động áp dụng mức giá ưu đãi riêng cài đặt từ Web cho từng khách hàng trên Bot.
- ✅ **Nạp tiền tự động**: Tích hợp VietQR, USDT (TRC20, Bybit Pay ID), tự động cộng tiền & tính phần trăm thưởng Khuyến mại nạp tiền + Rank VIP.
- ✅ **Nút Mua ngay deep-link**: Tự động đính kèm nút mua hàng trực tiếp từ các tin nhắn thông báo kho ảo (`auto_restock`).
- ✅ **Điểm danh hàng ngày (`/checkin`)**: Nhận điểm thưởng/Credit, tính chuỗi ngày (streak) & mã giới thiệu bạn bè (`referral_code`).
- ✅ **Gửi yêu cầu Hỗ trợ / Bảo hành (`/support`)**: Khách hàng gửi yêu cầu trực tiếp từ Bot về trang quản trị Web.
- ✅ **Xem lại lịch sử đơn hàng (`/orders`)**: Cho phép khách xem lại 10 đơn gần nhất và lấy lại TK/MK đã mua.

### 🌐 2. Web Admin Dashboard (Next.js 16)
- 📊 **Thống kê doanh thu & lợi nhuận PnL**: Theo dõi doanh thu, chi phí, lợi nhuận thực tế theo ngày/tháng.
- 📦 **Quản lý Sản phẩm & Kho hàng**:
  - Hỗ trợ **Kéo thả sắp xếp (Drag & Drop)** thứ tự hiển thị và nút di chuyển Lên/Xuống (`↑`/`↓`).
  - Phân loại sản phẩm Sẵn kho & Sản phẩm Order tùy chỉnh thông điệp yêu cầu (`prompt_message`).
  - Thêm tài khoản hàng loạt theo định dạng (User|Pass|Extra|2FA) hoặc theo dòng.
- 🏷️ **Cấu hình Giá riêng (`Custom Pricing`)**: Cài đặt giá ưu đãi riêng theo từng khách hàng (Phạm vi tất cả đơn hoặc đơn đầu tiên).
- 🎁 **Khuyến mãi Nạp tiền & Flash Sale**:
  - Tạo chiến dịch khuyến mãi nạp tiền theo khung giờ.
  - Tạo chương trình Flash Sale giảm giá số lượng lớn (`bulk_price`).
- 🛟 **Live Chat & Hỗ trợ bảo hành**: Xử lý yêu cầu bảo hành, trao đổi trực tiếp với khách hàng trên Telegram ngay từ Web Dashboard.
- 📢 **Thông báo hàng loạt & Auto Restock**: Hẹn giờ tự động quét kho và phát sóng thông báo về Kênh Telegram / User CSDL.
- ⚙️ **Cài đặt hệ thống**: Cấu hình Ngân hàng VietQR, Token Bot, Tần suất quét kho, Nút bấm Menu...

---

## 🚀 Cài Đặt & Khởi Chạy

### Yêu cầu hệ thống
- Node.js >= 18.x
- MySQL >= 8.0
- NPM / Yarn

### 1. Clone repository
```bash
git clone https://github.com/basil204/botteleandweb.git
cd botteleandweb
```

### 2. Cài đặt dependencies
```bash
# Cài đặt Bot Engine
npm install

# Cài đặt Webapp Admin Dashboard
cd webapp && npm install

# Cài đặt Email EDU Web (Nếu sử dụng)
cd ../email-edu-web && npm install
```

### 3. Cấu hình môi trường (`.env`)

Tạo file `.env` tại thư mục gốc:
```env
# Telegram Config
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ADMIN_IDS=["123456789"]

# Database Connection
DB_HOST=103.139.155.175
DB_PORT=3306
DB_USER=testv1
DB_PASS=skeLdYCEGkFESpdZ
DB_NAME=testv1

# Payment Configuration
VIETQR_BANK_CODE=VCB
VIETQR_ACCOUNT_NO=123456789
VIETQR_ACCOUNT_NAME=NGUYEN VAN A
USDT_TRC20_WALLET=T...
```

---

## 💻 Hướng Dẫn Vận Hành

### Chạy Telegram Bot Engine:
```bash
npm run dev
```

### Chạy Web Admin Dashboard (Port 8693):
```bash
cd webapp
npm run dev
```
Truy cập Dashboard tại: `http://localhost:8693`

---

## 🗄️ Cấu Trúc Thư Mục Dự Án

```
botteleandweb/
├── 📄 main.js                       # Bot entry point chính
├── 📄 config.js                     # Cấu hình chung
├── 📁 includes/                     # Logic cốt lõi Bot Telegram
│   ├── 📁 controllers/              # Xử lý CSDL (Product, Order, CustomPricing, Checkin...)
│   ├── 📁 handle/                   # Event handlers (handleBuy, handleDeposit, handleUser...)
│   ├── 📁 helpers/                  # Utilities (customPricing.js, formatters...)
│   └── 📁 database/                 # Kết nối MySQL & Migration tự động
├── 📁 modules/                      # Lệnh Bot (/start, /menu, /checkin, /support...)
└── 📁 webapp/                       # Web Admin Dashboard (Next.js 16)
    ├── 📁 app/
    │   ├── 📁 (dashboard)/          # Các trang quản trị (products, categories, orders...)
    │   └── 📁 api/                  # API endpoints (custom-pricing, promotions, preorders...)
    ├── 📁 components/               # UI components (Radix UI, Tailwind CSS)
    └── 📁 lib/                      # DB Connection pool & Helpers
```

---

## 📝 Bản Quyền & Giấy Phép

Private - All rights reserved. Developed by **basil204**.
