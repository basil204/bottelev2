import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool;

export const initDb = async (config) => {
  pool = mysql.createPool({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0
  });

  // MySQL may need a moment to release connections after nodemon restarts.
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const [result] = await pool.execute('SELECT DATABASE() as db');
      console.log('Connected to database:', result[0]?.db);
      break;
    } catch (err) {
      if (err.code !== 'ER_CON_COUNT_ERROR' || attempt === 10) throw err;
      console.warn(`Database đang hết kết nối, thử lại ${attempt}/10 sau 3 giây...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // bootstrap schema if available
  try {
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      // Use a connection from pool to execute schema
      const conn = await pool.getConnection();
      try {
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        for (const statement of statements) {
          try {
            await conn.execute(statement.trim());
          } catch (e) {
            // Ignore errors for IF NOT EXISTS cases
            if (!e.message.includes('already exists') && !e.message.includes('Duplicate') && !e.message.includes('Table')) {
              console.error('Schema execution error:', e.message);
            }
          }
        }
      } finally {
        conn.release();
      }
    }

    // Ensure columns exist (migration for existing tables)
    try {
      // Check and add telegram_id to users table if it doesn't exist
      const [columns] = await pool.execute('SHOW COLUMNS FROM users LIKE ?', ['telegram_id']);
      if (columns.length === 0) {
        await pool.execute('ALTER TABLE users ADD COLUMN telegram_id BIGINT UNIQUE');
        // If there's existing data, you might need to handle migration here
      }
    } catch (e) {
      // Table might not exist yet, which is fine
    }

    // ensure tx_ref column exists for auto deposit
    try {
      await pool.execute('ALTER TABLE deposits ADD COLUMN tx_ref VARCHAR(64)');
    } catch (e) {
      // ignore if already exists
    }

    // ensure content column exists for persistent token matching
    try {
      await pool.execute('ALTER TABLE deposits ADD COLUMN content VARCHAR(64)');
      await pool.execute('ALTER TABLE deposits ADD INDEX idx_content (content)');
    } catch (e) {
      // ignore if already exists
    }

    try {
      await pool.execute('ALTER TABLE orders MODIFY COLUMN email TEXT NULL');
    } catch (e) {
      if (!e.message.includes("doesn't exist")) {
        console.error('Migration error for orders.email:', e.message);
      }
    }

    // Ensure status column supports extended statuses (cancelled, reserved, expired, pending, completed)
    try {
      await pool.execute('ALTER TABLE orders MODIFY COLUMN status VARCHAR(50) DEFAULT "completed"');
    } catch (e) {
      if (!e.message.includes("doesn't exist")) {
        console.error('Migration error for orders.status:', e.message);
      }
    }

    // Ensure preorders table exists
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS preorders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_code VARCHAR(100) NULL,
          user_id INT NULL,
          telegram_id BIGINT NULL,
          username VARCHAR(100) NULL,
          user_fullname VARCHAR(100) NULL,
          product_id INT NOT NULL,
          quantity INT DEFAULT 1,
          deposit_fee DECIMAL(15, 2) DEFAULT 0,
          total_price DECIMAL(15, 2) DEFAULT 0,
          payment_method VARCHAR(100) DEFAULT 'Admin Tạo Thủ Công',
          status VARCHAR(50) DEFAULT 'pending',
          fifo_position INT DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Ensured preorders table exists');
    } catch (e) {
      console.error('Migration error for preorders:', e.message);
    }

    // Ensure checkin tables exist
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS checkin_rewards (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          streak_days INT DEFAULT 1,
          sort_order INT DEFAULT 0,
          reward_type VARCHAR(50) DEFAULT 'Ví',
          reward_amount DECIMAL(15, 2) DEFAULT 0,
          reward_message TEXT NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS checkin_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          telegram_id BIGINT NULL,
          username VARCHAR(100) NULL,
          checkin_date DATE NULL,
          streak INT DEFAULT 1,
          total_checkins INT DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS checkin_claims (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          telegram_id BIGINT NULL,
          reward_id INT NULL,
          reward_name VARCHAR(100) NULL,
          reward_amount DECIMAL(15, 2) DEFAULT 0,
          streak INT DEFAULT 1,
          status VARCHAR(50) DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Ensured checkin tables exist');
    } catch (e) {
      console.error('Migration error for checkin tables:', e.message);
    }

    // Ensure flash_sales table exists
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS flash_sales (
          id INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT NOT NULL,
          sale_type VARCHAR(50) DEFAULT 'PRICE_SALE',
          sale_price DECIMAL(15, 2) DEFAULT 0,
          bulk_min_qty INT DEFAULT 0,
          bulk_price DECIMAL(15, 2) DEFAULT 0,
          start_time DATETIME NOT NULL,
          end_time DATETIME NOT NULL,
          notify_telegram TINYINT(1) DEFAULT 1,
          status VARCHAR(50) DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Ensured flash_sales table exists');
    } catch (e) {
      console.error('Migration error for flash_sales:', e.message);
    }

    // Ensure coupons table exists
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS coupons (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(50) NOT NULL UNIQUE,
          discount_type VARCHAR(50) DEFAULT 'FIXED',
          discount_value DECIMAL(15, 2) DEFAULT 0,
          min_order_value DECIMAL(15, 2) DEFAULT 0,
          max_discount DECIMAL(15, 2) NULL,
          max_uses INT NULL,
          used_count INT DEFAULT 0,
          product_id INT NULL,
          start_time DATETIME NULL,
          end_time DATETIME NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Ensured coupons table exists');
    } catch (e) {
      console.error('Migration error for coupons:', e.message);
    }

    // ensure delete_at column exists for gmail_accounts table
    try {
      // Thử thêm cột (sẽ bỏ qua nếu đã tồn tại)
      await pool.execute('ALTER TABLE gmail_accounts ADD COLUMN delete_at TIMESTAMP NULL DEFAULT NULL');
      console.log('✅ Added delete_at column to gmail_accounts table');

      // Thử thêm index
      try {
        await pool.execute('ALTER TABLE gmail_accounts ADD INDEX idx_delete_at (delete_at)');
        console.log('✅ Added index idx_delete_at to gmail_accounts table');
      } catch (idxError) {
        // Index đã tồn tại hoặc có lỗi khác (không phải lỗi nghiêm trọng)
        if (!idxError.message.includes('Duplicate') && !idxError.message.includes('already exists')) {
          console.warn('⚠️ Could not add index idx_delete_at:', idxError.message);
        }
      }
    } catch (e) {
      // Nếu lỗi là do cột đã tồn tại hoặc bảng chưa tồn tại thì bỏ qua
      if (e.message.includes('Duplicate column name') || e.message.includes('already exists')) {
        // Cột đã tồn tại, không cần làm gì
      } else if (e.message.includes('doesn\'t exist')) {
        // Bảng chưa tồn tại, sẽ được tạo bởi schema.sql
      } else {
        console.error('Migration error for gmail_accounts.delete_at:', e.message);
      }
    }

    // ensure delete_at column exists for accounts table
    try {
      // Thử thêm cột (sẽ bỏ qua nếu đã tồn tại)
      await pool.execute('ALTER TABLE accounts ADD COLUMN delete_at TIMESTAMP NULL DEFAULT NULL');
      console.log('✅ Added delete_at column to accounts table');

      // Thử thêm index
      try {
        await pool.execute('ALTER TABLE accounts ADD INDEX idx_delete_at (delete_at)');
        console.log('✅ Added index idx_delete_at to accounts table');
      } catch (idxError) {
        // Index đã tồn tại hoặc có lỗi khác (không phải lỗi nghiêm trọng)
        if (!idxError.message.includes('Duplicate') && !idxError.message.includes('already exists')) {
          console.warn('⚠️ Could not add index idx_delete_at:', idxError.message);
        }
      }
    } catch (e) {
      // Nếu lỗi là do cột đã tồn tại hoặc bảng chưa tồn tại thì bỏ qua
      if (e.message.includes('Duplicate column name') || e.message.includes('already exists')) {
        // Cột đã tồn tại, không cần làm gì
      } else if (e.message.includes('doesn\'t exist')) {
        // Bảng chưa tồn tại, sẽ được tạo bởi schema.sql
      } else {
        console.error('Migration error for accounts.delete_at:', e.message);
      }
    }

    // ensure settings table exists
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          \`key\` VARCHAR(100) UNIQUE NOT NULL,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_key (\`key\`)
        )
      `);
      console.log('✅ Settings table ready');
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('Table')) {
        console.error('Migration error for settings table:', e.message);
      }
    }

    // TỰ ĐỘNG BỔ SUNG TOÀN BỘ BẢNG VÀ CỘT SQL CÒN THIẾU
    const safeAddColumn = async (table, column, colDef) => {
      try {
        const [cols] = await pool.execute(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
        if (!cols || cols.length === 0) {
          await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${colDef}`);
          console.log(`✅ [AUTO_MIGRATE] Đã thêm cột \`${column}\` vào bảng \`${table}\``);
        }
      } catch (e) {
        // Table might not exist yet, handled by table creation
      }
    };

    // 1. Bảng users
    await safeAddColumn('users', 'name', 'VARCHAR(255) NULL');
    await safeAddColumn('users', 'telegram_id', 'BIGINT NULL');
    await safeAddColumn('users', 'balance', 'DECIMAL(15,2) DEFAULT 0');
    await safeAddColumn('users', 'is_banned', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn('users', 'language', "VARCHAR(10) DEFAULT 'vi'");

    // 2. Bảng products
    await safeAddColumn('products', 'priority', 'INT DEFAULT 0');
    await safeAddColumn('products', 'type', "VARCHAR(50) DEFAULT 'stock'");
    await safeAddColumn('products', 'prompt_message', 'TEXT NULL');
    await safeAddColumn('products', 'category_id', 'INT NULL');

    // 3. Bảng orders
    await safeAddColumn('orders', 'invoice_code', 'VARCHAR(100) NULL');
    await safeAddColumn('orders', 'product_id', 'INT NULL');

    // 4. Khởi tạo Bảng user_api_keys
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS user_api_keys (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          api_key VARCHAR(100) NOT NULL UNIQUE,
          name VARCHAR(100) DEFAULT 'User API Key',
          is_active TINYINT(1) DEFAULT 1,
          last_used_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await safeAddColumn('user_api_keys', 'name', "VARCHAR(100) DEFAULT 'User API Key'");
      await safeAddColumn('user_api_keys', 'is_active', 'TINYINT(1) DEFAULT 1');
      console.log('✅ Bảng user_api_keys sẵn sàng');
    } catch (e) {}

    // 5. Khởi tạo Bảng custom_pricing
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS custom_pricing (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          plan_id VARCHAR(100) NULL,
          custom_price DECIMAL(15,2) NOT NULL,
          scope VARCHAR(50) DEFAULT 'ALL_ORDERS',
          is_active TINYINT(1) DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Bảng custom_pricing sẵn sàng');
    } catch (e) {}

    // 6. Khởi tạo Bảng balance_logs
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS balance_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          reason TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Bảng balance_logs sẵn sàng');
    } catch (e) {}

    // ChatGPT Join FAM was removed; legacy migration is disabled.
    if (false) {
    // ensure ChatGPT FAM table exists
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS chatgpt_fams (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          workspace_id VARCHAR(100) NOT NULL UNIQUE,
          authorization TEXT NOT NULL,
          max_slots INT DEFAULT 5,
          used_slots INT DEFAULT 0,
          status ENUM('active', 'full', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ ChatGPT FAM table ready');

      // Ensure cookie column exists
      try {
        const [columns] = await pool.execute("SHOW COLUMNS FROM chatgpt_fams LIKE 'cookie'");
        if (columns.length === 0) {
          await pool.execute('ALTER TABLE chatgpt_fams ADD COLUMN cookie TEXT NULL AFTER authorization');
          console.log('✅ Added cookie column to chatgpt_fams');
        }
      } catch (e) {
        console.error('Migration error for chatgpt_fams.cookie:', e.message);
      }
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.error('Migration error for chatgpt_fams:', e.message);
      }
    }

    // ensure ChatGPT rentals table exists
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS chatgpt_rentals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          fam_id INT NOT NULL,
          email VARCHAR(255) NOT NULL,
          price DECIMAL(18,2) NOT NULL DEFAULT 0,
          start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_date TIMESTAMP NOT NULL,
          status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
          invite_status ENUM('pending', 'sent', 'accepted', 'failed') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user (user_id),
          INDEX idx_fam (fam_id),
          INDEX idx_email (email),
          INDEX idx_status (status),
          INDEX idx_end_date (end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ ChatGPT rentals table ready');
    } catch (e) {
      if (!e.message.includes('already exists')) {
        console.error('Migration error for chatgpt_rentals:', e.message);
      }
    }

    // Insert default ChatGPT settings
    try {
      await pool.execute(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('chatgpt_slot_price', '60000')`);
      await pool.execute(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('chatgpt_slot_days', '30')`);
    } catch (e) {
      // ignore
    }
    }
  } catch (err) {
    // Error handling without logging
  }
};

export const getPool = () => {
  if (!pool) throw new Error('DB not initialized');
  return pool;
};

export const closeDb = async () => {
  if (!pool) return;
  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
};

export const query = async (sql, params = []) => {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    // Error handling without logging
    throw error;
  }
};

