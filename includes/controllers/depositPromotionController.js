import { query, getPool } from '../database/index.js';

// Tạo khuyến mại nạp tiền mới
export const createDepositPromotion = async (startTime, endTime, bonusPercentage, minAmount) => {
  const [result] = await getPool().execute(
    'INSERT INTO deposit_promotions (start_time, end_time, bonus_percentage, min_amount, status) VALUES (?, ?, ?, ?, "active")',
    [startTime, endTime, bonusPercentage, minAmount]
  );
  return result.insertId;
};

// Lấy khuyến mại đang active tại thời điểm hiện tại (theo timezone MySQL server)
export const getActivePromotion = async () => {
  // Sử dụng NOW() của MySQL để đảm bảo khớp timezone với dữ liệu lưu trong DB
  const rows = await query(
    `SELECT * FROM deposit_promotions 
     WHERE status = 'active' 
     AND start_time <= NOW() 
     AND end_time >= NOW() 
     ORDER BY created_at DESC 
     LIMIT 1`
  );

  if (rows[0]) {
    console.log('[PROMOTION] Active promotion found:', rows[0].id, 'Bonus:', rows[0].bonus_percentage + '%');
  }

  return rows[0] || null;
};

// Lấy tất cả khuyến mại (cho admin)
export const getAllPromotions = async () => {
  const rows = await query(
    'SELECT * FROM deposit_promotions ORDER BY created_at DESC'
  );
  return rows;
};

// Tính toán số tiền sau khuyến mại
export const calculatePromotedAmount = (originalAmount, promotion) => {
  if (!promotion) {
    return { originalAmount: Number(originalAmount), bonusAmount: 0, finalAmount: Number(originalAmount) };
  }

  const amount = Number(originalAmount);
  const minAmount = Number(promotion.min_amount);

  // Kiểm tra số tiền có đủ tối thiểu không
  if (amount < minAmount) {
    return { originalAmount: amount, bonusAmount: 0, finalAmount: amount };
  }

  // Tính khuyến mại
  const bonusPercentage = Number(promotion.bonus_percentage);
  const bonusAmount = Math.floor((amount * bonusPercentage) / 100);
  const finalAmount = amount + bonusAmount;

  return {
    originalAmount: amount,
    bonusAmount,
    finalAmount,
    promotion
  };
};

// Cập nhật trạng thái khuyến mại
export const updatePromotionStatus = async (id, status) => {
  await query('UPDATE deposit_promotions SET status = ? WHERE id = ?', [status, id]);
};

// Xóa khuyến mại
export const deletePromotion = async (id) => {
  await query('DELETE FROM deposit_promotions WHERE id = ?', [id]);
};

