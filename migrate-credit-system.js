import { initDb } from './includes/database/index.js';
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
    console.log('🔄 Đang kết nối database...');
    await initDb(config);
    console.log('✅ Đã kết nối database');

    // Thêm cột credit nếu chưa có
    try {
      await query('ALTER TABLE users ADD COLUMN credit INT DEFAULT 0');
      console.log('✅ Đã thêm cột credit vào bảng users');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Cột credit đã tồn tại');
      } else {
        throw e;
      }
    }

    // Thêm cột referral_code nếu chưa có
    try {
      await query('ALTER TABLE users ADD COLUMN referral_code VARCHAR(50) UNIQUE');
      console.log('✅ Đã thêm cột referral_code vào bảng users');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Cột referral_code đã tồn tại');
      } else {
        throw e;
      }
    }

    // Tạo bảng checkins
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS checkins (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_checked (user_id, checked_at)
        )
      `);
      console.log('✅ Đã tạo bảng checkins');
    } catch (e) {
      console.log('ℹ️  Bảng checkins có thể đã tồn tại');
    }

    // Tạo bảng referrals
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS referrals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          referrer_id INT NOT NULL,
          referred_id INT NOT NULL,
          credit_rewarded INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_referral (referrer_id, referred_id),
          INDEX idx_referrer (referrer_id),
          INDEX idx_referred (referred_id)
        )
      `);
      console.log('✅ Đã tạo bảng referrals');
    } catch (e) {
      console.log('ℹ️  Bảng referrals có thể đã tồn tại');
    }

    // Cập nhật credit = 0 cho các user chưa có credit
    await query('UPDATE users SET credit = 0 WHERE credit IS NULL');
    console.log('✅ Đã cập nhật credit cho các user hiện có');

    console.log('\n🎉 Migration hoàn tất!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi migration:', error);
    process.exit(1);
  }
};

migrate();

