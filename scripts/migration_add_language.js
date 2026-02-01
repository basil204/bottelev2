/**
 * Migration script để thêm cột language vào bảng users
 * Chạy: node scripts/migration_add_language.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'botbanhang'
    });

    try {
        console.log('Đang kiểm tra cột language trong bảng users...');

        // Kiểm tra xem cột đã tồn tại chưa
        const [columns] = await connection.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'language'`,
            [process.env.DB_NAME || 'botbanhang']
        );

        if (columns.length > 0) {
            console.log('✓ Cột language đã tồn tại.');
        } else {
            console.log('Đang thêm cột language...');
            await connection.query(
                `ALTER TABLE users ADD COLUMN language VARCHAR(5) DEFAULT NULL`
            );
            console.log('✓ Đã thêm cột language thành công!');
        }

        console.log('\n✅ Migration hoàn tất!');
    } catch (error) {
        console.error('❌ Lỗi migration:', error.message);
    } finally {
        await connection.end();
    }
}

migrate();
