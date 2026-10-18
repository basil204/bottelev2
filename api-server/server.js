import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import pool, { query, execute } from './db.js';
import { sendCanvaInviteApi, inviteMemberApi, batchInvite, getTeamInfo, getInviteHistory, getCanvaSession, saveCanvaSession, ROLE_NAME_MAP } from './canva_service.js';
import { createEduAccount, updateAccountPassword, generateRandomPassword, generateRandomUsername, DEFAULT_EDU_DOMAIN } from '../includes/services/googleAdminService.js';
import { startEduAccountExpirationService, setExpirationDbQuery } from '../includes/services/eduAccountExpirationService.js';

const app = express();
const PORT = process.env.PORT || 1568;

// Bật trust proxy để hỗ trợ Nginx, Cloudflare, Load Balancer (tránh lỗi ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

// TỰ ĐỘNG CẬP NHẬT CẤU TRÚC VÀ BẢNG SQL CÒN THIẾU
async function initDatabase() {
  try {
    const safeAddColumn = async (table, column, colDef) => {
      try {
        const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
        if (!cols || cols.length === 0) {
          await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${colDef}`);
          console.log(`✅ [API_SERVER] Đã bổ sung cột \`${column}\` vào bảng \`${table}\``);
        }
      } catch (e) {}
    };

    // 1. Khởi tạo Bảng user_api_keys
    await pool.query(`
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

    // 2. Bổ sung các cột cho bảng users
    await safeAddColumn('users', 'name', 'VARCHAR(255) NULL');
    await safeAddColumn('users', 'telegram_id', 'BIGINT NULL');
    await safeAddColumn('users', 'balance', 'DECIMAL(15,2) DEFAULT 0');
    await safeAddColumn('users', 'is_banned', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn('users', 'language', "VARCHAR(10) DEFAULT 'vi'");

    // 3. Bổ sung các cột cho bảng categories & products
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        priority INT DEFAULT 0,
        emoji VARCHAR(50) DEFAULT NULL,
        custom_emoji_id VARCHAR(100) DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await safeAddColumn('categories', 'is_active', 'TINYINT(1) DEFAULT 1');
    await safeAddColumn('categories', 'emoji', 'VARCHAR(50) DEFAULT NULL');
    await safeAddColumn('categories', 'custom_emoji_id', 'VARCHAR(100) DEFAULT NULL');

    await safeAddColumn('products', 'priority', 'INT DEFAULT 0');
    await safeAddColumn('products', 'type', "VARCHAR(50) DEFAULT 'stock'");
    await safeAddColumn('products', 'prompt_message', 'TEXT NULL');
    await safeAddColumn('products', 'category_id', 'INT NULL');
    await safeAddColumn('products', 'is_active', 'TINYINT(1) DEFAULT 1');
    await safeAddColumn('products', 'require_email', 'TINYINT(1) DEFAULT 0');

    // 4. Bổ sung các cột cho bảng orders
    await safeAddColumn('orders', 'invoice_code', 'VARCHAR(100) NULL');
    await safeAddColumn('orders', 'product_id', 'INT NULL');
    await safeAddColumn('orders', 'api_key_id', 'INT NULL');
    await safeAddColumn('orders', 'source', "VARCHAR(50) DEFAULT 'bot'");

    // Bổ sung các cột theo dõi đăng nhập và thời gian xóa cho bảng gmail_accounts
    await safeAddColumn('gmail_accounts', 'is_logged_in', 'TINYINT(1) DEFAULT 0');
    await safeAddColumn('gmail_accounts', 'first_login_at', 'DATETIME NULL');
    await safeAddColumn('gmail_accounts', 'last_login_at', 'DATETIME NULL');
    await safeAddColumn('gmail_accounts', 'delete_at', 'DATETIME NULL');
    await safeAddColumn('gmail_accounts', 'order_id', 'VARCHAR(100) NULL');

    // 5. Khởi tạo Bảng custom_pricing
    await pool.query(`
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

    // 6. Khởi tạo Bảng balance_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS balance_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        reason TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Khởi tạo Bảng translations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS translations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        msg_key VARCHAR(100) NOT NULL,
        lang VARCHAR(10) NOT NULL,
        msg_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_key_lang (msg_key, lang)
      )
    `);

    // 8. Khởi tạo Bảng canva_sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS canva_sessions (
        id INT PRIMARY KEY,
        saved_at DATETIME NOT NULL,
        cookies JSON NOT NULL,
        local_storage JSON NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 9. Khởi tạo Bảng canva_invites (Lưu lịch sử và Link mời vào Database)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS canva_invites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(100) NULL,
        role_code VARCHAR(10) NULL,
        member_count VARCHAR(100) NULL,
        invite_link TEXT NULL,
        invite_token VARCHAR(255) NULL,
        team_name VARCHAR(255) NULL,
        response_json LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('[API_SERVER] Cập nhật CSDL tự động hoàn tất.');
  } catch (e) {
    console.error('[API_SERVER_INIT_ERR]', e);
  }
}
initDatabase();

// 1. SECURITY HEADERS (Helmet)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.disable('x-powered-by');

// 2. CORS LOCKDOWN
app.use(cors({
  origin: '*', // Trong production có thể đổi thành domain cố định
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization']
}));

app.use(express.json({ limit: '10kb' })); // Anti payload bomb
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 3. RATE LIMITING
// Global API Rate Limit: Max 200 requests / 15 phút / IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, error: 'Quá nhiều yêu cầu từ IP của bạn. Vui lòng thử lại sau 15 phút.' }
});
app.use('/api/', globalLimiter);

// Purchase Rate Limit: Max 20 đơn / phút / IP
const buyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, error: 'Tốc độ đặt hàng quá nhanh. Vui lòng đợi 30 giây trước khi đặt lại.' }
});

// Helper: Mask API Key for safe logging
function maskKey(key) {
  if (!key || key.length < 12) return '***';
  return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
}

// Helper: Sanitize text against XSS/HTML Injection
function sanitizeInput(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Helper: Calculate Custom Pricing
async function getUserProductPrice(connection, userId, productId, defaultPrice, isApiCall = true) {
  try {
    const [rows] = await connection.query(
      `SELECT custom_price, scope FROM custom_pricing 
       WHERE (user_id = ? OR user_id = (SELECT telegram_id FROM users WHERE id = ? LIMIT 1))
       AND product_id = ? AND is_active = 1
       ORDER BY id DESC LIMIT 1`,
      [userId, userId, productId]
    );

    if (rows && rows.length > 0) {
      const { custom_price, scope } = rows[0];

      if (scope === 'CLIENT_API' && !isApiCall) {
        return Number(defaultPrice);
      }

      if (scope === 'FIRST_ORDER') {
        const [orderRows] = await connection.query(
          "SELECT id FROM orders WHERE user_id = ? AND product_id = ? AND status = 'completed' LIMIT 1",
          [userId, productId]
        );
        if (orderRows && orderRows.length > 0) return Number(defaultPrice);
      }
      return Number(custom_price);
    }
  } catch (e) {
    console.error('[CUSTOM_PRICE_ERR]', e);
  }
  return Number(defaultPrice);
}

// Middleware xác thực User API Key
const authenticateApiKey = async (req, res, next) => {
  try {
    let apiKey = req.headers['x-api-key'] || req.query.api_key || req.body?.api_key;
    const authHeader = req.headers['authorization'];
    if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.replace('Bearer ', '').trim();
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(401).json({
        success: false,
        error: 'Thiếu X-API-Key hợp lệ. Vui lòng truyền Header X-API-Key hoặc query parameter api_key.'
      });
    }

    const cleanKey = String(apiKey).trim();

    const keyRows = await query(
      `SELECT k.id as key_id, k.name as key_name, k.is_active, k.permissions, u.id as user_id, u.telegram_id, u.username, u.name, u.balance, u.is_banned
       FROM user_api_keys k
       INNER JOIN users u ON (k.user_id = u.id OR k.user_id = u.telegram_id)
       WHERE LOWER(TRIM(k.api_key)) = LOWER(TRIM(?)) LIMIT 1`,
      [cleanKey]
    );

    if (!keyRows || keyRows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'API Key không tồn tại hoặc đã bị vô hiệu hóa.'
      });
    }

    const keyInfo = keyRows[0];
    if (!keyInfo.is_active) {
      return res.status(403).json({
        success: false,
        error: 'API Key của bạn đang bị vô hiệu hóa. Vui lòng liên hệ Admin.'
      });
    }

    if (keyInfo.is_banned) {
      return res.status(403).json({
        success: false,
        error: 'Tài khoản người dùng liên kết với API Key này đã bị khóa.'
      });
    }

    // Touch last_used_at timestamp
    execute('UPDATE user_api_keys SET last_used_at = NOW() WHERE id = ?', [keyInfo.key_id]).catch(() => { });

    req.user = keyInfo;
    req.apiKey = cleanKey;
    next();
  } catch (err) {
    console.error('[AUTH_MIDDLEWARE_ERR]', err);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ khi xác thực API Key' });
  }
};

// Middleware kiểm tra quyền truy cập (Scope Permissions)
const requireScope = (requiredScope) => (req, res, next) => {
  const userPerms = req.user?.permissions || 'all';
  if (userPerms === 'all') return next();
  
  const scopes = userPerms.split(',').map(s => s.trim().toLowerCase());
  if (scopes.includes('all') || scopes.includes(requiredScope.toLowerCase())) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: `API Key của bạn không có quyền thực hiện thao tác này. (Cần quyền: ${requiredScope})`
  });
};

// ============================================================================
// API ROUTES
// ============================================================================

// A. Health Check
app.get('/', (req, res) => {
  res.json({
    service: 'Ultra-Secure Bot & Web Pure Backend API',
    status: 'ONLINE',
    security_features: ['Rate-Limiting', 'ACID Transactions (Row Locking)', 'Helmet Security Headers', 'Strict Type Checking', 'XSS Prevention'],
    version: '1.2.0'
  });
});

// B. User Profile Info & API Key Purchase History
app.get('/api/v1/user', authenticateApiKey, async (req, res) => {
  try {
    const historyLimit = Math.min(100, Math.max(1, parseInt(req.query.history_limit || req.query.limit, 10) || 10));

    // Thống kê đơn hàng mua bằng API Key của người dùng
    const statsRows = await query(`
      SELECT 
        COUNT(*) as total_api_orders,
        COALESCE(SUM(price), 0) as total_api_spent,
        MAX(created_at) as last_api_purchase_at
      FROM orders
      WHERE user_id = ? AND (api_key_id IS NOT NULL OR source = 'api' OR note LIKE '%API%')
    `, [req.user.user_id]);

    const stats = statsRows && statsRows.length > 0 ? statsRows[0] : { total_api_orders: 0, total_api_spent: 0, last_api_purchase_at: null };

    // Lấy danh sách lịch sử mua hàng qua API Key gần đây
    const historyRows = await query(`
      SELECT 
        o.id,
        o.invoice_code,
        o.product_id,
        COALESCE(p.name, o.note, 'Gmail EDU') as product_name,
        o.price,
        o.status,
        o.email as delivery_data,
        o.note,
        o.created_at,
        o.api_key_id,
        COALESCE(o.source, 'api') as source
      FROM orders o
      LEFT JOIN products p ON p.id = o.product_id
      WHERE o.user_id = ? AND (o.api_key_id IS NOT NULL OR o.source = 'api' OR o.note LIKE '%API%')
      ORDER BY o.id DESC
      LIMIT ?
    `, [req.user.user_id, historyLimit]);

    // Lấy thông tin giá Gmail EDU (giá mặc định & giá riêng nếu có)
    let defaultEduPrice = 10000;
    try {
      const sRows = await query("SELECT value FROM settings WHERE `key` = 'gmail_edu_price' LIMIT 1");
      if (sRows && sRows.length > 0 && sRows[0].value) {
        defaultEduPrice = Number(sRows[0].value) || 10000;
      }
    } catch (e) {}

    let effectiveEduPrice = defaultEduPrice;
    let hasCustomEduPrice = false;
    let customEduPriceRow = null;
    try {
      const cpRows = await query(`
        SELECT id, custom_price, scope, is_active FROM custom_pricing 
        WHERE (user_id = ? OR user_id = (SELECT id FROM users WHERE telegram_id = ? LIMIT 1))
          AND (product_id = -1 OR plan_id = 'gmail_edu' OR plan_id = 'gmail' OR scope = 'GMAIL_EDU')
        ORDER BY id DESC LIMIT 1
      `, [req.user.user_id, req.user.user_id]);

      if (cpRows && cpRows.length > 0) {
        customEduPriceRow = cpRows[0];
        if (Boolean(customEduPriceRow.is_active)) {
          effectiveEduPrice = Number(customEduPriceRow.custom_price);
          hasCustomEduPrice = true;
        }
      }
    } catch (e) {}

    res.json({
      success: true,
      data: {
        user_id: req.user.user_id,
        telegram_id: req.user.telegram_id,
        username: req.user.username,
        name: req.user.name,
        balance: Number(req.user.balance) || 0,
        api_key_info: {
          key_id: req.user.key_id,
          key_name: req.user.key_name,
          permissions: req.user.permissions || 'all',
          is_active: Boolean(req.user.is_active)
        },
        edu_pricing: {
          default_price: defaultEduPrice,
          effective_price: effectiveEduPrice,
          has_custom_price: hasCustomEduPrice,
          custom_price: customEduPriceRow ? Number(customEduPriceRow.custom_price) : null,
          scope: customEduPriceRow ? customEduPriceRow.scope : 'ALL_ORDERS',
          is_active: customEduPriceRow ? Boolean(customEduPriceRow.is_active) : false
        },
        api_purchase_stats: {
          total_orders: Number(stats.total_api_orders) || 0,
          total_spent: Number(stats.total_api_spent) || 0,
          last_purchase_at: stats.last_api_purchase_at || null
        },
        purchase_history: (historyRows || []).map(o => ({
          id: o.id,
          invoice_code: o.invoice_code,
          product_id: o.product_id,
          product_name: o.product_name,
          price: Number(o.price) || 0,
          status: o.status,
          note: o.note,
          delivery_data: o.delivery_data,
          created_at: o.created_at
        }))
      }
    });
  } catch (err) {
    console.error('[USER_API_ERR]', err);
    res.status(500).json({ success: false, error: 'Lỗi lấy thông tin người dùng và lịch sử API Key' });
  }
});

// B2. GET /api/v1/user/edu-price - Lấy thông tin giá Gmail EDU của người dùng
app.get('/api/v1/user/edu-price', authenticateApiKey, async (req, res) => {
  try {
    const targetUserIdInput = req.query.user_id || req.query.userId || req.query.telegram_id || req.query.telegramId || req.user.user_id;

    const uRows = await query('SELECT id, telegram_id, username, name FROM users WHERE id = ? OR telegram_id = ? LIMIT 1', [targetUserIdInput, targetUserIdInput]);
    if (!uRows || uRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng.' });
    }
    const targetUser = uRows[0];

    // Lấy giá mặc định
    let defaultEduPrice = 10000;
    try {
      const sRows = await query("SELECT value FROM settings WHERE `key` = 'gmail_edu_price' LIMIT 1");
      if (sRows && sRows.length > 0 && sRows[0].value) {
        defaultEduPrice = Number(sRows[0].value) || 10000;
      }
    } catch (e) {}

    let effectiveEduPrice = defaultEduPrice;
    let hasCustomEduPrice = false;
    let customEduPriceRow = null;
    try {
      const cpRows = await query(`
        SELECT id, custom_price, scope, is_active, updated_at FROM custom_pricing 
        WHERE (user_id = ? OR user_id = (SELECT id FROM users WHERE telegram_id = ? LIMIT 1))
          AND (product_id = -1 OR plan_id = 'gmail_edu' OR plan_id = 'gmail' OR scope = 'GMAIL_EDU')
        ORDER BY id DESC LIMIT 1
      `, [targetUser.id, targetUser.id]);

      if (cpRows && cpRows.length > 0) {
        customEduPriceRow = cpRows[0];
        if (Boolean(customEduPriceRow.is_active)) {
          effectiveEduPrice = Number(customEduPriceRow.custom_price);
          hasCustomEduPrice = true;
        }
      }
    } catch (e) {}

    res.json({
      success: true,
      data: {
        user_id: targetUser.id,
        telegram_id: targetUser.telegram_id,
        username: targetUser.username,
        default_price: defaultEduPrice,
        effective_price: effectiveEduPrice,
        has_custom_price: hasCustomEduPrice,
        custom_price: customEduPriceRow ? Number(customEduPriceRow.custom_price) : null,
        scope: customEduPriceRow ? customEduPriceRow.scope : 'ALL_ORDERS',
        is_active: customEduPriceRow ? Boolean(customEduPriceRow.is_active) : false,
        pricing_id: customEduPriceRow ? customEduPriceRow.id : null
      }
    });
  } catch (err) {
    console.error('[GET_USER_EDU_PRICE_ERR]', err);
    res.status(500).json({ success: false, error: 'Lỗi lấy thông tin giá Email EDU của người dùng' });
  }
});

// B3. POST /api/v1/user/edu-price - Cài đặt hoặc xóa giá riêng Gmail EDU cho người dùng
app.post('/api/v1/user/edu-price', authenticateApiKey, async (req, res) => {
  try {
    const targetUserIdInput = req.body.user_id || req.body.userId || req.body.telegram_id || req.body.telegramId || req.user.user_id;
    const price = req.body.price !== undefined ? req.body.price : req.body.custom_price;
    const scope = req.body.scope || 'ALL_ORDERS';
    const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : 1;
    const action = req.body.action; // 'set', 'delete', 'toggle'

    const uRows = await query('SELECT id, telegram_id, username, name FROM users WHERE id = ? OR telegram_id = ? LIMIT 1', [targetUserIdInput, targetUserIdInput]);
    if (!uRows || uRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng trong hệ thống.' });
    }
    const targetUser = uRows[0];

    // Chỉ cho phép admin hoặc tài khoản có permissions = 'all' chỉnh giá cho người dùng khác
    if (targetUser.id !== req.user.user_id && req.user.permissions !== 'all') {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền thiết lập giá cho người dùng khác.' });
    }

    if (action === 'delete') {
      await query(`
        DELETE FROM custom_pricing 
        WHERE user_id = ? AND (product_id = -1 OR plan_id = 'gmail_edu' OR scope = 'GMAIL_EDU')
      `, [targetUser.id]);
      return res.json({
        success: true,
        message: 'Đã xóa giá riêng Email EDU thành công, tài khoản sẽ áp dụng giá mặc định hệ thống.'
      });
    }

    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ success: false, error: 'Giá Email EDU không hợp lệ. Vui lòng nhập số tiền >= 0 VNĐ.' });
    }

    const numPrice = Number(price);
    const existing = await query(`
      SELECT id FROM custom_pricing 
      WHERE user_id = ? AND (product_id = -1 OR plan_id = 'gmail_edu' OR scope = 'GMAIL_EDU')
      ORDER BY id DESC LIMIT 1
    `, [targetUser.id]);

    let id;
    if (existing && existing.length > 0) {
      id = existing[0].id;
      await query(`
        UPDATE custom_pricing 
        SET custom_price = ?, scope = ?, is_active = ?, plan_id = 'gmail_edu', updated_at = NOW()
        WHERE id = ?
      `, [numPrice, scope, isActive, id]);
    } else {
      const insRes = await query(`
        INSERT INTO custom_pricing (user_id, product_id, plan_id, custom_price, scope, is_active)
        VALUES (?, -1, 'gmail_edu', ?, ?, ?)
      `, [targetUser.id, numPrice, scope, isActive]);
      id = insRes.insertId;
    }

    return res.json({
      success: true,
      message: `Đã thiết lập giá Email EDU ${numPrice.toLocaleString('vi-VN')} đ cho người dùng thành công!`,
      data: {
        id,
        user_id: targetUser.id,
        username: targetUser.username,
        custom_price: numPrice,
        scope,
        is_active: Boolean(isActive)
      }
    });
  } catch (err) {
    console.error('[SET_USER_EDU_PRICE_ERR]', err);
    return res.status(500).json({ success: false, error: 'Lỗi thiết lập giá Email EDU cho người dùng' });
  }
});

// B2. Lịch sử chi tiết sử dụng API Key mua hàng (hỗ trợ phân trang)
app.get('/api/v1/user/purchase-history', authenticateApiKey, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const countRows = await query(`
      SELECT COUNT(*) as total, COALESCE(SUM(price), 0) as total_spent
      FROM orders
      WHERE user_id = ? AND (api_key_id IS NOT NULL OR source = 'api' OR note LIKE '%API%')
    `, [req.user.user_id]);

    const total = countRows && countRows.length > 0 ? Number(countRows[0].total) : 0;
    const totalSpent = countRows && countRows.length > 0 ? Number(countRows[0].total_spent) : 0;

    const orders = await query(`
      SELECT 
        o.id,
        o.invoice_code,
        o.product_id,
        COALESCE(p.name, o.note, 'Gmail EDU') as product_name,
        o.price,
        o.status,
        o.email as delivery_data,
        o.note,
        o.created_at,
        o.api_key_id,
        COALESCE(o.source, 'api') as source
      FROM orders o
      LEFT JOIN products p ON p.id = o.product_id
      WHERE o.user_id = ? AND (o.api_key_id IS NOT NULL OR o.source = 'api' OR o.note LIKE '%API%')
      ORDER BY o.id DESC
      LIMIT ? OFFSET ?
    `, [req.user.user_id, limit, offset]);

    res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        total_orders: total,
        total_spent: totalSpent
      },
      data: orders
    });
  } catch (err) {
    console.error('[USER_PURCHASE_HISTORY_ERR]', err);
    res.status(500).json({ success: false, error: 'Lỗi lấy lịch sử mua hàng qua API Key' });
  }
});

// C. Self-Service Generate API Key
app.post('/api/v1/user/api-key', async (req, res) => {
  try {
    const { userId, telegramId } = req.body;
    const targetUserId = parseInt(userId, 10);
    const targetTelegramId = parseInt(telegramId, 10);

    if (!targetUserId && !targetTelegramId) {
      return res.status(400).json({ success: false, error: 'Vui lòng truyền userId hoặc telegramId số hợp lệ.' });
    }

    const userRows = await query(
      'SELECT id, username, name, is_banned FROM users WHERE id = ? OR telegram_id = ? LIMIT 1',
      [targetUserId || 0, targetTelegramId || 0]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng trong hệ thống.' });
    }

    const user = userRows[0];
    if (user.is_banned) {
      return res.status(403).json({ success: false, error: 'Tài khoản người dùng đã bị khóa.' });
    }

    const newApiKey = `sk_edu_${crypto.randomBytes(16).toString('hex')}`;

    const existing = await query('SELECT id FROM user_api_keys WHERE user_id = ? LIMIT 1', [user.id]);
    if (existing && existing.length > 0) {
      await execute('UPDATE user_api_keys SET api_key = ?, is_active = 1, created_at = NOW() WHERE user_id = ?', [newApiKey, user.id]);
    } else {
      await execute('INSERT INTO user_api_keys (user_id, api_key, name, is_active) VALUES (?, ?, ?, 1)', [user.id, newApiKey, 'Ví Self-Service API Key']);
    }

    console.log(`[SECURE_API_KEY] Created API Key for user #${user.id} (${maskKey(newApiKey)})`);

    res.json({
      success: true,
      message: 'Đã tạo/đổi API Key bảo mật thành công!',
      api_key: newApiKey
    });
  } catch (err) {
    console.error('[GENERATE_KEY_ERR]', err);
    res.status(500).json({ success: false, error: 'Lỗi máy chủ khi tạo API Key' });
  }
});

// D. Products List (Filtered & Safe)
app.get('/api/v1/products', authenticateApiKey, async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId, 10) : null;
    let whereClause = 'WHERE (p.is_active IS NULL OR p.is_active = 1) AND (c.is_active IS NULL OR c.is_active = 1)';
    const params = [];

    if (categoryId && !isNaN(categoryId)) {
      whereClause += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    const products = await query(`
      SELECT p.id, p.name, p.price, p.description, p.type, p.require_email, p.prompt_message, p.category_id, p.image_url,
             c.name as category_name,
             COALESCE(st.stock, 0) as stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN (
        SELECT product_id, COUNT(*) as stock FROM accounts WHERE status = 'available' GROUP BY product_id
      ) st ON st.product_id = p.id
      ${whereClause}
      ORDER BY p.priority DESC, p.id DESC
    `, params);

    const formattedProducts = await Promise.all(products.map(async (p) => {
      const userPrice = await getUserProductPrice(pool, req.user.user_id, p.id, p.price);
      return {
        id: p.id,
        name: p.name,
        original_price: Number(p.price),
        user_price: userPrice,
        description: p.description || '',
        type: p.type || 'stock',
        require_email: Boolean(p.require_email || p.type === 'order'),
        stock: p.type === 'order' ? 9999 : Number(p.stock || 0),
        category_name: p.category_name || 'Khác',
        image_url: p.image_url || null,
        prompt_message: p.prompt_message || null
      };
    }));

    res.json({
      success: true,
      total: formattedProducts.length,
      data: formattedProducts
    });
  } catch (err) {
    console.error('[PRODUCTS_API_ERR]', err);
    res.status(500).json({ success: false, error: 'Lỗi lấy danh sách sản phẩm', details: err.message });
  }
});

// E. ULTRA-SECURE UNIVERSAL PURCHASE API (ACID Transaction + Row Locking)
app.post('/api/v1/buy', buyLimiter, authenticateApiKey, async (req, res) => {
  // 1. STRICT INPUT VALIDATION & PARAMETER TAMPERING SANITIZATION
  const rawProductId = req.body.productId;
  const rawQuantity = req.body.quantity;
  const customEmail = sanitizeInput(req.body.custom_email);
  const note = sanitizeInput(req.body.note);

  const productId = parseInt(rawProductId, 10);
  const qty = parseInt(rawQuantity, 10);

  // Reject NaN, floats, negative numbers, or quantities outside range [1, 50]
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ success: false, error: 'productId phải là số nguyên dương hợp lệ.' });
  }

  if (isNaN(qty) || qty < 1 || qty > 50 || qty !== Number(rawQuantity)) {
    return res.status(400).json({ success: false, error: 'Số lượng mua (quantity) phải là số nguyên từ 1 đến 50.' });
  }

  // 2. ATOMIC DATABASE TRANSACTION WITH ROW-LEVEL LOCKING (FOR UPDATE)
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // A. Lock User Row FOR UPDATE to prevent parallel race condition
    const [userRows] = await connection.query(
      'SELECT id, balance, is_banned FROM users WHERE id = ? FOR UPDATE',
      [req.user.user_id]
    );

    if (!userRows || userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Người dùng không tồn tại.' });
    }

    const user = userRows[0];
    if (user.is_banned) {
      await connection.rollback();
      return res.status(403).json({ success: false, error: 'Tài khoản người dùng đã bị khóa.' });
    }

    // B. Lock Product Row & Category Row
    const [prodRows] = await connection.query(
      `SELECT p.id, p.name, p.price, p.type, p.require_email, p.is_active, c.is_active as cat_active 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = ? FOR UPDATE`,
      [productId]
    );

    if (!prodRows || prodRows.length === 0 || !prodRows[0].is_active || (prodRows[0].cat_active !== null && !prodRows[0].cat_active)) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Sản phẩm không tồn tại hoặc đã ngưng kinh doanh.' });
    }

    const product = prodRows[0];
    const isEmailRequired = Boolean(product.require_email || product.type === 'order');

    if (isEmailRequired) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!customEmail || !emailRegex.test(customEmail)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Sản phẩm này yêu cầu nhập email nhận hàng/xử lý (custom_email). Vui lòng cung cấp email hợp lệ.'
        });
      }
    }

    // C. Calculate User Custom Price
    const unitPrice = await getUserProductPrice(connection, user.id, product.id, product.price);
    const totalPrice = unitPrice * qty;
    const currentBalance = Number(user.balance) || 0;

    // Verify balance strictly INSIDE transaction lock
    if (currentBalance < totalPrice) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: `Số dư tài khoản không đủ. Số dư hiện có: ${currentBalance.toLocaleString('vi-VN')} VNĐ, Cần: ${totalPrice.toLocaleString('vi-VN')} VNĐ.`
      });
    }

    const productType = product.type || 'stock';

    // D1. PURCHASE SERVICE TYPE: ORDER / MANUAL
    if (productType === 'order') {
      // Deduct Balance
      await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [totalPrice, user.id]);
      await connection.query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)', [
        user.id, -totalPrice, `api_buy_order_${product.id}_qty_${qty}`
      ]);

      const noteText = customEmail ? `Email/Info: ${customEmail} | Note: ${note}` : (note || 'API Order Request');
      const [orderRes] = await connection.query(
        'INSERT INTO orders (user_id, product_id, price, email, note, status) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, product.id, totalPrice, customEmail || null, noteText, 'pending']
      );

      const invoiceCode = `HD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(orderRes.insertId).padStart(4, '0')}`;
      await connection.query('UPDATE orders SET invoice_code = ? WHERE id = ?', [invoiceCode, orderRes.insertId]);

      await connection.commit();

      return res.json({
        success: true,
        message: 'Đơn hàng dịch vụ Order đã được khởi tạo và đang chờ Admin xử lý!',
        invoice_code: invoiceCode,
        product_name: product.name,
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        remaining_balance: currentBalance - totalPrice,
        status: 'pending'
      });
    }

    // D2. PURCHASE SERVICE TYPE: STOCK (AUTO INSTANT DELIVERY)
    // Lock exact available accounts FOR UPDATE
    const [stockAccounts] = await connection.query(
      "SELECT id, username, password, extra_data, twofa FROM accounts WHERE product_id = ? AND status = 'available' LIMIT ? FOR UPDATE",
      [product.id, qty]
    );

    if (!stockAccounts || stockAccounts.length < qty) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: `Sản phẩm này trong kho không đủ hàng. Số lượng còn lại: ${stockAccounts ? stockAccounts.length : 0}`
      });
    }

    // Mark accounts as sold atomically
    const accountIds = stockAccounts.map(a => a.id);
    await connection.query(`UPDATE accounts SET status = 'sold' WHERE id IN (${accountIds.join(',')})`);

    // Deduct Balance
    await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [totalPrice, user.id]);
    await connection.query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)', [
      user.id, -totalPrice, `api_buy_stock_${product.id}_qty_${qty}`
    ]);

    const accountsDataFormatted = stockAccounts.map(acc => {
      let line = `${acc.username}|${acc.password || ''}`;
      if (acc.extra_data) line += `|${acc.extra_data}`;
      if (acc.twofa) line += `|${acc.twofa}`;
      return line;
    }).join('\n');

    const [orderRes] = await connection.query(
      'INSERT INTO orders (user_id, product_id, price, email, note, status, api_key_id, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user.id, product.id, totalPrice, accountsDataFormatted, req.body.note || 'API Instant Delivery', 'completed', req.user.key_id || null, 'api']
    );

    const invoiceCode = `HD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(orderRes.insertId).padStart(4, '0')}`;
    await connection.query('UPDATE orders SET invoice_code = ? WHERE id = ?', [invoiceCode, orderRes.insertId]);

    // Commit Transaction
    await connection.commit();

    console.log(`[SECURE_PURCHASE_SUCCESS] User #${user.id} bought ${qty}x ${product.name} (Invoice: ${invoiceCode})`);

    res.json({
      success: true,
      message: 'Thanh toán & nhận hàng thành công!',
      invoice_code: invoiceCode,
      product_name: product.name,
      quantity: qty,
      unit_price: unitPrice,
      total_price: totalPrice,
      remaining_balance: currentBalance - totalPrice,
      delivered_accounts: stockAccounts.map(acc => ({
        username: acc.username,
        password: acc.password,
        extra_data: acc.extra_data || null,
        twofa: acc.twofa || null
      }))
    });
  } catch (err) {
    await connection.rollback();
    console.error('[PURCHASE_TRANSACTION_FAILED]', err);
    res.status(500).json({ success: false, error: 'Lỗi giao dịch máy chủ. Giao dịch đã được hủy an toàn.' });
  } finally {
    connection.release();
  }
});

// F. User Orders History
app.get('/api/v1/orders', authenticateApiKey, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const apiOnly = req.query.api_only === 'true';

    let sql = `
      SELECT o.id, o.invoice_code, o.price, o.status, o.email as accounts_data, o.note, o.created_at,
             o.api_key_id, COALESCE(o.source, 'bot') as source,
             COALESCE(p.name, o.note, 'Sản phẩm') as product_name
      FROM orders o
      LEFT JOIN products p ON p.id = o.product_id
      WHERE o.user_id = ?
    `;
    const params = [req.user.user_id];

    if (apiOnly) {
      sql += ` AND (o.api_key_id IS NOT NULL OR o.source = 'api' OR o.note LIKE '%API%')`;
    }

    sql += ` ORDER BY o.id DESC LIMIT ?`;
    params.push(limit);

    const orders = await query(sql, params);

    res.json({
      success: true,
      total: orders.length,
      data: orders
    });
  } catch (err) {
    console.error('[ORDERS_API_ERR]', err);
    res.status(500).json({ success: false, error: 'Lỗi lấy lịch sử đơn hàng' });
  }
});

// G. API Order Gmail EDU Endpoint
app.post('/api/v1/order-edu', buyLimiter, authenticateApiKey, requireScope('order_edu'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Lock User Row
    const [userRows] = await connection.query(
      'SELECT id, balance, is_banned FROM users WHERE id = ? FOR UPDATE',
      [req.user.user_id]
    );

    if (!userRows || userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Người dùng không tồn tại.' });
    }

    const user = userRows[0];
    if (user.is_banned) {
      await connection.rollback();
      return res.status(403).json({ success: false, error: 'Tài khoản người dùng đã bị khóa.' });
    }

    // 2. Fetch Settings
    const [settingsRows] = await connection.query(
      "SELECT `key`, `value` FROM settings WHERE `key` IN ('gmail_edu_price', 'gmail_edu_domain', 'gmail_edu_enabled', 'buy_gmail_edu')"
    );

    const settingsMap = {};
    settingsRows.forEach(r => { settingsMap[r.key] = r.value; });

    const isEnabled = settingsMap.gmail_edu_enabled !== 'false' && settingsMap.buy_gmail_edu !== 'false';
    if (!isEnabled) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Tính năng mua Gmail EDU hiện đang bị tạm khóa bởi Admin.' });
    }

    let pricePerUnit = Number(settingsMap.gmail_edu_price) || 10000;
    try {
      const [cpRows] = await connection.query(
        `SELECT custom_price, scope FROM custom_pricing 
         WHERE (user_id = ? OR user_id = (SELECT id FROM users WHERE telegram_id = ? LIMIT 1))
           AND (product_id = -1 OR plan_id = 'gmail_edu' OR plan_id = 'gmail' OR scope = 'GMAIL_EDU')
           AND is_active = 1
         ORDER BY id DESC LIMIT 1`,
        [req.user.user_id, req.user.user_id]
      );
      if (cpRows && cpRows.length > 0) {
        pricePerUnit = Number(cpRows[0].custom_price);
      }
    } catch (cpErr) {
      if (cpErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error('[GMAIL_EDU_API_CUSTOM_PRICE_ERR]', cpErr.message);
      }
    }

    const defaultDomain = req.body.domain && String(req.body.domain).trim() 
      ? String(req.body.domain).trim() 
      : (settingsMap.gmail_edu_domain || DEFAULT_EDU_DOMAIN || 'nttp.edu.pl');

    const rawQuantity = req.body.quantity;
    const quantity = Math.min(Math.max(1, parseInt(rawQuantity, 10) || 1), 50);
    const domain = defaultDomain;
    const type = req.body.type === 'non' ? 'non' : 'edu';

    // Hỗ trợ đặt mật khẩu cho email EDU qua body hoặc query (password, pass, custom_password)
    const reqPassword = req.body.password || req.body.pass || req.body.custom_password || req.query?.password || req.query?.pass;
    let customPassword = null;
    if (reqPassword) {
      const cleanReqPass = String(reqPassword).trim();
      if (cleanReqPass.length < 8) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Mật khẩu tùy chỉnh cho Gmail EDU phải có tối thiểu 8 ký tự theo tiêu chuẩn bảo mật Google Workspace.'
        });
      }
      customPassword = cleanReqPass;
    }

    // Hỗ trợ mảng passwords cho nhiều tài khoản
    const passwordsList = Array.isArray(req.body.passwords) ? req.body.passwords : [];
    if (passwordsList.length > 0) {
      for (const p of passwordsList) {
        if (p && String(p).trim().length < 8) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            error: `Mật khẩu '${p}' trong danh sách passwords không hợp lệ. Phải có tối thiểu 8 ký tự.`
          });
        }
      }
    }

    const totalCost = pricePerUnit * quantity;
    const currentBalance = Number(user.balance) || 0;

    if (currentBalance < totalCost) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: `Số dư không đủ. Cần: ${totalCost.toLocaleString('vi-VN')} VNĐ, Số dư hiện có: ${currentBalance.toLocaleString('vi-VN')} VNĐ.`
      });
    }

    // 3. Create Accounts via Google Workspace Admin API
    const createdAccounts = [];
    const failedAccounts = [];

    for (let i = 0; i < quantity; i++) {
      const username = generateRandomUsername(req.body.prefix || req.body.username);
      // Quy luật: Nếu người dùng set pass thì tạo đúng mật khẩu đó, nếu không set pass thì random ngẫu nhiên
      const userProvidedPass = (passwordsList[i] && String(passwordsList[i]).trim()) || customPassword;
      const password = userProvidedPass || generateRandomPassword(12);

      const result = await createEduAccount(username, domain, password);

      if (!result.success) {
        console.error(`[API_ORDER_EDU] Lỗi tạo tài khoản Google Workspace (${username}@${domain}):`, result.error);
        failedAccounts.push({ username, domain, error: result.error });
        continue;
      }

      const email = result.email;
      const finalPass = result.password || password;

      // Lưu vào bảng gmail_accounts: is_logged_in = 0, first_login_at = NULL, delete_at = NULL
      // QUY LUẬT BẢO TOÀN: Khi khách mua qua API, nếu chưa đăng nhập thì KHÔNG ĐƯỢC XÓA!
      // Chỉ khi người dùng đăng nhập lần đầu tiên trên Google thì hệ thống mới kích hoạt đếm ngược thời gian xóa!
      await connection.query(`
        INSERT INTO gmail_accounts (
          email, password, type, domain, status, sold_to_user_id, sold_price, 
          is_logged_in, first_login_at, delete_at, created_at
        )
        VALUES (?, ?, ?, ?, 'sold', ?, ?, 0, NULL, NULL, NOW())
      `, [email, finalPass, type, domain, user.id, pricePerUnit]);

      createdAccounts.push({
        email,
        password: finalPass,
        type,
        domain,
        google_id: result.id,
        auto_delete: 'after_first_login',
        delete_rule: 'Tài khoản được bảo toàn cho đến khi đăng nhập lần đầu tiên. Hệ thống sẽ tự động đếm ngược và xóa sau khi phát hiện đăng nhập.'
      });

      if (i < quantity - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (createdAccounts.length === 0) {
      await connection.rollback();
      return res.status(500).json({
        success: false,
        error: `Không thể tạo tài khoản trên Google Admin API: ${failedAccounts[0]?.error || 'Lỗi hệ thống Google'}`
      });
    }

    const actualTotalCost = pricePerUnit * createdAccounts.length;

    // 4. Deduct User Balance
    await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [actualTotalCost, user.id]);
    await connection.query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)', [
      user.id, -actualTotalCost, `buy_gmail_edu_api_${createdAccounts.length}_items`
    ]);

    // 5. Create Order Record
    const accountsFormatted = createdAccounts.map(a => `${a.email}|${a.password}`).join('\n');
    const [orderRes] = await connection.query(
      "INSERT INTO orders (user_id, price, email, note, status, api_key_id, source) VALUES (?, ?, ?, ?, 'completed', ?, ?)",
      [user.id, actualTotalCost, accountsFormatted, `API Order Gmail EDU (${createdAccounts.length} tài khoản)`, req.user.key_id || null, 'api']
    );

    const invoiceCode = `HD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(orderRes.insertId).padStart(4, '0')}`;
    await connection.query('UPDATE orders SET invoice_code = ? WHERE id = ?', [invoiceCode, orderRes.insertId]);

    // Cập nhật order_id vào gmail_accounts
    try {
      await connection.query('UPDATE gmail_accounts SET order_id = ? WHERE sold_to_user_id = ? AND order_id IS NULL', [
        invoiceCode, user.id
      ]);
    } catch (e) {}

    await connection.commit();

    return res.json({
      success: true,
      message: 'Đặt Gmail EDU qua API thành công!',
      invoice_code: invoiceCode,
      quantity: createdAccounts.length,
      total_cost: actualTotalCost,
      price_per_unit: pricePerUnit,
      remaining_balance: currentBalance - actualTotalCost,
      data: createdAccounts
    });
  } catch (err) {
    await connection.rollback();
    console.error('[ORDER_EDU_API_ERR]', err);
    res.status(500).json({ success: false, error: 'Lỗi hệ thống khi xử lý đơn hàng Gmail EDU.' });
  } finally {
    connection.release();
  }
});

// G2. API Đổi / Set Mật Khẩu Cho Tài Khoản Gmail EDU Đã Mua
const handleEduSetPassword = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const rawEmail = req.body.email || req.query.email;
    const rawPassword = req.body.password || req.body.new_password || req.query.password;

    if (!rawEmail || !rawPassword) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp email và password mới (tối thiểu 8 ký tự).'
      });
    }

    const cleanEmail = String(rawEmail).trim().toLowerCase();
    const cleanPassword = String(rawPassword).trim();

    if (cleanPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Mật khẩu mới phải có tối thiểu 8 ký tự theo tiêu chuẩn bảo mật Google Workspace.'
      });
    }

    // 1. Kiểm tra tài khoản trong database
    const [accountRows] = await connection.query(
      'SELECT id, email, password, sold_to_user_id, status FROM gmail_accounts WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      [cleanEmail]
    );

    let isOwner = false;
    let isSystemAdmin = false;

    // Kiểm tra xem user có phải admin hệ thống không
    const [adminRows] = await connection.query(
      "SELECT `value` FROM settings WHERE `key` = 'admin_ids' LIMIT 1"
    );
    if (adminRows && adminRows.length > 0) {
      const adminIds = adminRows[0].value ? adminRows[0].value.split(',').map(s => s.trim()) : [];
      if (adminIds.includes(String(req.user.user_id)) || adminIds.includes(String(req.user.telegram_id))) {
        isSystemAdmin = true;
      }
    }

    if (accountRows && accountRows.length > 0) {
      const acc = accountRows[0];
      if (
        acc.sold_to_user_id === req.user.user_id ||
        (req.user.telegram_id && acc.sold_to_user_id === req.user.telegram_id) ||
        isSystemAdmin
      ) {
        isOwner = true;
      }
    } else {
      // Nếu không có trong gmail_accounts, kiểm tra trong orders của user này
      const [orderRows] = await connection.query(
        'SELECT id, email FROM orders WHERE user_id = ? AND email LIKE ? LIMIT 1',
        [req.user.user_id, `%${cleanEmail}%`]
      );
      if ((orderRows && orderRows.length > 0) || isSystemAdmin) {
        isOwner = true;
      }
    }

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền thay đổi mật khẩu của tài khoản email này hoặc tài khoản không tồn tại trong hệ thống.'
      });
    }

    // 2. Gọi Google Workspace Admin API đổi mật khẩu
    const updateRes = await updateAccountPassword(cleanEmail, cleanPassword);
    if (!updateRes.success) {
      return res.status(500).json({
        success: false,
        error: `Không thể đổi mật khẩu trên Google Workspace: ${updateRes.error || 'Lỗi hệ thống'}`
      });
    }

    // 3. Cập nhật mật khẩu mới trong database
    if (accountRows && accountRows.length > 0) {
      await connection.query(
        'UPDATE gmail_accounts SET password = ? WHERE id = ?',
        [cleanPassword, accountRows[0].id]
      );
    }

    // Cập nhật thông tin trong đơn hàng cũ nếu có
    try {
      const [userOrders] = await connection.query(
        'SELECT id, email FROM orders WHERE user_id = ? AND email LIKE ?',
        [req.user.user_id, `%${cleanEmail}%`]
      );
      for (const ord of userOrders) {
        if (ord.email && ord.email.includes(cleanEmail)) {
          const lines = ord.email.split('\n');
          const updatedLines = lines.map(line => {
            const parts = line.split('|');
            if (parts[0] && parts[0].trim().toLowerCase() === cleanEmail) {
              parts[1] = cleanPassword;
              return parts.join('|');
            }
            return line;
          });
          await connection.query('UPDATE orders SET email = ? WHERE id = ?', [updatedLines.join('\n'), ord.id]);
        }
      }
    } catch (ordErr) {
      console.error('[UPDATE_ORDER_PASS_ERR]', ordErr.message);
    }

    return res.json({
      success: true,
      message: 'Đặt lại mật khẩu cho tài khoản Gmail EDU thành công!',
      data: {
        email: cleanEmail,
        password: cleanPassword,
        updated_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[EDU_SET_PASSWORD_ERR]', err);
    return res.status(500).json({ success: false, error: 'Lỗi hệ thống khi đặt lại mật khẩu email EDU' });
  } finally {
    connection.release();
  }
};

app.post('/api/v1/edu/set-password', buyLimiter, authenticateApiKey, requireScope('order_edu'), handleEduSetPassword);
app.post('/api/v1/order-edu/set-password', buyLimiter, authenticateApiKey, requireScope('order_edu'), handleEduSetPassword);

// ============================================================================
// H. CANVA PRO / BRAND AUTOMATION ENDPOINTS
// ============================================================================

// POST /api/canva/session - Lưu / cập nhật session Canva vào CSDL
app.post('/api/canva/session', async (req, res) => {
  try {
    const { cookies, localStorage } = req.body;
    if (!cookies) {
      return res.status(400).json({ success: false, error: 'Thiếu trường cookies.' });
    }

    let parsedCookies = cookies;
    if (typeof cookies === 'string') {
      try {
        parsedCookies = JSON.parse(cookies);
      } catch {
        return res.status(400).json({ success: false, error: 'Định dạng cookies JSON không hợp lệ.' });
      }
    }

    if (!Array.isArray(parsedCookies) || parsedCookies.length === 0) {
      return res.status(400).json({ success: false, error: 'Cookies phải là một mảng và không được để trống.' });
    }

    let parsedStorage = localStorage;
    if (typeof localStorage === 'string') {
      try {
        parsedStorage = JSON.parse(localStorage);
      } catch {
        parsedStorage = {};
      }
    }

    const result = await saveCanvaSession(parsedCookies, parsedStorage || {});
    return res.json({
      success: true,
      message: 'Đã lưu session Canva vào CSDL thành công.',
      cookieCount: parsedCookies.length,
      savedAt: result.savedAt
    });
  } catch (err) {
    console.error('[CANVA_SAVE_SESSION_ERR]', err);
    res.status(500).json({ success: false, error: err.message || 'Lỗi khi lưu session Canva.' });
  }
});

// GET /api/canva/session - Lấy session và cookies Canva từ CSDL
app.get('/api/canva/session', async (req, res) => {
  try {
    const session = await getCanvaSession();
    if (!session) {
      return res.json({
        success: true,
        hasSession: false,
        message: 'Chưa có session Canva nào được lưu trong CSDL.',
        cookies: []
      });
    }

    return res.json({
      success: true,
      hasSession: true,
      savedAt: session.savedAt,
      cookieCount: Array.isArray(session.cookies) ? session.cookies.length : 0,
      hasLocalStorage: !!session.localStorage,
      cookies: session.cookies || [],
      localStorage: session.localStorage || {}
    });
  } catch (err) {
    console.error('[CANVA_GET_SESSION_API_ERR]', err);
    res.status(500).json({ success: false, error: err.message || 'Lỗi khi kiểm tra session Canva.' });
  }
});

// GET /api/canva/cookies - Lấy trực tiếp mảng JSON Cookies từ CSDL
app.get('/api/canva/cookies', async (req, res) => {
  try {
    const session = await getCanvaSession();
    if (!session || !session.cookies) {
      return res.status(404).json({ success: false, error: 'Chưa có cookie Canva trong CSDL' });
    }
    return res.json(session.cookies);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/canva/team-info - Kiểm tra trạng thái & lấy số lượng thành viên team Canva
app.get('/api/canva/team-info', async (req, res) => {
  try {
    const info = await getTeamInfo();
    return res.json({
      success: info.valid,
      ...info
    });
  } catch (err) {
    console.error('[CANVA_TEAM_INFO_ERR]', err);
    res.status(500).json({ success: false, error: err.message || 'Lỗi kiểm tra team Canva.' });
  }
});

// POST /api/canva/invite - Gửi lời mời Canva Pro / Brand qua Playwright
app.post('/api/canva/invite', async (req, res) => {
  const { email, role = 'designer', headless = true, team_id, teamId } = req.body;
  if (!email || !String(email).trim()) {
    return res.status(400).json({ success: false, error: 'Thiếu trường email.' });
  }

  console.log(`[CANVA] Đang gửi lời mời API tới: ${email} (Vai trò: ${role}, Headless: ${headless}, TeamID: ${team_id || teamId || 'Default'})`);
  try {
    const result = await sendCanvaInviteApi({
      email,
      role,
      headless,
      teamId: team_id || teamId || null
    });
    if (result.success) {
      console.log(`[CANVA] Mời thành công: ${email} | Link: ${result.inviteLink || 'N/A'}`);
      res.json(result);
    } else {
      console.error(`[CANVA] Mời thất bại: ${result.error}`);
      res.status(400).json(result);
    }
  } catch (err) {
    console.error(`[CANVA LỖI]:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/canva/batch-invite - Mời hàng loạt email Canva
app.post('/api/canva/batch-invite', async (req, res) => {
  const { emails, role = 'designer', delayMs = 1000 } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ success: false, error: 'Thiếu danh sách emails (mảng email).' });
  }

  try {
    const result = await batchInvite(emails, role, delayMs);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[CANVA_BATCH_INVITE_ERR]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/canva/history - Lấy lịch sử các lời mời đã gửi từ Database
app.get('/api/canva/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const history = await getInviteHistory(limit);
    res.json({ success: true, total: history.length, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Aliases for Direct Canva API compatibility
app.post('/api/invite', (req, res) => app._router.handle({ ...req, url: '/api/canva/invite' }, res));
app.post('/api/invite-batch', (req, res) => app._router.handle({ ...req, url: '/api/canva/batch-invite' }, res));
app.get('/api/team-info', (req, res) => app._router.handle({ ...req, url: '/api/canva/team-info' }, res));
app.get('/api/invites', (req, res) => app._router.handle({ ...req, url: '/api/canva/history' }, res));
app.post('/api/cookies', async (req, res) => {
  const { cookieString, cookies } = req.body;
  const input = cookies || cookieString;
  if (!input) return res.status(400).json({ success: false, error: 'Thiếu cookieString hoặc cookies.' });
  try {
    const result = await saveCanvaSession(input, {});
    return res.json({ success: true, message: 'Đã cập nhật Cookie thành công!', ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// I. SWAGGER UI & OPENAPI 3.0 TEST API ENDPOINTS
// ============================================================================
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'BotTele & Store Standalone API Server',
    version: '1.0.0',
    description: 'Trang chạy thử và tài liệu API trực quan (Swagger UI Interactive Tester). Hỗ trợ test trực tiếp tất cả API qua User API Key.'
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: 'Local Standalone API Server'
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Nhập User API Key của bạn (Ví dụ: sk_edu_YOUR_KEY)'
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Nhập API Key dưới dạng Bearer Token'
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Kiểm tra trạng thái máy chủ API (Health Check)',
        tags: ['System'],
        responses: {
          200: { description: 'Máy chủ hoạt động bình thường' }
        }
      }
    },
    '/api/v1/user': {
      get: {
        summary: 'Lấy thông tin tài khoản, số dư, API Key & lịch sử mua hàng',
        tags: ['User'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          {
            name: 'history_limit',
            in: 'query',
            schema: { type: 'integer', default: 10 },
            description: 'Số lượng đơn hàng API mua gần nhất trả về (mặc định 10, tối đa 100)'
          }
        ],
        responses: {
          200: { description: 'Trả về thông tin tài khoản, số dư, thống kê mua hàng và danh sách purchase_history thành công' },
          401: { description: 'API Key không hợp lệ hoặc thiếu' }
        }
      }
    },
    '/api/v1/user/purchase-history': {
      get: {
        summary: 'Truy vấn chi tiết lịch sử mua hàng qua API Key (Phân trang)',
        tags: ['User'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
            description: 'Số trang (bắt đầu từ 1)'
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
            description: 'Số lượng đơn hàng mỗi trang (tối đa 100)'
          }
        ],
        responses: {
          200: { description: 'Danh sách lịch sử mua hàng qua API Key kèm phân trang' }
        }
      }
    },
    '/api/v1/user/edu-price': {
      get: {
        summary: 'Xem giá Email EDU áp dụng cho tài khoản (giá gốc & giá riêng nếu có)',
        tags: ['User', 'Gmail EDU'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          {
            name: 'user_id',
            in: 'query',
            schema: { type: 'integer' },
            description: 'ID người dùng cần tra cứu (mặc định lấy theo API Key)'
          }
        ],
        responses: {
          200: { description: 'Trả về thông tin chi tiết giá Email EDU' }
        }
      },
      post: {
        summary: 'Cài đặt / Thay đổi hoặc Xóa giá riêng Email EDU cho người dùng',
        tags: ['User', 'Gmail EDU'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['price'],
                properties: {
                  user_id: { type: 'integer', example: 1, description: 'ID người dùng hệ thống' },
                  price: { type: 'number', example: 8000, description: 'Đơn giá tùy chỉnh cho Email EDU (VNĐ)' },
                  scope: { type: 'string', enum: ['ALL_ORDERS', 'CLIENT_API'], example: 'ALL_ORDERS', description: 'Phạm vi áp dụng giá' },
                  is_active: { type: 'boolean', example: true, description: 'Kích hoạt giá riêng' },
                  action: { type: 'string', enum: ['set', 'delete'], example: 'set', description: 'set để lưu giá, delete để xóa về giá gốc' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Thiết lập giá Email EDU thành công' },
          400: { description: 'Thông tin giá không hợp lệ' },
          403: { description: 'Không có quyền thực hiện thao tác' }
        }
      }
    },
    '/api/v1/user/api-key': {
      post: {
        summary: 'Tạo mới hoặc thay đổi API Key người dùng',
        tags: ['User'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  user_id: { type: 'integer', example: 1, description: 'ID người dùng hệ thống' },
                  action: { type: 'string', example: 'generate', description: 'generate hoặc revoke' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Tạo / Đổi API Key thành công' }
        }
      }
    },
    '/api/v1/products': {
      get: {
        summary: 'Lấy danh sách sản phẩm & số lượng tồn kho',
        tags: ['Products'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Lọc theo ID danh mục sản phẩm (tùy chọn)'
          }
        ],
        responses: {
          200: { description: 'Danh sách sản phẩm thành công' }
        }
      }
    },
    '/api/v1/buy': {
      post: {
        summary: 'Mua hàng / Đặt dịch vụ tự động (ACID Row-Locking Security)',
        tags: ['Purchase'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'quantity'],
                properties: {
                  productId: { type: 'integer', example: 1, description: 'ID sản phẩm cần mua' },
                  quantity: { type: 'integer', example: 1, description: 'Số lượng mua (1 đến 50)' },
                  custom_email: { type: 'string', example: 'customer@gmail.com', description: 'Email nhận thông tin (tùy chọn)' },
                  note: { type: 'string', example: 'Đơn hàng qua API', description: 'Ghi chú cho đơn hàng' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Giao dịch mua hàng thành công' },
          400: { description: 'Số dư không đủ hoặc tham số sai' }
        }
      }
    },
    '/api/v1/order-edu': {
      post: {
        summary: 'Đặt & Tạo tài khoản Gmail EDU tự động qua API Key (Hỗ trợ set pass)',
        tags: ['Gmail EDU'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  quantity: { type: 'integer', example: 1, description: 'Số lượng tài khoản (tối đa 50)' },
                  domain: { type: 'string', example: 'suafpoly.app', description: 'Tên miền EDU (tùy chọn)' },
                  prefix: { type: 'string', example: 'student', description: 'Tiền tố username (tùy chọn)' },
                  password: { type: 'string', example: 'Student@2026Secure', description: 'Mật khẩu tùy chỉnh (tối thiểu 8 ký tự, nếu để trống hệ thống sẽ tự sinh ngẫu nhiên an toàn)' },
                  passwords: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['Pass1@2026', 'Pass2@2026'],
                    description: 'Mảng mật khẩu riêng cho từng tài khoản khi mua số lượng nhiều'
                  },
                  type: { type: 'string', example: 'edu', description: 'Loại edu hoặc non' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Đặt Gmail EDU thành công kèm thông tin tài khoản & mật khẩu' },
          400: { description: 'Số dư không đủ, mật khẩu < 8 ký tự hoặc tính năng bị tạm khóa' }
        }
      }
    },
    '/api/v1/edu/set-password': {
      post: {
        summary: 'Đổi / Set mật khẩu mới cho tài khoản Gmail EDU đã mua',
        tags: ['Gmail EDU'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'student123@domain.edu.pl', description: 'Địa chỉ email Gmail EDU cần đổi mật khẩu' },
                  password: { type: 'string', example: 'NewPass@2026Safe', description: 'Mật khẩu mới (tối thiểu 8 ký tự)' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Cập nhật mật khẩu Google Workspace thành công' },
          400: { description: 'Thiếu email hoặc mật khẩu < 8 ký tự' },
          403: { description: 'Không có quyền quản lý tài khoản email này' },
          500: { description: 'Lỗi Google Admin API' }
        }
      }
    },
    '/api/v1/orders': {
      get: {
        summary: 'Truy vấn lịch sử các đơn hàng đã mua',
        tags: ['Orders'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
            description: 'Số lượng đơn hàng tối đa trả về'
          },
          {
            name: 'api_only',
            in: 'query',
            schema: { type: 'boolean', default: false },
            description: 'Chỉ lấy các đơn hàng đặt qua API Key'
          }
        ],
        responses: {
          200: { description: 'Danh sách lịch sử đơn hàng' }
        }
      }
    },
    '/api/canva/session': {
      get: {
        summary: 'Kiểm tra trạng thái Canva session trong CSDL',
        tags: ['Canva Automation'],
        responses: {
          200: { description: 'Trạng thái session hiện tại' }
        }
      },
      post: {
        summary: 'Lưu / Cập nhật Canva session (cookies & localStorage) vào CSDL',
        tags: ['Canva Automation'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cookies'],
                properties: {
                  cookies: { type: 'array', items: { type: 'object' }, description: 'Mảng cookies Canva' },
                  localStorage: { type: 'object', description: 'Dữ liệu localStorage (tùy chọn)' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Lưu session thành công' },
          400: { description: 'Dữ liệu session không hợp lệ' }
        }
      }
    },
    '/api/canva/invite': {
      post: {
        summary: 'Gửi lời mời Canva Pro / Brand đội tự động',
        tags: ['Canva Automation'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'member@gmail.com', description: 'Email cần mời vào đội' },
                  role: { type: 'string', enum: ['designer', 'member', 'admin'], default: 'designer', description: 'Vai trò thành viên' },
                  headless: { type: 'boolean', default: true, description: 'Chạy ngầm browser hay hiện UI' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Mời thành công và trả về Invite Link' },
          400: { description: 'Mời thất bại hoặc thiếu email' }
        }
      }
    },
    '/api/canva/team-info': {
      get: {
        summary: 'Kiểm tra trạng thái kết nối & số lượng thành viên Canva Team',
        tags: ['Canva Automation'],
        responses: {
          200: { description: 'Thông tin Canva Team' }
        }
      }
    },
    '/api/canva/batch-invite': {
      post: {
        summary: 'Mời hàng loạt email vào Canva Team',
        tags: ['Canva Automation'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['emails'],
                properties: {
                  emails: { type: 'array', items: { type: 'string' }, description: 'Danh sách email cần mời' },
                  role: { type: 'string', enum: ['designer', 'member', 'admin', 'C', 'B', 'A'], default: 'designer' },
                  delayMs: { type: 'integer', default: 1000, description: 'Độ trễ giữa mỗi lời mời (ms)' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Kết quả mời hàng loạt' }
        }
      }
    },
    '/api/canva/history': {
      get: {
        summary: 'Xem lịch sử các lời mời Canva đã gửi',
        tags: ['Canva Automation'],
        responses: {
          200: { description: 'Danh sách lịch sử lời mời' }
        }
      }
    }
  }
};

// ============================================================================
// J. SWAGGER UI SECURITY & AUTHENTICATION MIDDLEWARE
// ============================================================================
const swaggerAuthMiddleware = (req, res, next) => {
  const isEnabled = process.env.ENABLE_SWAGGER !== 'false' && process.env.SWAGGER_ENABLED !== 'false';
  if (!isEnabled) {
    return res.status(404).json({
      success: false,
      error: 'Tài liệu Swagger API hiện đang bị vô hiệu hóa hoặc ẩn bởi quản trị viên.'
    });
  }

  const authRequired = process.env.SWAGGER_AUTH_REQUIRED === 'true' || !!process.env.SWAGGER_USER || !!process.env.SWAGGER_PASS;
  if (!authRequired) {
    return next();
  }

  const expectedUser = process.env.SWAGGER_USER || 'admin';
  const expectedPass = process.env.SWAGGER_PASS || 'admin123';

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Tester - Enter Admin Credentials"');
    return res.status(401).send('Yêu cầu xác thực tài khoản và mật khẩu để truy cập Swagger API.');
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const separatorIdx = credentials.indexOf(':');
    if (separatorIdx === -1) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Tester - Enter Admin Credentials"');
      return res.status(401).send('Định dạng xác thực Basic Auth không hợp lệ.');
    }

    const user = credentials.substring(0, separatorIdx);
    const pass = credentials.substring(separatorIdx + 1);

    if (user === expectedUser && pass === expectedPass) {
      return next();
    }
  } catch (_) {}

  res.setHeader('WWW-Authenticate', 'Basic realm="Swagger API Tester - Enter Admin Credentials"');
  return res.status(401).send('Tài khoản hoặc mật khẩu Swagger không chính xác.');
};

// Mount Swagger UI Endpoints (Bảo vệ bằng Basic Auth hoặc Ẩn theo cấu hình .env)
app.use('/docs', swaggerAuthMiddleware, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/swagger', swaggerAuthMiddleware, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', swaggerAuthMiddleware, (req, res) => res.json(swaggerSpec));

// 404 Fallback JSON Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint ${req.method} ${req.originalUrl} không tồn tại trên hệ thống API.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED_ERROR]', err);
  res.status(500).json({ success: false, error: 'Lỗi hệ thống không xác định.' });
});

app.listen(PORT, () => {
  const isEnabled = process.env.ENABLE_SWAGGER !== 'false' && process.env.SWAGGER_ENABLED !== 'false';
  const authRequired = process.env.SWAGGER_AUTH_REQUIRED === 'true' || !!process.env.SWAGGER_USER || !!process.env.SWAGGER_PASS;
  const swaggerStatus = !isEnabled ? '🚫 [ẨN / TẮT]' : (authRequired ? '🔒 [Yêu cầu Mật khẩu / Basic Auth]' : '🔓 [Công khai]');

  console.log(`================================================================`);
  console.log(`🛡️  ULTRA-SECURE Standalone API Server running on port ${PORT}`);
  console.log(`🔒 Security Layers: Helmet, Rate-Limit, ACID Transactions (FOR UPDATE)`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`📖 Swagger API Test UI: http://localhost:${PORT}/docs ${swaggerStatus}`);
  console.log(`📖 Swagger Spec JSON:  http://localhost:${PORT}/swagger.json`);
  if (isEnabled && authRequired) {
    console.log(`🔑 Swagger Auth: User: ${process.env.SWAGGER_USER || 'admin'} | Pass: ${process.env.SWAGGER_PASS ? '******' : 'admin123'}`);
  }
  console.log(`================================================================`);

  // Tự động kiểm tra phát hiện đăng nhập Google Workspace & xóa email EDU khi hết hạn live
  try {
    setExpirationDbQuery(query);
    startEduAccountExpirationService(60000);
  } catch (expErr) {
    console.error('[API_SERVER] Không thể khởi động EduExpirationService:', expErr.message);
  }
});
