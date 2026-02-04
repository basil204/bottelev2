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
    console.log('[DB] Account storage tables initialized');
  } catch (error) {
    console.error('[DB] Error initializing account storage tables:', error);
  }
}

// Run on import
initAccountStorageTables();

export default pool;

