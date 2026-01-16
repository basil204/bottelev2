import { query } from './includes/database/index.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const configPath = path.join(process.cwd(), 'config.json');
const fileConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath)) : {};

const config = {
  DB_HOST: process.env.DB_HOST || fileConfig.DB_HOST,
  DB_NAME: process.env.DB_NAME || fileConfig.DB_NAME,
  DB_USER: process.env.DB_USER || fileConfig.DB_USER,
  DB_PASS: process.env.DB_PASS || fileConfig.DB_PASS,
};

const migrate = async () => {
  try {
    console.log('🔄 Bắt đầu migration...');
    
    // Xóa hết data sản phẩm
    console.log('🗑️  Xóa hết data sản phẩm...');
    await query('DELETE FROM orders WHERE product_id IN (SELECT id FROM products)');
    await query('DELETE FROM accounts WHERE product_id IN (SELECT id FROM products)');
    await query('DELETE FROM products');
    console.log('✅ Đã xóa hết data sản phẩm');
    
    // Đổi type từ auto/manual thành order/stock
    console.log('🔄 Đổi type sản phẩm...');
    try {
      // Kiểm tra xem có cột type không (dùng query trực tiếp vì SHOW COLUMNS không hỗ trợ prepared statement)
      const columns = await query("SHOW COLUMNS FROM products WHERE Field = 'type'");
      if (columns && columns.length > 0) {
        // Cột type đã tồn tại, kiểm tra enum hiện tại
        const columnInfo = columns[0];
        if (columnInfo.Type && (columnInfo.Type.includes('auto') || columnInfo.Type.includes('manual'))) {
          // Đổi giá trị: auto -> stock, manual -> order
          await query(`UPDATE products SET type = CASE 
            WHEN type = 'auto' THEN 'stock'
            WHEN type = 'manual' THEN 'order'
            ELSE 'stock'
          END`);
          // Sửa lại enum
          await query(`ALTER TABLE products MODIFY COLUMN type ENUM('order', 'stock') DEFAULT 'stock'`);
          console.log('✅ Đã cập nhật type sản phẩm và enum');
        } else {
          console.log('✅ Cột type đã đúng định dạng');
        }
      } else {
        // Nếu chưa có cột type, thêm mới
        await query(`ALTER TABLE products ADD COLUMN type ENUM('order', 'stock') DEFAULT 'stock'`);
        console.log('✅ Đã thêm cột type');
      }
    } catch (err) {
      // Nếu lỗi do cột chưa tồn tại, thêm mới
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.message.includes('Unknown column')) {
        try {
          await query(`ALTER TABLE products ADD COLUMN type ENUM('order', 'stock') DEFAULT 'stock'`);
          console.log('✅ Đã thêm cột type');
        } catch (addErr) {
          console.error('❌ Không thể thêm cột type:', addErr.message);
          throw addErr;
        }
      } else {
        console.error('❌ Lỗi khi xử lý cột type:', err.message);
        throw err;
      }
    }
    
    console.log('✅ Migration hoàn tất!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi migration:', error);
    process.exit(1);
  }
};

// Import initDb để khởi tạo connection
import('./includes/database/index.js').then(async ({ initDb }) => {
  await initDb(config);
  await migrate();
});
