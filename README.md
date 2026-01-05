# Bot Bán Hàng Telegram

Bot bán hàng tự động qua Telegram với nạp tiền VietQR, quản lý sản phẩm/tài khoản, đơn hàng và trình quản trị inline cho admin.

## Yêu cầu
- Node.js >= 18
- MariaDB / MySQL 8

## Cài đặt
```bash
npm install
```

## Cấu hình
Chỉnh `config.json` (hoặc đặt biến môi trường) với các giá trị:
- `TELEGRAM_BOT_TOKEN`
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `VIETQR_ACCOUNT_NO`, `VIETQR_BANK_CODE`
- `ADMIN_IDS` (mảng ID admin)
- `NOTIFY_MODE` = `all` hoặc `buyer`
- `PAGE_SIZE` (mặc định 10)

Biến môi trường sẽ override giá trị trong `config.json`.

## Chạy
```bash
npm run dev
```

## Luồng chính
- `/start` hoặc `/menu`: tạo user nếu chưa có, hiển thị số dư và menu.
- Nạp tiền: nhập số tiền, bot tạo nội dung chuyển khoản `NAP_<TELEGRAM_ID>`, lưu `deposits` status `pending`, admin duyệt.
- Mua sản phẩm: phân trang sản phẩm, kiểm tra số dư, trừ tiền, giao 1 account khả dụng, lưu order.
- Admin `/admin`: menu inline CRUD sản phẩm, tài khoản, duyệt nạp, cộng/trừ tiền, xem user/orders/deposits (phân trang).

## Nạp tự động (tùy chọn)
- Chạy service lấy lịch sử (ví dụ code Puppeteer ở yêu cầu) trả JSON tại `AUTODEPOSIT_API_URL` (mặc định `http://localhost:6868/`).
- Cấu hình `AUTODEPOSIT_API_URL`, `AUTODEPOSIT_POLL_MS`.
- Bot sẽ quét giao dịch có nội dung `NAP_<TELEGRAM_ID>`, cộng tiền tự động và ghi log `auto_deposit:<ref>`.

## SQL
Xem `database/schema.sql`.

## Upload tài khoản
File `.txt` mỗi dòng: `username|password`. Ví dụ: `accounts_example.txt`.

## Log
Console + `utils/log.js` ghi log cho user, admin, sự kiện.

