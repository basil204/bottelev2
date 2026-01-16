export const formatCurrency = (amount) => {
  // Làm tròn về số nguyên để tránh lỗi thập phân
  const num = Math.round(Number(amount || 0));
  return num.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' VNĐ';
};

// Helper function để tạo callback_data không chứa null/undefined và đảm bảo không quá 64 bytes
export const createCallbackData = (data) => {
  // Loại bỏ null và undefined
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== null && value !== undefined)
  );
  const jsonStr = JSON.stringify(cleanData);
  
  // Kiểm tra độ dài (Telegram limit: 64 bytes)
  if (jsonStr.length > 64) {
    console.warn(`[CALLBACK_DATA] Warning: callback_data exceeds 64 bytes (${jsonStr.length} bytes):`, jsonStr);
  }
  
  return jsonStr;
};

export const buildPaginationKeyboard = (baseData, page, hasPrev, hasNext) => {
  // Loại bỏ các field null/undefined trước khi stringify
  const cleanBaseData = Object.fromEntries(
    Object.entries(baseData).filter(([_, value]) => value !== null && value !== undefined)
  );
  const buttons = [];
  if (hasPrev) buttons.push({ text: '◀️ Prev', callback_data: createCallbackData({ ...cleanBaseData, page: page - 1 }) });
  if (hasNext) buttons.push({ text: '▶️ Next', callback_data: createCallbackData({ ...cleanBaseData, page: page + 1 }) });
  return buttons.length ? [buttons] : [];
};

export const isAdmin = (telegramId, adminIds = []) => adminIds.includes(Number(telegramId));

export const parseUploadText = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const parts = line.split('|').map((x) => x.trim());
    const [username, password, twofa] = parts;
    return { username, password, twofa: twofa || null };
  }).filter((x) => x.username && x.password);
};

