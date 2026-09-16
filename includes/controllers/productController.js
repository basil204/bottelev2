import { query } from '../database/index.js';

export const createProduct = async ({ name, price, description, type = 'stock', priority = 0, check_live = 0 }) => {
  return await query('INSERT INTO products (name, price, description, stock, type, priority, check_live) VALUES (?, ?, ?, 0, ?, ?, ?)', [name, price, description, type, priority, check_live]);
};

export const updateProduct = async (id, { name, price, description, type, priority, check_live }) => {
  let q = 'UPDATE products SET name = ?, price = ?, description = ?';
  let params = [name, price, description];

  if (type !== undefined) {
    q += ', type = ?';
    params.push(type);
  }
  if (priority !== undefined) {
    q += ', priority = ?';
    params.push(priority);
  }
  if (check_live !== undefined) {
    q += ', check_live = ?';
    params.push(check_live);
  }

  q += ' WHERE id = ?';
  params.push(id);

  await query(q, params);
};

export const deleteProduct = async (id) => {
  await query('DELETE FROM products WHERE id = ?', [id]);
};

export const getProduct = async (id) => {
  const rows = await query(
    `SELECT p.*,
            GREATEST(
              0,
              (SELECT COUNT(*) FROM accounts a WHERE a.product_id = p.id AND a.status = 'sold')
              + COALESCE(p.sold_adjustment, 0)
            ) AS sold_count
     FROM products p
     WHERE p.id = ?`,
    [id]
  );
  return rows[0];
};

export const listProducts = async (offset, limit, categoryId = null, includeInactive = false) => {
  try {
    const conditions = [];
    const params = [];

    if (!includeInactive) {
      conditions.push('(p.is_active IS NULL OR p.is_active = 1)');
    }

    if (categoryId) {
      conditions.push('p.category_id = ?');
      params.push(Number(categoryId));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countParams = [...params];
    params.push(limit, offset);

    // Query sản phẩm kèm tính stock từ accounts
    const rows = await query(
      `SELECT p.*, 
      (SELECT COUNT(*) FROM accounts a WHERE a.product_id = p.id AND a.status='available') as stock 
      FROM products p ${whereClause} ORDER BY priority DESC, id DESC LIMIT ? OFFSET ?`,
      params
    );
    const [{ total }] = await query(`SELECT COUNT(*) as total FROM products p ${whereClause}`, countParams);
    return { rows, total };
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR' && error.message && error.message.includes('product_id')) {
      console.warn('[PRODUCT_CONTROLLER] Column product_id not found in accounts table, using product stock field instead');
      const conditions = [];
      const params = [];

      if (!includeInactive) {
        conditions.push('(p.is_active IS NULL OR p.is_active = 1)');
      }

      if (categoryId) {
        conditions.push('p.category_id = ?');
        params.push(Number(categoryId));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countParams = [...params];
      params.push(limit, offset);

      const rows = await query(
        `SELECT p.*, p.stock as stock FROM products p ${whereClause} ORDER BY priority DESC, id DESC LIMIT ? OFFSET ?`,
        params
      );
      const [{ total }] = await query(`SELECT COUNT(*) as total FROM products p ${whereClause}`, countParams);
      return { rows, total };
    }
    throw error;
  }
};

