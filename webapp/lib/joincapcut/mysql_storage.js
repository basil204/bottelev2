import mysql from "mysql2/promise";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || "160.191.245.27",
  user: process.env.MYSQL_USER || "admin",
  password: process.env.MYSQL_PASSWORD || "admin",
  database: process.env.MYSQL_DATABASE || "gw_temp_users_1",
  port: process.env.MYSQL_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 3000
};

let pool = null;
let useJsonFallback = false;

const TOKENS_FILE = path.resolve('./tokens.json');
const CHATGPT_FILE = path.resolve('./chatgpt_accounts.json');

// Local JSON File Storage Helpers
function readJson(filePath, defaultVal = []) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[JSON_STORAGE] Lỗi đọc file ${filePath}:`, err.message);
  }
  return defaultVal;
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[JSON_STORAGE] Lỗi ghi file ${filePath}:`, err.message);
  }
}

// Khởi tạo connection pool với tự động fallback sang JSON
async function getPool() {
  if (useJsonFallback) return null;

  if (!pool) {
    console.log('[MYSQL] Creating connection pool...');
    try {
      await ensureDatabaseExists();
      pool = mysql.createPool(DB_CONFIG);
      const connection = await pool.getConnection();
      console.log('[MYSQL] ✅ Connection pool created successfully');
      await createTableIfNotExists(connection);
      connection.release();
    } catch (error) {
      console.warn('[MYSQL] ⚠️ Không thể kết nối MySQL (' + error.message + '). TỰ ĐỘNG CHUYỂN SANG DÙNG LOCAL JSON STORAGE!');
      useJsonFallback = true;
      return null;
    }
  }
  return pool;
}

async function ensureDatabaseExists() {
  const tempConfig = { ...DB_CONFIG };
  delete tempConfig.database;
  const tempPool = mysql.createPool(tempConfig);
  try {
    const connection = await tempPool.getConnection();
    const [databases] = await connection.execute(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [DB_CONFIG.database]
    );
    if (databases.length === 0) {
      await connection.execute(`CREATE DATABASE \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    }
    connection.release();
  } catch (error) {
    throw error;
  } finally {
    await tempPool.end();
  }
}

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
      package VARCHAR(50),
      status ENUM('active', 'expired', 'inactive') DEFAULT 'active'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  await connection.execute(createTableSQL);

  const createChatGPTTableSQL = `
    CREATE TABLE IF NOT EXISTS chatgpt_accounts (
      id VARCHAR(255) PRIMARY KEY,
      account_id VARCHAR(255) NOT NULL,
      authorization TEXT NOT NULL,
      name VARCHAR(255),
      email VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      status ENUM('active', 'inactive') DEFAULT 'active'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  await connection.execute(createChatGPTTableSQL);
}

// 1. Lấy tất cả tokens
export async function getAllTokens() {
  try {
    const activePool = await getPool();
    if (!activePool) {
      const tokens = readJson(TOKENS_FILE, []);
      console.log('[JSON_STORAGE] Lấy thành công', tokens.length, 'tokens từ tokens.json');
      return tokens;
    }
    const [rows] = await activePool.execute(`
      SELECT id, email, token, link, expires_at, created_at, updated_at,
             workspaces, vip_workspaces, account_id, cookie, password, package, status
      FROM tokens ORDER BY created_at DESC
    `);
    return rows.map(row => ({
      _id: row.id,
      email: row.email,
      token: row.token,
      link: row.link,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workspaces: row.workspaces ? (typeof row.workspaces === 'string' ? JSON.parse(row.workspaces) : row.workspaces) : [],
      vipWorkspaces: row.vip_workspaces ? (typeof row.vip_workspaces === 'string' ? JSON.parse(row.vip_workspaces) : row.vip_workspaces) : [],
      accountId: row.account_id,
      cookie: row.cookie || '',
      password: row.password || '',
      package: row.package || null,
      status: row.status
    }));
  } catch (error) {
    console.warn('[MYSQL] Error getting tokens, using JSON fallback:', error.message);
    useJsonFallback = true;
    return readJson(TOKENS_FILE, []);
  }
}

// 2. Lưu token mới
export async function saveToken(tokenData) {
  const activePool = await getPool();
  const id = tokenData.id || crypto.randomUUID();
  const now = new Date();

  const formattedToken = {
    _id: id,
    id: id,
    email: tokenData.email,
    token: tokenData.token,
    link: tokenData.link,
    expiresAt: tokenData.expiresAt || null,
    createdAt: tokenData.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    workspaces: tokenData.workspaces || [],
    vipWorkspaces: tokenData.vipWorkspaces || [],
    accountId: tokenData.accountId || crypto.randomUUID(),
    cookie: tokenData.cookie || '',
    password: tokenData.password || '',
    package: tokenData.package || null,
    status: tokenData.status || 'active'
  };

  if (!activePool) {
    const tokens = readJson(TOKENS_FILE, []);
    const idx = tokens.findIndex(t => t.token === tokenData.token || t.email === tokenData.email);
    if (idx >= 0) {
      tokens[idx] = { ...tokens[idx], ...formattedToken };
    } else {
      tokens.unshift(formattedToken);
    }
    writeJson(TOKENS_FILE, tokens);
    console.log('[JSON_STORAGE] ✅ Đã lưu token vào tokens.json cho:', tokenData.email);
    return { success: true, id };
  }

  try {
    await activePool.execute(`
      INSERT INTO tokens 
      (id, email, token, link, expires_at, created_at, updated_at, workspaces, vip_workspaces, account_id, cookie, password, package, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      link = VALUES(link), expires_at = VALUES(expires_at), updated_at = VALUES(updated_at),
      workspaces = VALUES(workspaces), vip_workspaces = VALUES(vip_workspaces),
      cookie = VALUES(cookie), password = VALUES(password), package = VALUES(package), status = VALUES(status)
    `, [
      id, tokenData.email, tokenData.token, tokenData.link, tokenData.expiresAt,
      now, now, JSON.stringify(tokenData.workspaces || []), JSON.stringify(tokenData.vipWorkspaces || []),
      formattedToken.accountId, tokenData.cookie || '', tokenData.password || '', tokenData.package || null, formattedToken.status
    ]);
    return { success: true, id };
  } catch (error) {
    console.warn('[MYSQL] Error saving token, fallback to JSON:', error.message);
    useJsonFallback = true;
    const tokens = readJson(TOKENS_FILE, []);
    tokens.unshift(formattedToken);
    writeJson(TOKENS_FILE, tokens);
    return { success: true, id };
  }
}

// 3. Cập nhật token
export async function updateToken(token, updateData) {
  const activePool = await getPool();
  const now = new Date();

  if (!activePool) {
    const tokens = readJson(TOKENS_FILE, []);
    const idx = tokens.findIndex(t => t.token === token);
    if (idx >= 0) {
      tokens[idx] = { ...tokens[idx], ...updateData, updatedAt: now.toISOString() };
      writeJson(TOKENS_FILE, tokens);
      return { success: true, updatedCount: 1 };
    }
    return { success: false, updatedCount: 0 };
  }

  try {
    const fields = [];
    const values = [];
    if (updateData.cookie !== undefined) { fields.push('cookie = ?'); values.push(updateData.cookie); }
    if (updateData.workspaces !== undefined) { fields.push('workspaces = ?'); values.push(JSON.stringify(updateData.workspaces)); }
    if (updateData.vipWorkspaces !== undefined) { fields.push('vip_workspaces = ?'); values.push(JSON.stringify(updateData.vipWorkspaces)); }
    if (updateData.password !== undefined) { fields.push('password = ?'); values.push(updateData.password); }
    if (updateData.package !== undefined) { fields.push('package = ?'); values.push(updateData.package); }
    if (updateData.status !== undefined) { fields.push('status = ?'); values.push(updateData.status); }

    if (fields.length === 0) return { success: true, updatedCount: 0 };

    fields.push('updated_at = ?');
    values.push(now);
    values.push(token);

    const [result] = await activePool.execute(`UPDATE tokens SET ${fields.join(', ')} WHERE token = ?`, values);
    return { success: true, updatedCount: result.affectedRows };
  } catch (error) {
    useJsonFallback = true;
    const tokens = readJson(TOKENS_FILE, []);
    const idx = tokens.findIndex(t => t.token === token);
    if (idx >= 0) {
      tokens[idx] = { ...tokens[idx], ...updateData, updatedAt: now.toISOString() };
      writeJson(TOKENS_FILE, tokens);
      return { success: true, updatedCount: 1 };
    }
    return { success: false, updatedCount: 0 };
  }
}

// 4. Xóa token
export async function deleteToken(token) {
  const activePool = await getPool();
  if (!activePool) {
    const tokens = readJson(TOKENS_FILE, []);
    const filtered = tokens.filter(t => t.token !== token);
    const deletedCount = tokens.length - filtered.length;
    writeJson(TOKENS_FILE, filtered);
    return { success: true, deletedCount };
  }
  try {
    const [result] = await activePool.execute('DELETE FROM tokens WHERE token = ?', [token]);
    return { success: true, deletedCount: result.affectedRows };
  } catch (error) {
    useJsonFallback = true;
    const tokens = readJson(TOKENS_FILE, []);
    const filtered = tokens.filter(t => t.token !== token);
    writeJson(TOKENS_FILE, filtered);
    return { success: true, deletedCount: tokens.length - filtered.length };
  }
}

// 5. Tìm token bằng token string
export async function findTokenByToken(token) {
  const all = await getAllTokens();
  return all.find(t => t.token === token) || null;
}

// 6. Tìm tokens bằng email
export async function findTokensByEmail(email) {
  const all = await getAllTokens();
  return all.filter(t => t.email === email);
}

// 7. Lấy tokens đang hoạt động
export async function getActiveTokens() {
  const all = await getAllTokens();
  const now = new Date();
  return all.filter(t => t.status === 'active' && (!t.expiresAt || new Date(t.expiresAt) > now));
}

// 8. Lấy tokens đã hết hạn
export async function getExpiredTokens() {
  const all = await getAllTokens();
  const now = new Date();
  return all.filter(t => t.expiresAt && new Date(t.expiresAt) <= now);
}

// 9. Sinh token mới
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 10. Dọn dẹp token hết hạn
export async function cleanupExpiredTokens() {
  const activePool = await getPool();
  if (!activePool) {
    const tokens = readJson(TOKENS_FILE, []);
    const now = new Date();
    const active = tokens.filter(t => !t.expiresAt || new Date(t.expiresAt) > now);
    writeJson(TOKENS_FILE, active);
    return { success: true, deletedCount: tokens.length - active.length };
  }
  try {
    const [result] = await activePool.execute('DELETE FROM tokens WHERE expires_at IS NOT NULL AND expires_at <= NOW()');
    return { success: true, deletedCount: result.affectedRows };
  } catch (error) {
    useJsonFallback = true;
    const tokens = readJson(TOKENS_FILE, []);
    const now = new Date();
    const active = tokens.filter(t => !t.expiresAt || new Date(t.expiresAt) > now);
    writeJson(TOKENS_FILE, active);
    return { success: true, deletedCount: tokens.length - active.length };
  }
}

// 11. Khởi tạo Database
export async function initializeDatabase() {
  const activePool = await getPool();
  const tokens = await getAllTokens();
  if (!activePool) {
    return {
      success: true,
      message: 'Sử dụng JSON Storage local thành công',
      totalTokens: tokens.length
    };
  }
  return {
    success: true,
    message: 'Khởi tạo MySQL Database thành công',
    totalTokens: tokens.length
  };
}

// 12. Test MySQL Connection
export async function testMySQLConnection() {
  const activePool = await getPool();
  if (!activePool) {
    return { success: true, connected: false, message: 'Đang chạy chế độ Local JSON Storage (MySQL Offline)' };
  }
  return { success: true, connected: true, message: 'Kết nối MySQL thành công' };
}

// ===== ChatGPT Accounts Methods =====

export async function saveChatGPTAccount(accountData) {
  const activePool = await getPool();
  const id = accountData.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const formatted = {
    id,
    accountId: accountData.accountId,
    authorization: accountData.authorization,
    name: accountData.name || null,
    email: accountData.email || null,
    createdAt: now,
    updatedAt: now,
    status: accountData.status || 'active'
  };

  if (!activePool) {
    const list = readJson(CHATGPT_FILE, []);
    const idx = list.findIndex(a => a.id === id || a.accountId === accountData.accountId);
    if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
    else list.unshift(formatted);
    writeJson(CHATGPT_FILE, list);
    return { success: true, id };
  }

  try {
    await activePool.execute(`
      INSERT INTO chatgpt_accounts (id, account_id, authorization, name, email, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      authorization = VALUES(authorization), name = VALUES(name), email = VALUES(email), status = VALUES(status)
    `, [id, accountData.accountId, accountData.authorization, accountData.name || null, accountData.email || null, formatted.status]);
    return { success: true, id };
  } catch (error) {
    useJsonFallback = true;
    const list = readJson(CHATGPT_FILE, []);
    list.unshift(formatted);
    writeJson(CHATGPT_FILE, list);
    return { success: true, id };
  }
}

export async function getAllChatGPTAccounts() {
  const activePool = await getPool();
  if (!activePool) {
    return readJson(CHATGPT_FILE, []).filter(a => a.status === 'active');
  }
  try {
    const [rows] = await activePool.execute(`
      SELECT id, account_id, authorization, name, email, created_at, updated_at, status
      FROM chatgpt_accounts WHERE status = 'active' ORDER BY created_at DESC
    `);
    return rows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      authorization: r.authorization,
      name: r.name,
      email: r.email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      status: r.status
    }));
  } catch (error) {
    useJsonFallback = true;
    return readJson(CHATGPT_FILE, []).filter(a => a.status === 'active');
  }
}

export async function getChatGPTAccountById(id) {
  const all = await getAllChatGPTAccounts();
  return all.find(a => a.id === id) || null;
}

export async function deleteChatGPTAccount(id) {
  const activePool = await getPool();
  if (!activePool) {
    const list = readJson(CHATGPT_FILE, []);
    const filtered = list.filter(a => a.id !== id);
    writeJson(CHATGPT_FILE, filtered);
    return { success: true, deletedCount: list.length - filtered.length };
  }
  try {
    const [result] = await activePool.execute(`UPDATE chatgpt_accounts SET status = 'inactive' WHERE id = ?`, [id]);
    return { success: true, deletedCount: result.affectedRows };
  } catch (error) {
    useJsonFallback = true;
    const list = readJson(CHATGPT_FILE, []);
    const filtered = list.filter(a => a.id !== id);
    writeJson(CHATGPT_FILE, filtered);
    return { success: true, deletedCount: list.length - filtered.length };
  }
}
