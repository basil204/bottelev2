import mysql from "mysql2/promise";
import crypto from 'crypto';

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || "160.191.245.27",
  user: process.env.MYSQL_USER || "admin",
  password: process.env.MYSQL_PASSWORD || "admin",
  database: process.env.MYSQL_DATABASE || "gw_temp_users_1",
  port: process.env.MYSQL_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

let pool = null;

// Khởi tạo connection pool
async function getPool() {
  if (!pool) {
    console.log('[MYSQL] Creating connection pool...');
    console.log('[MYSQL] Host:', DB_CONFIG.host);
    console.log('[MYSQL] Database:', DB_CONFIG.database);
    
    // First, try to connect without database to create it if needed
    try {
      await ensureDatabaseExists();
    } catch (error) {
      console.error('[MYSQL] ❌ Failed to ensure database exists:', error.message);
      throw error;
    }
    
    pool = mysql.createPool(DB_CONFIG);
    
    // Test connection
    try {
      const connection = await pool.getConnection();
      console.log('[MYSQL] ✅ Connection pool created successfully');
      
      // Tạo bảng nếu chưa tồn tại
      await createTableIfNotExists(connection);
      
      connection.release();
    } catch (error) {
      console.error('[MYSQL] ❌ Failed to create connection pool:', error.message);
      throw error;
    }
  }
  return pool;
}

// Đảm bảo database tồn tại, nếu không thì tạo
async function ensureDatabaseExists() {
  const tempConfig = { ...DB_CONFIG };
  delete tempConfig.database; // Connect without database first
  
  console.log('[MYSQL] Checking if database exists...');
  
  const tempPool = mysql.createPool(tempConfig);
  
  try {
    const connection = await tempPool.getConnection();
    console.log('[MYSQL] Connected to MySQL server');
    
    // Check if database exists
    const [databases] = await connection.execute(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [DB_CONFIG.database]
    );
    
    if (databases.length === 0) {
      console.log(`[MYSQL] Database '${DB_CONFIG.database}' does not exist, creating...`);
      await connection.execute(`CREATE DATABASE \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`[MYSQL] ✅ Database '${DB_CONFIG.database}' created successfully`);
    } else {
      console.log(`[MYSQL] ✅ Database '${DB_CONFIG.database}' already exists`);
    }
    
    connection.release();
  } catch (error) {
    console.error('[MYSQL] ❌ Error checking/creating database:', error.message);
    throw error;
  } finally {
    await tempPool.end();
  }
}

// Tạo bảng tokens nếu chưa tồn tại
async function createTableIfNotExists(connection) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS tokens (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) UNIQUE NOT NULL,
      link TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      workspaces JSON,
      vip_workspaces JSON,
      account_id VARCHAR(255),
      cookie TEXT,
      password TEXT,
      status ENUM('active', 'expired', 'inactive') DEFAULT 'active',
      INDEX idx_email (email),
      INDEX idx_token (token),
      INDEX idx_expires_at (expires_at),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  await connection.execute(createTableSQL);
  console.log('[MYSQL] ✅ Table tokens created/verified');
  
  // Check if password column exists, if not add it
  try {
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tokens' AND COLUMN_NAME = 'password'
    `, [DB_CONFIG.database]);
    
    if (columns.length === 0) {
      console.log('[MYSQL] Adding password column to existing table...');
      await connection.execute('ALTER TABLE tokens ADD COLUMN password TEXT AFTER cookie');
      console.log('[MYSQL] ✅ Password column added successfully');
    } else {
      console.log('[MYSQL] ✅ Password column already exists');
    }
  } catch (error) {
    console.error('[MYSQL] Error checking/adding password column:', error.message);
  }

  // Check if package column exists, if not add it
  try {
    const [packageColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tokens' AND COLUMN_NAME = 'package'
    `, [DB_CONFIG.database]);
    
    if (packageColumns.length === 0) {
      console.log('[MYSQL] Adding package column to existing table...');
      await connection.execute('ALTER TABLE tokens ADD COLUMN package VARCHAR(50) DEFAULT NULL AFTER password');
      console.log('[MYSQL] ✅ Package column added successfully');
    } else {
      console.log('[MYSQL] ✅ Package column already exists');
    }
  } catch (error) {
    console.error('[MYSQL] Error checking/adding package column:', error.message);
  }

  // Create ChatGPT accounts table
  const createChatGPTTableSQL = `
    CREATE TABLE IF NOT EXISTS chatgpt_accounts (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL,
      authorization TEXT NOT NULL,
      name VARCHAR(255),
      email VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      status ENUM('active', 'inactive') DEFAULT 'active',
      INDEX idx_account_id (account_id),
      INDEX idx_email (email),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  await connection.execute(createChatGPTTableSQL);
  console.log('[MYSQL] ✅ Table chatgpt_accounts created/verified');
  
  // Remove cookie column if exists (migration)
  try {
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chatgpt_accounts' AND COLUMN_NAME = 'cookie'
    `, [DB_CONFIG.database]);
    
    if (columns.length > 0) {
      console.log('[MYSQL] Removing cookie column from chatgpt_accounts table...');
      await connection.execute('ALTER TABLE chatgpt_accounts DROP COLUMN cookie');
      console.log('[MYSQL] ✅ Cookie column removed successfully');
    }
  } catch (error) {
    console.log('[MYSQL] Note: Cookie column migration:', error.message);
  }
}

// Lấy tất cả tokens
export async function getAllTokens() {
  try {
    const pool = await getPool();
    const [rows] = await pool.execute(`
      SELECT 
        id, email, token, link, expires_at, created_at, updated_at,
        workspaces, vip_workspaces, account_id, cookie, password, package, status
      FROM tokens 
      ORDER BY created_at DESC
    `);
    
    console.log('[MYSQL] Raw rows from database:', rows.length, 'rows');
    
    // Ensure rows is an array
    if (!Array.isArray(rows)) {
      console.error('[MYSQL] ERROR: rows is not an array:', rows);
      return [];
    }
    
    // Parse JSON fields
    const tokens = rows.map(row => {
      try {
        return {
          _id: row.id,
          email: row.email,
          token: row.token,
          link: row.link,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          workspaces: row.workspaces ? JSON.parse(row.workspaces) : [],
          vipWorkspaces: row.vip_workspaces ? JSON.parse(row.vip_workspaces) : [],
          accountId: row.account_id,
          cookie: row.cookie || '',
          password: row.password || '',
          package: row.package || null,
          status: row.status
        };
      } catch (parseError) {
        console.error('[MYSQL] Error parsing row:', parseError.message, 'Row:', row);
        return null;
      }
    }).filter(token => token !== null);
    
    console.log('[MYSQL] Retrieved', tokens.length, 'tokens');
    return tokens;
  } catch (error) {
    console.error('[MYSQL] Error getting tokens:', error.message);
    throw error;
  }
}

// Lưu token mới
export async function saveToken(tokenData) {
  try {
    const pool = await getPool();
    
    const tokenDoc = {
      id: tokenData.token, // Sử dụng token làm id
      email: tokenData.email,
      token: tokenData.token,
      link: tokenData.link,
      expires_at: tokenData.expiresAt,
      workspaces: JSON.stringify(tokenData.workspaces || []),
      vip_workspaces: JSON.stringify(tokenData.vipWorkspaces || []),
      account_id: tokenData.accountId,
      cookie: tokenData.cookie || '',
      password: tokenData.password || '',
      package: tokenData.package || null,
      status: 'active'
    };
    
    const [result] = await pool.execute(`
      INSERT INTO tokens (id, email, token, link, expires_at, workspaces, vip_workspaces, account_id, cookie, password, package, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        link = VALUES(link),
        expires_at = VALUES(expires_at),
        workspaces = VALUES(workspaces),
        vip_workspaces = VALUES(vip_workspaces),
        account_id = VALUES(account_id),
        cookie = VALUES(cookie),
        password = VALUES(password),
        package = VALUES(package),
        status = VALUES(status),
        updated_at = CURRENT_TIMESTAMP
    `, [
      tokenDoc.id,
      tokenDoc.email,
      tokenDoc.token,
      tokenDoc.link,
      tokenDoc.expires_at,
      tokenDoc.workspaces,
      tokenDoc.vip_workspaces,
      tokenDoc.account_id,
      tokenDoc.cookie,
      tokenDoc.password,
      tokenDoc.package,
      tokenDoc.status
    ]);
    
    console.log('[MYSQL] Saved token for', tokenData.email, 'with ID:', tokenDoc.id);
    return { success: true, insertedId: tokenDoc.id };
  } catch (error) {
    console.error('[MYSQL] Error saving token:', error.message);
    throw error;
  }
}

// Cập nhật token
export async function updateToken(token, updateData) {
  try {
    const pool = await getPool();
    
    const updateFields = [];
    const updateValues = [];
    
    if (updateData.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(updateData.email);
    }
    if (updateData.link !== undefined) {
      updateFields.push('link = ?');
      updateValues.push(updateData.link);
    }
    if (updateData.expiresAt !== undefined) {
      updateFields.push('expires_at = ?');
      updateValues.push(updateData.expiresAt);
    }
    if (updateData.workspaces !== undefined) {
      updateFields.push('workspaces = ?');
      updateValues.push(JSON.stringify(updateData.workspaces));
    }
    if (updateData.vipWorkspaces !== undefined) {
      updateFields.push('vip_workspaces = ?');
      updateValues.push(JSON.stringify(updateData.vipWorkspaces));
    }
    if (updateData.accountId !== undefined) {
      updateFields.push('account_id = ?');
      updateValues.push(updateData.accountId);
    }
    if (updateData.cookie !== undefined) {
      updateFields.push('cookie = ?');
      updateValues.push(updateData.cookie);
    }
    if (updateData.password !== undefined) {
      updateFields.push('password = ?');
      updateValues.push(updateData.password);
    }
    if (updateData.package !== undefined) {
      updateFields.push('package = ?');
      updateValues.push(updateData.package);
    }
    if (updateData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(updateData.status);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(token);
    
    const [result] = await pool.execute(`
      UPDATE tokens 
      SET ${updateFields.join(', ')}
      WHERE token = ?
    `, updateValues);
    
    console.log('[MYSQL] Updated token:', token, 'Modified count:', result.affectedRows);
    return { success: true, modifiedCount: result.affectedRows };
  } catch (error) {
    console.error('[MYSQL] Error updating token:', error.message);
    throw error;
  }
}

// Xóa token
export async function deleteToken(token) {
  try {
    const pool = await getPool();
    
    const [result] = await pool.execute(`
      DELETE FROM tokens WHERE token = ?
    `, [token]);
    
    console.log('[MYSQL] Deleted token:', token, 'Deleted count:', result.affectedRows);
    return { success: true, deletedCount: result.affectedRows };
  } catch (error) {
    console.error('[MYSQL] Error deleting token:', error.message);
    throw error;
  }
}

// Tìm token theo token string
export async function findTokenByToken(tokenString) {
  try {
    const pool = await getPool();
    
    const [rows] = await pool.execute(`
      SELECT 
        id, email, token, link, expires_at, created_at, updated_at,
        workspaces, vip_workspaces, account_id, cookie, status, password, package
      FROM tokens 
      WHERE token = ?
    `, [tokenString]);
    
    if (rows.length === 0) {
      console.log('[MYSQL] Token not found:', tokenString);
      return null;
    }
    
    const row = rows[0];
    const token = {
      _id: row.id,
      email: row.email,
      token: row.token,
      link: row.link,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workspaces: row.workspaces ? JSON.parse(row.workspaces) : [],
      vipWorkspaces: row.vip_workspaces ? JSON.parse(row.vip_workspaces) : [],
      accountId: row.account_id,
      cookie: row.cookie || '',
      status: row.status,
      password: row.password || '',
      package: row.package || null
    };
    
    console.log('[MYSQL] Found token for email:', token.email);
    return token;
  } catch (error) {
    console.error('[MYSQL] Error finding token:', error.message);
    return null;
  }
}

// Tìm tokens theo email
export async function findTokensByEmail(email) {
  try {
    const pool = await getPool();
    
    const [rows] = await pool.execute(`
      SELECT 
        id, email, token, link, expires_at, created_at, updated_at,
        workspaces, vip_workspaces, account_id, cookie, status, package
      FROM tokens 
      WHERE email = ?
      ORDER BY created_at DESC
    `, [email]);
    
    const tokens = rows.map(row => ({
      _id: row.id,
      email: row.email,
      token: row.token,
      link: row.link,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workspaces: row.workspaces ? JSON.parse(row.workspaces) : [],
      vipWorkspaces: row.vip_workspaces ? JSON.parse(row.vip_workspaces) : [],
      accountId: row.account_id,
      cookie: row.cookie || '',
      status: row.status,
      package: row.package || null
    }));
    
    console.log('[MYSQL] Found', tokens.length, 'tokens for email:', email);
    return tokens;
  } catch (error) {
    console.error('[MYSQL] Error finding tokens by email:', error.message);
    return [];
  }
}

// Lấy tokens hết hạn
export async function getExpiredTokens() {
  try {
    const pool = await getPool();
    
    const [rows] = await pool.execute(`
      SELECT 
        id, email, token, link, expires_at, created_at, updated_at,
        workspaces, vip_workspaces, account_id, cookie, status, package
      FROM tokens 
      WHERE expires_at < NOW()
      ORDER BY expires_at ASC
    `);
    
    const tokens = rows.map(row => ({
      _id: row.id,
      email: row.email,
      token: row.token,
      link: row.link,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workspaces: row.workspaces ? JSON.parse(row.workspaces) : [],
      vipWorkspaces: row.vip_workspaces ? JSON.parse(row.vip_workspaces) : [],
      accountId: row.account_id,
      cookie: row.cookie || '',
      status: row.status,
      package: row.package || null
    }));
    
    console.log('[MYSQL] Found', tokens.length, 'expired tokens');
    return tokens;
  } catch (error) {
    console.error('[MYSQL] Error getting expired tokens:', error.message);
    return [];
  }
}

// Lấy tokens còn hiệu lực
export async function getActiveTokens() {
  try {
    const pool = await getPool();
    
    const [rows] = await pool.execute(`
      SELECT 
        id, email, token, link, expires_at, created_at, updated_at,
        workspaces, vip_workspaces, account_id, cookie, status, package
      FROM tokens 
      WHERE (expires_at > NOW() OR expires_at IS NULL) 
        AND status = 'active'
      ORDER BY created_at DESC
    `);
    
    const tokens = rows.map(row => ({
      _id: row.id,
      email: row.email,
      token: row.token,
      link: row.link,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workspaces: row.workspaces ? JSON.parse(row.workspaces) : [],
      vipWorkspaces: row.vip_workspaces ? JSON.parse(row.vip_workspaces) : [],
      accountId: row.account_id,
      cookie: row.cookie || '',
      status: row.status,
      package: row.package || null
    }));
    
    console.log('[MYSQL] Found', tokens.length, 'active tokens');
    return tokens;
  } catch (error) {
    console.error('[MYSQL] Error getting active tokens:', error.message);
    return [];
  }
}

// Test kết nối MySQL
export async function testMySQLConnection() {
  try {
    console.log('[MYSQL] Starting connection test...');
    console.log('[MYSQL] Environment:', process.env.NODE_ENV || 'development');
    console.log('[MYSQL] Using ENV config:', !!process.env.MYSQL_HOST);
    
    const pool = await getPool();
    const connection = await pool.getConnection();
    
    // Test ping
    await connection.ping();
    console.log('[MYSQL] Ping successful');
    
    // Đếm số documents
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM tokens');
    const count = countResult[0].count;
    console.log('[MYSQL] Count documents successful:', count);
    
    // Test insert/delete để verify write permissions
    const testId = 'test_' + Date.now();
    await connection.execute(`
      INSERT INTO tokens (id, email, token, link, status) 
      VALUES (?, ?, ?, ?, ?)
    `, [testId, 'test@example.com', testId, 'http://test.com', 'active']);
    
    await connection.execute('DELETE FROM tokens WHERE id = ?', [testId]);
    console.log('[MYSQL] Write/Delete test successful');
    
    connection.release();
    
    console.log('[MYSQL] ✅ Connection test successful');
    console.log('[MYSQL] Total tokens in database:', count);
    
    return { 
      success: true, 
      message: 'MySQL connection successful',
      totalTokens: count,
      environment: process.env.NODE_ENV || 'development',
      usingEnvConfig: !!process.env.MYSQL_HOST
    };
  } catch (error) {
    console.error('[MYSQL] ❌ Connection test failed:', error.message);
    console.error('[MYSQL] Error code:', error.code);
    console.error('[MYSQL] Error name:', error.name);
    console.error('[MYSQL] Full error:', error);
    
    return { 
      success: false, 
      error: error.message,
      errorCode: error.code,
      errorName: error.name,
      environment: process.env.NODE_ENV || 'development',
      usingEnvConfig: !!process.env.MYSQL_HOST
    };
  }
}

// Generate token
export function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Khởi tạo database hoàn toàn (database + tables)
export async function initializeDatabase() {
  try {
    console.log('[MYSQL] 🚀 Initializing database...');
    
    // Ensure database exists
    await ensureDatabaseExists();
    
    // Get pool and create tables
    const pool = await getPool();
    const connection = await pool.getConnection();
    
    // Create tables
    await createTableIfNotExists(connection);
    
    // Test the setup
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM tokens');
    const count = countResult[0].count;
    
    // Check ChatGPT accounts table
    try {
      const [chatgptCountResult] = await connection.execute('SELECT COUNT(*) as count FROM chatgpt_accounts');
      const chatgptCount = chatgptCountResult[0].count;
      console.log(`[MYSQL] 📊 Current ChatGPT accounts in database: ${chatgptCount}`);
    } catch (error) {
      console.log('[MYSQL] ⚠️ ChatGPT accounts table check failed, will be created on next use');
    }
    
    connection.release();
    
    console.log('[MYSQL] ✅ Database initialization completed successfully');
    console.log(`[MYSQL] 📊 Current tokens in database: ${count}`);
    
    return {
      success: true,
      message: 'Database initialized successfully',
      totalTokens: count
    };
  } catch (error) {
    console.error('[MYSQL] ❌ Database initialization failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Cleanup expired tokens
export async function cleanupExpiredTokens() {
  try {
    const pool = await getPool();
    
    const [result] = await pool.execute(`
      DELETE FROM tokens 
      WHERE expires_at < NOW()
    `);
    
    console.log('[MYSQL] Deleted', result.affectedRows, 'expired tokens');
    return { success: true, deletedCount: result.affectedRows };
  } catch (error) {
    console.error('[MYSQL] Error cleaning up expired tokens:', error.message);
    return { success: false, error: error.message };
  }
}

// Đóng connection pool
export async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[MYSQL] Connection pool closed');
  }
}

// ===== ChatGPT Accounts Functions =====

// Ensure ChatGPT accounts table exists
async function ensureChatGPTTableExists(connection) {
  try {
    const createChatGPTTableSQL = `
      CREATE TABLE IF NOT EXISTS chatgpt_accounts (
        id VARCHAR(255) PRIMARY KEY,
        account_id VARCHAR(255) NOT NULL,
        authorization TEXT NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        status ENUM('active', 'inactive') DEFAULT 'active',
        INDEX idx_account_id (account_id),
        INDEX idx_email (email),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createChatGPTTableSQL);
    console.log('[MYSQL] ✅ Table chatgpt_accounts verified/created');
    
    // Remove cookie column if exists (migration)
    try {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chatgpt_accounts' AND COLUMN_NAME = 'cookie'
      `, [DB_CONFIG.database]);
      
      if (columns.length > 0) {
        console.log('[MYSQL] Removing cookie column from chatgpt_accounts table...');
        await connection.execute('ALTER TABLE chatgpt_accounts DROP COLUMN cookie');
        console.log('[MYSQL] ✅ Cookie column removed successfully');
      }
    } catch (error) {
      // Ignore if column doesn't exist or can't be removed
    }
  } catch (error) {
    console.error('[MYSQL] Error creating chatgpt_accounts table:', error.message);
    throw error;
  }
}

// Save ChatGPT account
export async function saveChatGPTAccount(accountData) {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    
    // Ensure table exists
    await ensureChatGPTTableExists(connection);
    
    const id = accountData.id || crypto.randomBytes(16).toString('hex');
    
    await connection.execute(`
      INSERT INTO chatgpt_accounts 
      (id, account_id, authorization, name, email, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        authorization = VALUES(authorization),
        name = VALUES(name),
        email = VALUES(email),
        status = VALUES(status),
        updated_at = CURRENT_TIMESTAMP
    `, [
      id,
      accountData.accountId,
      accountData.authorization,
      accountData.name || null,
      accountData.email || null,
      accountData.status || 'active'
    ]);
    
    connection.release();
    console.log('[MYSQL] ChatGPT account saved:', id);
    return { success: true, id };
  } catch (error) {
    console.error('[MYSQL] Error saving ChatGPT account:', error.message);
    throw error;
  }
}

// Get all ChatGPT accounts
export async function getAllChatGPTAccounts() {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    
    // Ensure table exists
    await ensureChatGPTTableExists(connection);
    
    const [rows] = await connection.execute(`
      SELECT id, account_id, authorization, name, email, 
             created_at, updated_at, status
      FROM chatgpt_accounts
      WHERE status = 'active'
      ORDER BY created_at DESC
    `);
    
    connection.release();
    
    return rows.map(row => ({
      id: row.id,
      accountId: row.account_id,
      authorization: row.authorization,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status
    }));
  } catch (error) {
    console.error('[MYSQL] Error getting ChatGPT accounts:', error.message);
    throw error;
  }
}

// Get ChatGPT account by ID
export async function getChatGPTAccountById(id) {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    
    // Ensure table exists
    await ensureChatGPTTableExists(connection);
    
    const [rows] = await connection.execute(`
      SELECT id, account_id, authorization, name, email,
             created_at, updated_at, status
      FROM chatgpt_accounts
      WHERE id = ? AND status = 'active'
    `, [id]);
    
    connection.release();
    
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    return {
      id: row.id,
      accountId: row.account_id,
      authorization: row.authorization,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status
    };
  } catch (error) {
    console.error('[MYSQL] Error getting ChatGPT account:', error.message);
    throw error;
  }
}

// Delete ChatGPT account
export async function deleteChatGPTAccount(id) {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    
    // Ensure table exists
    await ensureChatGPTTableExists(connection);
    
    const [result] = await connection.execute(`
      UPDATE chatgpt_accounts 
      SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);
    
    connection.release();
    
    console.log('[MYSQL] ChatGPT account deleted:', id);
    return { success: true, deletedCount: result.affectedRows };
  } catch (error) {
    console.error('[MYSQL] Error deleting ChatGPT account:', error.message);
    throw error;
  }
}
