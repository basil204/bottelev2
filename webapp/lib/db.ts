import { createPool, type Pool } from 'mysql2/promise';
import { runPendingMigrations } from './dbMigrations';

// Load .env is handled by Next.js automatically

const globalForDatabase = globalThis as typeof globalThis & { mysqlPool?: Pool };

const pool = globalForDatabase.mysqlPool ?? createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 2,
  queueLimit: 0,
});

// Reuse the same pool during Next.js hot reload instead of leaking connections.
globalForDatabase.mysqlPool = pool;

// Auto-create tables if they don't exist
async function initAccountStorageTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Revenue and admin-management queries depend on this table. Keep its
    // creation in the shared bootstrap so a fresh database does not require a
    // separate one-off script before the dashboard can load.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullname VARCHAR(255) NULL,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        telegram_id VARCHAR(50) NULL,
        role ENUM('super_admin', 'admin') NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_admin_telegram_id (telegram_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Editable sold counter: displayed sold = real sold inventory + adjustment.
    try {
      await pool.query('ALTER TABLE products ADD COLUMN sold_adjustment INT NOT NULL DEFAULT 0');
      console.log('[DB] Added sold_adjustment to products');
    } catch (e: unknown) {
      const dbError = e as { code?: string };
      if (dbError.code !== 'ER_DUP_FIELDNAME' && dbError.code !== 'ER_NO_SUCH_TABLE') {
        console.error('[DB] Error adding products.sold_adjustment:', e);
      }
    }

    // Inventory alerts: configurable threshold per product. This migration is
    // safe to run on every web startup; MySQL reports a duplicate-field error
    // when the database is already up to date.
    try {
      await pool.query('ALTER TABLE products ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 5 AFTER stock');
      console.log('[DB] Added low_stock_threshold to products');
    } catch (e: unknown) {
      const dbError = e as { code?: string };
      if (dbError.code !== 'ER_DUP_FIELDNAME' && dbError.code !== 'ER_NO_SUCH_TABLE') {
        console.error('[DB] Error adding products.low_stock_threshold:', e);
      }
    }

    // Seed settings introduced by newer web versions without overwriting the
    // values configured by an administrator.
    await pool.query(
      "INSERT IGNORE INTO settings (`key`, `value`) VALUES ('deposit_rank_promotions', '[]')"
    );

    for (const migration of [
      "ALTER TABLE users ADD COLUMN customer_tag VARCHAR(50) NULL",
      "ALTER TABLE users ADD COLUMN admin_note TEXT NULL"
    ]) {
      try {
        await pool.query(migration);
        console.log('[DB] Added user administration metadata column');
      } catch (e: unknown) {
        const dbError = e as { code?: string };
        if (dbError.code !== 'ER_DUP_FIELDNAME' && dbError.code !== 'ER_NO_SUCH_TABLE') {
          console.error('[DB] Error updating user administration metadata:', e);
        }
      }
    }

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

    // Upgrade databases created with the older admin_accounts schema.
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
      } catch {
        // Skip if constraint already exists
      }
    } catch (e: any) {
      if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_NO_SUCH_TABLE') {
        console.error('[DB] Error adding category_id to products:', e);
      }
    }

    console.log('[DB] Account storage tables initialized');
    await runPendingMigrations(pool);
  } catch (error) {
    console.error('[DB] Error initializing account storage tables:', error);
  }
}

// Routes that depend on newly introduced columns can await this promise on a
// cold start. Other routes still benefit from the eager initialization.
export const dbReady = initAccountStorageTables();

export default pool;

