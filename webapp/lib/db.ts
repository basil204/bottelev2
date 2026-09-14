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
      { name: 'telegram_custom_emoji_id', type: 'VARCHAR(100) NULL' },
      { name: 'name_vi', type: 'VARCHAR(255) NULL' },
      { name: 'name_en', type: 'VARCHAR(255) NULL' },
      { name: 'name_zh', type: 'VARCHAR(255) NULL' },
      { name: 'description_vi', type: 'TEXT NULL' },
      { name: 'description_en', type: 'TEXT NULL' },
      { name: 'description_zh', type: 'TEXT NULL' },
      { name: 'note_vi', type: 'TEXT NULL' },
      { name: 'note_en', type: 'TEXT NULL' },
      { name: 'note_zh', type: 'TEXT NULL' },
      { name: 'prompt_message_vi', type: 'TEXT NULL' },
      { name: 'prompt_message_en', type: 'TEXT NULL' },
      { name: 'prompt_message_zh', type: 'TEXT NULL' }
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

    // Auto Netflix 30 Days Tasks & Queue table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS netflix_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        telegram_id VARCHAR(64) NULL,
        email VARCHAR(255) NOT NULL,
        price DECIMAL(15, 2) DEFAULT 0,
        proxy_used VARCHAR(255) NULL,
        status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
        step_status VARCHAR(255) NULL,
        error_message TEXT NULL,
        screenshot_path VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        INDEX idx_netflix_status (status),
        INDEX idx_netflix_tg (telegram_id),
        INDEX idx_netflix_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Seed default settings for Netflix 30 Days
    await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_enabled', 'true')");
    await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_price', '25000')");
    await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_headless', 'true')");
    await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_concurrency', '1')");
    await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_proxies', '')");


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

    // Initialize Seller Manager tables
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS seller_wallets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type ENUM('CASH', 'BANK', 'EWALLET') DEFAULT 'BANK',
          account_number VARCHAR(100) NULL,
          balance DECIMAL(15, 2) DEFAULT 0,
          icon VARCHAR(50) DEFAULT 'Wallet',
          is_default TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS seller_account_types (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(50) NOT NULL UNIQUE,
          icon VARCHAR(50) DEFAULT 'Folder',
          description TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS seller_products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          account_type_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          default_cost_price DECIMAL(15, 2) DEFAULT 0,
          default_selling_price DECIMAL(15, 2) DEFAULT 0,
          description TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_type_id) REFERENCES seller_account_types(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS seller_customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NULL,
          email VARCHAR(255) NULL,
          notes TEXT NULL,
          debt_amount DECIMAL(15, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS seller_orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_number VARCHAR(50) NOT NULL UNIQUE,
          customer_id INT NULL,
          wallet_id INT NULL,
          status ENUM('COMPLETED', 'PENDING', 'CANCELLED') DEFAULT 'COMPLETED',
          payment_status ENUM('PAID', 'UNPAID', 'PARTIAL') DEFAULT 'PAID',
          total_cost DECIMAL(15, 2) DEFAULT 0,
          total_amount DECIMAL(15, 2) DEFAULT 0,
          total_profit DECIMAL(15, 2) DEFAULT 0,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES seller_customers(id) ON DELETE SET NULL,
          FOREIGN KEY (wallet_id) REFERENCES seller_wallets(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS seller_inventory (
          id INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT NOT NULL,
          credentials TEXT NOT NULL,
          cost_price DECIMAL(15, 2) DEFAULT 0,
          selling_price DECIMAL(15, 2) DEFAULT 0,
          status ENUM('AVAILABLE', 'SOLD', 'ERROR', 'RESERVED') DEFAULT 'AVAILABLE',
          order_id INT NULL,
          note TEXT NULL,
          sold_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES seller_products(id) ON DELETE CASCADE,
          FOREIGN KEY (order_id) REFERENCES seller_orders(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS seller_order_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT NOT NULL,
          unit_cost DECIMAL(15, 2) DEFAULT 0,
          unit_price DECIMAL(15, 2) DEFAULT 0,
          subtotal DECIMAL(15, 2) DEFAULT 0,
          profit DECIMAL(15, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES seller_orders(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES seller_products(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS seller_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          wallet_id INT NOT NULL,
          order_id INT NULL,
          type ENUM('INCOME', 'EXPENSE', 'TRANSFER') NOT NULL,
          category VARCHAR(100) NOT NULL,
          amount DECIMAL(15, 2) NOT NULL,
          description TEXT NULL,
          reference VARCHAR(100) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (wallet_id) REFERENCES seller_wallets(id) ON DELETE CASCADE,
          FOREIGN KEY (order_id) REFERENCES seller_orders(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Seed initial data if seller_wallets empty
      const [wCheck] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM seller_wallets');
      if (wCheck[0]?.cnt === 0) {
        await pool.query(`
          INSERT INTO seller_wallets (name, type, account_number, balance, is_default) VALUES
          ('Tiền mặt', 'CASH', NULL, 2000000, 1),
          ('Ngân hàng (Vietcombank)', 'BANK', '9988776655', 8500000, 0),
          ('Ví MoMo', 'EWALLET', '0987654321', 1200000, 0)
        `);

        await pool.query(`
          INSERT INTO seller_account_types (name, code, icon, description) VALUES
          ('Gmail', 'GMAIL', 'Mail', 'Gmail cổ, 2FA, khôi phục'),
          ('ChatGPT', 'CHATGPT', 'Bot', 'OpenAI / ChatGPT Plus'),
          ('Domain & Hosting', 'HOSTING', 'Globe', 'Domain, VPS, Web hosting'),
          ('Tài khoản Game', 'GAME', 'Gamepad2', 'Steam, Riot, Netflix')
        `);

        await pool.query(`
          INSERT INTO seller_products (account_type_id, name, default_cost_price, default_selling_price, description) VALUES
          (2, 'ChatGPT Plus 1 Tháng (Dùng riêng)', 150000, 280000, 'Gói nâng cấp 20$/tháng'),
          (1, 'Gmail Cổ 2020 (Bao đổi 2FA)', 15000, 35000, 'Gmail tạo 2020'),
          (4, 'Netflix Premium 4K (Profile riêng)', 40000, 75000, 'Xem mượt 4K UHD')
        `);

        await pool.query(`
          INSERT INTO seller_inventory (product_id, credentials, cost_price, selling_price, status, note) VALUES
          (1, 'gpt_user1@gmail.com|Pass1234!|JBSWY3DPEHPK3PXP|recovery1@gmail.com', 150000, 280000, 'AVAILABLE', 'Import mẫu'),
          (1, 'gpt_user2@gmail.com|Pass1234!|JBSWY3DPEHPK3PYY|recovery2@gmail.com', 150000, 280000, 'AVAILABLE', 'Import mẫu'),
          (2, 'gmail2020_1@gmail.com|Pass99!|2FA1|rec1@gmail.com', 15000, 35000, 'AVAILABLE', 'Import mẫu'),
          (2, 'gmail2020_2@gmail.com|Pass99!|2FA2|rec2@gmail.com', 15000, 35000, 'AVAILABLE', 'Import mẫu')
        `);

        await pool.query(`
          INSERT INTO seller_customers (name, phone, email, notes, debt_amount) VALUES
          ('Nguyễn Văn Minh', '0901234567', 'minh.nguyen@gmail.com', 'Khách sỉ mua ChatGPT', 0),
          ('Trần Thị Thu', '0912345678', 'thutran@yahoo.com', 'Mua Netflix & Gmail', 150000)
        `);
      }

      console.log('[DB] Seller Manager tables initialized successfully');
    } catch (e: any) {
      console.error('[DB] Error initializing Seller Manager tables:', e?.message || e);
    }

    // Canva Teams & Tasks tables
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS canva_teams (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          cookies TEXT NOT NULL,
          local_storage TEXT NULL,
          member_limit INT DEFAULT 500,
          current_members INT DEFAULT 0,
          role VARCHAR(50) DEFAULT 'member',
          status ENUM('active', 'full', 'expired', 'disabled') DEFAULT 'active',
          proxy VARCHAR(255) NULL,
          last_checked_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_canva_team_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS canva_tasks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          telegram_id VARCHAR(64) NULL,
          team_id INT NULL,
          email VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'member',
          price DECIMAL(15, 2) DEFAULT 0,
          proxy_used VARCHAR(255) NULL,
          invite_link TEXT NULL,
          invite_token VARCHAR(255) NULL,
          team_name VARCHAR(255) NULL,
          status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
          step_status VARCHAR(255) NULL,
          error_message TEXT NULL,
          screenshot_path VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          started_at TIMESTAMP NULL,
          completed_at TIMESTAMP NULL,
          INDEX idx_canva_task_status (status),
          INDEX idx_canva_task_tg (telegram_id),
          INDEX idx_canva_task_team (team_id),
          INDEX idx_canva_task_created_at (created_at),
          FOREIGN KEY (team_id) REFERENCES canva_teams(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_enabled', 'true')");
      await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_price', '15000')");
      await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_headless', 'true')");
      await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_concurrency', '1')");
      await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_default_role', 'member')");
      await pool.query("INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_proxies', '')");

      console.log('[DB] Canva Pro tables initialized successfully');
    } catch (e: any) {
      console.error('[DB] Error initializing Canva tables:', e?.message || e);
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
