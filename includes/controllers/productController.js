import { query } from '../database/index.js';

export const createProduct = async ({ name, price, description }) => {
  await query('INSERT INTO products (name, price, description, stock) VALUES (?, ?, ?, 0)', [name, price, description]);
};

export const updateProduct = async (id, { name, price, description }) => {
  await query('UPDATE products SET name = ?, price = ?, description = ? WHERE id = ?', [name, price, description, id]);
};

export const deleteProduct = async (id) => {
  await query('DELETE FROM products WHERE id = ?', [id]);
};

export const getProduct = async (id) => {
  const rows = await query('SELECT * FROM products WHERE id = ?', [id]);
  return rows[0];
};

export const listProducts = async (offset, limit) => {
  try {
    // Thử query với product_id trước
    const rows = await query(
      `SELECT p.*, 
      (SELECT COUNT(*) FROM accounts a WHERE a.product_id = p.id AND a.status='available') as stock 
      FROM products p ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [{ total }] = await query('SELECT COUNT(*) as total FROM products');
    return { rows, total };
  } catch (error) {
    // Nếu lỗi do không có cột product_id, dùng query đơn giản hơn (không tính stock từ accounts)
    if (error.code === 'ER_BAD_FIELD_ERROR' && error.message && error.message.includes('product_id')) {
      console.warn('[PRODUCT_CONTROLLER] Column product_id not found in accounts table, using product stock field instead');
      const rows = await query(
        `SELECT p.*, p.stock as stock FROM products p ORDER BY id DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const [{ total }] = await query('SELECT COUNT(*) as total FROM products');
      return { rows, total };
    }
    throw error;
  }
};

