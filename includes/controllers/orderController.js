import { query, getPool } from '../database/index.js';

export const createOrder = async ({ userId, productId, price, email = null, note = null, status = 'completed' }) => {
  const pool = getPool();
  try {
    // Thử INSERT với đầy đủ các cột mới (email, note, status)
    const [result] = await pool.execute('INSERT INTO orders (user_id, product_id, price, email, note, status) VALUES (?, ?, ?, ?, ?, ?)', [
      userId,
      productId,
      price,
      email,
      note,
      status
    ]);
    return result;
  } catch (error) {
    // Nếu lỗi do thiếu cột, thử INSERT chỉ với các cột cơ bản
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.warn('[ORDER_CONTROLLER] New columns (email, note, status) not found, using basic INSERT');
      const [result] = await pool.execute('INSERT INTO orders (user_id, product_id, price) VALUES (?, ?, ?)', [
        userId,
        productId,
        price
      ]);
      return result;
    } else {
      throw error;
    }
  }
};

export const listOrdersByUser = async (userId, offset, limit) => {
  const rows = await query(
    `SELECT o.*, p.name FROM orders o 
     JOIN products p ON p.id = o.product_id 
     WHERE o.user_id = ? ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  const [{ total }] = await query('SELECT COUNT(*) as total FROM orders WHERE user_id = ?', [userId]);
  return { rows, total };
};

// Lấy danh sách manual orders cần xử lý (status = 'pending')
// Manual orders là những orders có email/note và status = 'pending'
export const listPendingManualOrders = async (offset, limit) => {
  const rows = await query(
    `SELECT o.*, p.name as product_name, u.telegram_id, u.username 
     FROM orders o 
     JOIN products p ON p.id = o.product_id 
     JOIN users u ON u.id = o.user_id
     WHERE o.status = 'pending' AND o.email IS NOT NULL
     ORDER BY o.created_at ASC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [{ total }] = await query(
    `SELECT COUNT(*) as total FROM orders o 
     WHERE o.status = 'pending' AND o.email IS NOT NULL`
  );
  return { rows, total };
};

// Lấy order theo ID
export const getOrderById = async (orderId) => {
  const rows = await query(
    `SELECT o.*, p.name as product_name, u.telegram_id, u.username 
     FROM orders o 
     JOIN products p ON p.id = o.product_id 
     JOIN users u ON u.id = o.user_id
     WHERE o.id = ?`,
    [orderId]
  );
  return rows[0];
};

// Cập nhật order status thành completed
export const completeOrder = async (orderId) => {
  await query(
    'UPDATE orders SET status = ?, completed_at = NOW() WHERE id = ?',
    ['completed', orderId]
  );
};

