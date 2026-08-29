import { createPool, type Pool } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
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

    // Ensure all products columns exist in database schema
    const productColumns = [
      { name: 'sold_adjustment', type: 'INT NOT NULL DEFAULT 0' },
      { name: 'low_stock_threshold', type: 'INT NOT NULL DEFAULT 5' },
      { name: 'delivery_type', type: 'VARCHAR(50) NULL' },
      { name: 'prompt_message', type: 'TEXT NULL' },
      { name: 'item_structure', type: 'VARCHAR(255) NULL' },
      { name: 'account_prefix', type: 'VARCHAR(100) NULL' },
      { name: 'file_delivery_mode', type: 'VARCHAR(50) NULL' },
      { name: 'telegram_file_id', type: 'VARCHAR(255) NULL' },
      { name: 'telegram_file_unique_id', type: 'VARCHAR(255) NULL' },
      { name: 'access_duration_enabled', type: 'TINYINT(1) DEFAULT 0' },
      { name: 'access_duration_days', type: 'INT DEFAULT 30' },
      { name: 'preorder_enabled', type: 'TINYINT(1) DEFAULT 0' },
      { name: 'preorder_fee_vnd', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'preorder_fee_usdt', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'preorder_max_per_user', type: 'INT DEFAULT 5' },
      { name: 'preorder_total_limit', type: 'INT DEFAULT 100' },
      { name: 'image_url', type: 'TEXT NULL' },
      { name: 'emoji', type: 'VARCHAR(50) NULL' },
      { name: 'custom_emoji_id', type: 'VARCHAR(100) NULL' },
      { name: 'telegram_emoji', type: 'VARCHAR(50) NULL' },
      { name: 'telegram_custom_emoji_id', type: 'VARCHAR(100) NULL' }
    ];

    for (const col of productColumns) {
      try {
        await pool.query(`ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`);
        console.log(`[DB] Added ${col.name} column to products table`);
      } catch (e: any) {
        if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_NO_SUCH_TABLE') {
          console.error(`[DB] Error adding ${col.name} to products:`, e.message);
        }
      }
    }

    // Seed settings introduced by newer web versions without overwriting the
    // values configured by an administrator.
    await pool.query(
      "INSERT IGNORE INTO settings (`key`, `value`) VALUES ('deposit_rank_promotions', '[]')"
    );

    for (const migration of [
      "ALTER TABLE users ADD COLUMN customer_tag VARCHAR(50) NULL",
      "ALTER TABLE users ADD COLUMN admin_note TEXT NULL",
      "ALTER TABLE user_api_keys ADD COLUMN permissions VARCHAR(255) DEFAULT 'all'"
    ]) {
      try {
        await pool.query(migration);
        console.log('[DB] Applied table column migration:', migration);
      } catch (e: unknown) {
        const dbError = e as { code?: string };
        if (dbError.code !== 'ER_DUP_FIELDNAME' && dbError.code !== 'ER_NO_SUCH_TABLE') {
          console.error('[DB] Error running migration:', migration, e);
        }
      }
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_types (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Auto-seed default account types if empty
    await pool.query(
      "INSERT IGNORE INTO account_types (name) VALUES ('CapCut Pro'), ('Gmail EDU'), ('Canva Pro')"
    );

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
        INDEX idx_sale_status (sale_status)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS capcut_admin_workspaces (
        id INT PRIMARY KEY AUTO_INCREMENT,
        admin_email VARCHAR(255) NOT NULL,
        admin_password VARCHAR(255) NOT NULL,
        admin_cookie TEXT NOT NULL,
        workspace_id VARCHAR(100) NOT NULL UNIQUE,
        workspace_name VARCHAR(255) NULL,
        member_limit INT DEFAULT 7,
        member_cnt INT DEFAULT 1,
        team_vip_end BIGINT DEFAULT 0,
        status ENUM('active', 'full', 'expired', 'disabled') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_ws_id (workspace_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS capcut_user_warranties (
        id INT PRIMARY KEY AUTO_INCREMENT,
        telegram_id VARCHAR(50) NOT NULL,
        user_capcut_email VARCHAR(255) NOT NULL,
        user_capcut_uid VARCHAR(100) NULL,
        workspace_id VARCHAR(100) NOT NULL,
        admin_email VARCHAR(255) NULL,
        price_paid DECIMAL(15,2) DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        status ENUM('active', 'expired', 'refunded') DEFAULT 'active',
        note TEXT NULL,
        INDEX idx_tg_id (telegram_id),
        INDEX idx_user_email (user_capcut_email),
        INDEX idx_ws_id (workspace_id),
        INDEX idx_admin_email (admin_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    try {
      await pool.query("ALTER TABLE capcut_user_warranties ADD COLUMN admin_email VARCHAR(255) NULL AFTER workspace_id");
    } catch (e: any) {}

    // Create broadcast_templates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS broadcast_templates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        message TEXT NOT NULL,
        image_url TEXT NULL,
        inline_keyboard JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Seed default templates if empty
    try {
      const [tplCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM broadcast_templates');
      if (tplCount[0]?.cnt === 0) {
        await pool.query(
          `INSERT INTO broadcast_templates (title, category, message, image_url, inline_keyboard) VALUES
           (?, 'product', ?, '', ?),
           (?, 'general', ?, '', ?),
           (?, 'maintenance', ?, '', ?)`,
          [
            'Hàng mới lên kho',
            '{5375135722514685501} HÀNG MỚI VỪA LÊN KHO\n\nSản phẩm hot vừa được nhập thêm.\nNhanh tay mua trước khi hết hàng.',
            JSON.stringify([[{ id: 'btn_1', text: '{5375135722514685501} Xem sản phẩm', type: 'callback', callbackData: 'start:shop' }]]),
            'Thông báo Khuyến mãi & Sự kiện',
            '🎉 **CHƯƠNG TRÌNH KHUYẾN MÃI ĐẶC BIỆT**\n\nShop giảm giá cực sốc tất cả các sản phẩm hôm nay!\nĐừng bỏ lỡ cơ hội sở hữu tài khoản VIP giá cực ưu đãi.',
            JSON.stringify([[{ id: 'btn_2', text: '🔥 Mua Ngay Giảm Giá', type: 'callback', callbackData: 'start:shop' }]]),
            'Thông báo Bảo trì hệ thống',
            '⚠️ **THÔNG BÁO BẢO TRÌ HỆ THỐNG**\n\nHệ thống sẽ tiến hành bảo trì nâng cấp trong ít phút.\nCác giao dịch hiện tại có thể bị gián đoạn nhẹ. Xin cảm ơn sự kiên nhẫn của bạn!',
            JSON.stringify([[{ id: 'btn_3', text: '📞 Liên Hệ Hỗ Trợ', type: 'url', url: 'https://t.me' }]])
          ]
        );
      }
    } catch (e: any) {
      console.error('[DB] Error seeding broadcast_templates:', e?.message);
    }


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
          emoji VARCHAR(50) NULL,
          custom_emoji_id VARCHAR(100) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      for (const col of [
        { name: 'emoji', type: 'VARCHAR(50) NULL' },
        { name: 'custom_emoji_id', type: 'VARCHAR(100) NULL' }
      ]) {
        try {
          await pool.query(`ALTER TABLE categories ADD COLUMN ${col.name} ${col.type}`);
        } catch {}
      }
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

    // Create chatgpt_accounts table (Kho tài khoản ChatGPT: TK, MK, 2FA, Plus/Free, Live/Die)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chatgpt_accounts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          twofa_secret VARCHAR(255) NULL,
          is_plus TINYINT(1) NOT NULL DEFAULT 0,
          plan_type VARCHAR(50) NOT NULL DEFAULT 'free',
          status ENUM('live', 'die', 'wrong_pass', 'twofa_error', 'uncheck') NOT NULL DEFAULT 'uncheck',
          sale_status ENUM('in_stock', 'sold', 'used', 'reserved') NOT NULL DEFAULT 'in_stock',
          note TEXT NULL,
          last_checked_at TIMESTAMP NULL,
          plus_updated_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_chatgpt_email (email),
          INDEX idx_chatgpt_is_plus (is_plus),
          INDEX idx_chatgpt_status (status),
          INDEX idx_chatgpt_sale_status (sale_status),
          INDEX idx_chatgpt_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('[DB] chatgpt_accounts table initialized');
    } catch (e: any) {
      console.error('[DB] Error initializing chatgpt_accounts table:', e);
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
