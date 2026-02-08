import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// API to manually create tables if they don't exist
export async function GET() {
    try {
        // Create account_types table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS account_types (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create stored_accounts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stored_accounts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                account_type_id INT NOT NULL,
                data TEXT NOT NULL,
                payment_status ENUM('pending', 'paid', 'invalid') DEFAULT 'pending',
                sale_status ENUM('in_stock', 'sold') DEFAULT 'in_stock',
                paid_at TIMESTAMP NULL,
                sold_at TIMESTAMP NULL,
                note TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_type_id) REFERENCES account_types(id) ON DELETE CASCADE,
                INDEX idx_type (account_type_id),
                INDEX idx_payment_status (payment_status),
                INDEX idx_sale_status (sale_status)
            )
        `);

        // Create ChatGPT FAM table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatgpt_fams (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL COMMENT 'Tên FAM để dễ quản lý',
                workspace_id VARCHAR(100) NOT NULL UNIQUE COMMENT 'chatgpt_account_id từ ChatGPT',
                authorization TEXT NOT NULL COMMENT 'Bearer token',
                max_slots INT DEFAULT 5 COMMENT 'Tổng số slot (bao gồm owner)',
                used_slots INT DEFAULT 0 COMMENT 'Số slot đã sử dụng',
                status ENUM('active', 'full', 'inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Create ChatGPT rentals table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatgpt_rentals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL COMMENT 'Telegram user ID',
                fam_id INT NOT NULL COMMENT 'FAM được gán',
                email VARCHAR(255) NOT NULL COMMENT 'Email khách hàng',
                price DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT 'Giá đã thanh toán',
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP NOT NULL COMMENT 'Ngày hết hạn',
                status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
                invite_status ENUM('pending', 'sent', 'accepted', 'failed') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (fam_id) REFERENCES chatgpt_fams(id) ON DELETE CASCADE,
                INDEX idx_user (user_id),
                INDEX idx_fam (fam_id),
                INDEX idx_email (email),
                INDEX idx_status (status),
                INDEX idx_end_date (end_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Insert default ChatGPT settings
        await pool.query(`
            INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('chatgpt_slot_price', '60000')
        `);
        await pool.query(`
            INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('chatgpt_slot_days', '30')
        `);

        console.log('[DB] ChatGPT tables initialized');

        return NextResponse.json({
            success: true,
            message: 'Tables created successfully (including ChatGPT)'
        });
    } catch (error) {
        console.error('Error creating tables:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
