import { query } from '../database/index.js';

// Lấy giá Gmail theo type, duration, quantity
export const getGmailPrice = async (type, duration, quantity) => {
  // Nếu mua >= 10, tính giá theo từng nhóm 10
  if (quantity >= 10) {
    const rowsForTen = await query(
      'SELECT price FROM gmail_pricing WHERE type = ? AND duration = ? AND quantity = ?',
      [type, duration, 10]
    );
    
    if (rowsForTen && rowsForTen.length > 0) {
      const priceTen = Number(rowsForTen[0].price);
      return priceTen * Math.ceil(quantity / 10);
    }
    
    // Nếu không có giá cho 10, dùng giá mặc định
    const priceTen = getDefaultPrice(type, duration, 10);
    if (priceTen > 0) {
      return priceTen * Math.ceil(quantity / 10);
    }
    
    // Nếu vẫn không có giá cho 10, dùng giá cho 1 và nhân
    const pricePerOne = getDefaultPrice(type, duration, 1);
    if (pricePerOne > 0) {
      return pricePerOne * quantity;
    }
    
    return 0;
  }
  
  // Query với quantity thực tế (nếu < 10)
  if (quantity < 10) {
    const rows = await query(
      'SELECT price FROM gmail_pricing WHERE type = ? AND duration = ? AND quantity = ?',
      [type, duration, quantity]
    );
    
    if (rows && rows.length > 0) {
      const price = Number(rows[0].price);
      return price * quantity;
    }
  }
  
  // Nếu không tìm thấy, thử query với quantity = 1
  const rowsForOne = await query(
    'SELECT price FROM gmail_pricing WHERE type = ? AND duration = ? AND quantity = ?',
    [type, duration, 1]
  );
  
  if (rowsForOne && rowsForOne.length > 0) {
    const pricePerOne = Number(rowsForOne[0].price);
    return pricePerOne * quantity;
  }
  
  // Nếu vẫn không tìm thấy, dùng giá mặc định
  const pricePerOne = getDefaultPrice(type, duration, 1);
  if (pricePerOne > 0) {
    return pricePerOne * quantity;
  }
  
  return 0;
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
  
  // Nếu có giá cụ thể cho quantity này, trả về
  const specificPrice = defaultPricing[type]?.[duration]?.[quantity];
  if (specificPrice) {
    return specificPrice;
  }
  
  // Nếu không có giá cụ thể, tính dựa trên giá 1 account
  const pricePerOne = defaultPricing[type]?.[duration]?.[1];
  if (pricePerOne) {
    return pricePerOne * quantity;
  }
  
  // Nếu vẫn không có, trả về 0
  return 0;
};

