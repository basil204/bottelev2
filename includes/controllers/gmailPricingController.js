import { query } from '../database/index.js';

// Lấy giá Gmail theo type, duration, quantity
export const getGmailPrice = async (type, duration, quantity) => {
  // Nếu mua >= 10, tính giá theo từng nhóm 10
  const actualQuantity = quantity >= 10 ? 10 : quantity;
  
  const rows = await query(
    'SELECT price FROM gmail_pricing WHERE type = ? AND duration = ? AND quantity = ?',
    [type, duration, actualQuantity]
  );
  
  if (!rows || rows.length === 0) {
    // Nếu không tìm thấy trong DB, trả về giá mặc định
    return getDefaultPrice(type, duration, actualQuantity);
  }
  
  const price = Number(rows[0].price);
  
  // Nếu mua >= 10, nhân với số nhóm
  if (quantity >= 10) {
    return price * Math.ceil(quantity / 10);
  }
  
  return price * quantity;
};

// Lấy tất cả giá Gmail
export const getAllGmailPricing = async () => {
  const rows = await query(
    'SELECT * FROM gmail_pricing ORDER BY type, duration, quantity'
  );
  return rows;
};

// Cập nhật giá Gmail
export const updateGmailPrice = async (type, duration, quantity, price) => {
  await query(
    `INSERT INTO gmail_pricing (type, duration, quantity, price) 
     VALUES (?, ?, ?, ?) 
     ON DUPLICATE KEY UPDATE price = ?, updated_at = NOW()`,
    [type, duration, quantity, price, price]
  );
};

// Lấy giá mặc định (fallback nếu chưa có trong DB)
const getDefaultPrice = (type, duration, quantity) => {
  const defaultPricing = {
    edu: {
      single: {
        1: 700,
        10: 6500
      },
      daily: {
        1: 4000,
        10: 35000
      }
    },
    non: {
      single: {
        1: 4000,
        10: 35000
      },
      daily: {
        1: 4000,
        10: 35000
      }
    }
  };
  
  return defaultPricing[type]?.[duration]?.[quantity] || 0;
};

