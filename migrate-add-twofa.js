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
    console.log('🔄 Bắt đầu migration thêm cột twofa...');
    
    // Kiểm tra xem có cột twofa không
    const columns = await query("SHOW COLUMNS FROM accounts WHERE Field = 'twofa'");
    if (columns && columns.length > 0) {
      console.log('✅ Cột twofa đã tồn tại.');
    } else {
      // Thêm cột twofa
      await query('ALTER TABLE accounts ADD COLUMN twofa VARCHAR(255) NULL DEFAULT NULL AFTER password');
      console.log('✅ Đã thêm cột twofa vào bảng accounts');
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
