import { query } from '../database/index.js';

export const addBalanceLog = async ({ userId, amount, reason, adminId = null }) => {
  await query(
    'INSERT INTO balance_logs (user_id, amount, reason, admin_id) VALUES (?, ?, ?, ?)',
    [userId, amount, reason, adminId]
  );
};

export const listBalanceLogs = async (userId, offset, limit) => {
  const rows = await query(
    'SELECT * FROM balance_logs WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );
  const [{ total }] = await query('SELECT COUNT(*) as total FROM balance_logs WHERE user_id = ?', [userId]);
  return { rows, total };
};

