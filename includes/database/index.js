import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool;

export const initDb = async (config) => {
  // Ensure database exists first (connect without database)
  const adminConn = await mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    multipleStatements: true
  });
  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await adminConn.end();

  pool = mysql.createPool({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Verify connection
  try {
    const [result] = await pool.execute('SELECT DATABASE() as db');
    console.log('Connected to database:', result[0]?.db);
  } catch (err) {
    console.error('Database connection verification failed:', err.message);
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
  } catch (err) {
    // Error handling without logging
  }
};

export const getPool = () => {
  if (!pool) throw new Error('DB not initialized');
  return pool;
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

