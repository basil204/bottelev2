# 🎨 Canva Automated API Service (Dùng Session JSON)

Thư mục API độc lập, siêu tốc dành riêng cho Canva (Tạo lời mời thành viên đội ngũ, bắt link mời công khai, lấy số lượng thành viên và quản lý team).

---

## ⚡ Điểm nổi bật
- **Sử dụng `canva_session.json`**: Chạy ngầm 100% (Headless), tự động nạp toàn bộ cookies và localStorage từ `canva_session.json`.
- **Vượt Cloudflare 100%**: Không bị chặn bởi Cloudflare Bot Challenge, tự động lấy lời mời thành công và trả về URL mời ngay lập tức.
- **Không cần mở cửa sổ trình duyệt hay thao tác tay**.
- **Hỗ trợ 3 vai trò**:
  - `designer` (Mã `C`): Nhà thiết kế thương hiệu của đội (Mặc định).
  - `member` (Mã `B`): Thành viên đội.
  - `admin` (Mã `A`): Quản trị viên đội.
- **Tích hợp sẵn REST API Server & Web UI Dashboard**.

---

## 📁 Cấu trúc thư mục `api_canva`

```text
api_canva/
├── canva_api.js             # Module Core API (sendCanvaInviteApi, batchInvite, getTeamInfo)
├── server.js                # REST API Server Express & Giao diện Web Dashboard (Port 3001)
├── canva_session.json       # File session lưu trữ Cookies & LocalStorage của Canva
├── canva_invites.json       # Lịch sử chi tiết các lần mời và Response từ Canva
├── canva_invite_links.txt   # File tổng hợp link mời theo thời gian
├── package.json             # Cấu hình package độc lập
├── run_api_server.bat       # 1-Click chạy REST API Server & Web UI
└── run_invite_cli.bat       # 1-Click chạy giao diện mời qua CLI
```

---

## 🚀 Hướng Dẫn Sử Dụng

### 1. Dùng Web Dashboard & REST API Server
Chạy file `run_api_server.bat` hoặc lệnh:
```bash
node api_canva/server.js
```
Truy cập: **http://localhost:3001**

#### Danh sách API Endpoints:
- **`POST /api/invite`**: Gửi lời mời 1 email
  - Body: `{ "email": "user@gmail.com", "role": "designer" }`
  - Response:
    ```json
    {
      "success": true,
      "email": "user@gmail.com",
      "role": "Nhà thiết kế thương hiệu của đội",
      "roleCode": "C",
      "inviteLink": "https://www.canva.com/brand/join?token=...",
      "inviteToken": "...",
      "teamName": "Shuyen Liu's Team"
    }
    ```
- **`POST /api/invite-batch`**: Mời nhiều email cùng lúc
  - Body: `{ "emails": ["a@gmail.com", "b@gmail.com"], "role": "designer", "delayMs": 1000 }`
- **`GET /api/team-info`**: Kiểm tra trạng thái session và số lượng thành viên
- **`GET /api/invites`**: Lấy danh sách lịch sử các lời mời đã gửi

---

### 2. Dùng qua Dòng Lệnh (CLI)
Chạy file `run_invite_cli.bat` hoặc lệnh:
```bash
# Chạy ở chế độ tương tác hỏi đáp:
node api_canva/canva_api.js

# Hoặc truyền trực tiếp email và vai trò:
node api_canva/canva_api.js user@gmail.com --designer
node api_canva/canva_api.js user@gmail.com --member
node api_canva/canva_api.js user@gmail.com --admin
```

---

### 3. Nhúng vào Code Node.js khác
```javascript
const { sendCanvaInviteApi, getTeamInfo } = require('./api_canva/canva_api');

async function main() {
  const result = await sendCanvaInviteApi('khachhang@gmail.com', 'designer');
  if (result.success) {
    console.log('Link mời:', result.inviteLink);
    console.log('Tên Team:', result.teamName);
  }
}

main();
```
