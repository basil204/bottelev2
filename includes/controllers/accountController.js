import { query } from '../database/index.js';

export const addAccounts = async (productId, accounts = []) => {
  if (!accounts.length) return;
  // Kiểm tra xem có cột twofa, extra_data không
  const [columns] = await query("SHOW COLUMNS FROM accounts");
  const hasTwofa = columns.some(c => c.Field === 'twofa');
  const hasExtraData = columns.some(c => c.Field === 'extra_data');

  const values = [];
  const params = [];

  let sql = 'INSERT INTO accounts (product_id, username, password';
  if (hasTwofa) sql += ', twofa';
  if (hasExtraData) sql += ', extra_data';
  sql += ', status) VALUES ';

  accounts.forEach(({ username, password, twofa, extra_data }) => {
    let placeholder = '(?, ?, ?';
    params.push(productId, username, password);

    if (hasTwofa) {
      placeholder += ', ?';
      params.push(twofa || null);
    }

    if (hasExtraData) {
      placeholder += ', ?';
      params.push(extra_data || null);
    }

    placeholder += ', "available")';
    values.push(placeholder);
  });

  sql += values.join(',');

  await query(sql, params);
  await syncStock(productId);
};

export const takeOneAvailable = async (productId) => {
  const connRows = await query(
    'SELECT * FROM accounts WHERE product_id = ? AND status = "available" LIMIT 1',
    [productId]
  );
  return connRows[0];
};

// Lấy và đánh dấu account ngay lập tức để tránh lấy trùng
export const takeAndMarkSoldOneAvailable = async (productId) => {
  // Lấy account và đánh dấu "sold" ngay trong một query để tránh race condition
  const account = await takeOneAvailable(productId);
  if (account) {
    // Đánh dấu ngay để không bị lấy lại trong lần tiếp theo
    await query('UPDATE accounts SET status = "sold" WHERE id = ?', [account.id]);
  }
  return account;
};

export const markSold = async (accountId, deleteAt = null) => {
  if (deleteAt) {
    await query('UPDATE accounts SET status = "sold", delete_at = ? WHERE id = ?', [deleteAt, accountId]);
  } else {
    await query('UPDATE accounts SET status = "sold" WHERE id = ?', [accountId]);
  }
};

// Xóa account sau khi mua (mua đến đâu xóa đến đó)
export const deleteAccountAfterPurchase = async (accountId, productId) => {
  // Xóa account khỏi database
  await query('DELETE FROM accounts WHERE id = ?', [accountId]);
  // Sync stock
  await syncStock(productId);
};

export const listAccounts = async (productId, offset, limit, status = null) => {
  let sql = 'SELECT * FROM accounts WHERE product_id = ?';
  let countSql = 'SELECT COUNT(*) as total FROM accounts WHERE product_id = ?';
  const params = [productId];
  const countParams = [productId];

  if (status) {
    sql += ' AND status = ?';
    countSql += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  // Đảm bảo limit và offset là số nguyên
  params.push(parseInt(limit), parseInt(offset));

  const rows = await query(sql, params);
  const [{ total }] = await query(countSql, countParams);
  return { rows, total };
};

export const listAvailableAccounts = async (productId, offset, limit) => {
  const rows = await query(
    'SELECT * FROM accounts WHERE product_id = ? AND status = "available" ORDER BY id DESC LIMIT ? OFFSET ?',
    [productId, limit, offset]
  );
  const [{ total }] = await query('SELECT COUNT(*) as total FROM accounts WHERE product_id = ? AND status = "available"', [productId]);
  return { rows, total };
};

export const syncStock = async (productId) => {
  await query(
    'UPDATE products SET stock = (SELECT COUNT(*) FROM accounts WHERE product_id = ? AND status="available") WHERE id = ?',
    [productId, productId]
  );
};

export const deleteAccount = async (accountId) => {
  // Lấy thông tin account để sync stock sau khi xóa
  const accountRows = await query('SELECT product_id FROM accounts WHERE id = ?', [accountId]);
  if (accountRows.length === 0) {
    return { success: false, error: 'Account not found' };
  }

  const productId = accountRows[0].product_id;

  // Xóa account
  await query('DELETE FROM accounts WHERE id = ?', [accountId]);

  // Sync stock
  await syncStock(productId);

  return { success: true, productId };
};

// Xóa hàng loạt accounts theo status
export const deleteAccountsByStatus = async (productId, status) => {
  // Đếm số account sẽ bị xóa
  const [{ count }] = await query(
    'SELECT COUNT(*) as count FROM accounts WHERE product_id = ? AND status = ?',
    [productId, status]
  );

  if (count === 0) {
    return { success: false, error: 'Không có tài khoản nào để xóa', deletedCount: 0 };
  }

  // Xóa accounts
  await query('DELETE FROM accounts WHERE product_id = ? AND status = ?', [productId, status]);

  // Sync stock
  await syncStock(productId);

  return { success: true, deletedCount: count, productId };
};

