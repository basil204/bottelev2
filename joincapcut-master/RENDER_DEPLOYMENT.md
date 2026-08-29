# 🚀 Hướng dẫn Deploy lên Render

## 📋 Environment Variables cần thiết

Trong Render Dashboard, thêm các Environment Variables sau:

### **MySQL Configuration:**
```
MYSQL_HOST=160.191.245.27
MYSQL_USER=admin
MYSQL_PASSWORD=admin
MYSQL_DATABASE=gw_temp_users_1
MYSQL_PORT=3306
```

### **Server Configuration:**
```
PORT=3000
NODE_ENV=production
```

## 🔧 Cách thêm Environment Variables:

1. **Vào Render Dashboard**
2. **Chọn service của bạn**
3. **Vào tab "Environment"**
4. **Thêm từng variable:**
   - Key: `MYSQL_HOST`, Value: `160.191.245.27`
   - Key: `MYSQL_USER`, Value: `admin`
   - Key: `MYSQL_PASSWORD`, Value: `admin`
   - Key: `MYSQL_DATABASE`, Value: `gw_temp_users_1`
   - Key: `MYSQL_PORT`, Value: `3306`

## 🐛 Troubleshooting MySQL Connection:

### **Lỗi thường gặp:**
- `ENOTFOUND`: DNS resolution failed
- `ETIMEDOUT`: Connection timeout
- `ECONNREFUSED`: Connection refused
- `ER_ACCESS_DENIED_ERROR`: Access denied
- `ER_BAD_DB_ERROR`: Database doesn't exist

### **Giải pháp:**
1. **Kiểm tra MySQL Server:**
   - Server đang chạy và accessible
   - User có quyền connect và read/write
   - Database tồn tại

2. **Kiểm tra Environment Variables:**
   - Đảm bảo tất cả MySQL config được set đúng
   - Không có space thừa
   - Port number đúng (3306)

3. **Kiểm tra logs:**
   - Vào Render Dashboard > Logs
   - Tìm `[MYSQL]` để xem connection status

## 🔍 Test Connection:

Sau khi deploy, test bằng cách:
1. Vào admin panel: `https://your-app.onrender.com/admin.html`
2. Click "🗄️ Test MySQL"
3. Kiểm tra logs để xem kết quả

## 📝 Build Command:
```
npm install
```

## 📝 Start Command:
```
node web_app.js
```
