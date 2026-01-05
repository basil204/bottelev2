import { query } from '../database/index.js';

// Tạo gói VIP mới
export const createVipPackage = async ({ userId, totalGmail = 400, expiresInDays = 30 }) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  
  await query(
    'INSERT INTO vip_packages (user_id, package_type, total_gmail, used_gmail, expires_at, status) VALUES (?, ?, ?, 0, ?, "active")',
    [userId, 'vip', totalGmail, expiresAt]
  );
  
  // Lấy package vừa tạo
  const rows = await query(
    'SELECT * FROM vip_packages WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [userId]
  );
  return rows[0];
};

// Lấy gói VIP đang active của user
export const getActiveVipPackage = async (userId) => {
  const rows = await query(
    `SELECT * FROM vip_packages 
     WHERE user_id = ? 
     AND status = 'active' 
     AND expires_at > NOW() 
     AND used_gmail < total_gmail 
     ORDER BY id DESC 
     LIMIT 1`,
    [userId]
  );
  return rows[0];
};

// Tăng số Gmail đã sử dụng trong gói VIP
export const incrementVipUsage = async (vipPackageId, email) => {
  const { getPool } = await import('../database/index.js');
  const pool = getPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Thêm vào bảng usage
    await connection.execute(
      'INSERT INTO vip_gmail_usage (vip_package_id, email) VALUES (?, ?)',
      [vipPackageId, email]
    );
    
    // Tăng used_gmail
    await connection.execute(
      'UPDATE vip_packages SET used_gmail = used_gmail + 1 WHERE id = ?',
      [vipPackageId]
    );
    
    // Kiểm tra nếu đã dùng hết hoặc hết hạn thì update status
    const [pkg] = await connection.execute(
      'SELECT * FROM vip_packages WHERE id = ?',
      [vipPackageId]
    );
    
    if (pkg[0].used_gmail >= pkg[0].total_gmail) {
      await connection.execute(
        'UPDATE vip_packages SET status = "used_up" WHERE id = ?',
        [vipPackageId]
      );
    } else if (new Date(pkg[0].expires_at) < new Date()) {
      await connection.execute(
        'UPDATE vip_packages SET status = "expired" WHERE id = ?',
        [vipPackageId]
      );
    }
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Cập nhật status các gói VIP đã hết hạn
export const updateExpiredVipPackages = async () => {
  await query(
    `UPDATE vip_packages 
     SET status = 'expired' 
     WHERE status = 'active' 
     AND expires_at <= NOW()`
  );
};

// Lấy thông tin gói VIP của user
export const getUserVipPackages = async (userId, offset = 0, limit = 10) => {
  const rows = await query(
    'SELECT * FROM vip_packages WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );
  const [{ total }] = await query('SELECT COUNT(*) as total FROM vip_packages WHERE user_id = ?', [userId]);
  return { rows, total };
};

