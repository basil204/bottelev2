import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load .env is handled by Next.js automatically

const pool = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Auto-create tables if they don't exist
async function initAccountStorageTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_types (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Add invoice_code column to orders table if not exists
    try {
      await pool.query(`
        ALTER TABLE orders ADD COLUMN invoice_code VARCHAR(50) NULL AFTER status
      `);
      console.log('[DB] Added invoice_code column to orders table');
    } catch (e: any) {
      // Column already exists, ignore error
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.log('[DB] invoice_code column already exists or table not ready');
      }
    }

    // Add telegram_id column to admin_accounts if not exists
    try {
      await pool.query(`
        ALTER TABLE admin_accounts ADD COLUMN telegram_id VARCHAR(50) NULL AFTER password
      `);
      console.log('[DB] Added telegram_id column to admin_accounts table');
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_NO_SUCH_TABLE') {
        console.error('[DB] Error adding telegram_id to admin_accounts:', e);
      }
    }

    // Create admin_logs table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          admin_id INT DEFAULT NULL,
          admin_name VARCHAR(100) DEFAULT NULL,
          action VARCHAR(50) NOT NULL,
          target_type VARCHAR(50) NOT NULL,
          target_id VARCHAR(100) DEFAULT NULL,
          details TEXT DEFAULT NULL,
          ip_address VARCHAR(255) DEFAULT NULL,
          user_agent TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_admin_id (admin_id),
          INDEX idx_action (action),
          INDEX idx_target_type (target_type),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('[DB] admin_logs table initialized');
    } catch (e: any) {
      console.error('[DB] Error initializing admin_logs table:', e);
    }

    // Expand ip_address column in admin_logs
    try {
      await pool.query(`
        ALTER TABLE admin_logs MODIFY COLUMN ip_address VARCHAR(255)
      `);
      console.log('[DB] Expanded ip_address column in admin_logs table');
    } catch (e: any) {
      if (e.code !== 'ER_NO_SUCH_TABLE') {
        console.error('[DB] Error expanding ip_address in admin_logs:', e);
      }
    }
    // Create categories table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          priority INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('[DB] Categories table initialized');
    } catch (e: any) {
      console.error('[DB] Error initializing categories table:', e);
    }

    // Add category_id column to products table if not exists
    try {
      await pool.query(`
        ALTER TABLE products ADD COLUMN category_id INT NULL DEFAULT NULL
      `);
      console.log('[DB] Added category_id column to products table');
      try {
        await pool.query(`
          ALTER TABLE products ADD CONSTRAINT fk_products_categories FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        `);
        console.log('[DB] Added foreign key constraint fk_products_categories');
      } catch (fkErr: any) {
        // Skip if constraint already exists
      }
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_NO_SUCH_TABLE') {
        console.error('[DB] Error adding category_id to products:', e);
      }
    }

    console.log('[DB] Account storage tables initialized');
  } catch (error) {
    console.error('[DB] Error initializing account storage tables:', error);
  }
}

// Run on import
initAccountStorageTables();

export default pool;

