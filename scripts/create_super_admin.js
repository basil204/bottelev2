/**
 * Script tạo tài khoản Super Admin mặc định
 * Chạy: node scripts/create_super_admin.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function createSuperAdmin() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || 'root',
        database: process.env.DB_NAME || 'botteleandweb'
    });

    try {
        console.log('🔧 Đang tạo bảng admin_accounts nếu chưa có...');

        // Tạo bảng admin_accounts nếu chưa có
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admin_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fullname VARCHAR(255),
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('super_admin', 'admin') NOT NULL DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Kiểm tra xem manhit đã tồn tại chưa
        const [existing] = await connection.query(
            'SELECT id FROM admin_accounts WHERE username = ?',
            ['manhit']
        );

        if (existing.length > 0) {
            console.log('⚠️  Tài khoản manhit đã tồn tại, đang cập nhật thành Super Admin...');
            await connection.query(
                "UPDATE admin_accounts SET role = 'super_admin', fullname = 'Super Admin' WHERE username = 'manhit'"
            );
        } else {
            console.log('➕ Đang tạo tài khoản Super Admin mới...');
            await connection.query(
                "INSERT INTO admin_accounts (fullname, username, password, role) VALUES (?, ?, ?, ?)",
                ['Super Admin', 'manhit', 'manhit', 'super_admin']
            );
        }

        // Cũng cập nhật vào bảng settings để backward compatibility
        await connection.query(`
            INSERT INTO settings (\`key\`, \`value\`) VALUES ('admin_username', 'manhit')
            ON DUPLICATE KEY UPDATE \`value\` = 'manhit'
        `);
        await connection.query(`
            INSERT INTO settings (\`key\`, \`value\`) VALUES ('admin_password', 'manhit')
            ON DUPLICATE KEY UPDATE \`value\` = 'manhit'
        `);

        console.log('✅ Hoàn thành! Tài khoản Super Admin:');
        console.log('   Username: manhit');
        console.log('   Password: manhit');
        console.log('   Role: super_admin');

        // Hiển thị danh sách tài khoản
        const [accounts] = await connection.query('SELECT id, fullname, username, role FROM admin_accounts');
        console.log('\n📋 Danh sách tài khoản admin:');
        console.table(accounts);

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        await connection.end();
    }
}

createSuperAdmin();
