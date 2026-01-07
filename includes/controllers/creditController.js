import { query } from '../database/index.js';

// Cập nhật credit của user
export const updateCredit = async (userId, amount) => {
  await query('UPDATE users SET credit = credit + ? WHERE id = ?', [amount, userId]);
};

// Lấy credit của user
export const getUserCredit = async (userId) => {
  const [user] = await query('SELECT credit FROM users WHERE id = ?', [userId]);
  return user ? Number(user.credit || 0) : 0;
};

// Kiểm tra và trừ credit
export const deductCredit = async (userId, amount) => {
  const currentCredit = await getUserCredit(userId);
  
  if (currentCredit < amount) {
    return {
      success: false,
      error: 'Không đủ credit',
      currentCredit
    };
  }

  await updateCredit(userId, -amount);
  return {
    success: true,
    remainingCredit: currentCredit - amount
  };
};

