import { query } from '../database/index.js';

export const findOrCreateUser = async (telegramId, username) => {
  const existing = await query('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
  if (existing.length) return existing[0];
  await query('INSERT INTO users (telegram_id, username, balance, credit, language) VALUES (?, ?, 0, 0, "vi")', [telegramId, username || null]);
  const [user] = await query('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
  return user;
};

export const updateLanguage = async (userId, lang) => {
  await query('UPDATE users SET language = ? WHERE id = ?', [lang, userId]);
};

export const getUserByTelegram = async (telegramId) => {
  const rows = await query('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
  return rows[0];
};

export const getUserById = async (userId) => {
  const rows = await query('SELECT * FROM users WHERE id = ?', [userId]);
  return rows[0];
};

export const updateBalance = async (userId, amount) => {
  await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, userId]);
};

export const setBalance = async (userId, amount) => {
  await query('UPDATE users SET balance = ? WHERE id = ?', [amount, userId]);
};

export const listUsers = async (offset, limit) => {
  const rows = await query('SELECT * FROM users ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
  const [{ total }] = await query('SELECT COUNT(*) as total FROM users');
  return { rows, total };
};

