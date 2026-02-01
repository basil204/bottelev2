# 🤖 Bot Bán Hàng Telegram & Web Management System

Hệ thống quản lý bán hàng tự động qua Telegram Bot, tích hợp thanh toán VietQR và quản lý email EDU.

## 📋 Tổng quan

Dự án bao gồm 3 thành phần chính:

| Thành phần | Mô tả | Port |
|------------|-------|------|
| **Telegram Bot** | Bot bán hàng tự động với thanh toán VietQR | - |
| **Webapp** | Dashboard quản trị viên | 8692 |
| **Email EDU Web** | Hệ thống tạo email Google Workspace EDU | 3000 |

---

## 🚀 Cài đặt

### Yêu cầu hệ thống
- Node.js >= 18
- MySQL >= 8.0
- npm hoặc yarn

### 1. Clone repository
```bash
git clone https://github.com/basil204/botteleandweb.git
cd botteleandweb
```

### 2. Cài đặt dependencies

```bash
# Bot chính
npm install

# Webapp
cd webapp && npm install

# Email EDU Web
cd ../email-edu-web && npm install
```

### 3. Cấu hình môi trường

Tạo file `.env` ở thư mục gốc:
```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_IDS=["123456789"]
NOTIFICATION_CHAT_ID=chat_id

# Database
DB_HOST=localhost
DB_NAME=webapi
DB_USER=root
DB_PASS=password

# VietQR Payment
VIETQR_ACCOUNT_NO=your_account_number
VIETQR_BANK_CODE=your_bank_code

# Mail API
MAIL_API_KEY=your_api_key
```

---

## 🤖 Telegram Bot

### Tính năng chính
- ✅ **Đăng ký & Quản lý tài khoản** - Tự động tạo tài khoản người dùng
- ✅ **Nạp tiền tự động** - Tích hợp VietQR, tự động xác nhận giao dịch
- ✅ **Mua sản phẩm** - Gmail EDU, VIP packages
- ✅ **Check-in hàng ngày** - Nhận điểm thưởng
- ✅ **Giftcode** - Hệ thống mã quà tặng
- ✅ **Thông báo tự động** - Gửi thông báo đến admin

### Commands
| Lệnh | Mô tả |
|------|-------|
| `/start` | Bắt đầu sử dụng bot |
| `/menu` | Hiển thị menu chính |
| `/nap` | Nạp tiền vào tài khoản |
| `/buy` | Mua sản phẩm |
| `/checkin` | Check-in nhận điểm |
| `/admin` | Panel quản trị (Admin only) |

### Chạy Bot
```bash
npm run dev
```

### Cấu trúc Bot
```
├── main.js                 # Entry point
├── config.js               # Cấu hình
├── includes/
│   ├── controllers/        # Business logic
│   │   ├── accountController.js
│   │   ├── depositController.js
│   │   ├── gmailController.js
│   │   ├── giftcodeController.js
│   │   └── ...
│   ├── handle/             # Event handlers
│   ├── services/           # Background services
│   │   ├── autoDeposit.js  # Tự động xử lý nạp tiền
│   │   └── gmailCleanup.js # Dọn dẹp Gmail
│   └── database/           # Database connection
└── modules/
    └── commands/           # Bot commands
```

---

## 🌐 Webapp (Admin Dashboard)

### Tính năng
- 📊 **Dashboard** - Thống kê doanh thu, đơn hàng, người dùng
- 👥 **Quản lý Users** - Xem, sửa, xóa người dùng
- 📦 **Quản lý Products** - Thêm, sửa sản phẩm
- 💰 **Quản lý Deposits** - Lịch sử nạp tiền
- 📋 **Quản lý Orders** - Lịch sử đơn hàng
- 📧 **Gmail EDU** - Quản lý email EDU
- 🏦 **Bank History** - Lịch sử giao dịch ngân hàng
- 📢 **Broadcast** - Gửi thông báo hàng loạt
- ⚙️ **Settings** - Cấu hình hệ thống

### Chạy Webapp
```bash
cd webapp
npm run dev
```

Truy cập: http://localhost:8692

### Cấu trúc Webapp
```
webapp/
├── app/
│   ├── (auth)/             # Đăng nhập
│   ├── (dashboard)/        # Các trang dashboard
│   │   ├── page.tsx        # Trang chủ dashboard
│   │   ├── users/          # Quản lý người dùng
│   │   ├── products/       # Quản lý sản phẩm
│   │   ├── orders/         # Quản lý đơn hàng
│   │   ├── deposits/       # Quản lý nạp tiền
│   │   ├── gmail-edu/      # Quản lý Gmail EDU
│   │   ├── bank-history/   # Lịch sử ngân hàng
│   │   ├── notifications/  # Thông báo
│   │   └── settings/       # Cài đặt
│   └── api/                # API routes
├── components/             # UI Components
├── lib/                    # Utilities
└── locales/                # Đa ngôn ngữ (vi/en)
```

### Tech Stack
- **Framework**: Next.js 16
- **UI**: Tailwind CSS 4, Radix UI
- **Database**: MySQL 2
- **Charts**: Recharts
- **Icons**: Lucide React

---

## 📧 Email EDU Web

Hệ thống tạo và quản lý email Google Workspace EDU.

### Tính năng

#### 👑 Admin
- 🌐 **Quản lý Domains** - Thêm/sửa/xóa domain EDU
- 👥 **Quản lý Users** - Cấp quota email cho users
- 📧 **Quản lý Emails** - Xem tất cả email đã tạo
- 🎬 **Netflix Accounts** - Quản lý tài khoản Netflix
- 📬 **tMail Domains** - Quản lý domain email tạm thời
- ⚙️ **Settings** - Cấu hình hệ thống

#### 👤 User
- ✏️ **Tạo Email EDU** - Tạo email với domain EDU
- 📋 **My Emails** - Xem email đã tạo
- 📬 **tMail** - Email tạm thời với inbox
- 🔐 **2FA Manager** - Quản lý mã 2FA
- 👤 **Profile** - Thông tin cá nhân

### Chạy Email EDU Web
```bash
cd email-edu-web
npm run dev
```

Truy cập: http://localhost:3000

### Setup Database
```bash
# Chạy schema
mysql -u root -p webapi < schema.sql

# Seed admin user
npx ts-node scripts/seed-admin.ts
```

### Cấu trúc Email EDU Web
```
email-edu-web/
├── app/
│   ├── (admin)/            # Admin pages
│   │   └── admin/
│   │       ├── domains/    # Quản lý domains
│   │       ├── users/      # Quản lý users
│   │       ├── emails/     # Quản lý emails
│   │       ├── netflix/    # Quản lý Netflix
│   │       ├── tmail-domains/
│   │       └── settings/
│   ├── (auth)/             # Login
│   ├── (user)/             # User pages
│   │   └── dashboard/
│   │       ├── create-email/
│   │       ├── my-emails/
│   │       ├── tmail/
│   │       ├── 2fa/
│   │       └── profile/
│   └── api/                # API routes
├── components/             # UI Components
├── lib/
│   ├── db.ts               # Database connection
│   ├── auth.ts             # Authentication
│   ├── google-admin.ts     # Google Admin SDK
│   ├── tmail.ts            # tMail API
│   └── 2fa.ts              # 2FA utilities
├── migrations/             # SQL migrations
├── scripts/                # Setup scripts
└── schema.sql              # Database schema
```

### Database Schema
```sql
-- Bảng chính
users           # Người dùng (admin/user)
edu_domains     # Domain EDU
edu_emails      # Email đã tạo
tmail_domains   # Domain email tạm
tmail_accounts  # Tài khoản email tạm
settings        # Cấu hình hệ thống
```

### Tech Stack
- **Framework**: Next.js 16
- **UI**: Tailwind CSS 4, Radix UI
- **Auth**: bcryptjs, middleware-based
- **Database**: MySQL 2
- **Google API**: googleapis (Admin SDK)

---

## 🗄️ Database

Dự án sử dụng MySQL với các bảng chính:

### Bot & Webapp
- `users` - Người dùng Telegram
- `products` - Sản phẩm
- `orders` - Đơn hàng
- `deposits` - Nạp tiền
- `balance_logs` - Lịch sử số dư
- `giftcodes` - Mã quà tặng
- `settings` - Cấu hình

### Email EDU Web
- `users` - Người dùng web (admin/user)
- `edu_domains` - Domain EDU
- `edu_emails` - Email đã tạo
- `tmail_domains` - Domain tMail
- `tmail_accounts` - Tài khoản tMail

---

## 🔧 Scripts

```bash
# Bot
npm run dev                 # Chạy bot với nodemon

# Webapp
cd webapp
npm run dev                 # Dev server (port 8692)
npm run build               # Build production
npm run start               # Start production

# Email EDU Web
cd email-edu-web
npm run dev                 # Dev server (port 3000)
npm run build               # Build production
npm run start               # Start production
```

---

## 📁 Cấu trúc dự án tổng quan

```
BotBanHangTele/
├── 📄 main.js              # Bot entry point
├── 📄 config.js            # Configuration
├── 📄 package.json         # Bot dependencies
├── 📁 includes/            # Bot core logic
├── 📁 modules/             # Bot commands & events
├── 📁 database/            # Google API credentials
├── 📁 scripts/             # Utility scripts
├── 📁 webapp/              # Admin dashboard (Next.js)
└── 📁 email-edu-web/       # Email EDU system (Next.js)
```

---

## 🔒 Bảo mật

- ✅ Mật khẩu được hash với bcrypt
- ✅ Session-based authentication
- ✅ Admin role protection
- ✅ API rate limiting
- ✅ Input validation

---

## 📝 License

Private - All rights reserved.

---

## 👨‍💻 Tác giả

**basil204**

- GitHub: [@basil204](https://github.com/basil204)
