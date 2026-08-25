import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import pool, { query, execute } from './db.js';

const app = express();
const PORT = process.env.PORT || 1568;

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

    // 3. Bổ sung các cột cho bảng products
    await safeAddColumn('products', 'priority', 'INT DEFAULT 0');
    await safeAddColumn('products', 'type', "VARCHAR(50) DEFAULT 'stock'");
    await safeAddColumn('products', 'prompt_message', 'TEXT NULL');
    await safeAddColumn('products', 'category_id', 'INT NULL');
    await safeAddColumn('products', 'is_active', 'TINYINT(1) DEFAULT 1');

    // 4. Bổ sung các cột cho bảng orders
    await safeAddColumn('orders', 'invoice_code', 'VARCHAR(100) NULL');
    await safeAddColumn('orders', 'product_id', 'INT NULL');

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
// Global API Rate Limit: Max 100 requests / 15 phút / IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Quá nhiều yêu cầu từ IP của bạn. Vui lòng thử lại sau 15 phút.' }
});
app.use('/api/', globalLimiter);

// Purchase Rate Limit: Max 20 đơn / phút / IP
const buyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
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

// B. User Profile Info
app.get('/api/v1/user', authenticateApiKey, (req, res) => {
  res.json({
    success: true,
    data: {
      user_id: req.user.user_id,
      telegram_id: req.user.telegram_id,
      username: req.user.username,
      name: req.user.name,
      balance: Number(req.user.balance) || 0,
      key_name: req.user.key_name
    }
  });
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
    let whereClause = 'WHERE (p.is_active IS NULL OR p.is_active = 1)';
    const params = [];

    if (categoryId && !isNaN(categoryId)) {
      whereClause += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    const products = await query(`
      SELECT p.id, p.name, p.price, p.description, p.type, p.prompt_message, p.category_id, p.image_url,
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

    // B. Lock Product Row
    const [prodRows] = await connection.query(
      'SELECT id, name, price, type, is_active FROM products WHERE id = ? FOR UPDATE',
      [productId]
    );

    if (!prodRows || prodRows.length === 0 || !prodRows[0].is_active) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Sản phẩm không tồn tại hoặc đã ngưng kinh doanh.' });
    }

    const product = prodRows[0];

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
      'INSERT INTO orders (user_id, product_id, price, email, note, status) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, product.id, totalPrice, accountsDataFormatted, 'API Instant Delivery', 'completed']
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
    const orders = await query(`
      SELECT o.id, o.invoice_code, o.price, o.status, o.email as accounts_data, o.note, o.created_at,
             COALESCE(p.name, 'Sản phẩm') as product_name
      FROM orders o
      LEFT JOIN products p ON p.id = o.product_id
      WHERE o.user_id = ?
      ORDER BY o.id DESC LIMIT ?
    `, [req.user.user_id, limit]);

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

// Helper functions for Gmail EDU ordering
function generatePassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%&*';
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  const all = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 8; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function generateUsername(prefix) {
  if (prefix && String(prefix).trim()) {
    const cleanPrefix = String(prefix).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanPrefix) return `${cleanPrefix}${Math.floor(Math.random() * 899 + 100)}`;
  }
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let str = '';
  for (let i = 0; i < 7; i++) str += chars[Math.floor(Math.random() * chars.length)];
  return `${str}${Math.floor(Math.random() * 89 + 10)}`;
}

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
      "SELECT `key`, `value` FROM settings WHERE `key` IN ('gmail_edu_price', 'gmail_edu_domain', 'gmail_edu_enabled')"
    );

    const settingsMap = {};
    settingsRows.forEach(r => { settingsMap[r.key] = r.value; });

    const isEnabled = settingsMap.gmail_edu_enabled !== 'false';
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
      : (settingsMap.gmail_edu_domain || 'nttp.edu.pl');

    const rawQuantity = req.body.quantity;
    const quantity = Math.min(Math.max(1, parseInt(rawQuantity, 10) || 1), 50);
    const domain = defaultDomain;
    const type = req.body.type === 'non' ? 'non' : 'edu';
    const customPassword = req.body.password ? String(req.body.password).trim() : null;

    const totalCost = pricePerUnit * quantity;
    const currentBalance = Number(user.balance) || 0;

    if (currentBalance < totalCost) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: `Số dư không đủ. Cần: ${totalCost.toLocaleString('vi-VN')} VNĐ, Số dư hiện có: ${currentBalance.toLocaleString('vi-VN')} VNĐ.`
      });
    }

    // 3. Create Accounts (Default: Auto delete 1h after creation)
    const createdAccounts = [];
    for (let i = 0; i < quantity; i++) {
      const username = generateUsername(req.body.prefix || req.body.username);
      const email = `${username}@${domain}`;
      const password = customPassword || generatePassword();

      await connection.query(`
        INSERT INTO gmail_accounts (email, password, type, domain, status, delete_at, created_at)
        VALUES (?, ?, ?, ?, 'available', DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())
      `, [email, password, type, domain]);

      createdAccounts.push({ email, password, type, domain, auto_delete: '1h_after_login' });
    }

    // 4. Deduct User Balance
    await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [totalCost, user.id]);
    await connection.query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)', [
      user.id, -totalCost, `buy_gmail_edu_api_${quantity}_items`
    ]);

    // 5. Create Order Record
    const accountsFormatted = createdAccounts.map(a => `${a.email}|${a.password}`).join('\n');
    const [orderRes] = await connection.query(
      "INSERT INTO orders (user_id, price, email, note, status) VALUES (?, ?, ?, ?, 'completed')",
      [user.id, totalCost, accountsFormatted, `API Order Gmail EDU (${quantity} tài khoản)`]
    );

    const invoiceCode = `HD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(orderRes.insertId).padStart(4, '0')}`;
    await connection.query('UPDATE orders SET invoice_code = ? WHERE id = ?', [invoiceCode, orderRes.insertId]);

    await connection.commit();

    return res.json({
      success: true,
      message: 'Đặt Gmail EDU qua API thành công!',
      invoice_code: invoiceCode,
      quantity,
      total_cost: totalCost,
      price_per_unit: pricePerUnit,
      remaining_balance: currentBalance - totalCost,
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

// ============================================================================
// H. SWAGGER UI & OPENAPI 3.0 TEST API ENDPOINTS
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
        summary: 'Lấy thông tin tài khoản, số dư & trạng thái khóa',
        tags: ['User'],
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        responses: {
          200: { description: 'Trả về thông tin tài khoản thành công' },
          401: { description: 'API Key không hợp lệ hoặc thiếu' }
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
        summary: 'Đặt & Tạo tài khoản Gmail EDU tự động qua API Key',
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
                  domain: { type: 'string', example: 'suafpoly.app', description: 'Tên miền EDU' },
                  prefix: { type: 'string', example: 'student', description: 'Tiền tố username' },
                  type: { type: 'string', example: 'edu', description: 'Loại edu hoặc non' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Đặt Gmail EDU thành công' },
          400: { description: 'Số dư không đủ hoặc tính năng bị tạm khóa' }
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
          }
        ],
        responses: {
          200: { description: 'Danh sách lịch sử đơn hàng' }
        }
      }
    }
  }
};

// Mount Swagger UI Endpoints
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/swagger.json', (req, res) => res.json(swaggerSpec));

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
  console.log(`================================================================`);
  console.log(`🛡️  ULTRA-SECURE Standalone API Server running on port ${PORT}`);
  console.log(`🔒 Security Layers: Helmet, Rate-Limit, ACID Transactions (FOR UPDATE)`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`📖 Swagger API Test UI: http://localhost:${PORT}/docs`);
  console.log(`📖 Swagger Spec JSON:  http://localhost:${PORT}/swagger.json`);
  console.log(`================================================================`);
});
