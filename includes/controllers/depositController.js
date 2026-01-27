import { query, getPool } from '../database/index.js';

export const createDeposit = async (userId, amount, content = null) => {
  const [result] = await getPool().execute(
    'INSERT INTO deposits (user_id, amount, status, content) VALUES (?, ?, "pending", ?)',
    [userId, amount, content]
  );
  return result.insertId;
};

export const createDepositWithStatus = async (userId, amount, status = 'pending', txRef = null) => {
  const [result] = await getPool().execute(
    'INSERT INTO deposits (user_id, amount, status, tx_ref) VALUES (?, ?, ?, ?)',
    [userId, amount, status, txRef]
  );
  return result.insertId;
};

export const listDeposits = async (status, offset, limit) => {
  const rows = await query(
    'SELECT d.*, u.telegram_id FROM deposits d JOIN users u ON u.id = d.user_id WHERE d.status = ? ORDER BY d.id DESC LIMIT ? OFFSET ?',
    [status, limit, offset]
  );
  const [{ total }] = await query('SELECT COUNT(*) as total FROM deposits WHERE status = ?', [status]);
  return { rows, total };
};

export const updateDepositStatus = async (id, status, txRef = null) => {
  await query('UPDATE deposits SET status = ?, tx_ref = COALESCE(?, tx_ref) WHERE id = ?', [status, txRef, id]);
};

export const getDeposit = async (id) => {
  const rows = await query('SELECT * FROM deposits WHERE id = ?', [id]);
  return rows[0];
};

export const findDepositByRef = async (txRef) => {
  const rows = await query('SELECT * FROM deposits WHERE tx_ref = ?', [txRef]);
  return rows[0];
};

export const findDepositByContent = async (content) => {
  const rows = await query('SELECT * FROM deposits WHERE content = ? AND status = "pending" ORDER BY id DESC LIMIT 1', [content]);
  return rows[0];
};

export const findLatestPendingByUser = async (userId) => {
  const rows = await query(
    'SELECT * FROM deposits WHERE user_id = ? AND status = "pending" ORDER BY id DESC LIMIT 1',
    [userId]
  );
  return rows[0];
};

