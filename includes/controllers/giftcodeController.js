import { query } from '../database/index.js';

// Tạo giftcode
export const createGiftcode = async ({ code, amount, maxUses = 1, createdBy, expiresAt = null }) => {
  await query(
    'INSERT INTO giftcodes (code, amount, max_uses, created_by, expires_at) VALUES (?, ?, ?, ?, ?)',
    [code, amount, maxUses, createdBy, expiresAt]
  );
};

// Lấy giftcode theo code
export const getGiftcodeByCode = async (code) => {
  const rows = await query('SELECT * FROM giftcodes WHERE code = ?', [code]);
  return rows[0];
};

// Kiểm tra user đã sử dụng giftcode chưa
export const hasUserRedeemed = async (giftcodeId, userId) => {
  const rows = await query(
    'SELECT * FROM giftcode_redemptions WHERE giftcode_id = ? AND user_id = ?',
    [giftcodeId, userId]
  );
  return rows.length > 0;
};

// Redeem giftcode
export const redeemGiftcode = async (giftcodeId, userId) => {
  const { getPool } = await import('../database/index.js');
  const pool = getPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Kiểm tra lại giftcode còn dùng được không
    const [giftcodeRows] = await connection.execute(
      'SELECT * FROM giftcodes WHERE id = ? FOR UPDATE',
      [giftcodeId]
    );
    
    if (!giftcodeRows || giftcodeRows.length === 0) {
      throw new Error('Giftcode không tồn tại');
    }
    
    const giftcode = giftcodeRows[0];
    
    // Kiểm tra đã dùng hết chưa
    if (giftcode.used_count >= giftcode.max_uses) {
      throw new Error('Giftcode đã được sử dụng hết');
    }
    
    // Kiểm tra hết hạn
    if (giftcode.expires_at && new Date(giftcode.expires_at) < new Date()) {
      throw new Error('Giftcode đã hết hạn');
    }

    // Tạo redemption record
    await connection.execute(
      'INSERT INTO giftcode_redemptions (giftcode_id, user_id) VALUES (?, ?)',
      [giftcodeId, userId]
    );

    // Tăng used_count
    await connection.execute(
      'UPDATE giftcodes SET used_count = used_count + 1 WHERE id = ?',
      [giftcodeId]
    );

    await connection.commit();
    return giftcode;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Lấy giftcode theo id
export const getGiftcodeById = async (id) => {
  const rows = await query('SELECT * FROM giftcodes WHERE id = ?', [id]);
  return rows[0];
};

// List giftcodes (admin)
export const listGiftcodes = async (offset, limit) => {
  const rows = await query(
    'SELECT * FROM giftcodes ORDER BY id DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const [{ total }] = await query('SELECT COUNT(*) as total FROM giftcodes');
  return { rows, total };
};

// Xóa giftcode
export const deleteGiftcode = async (id) => {
  await query('DELETE FROM giftcodes WHERE id = ?', [id]);
};

