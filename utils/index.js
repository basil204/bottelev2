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
    // Check key format (single part or explicitly key)
    if (!line.includes('|')) {
      // Treat as key: username=key, password=key
      return { username: line, password: line, twofa: null, extra_data: null };
    }

    const parts = line.split('|').map((x) => x.trim());

    // Format: username|password (2 parts)
    if (parts.length === 2) {
      return { username: parts[0], password: parts[1], twofa: null, extra_data: null };
    }

    // Format: username|password|twofa OR username|password|extra_data (3 parts)
    if (parts.length === 3) {
      // Logic heurristic: check if part 3 looks like 2FA (alphanumeric, no spaces usually, length often 16 or 32)
      // OR check if it looks like email/text (extra_data).
      // User requirement: TK|MK|2fa. 
      // Assume 3rd part is 2FA if it matches typical 2FA pattern or if we default to 2FA as before.
      // However, user said "TK|MK|MAIL KP|2FA" for 4 parts. 
      // If 3 parts, let's assume it's 2FA unless it clearly looks like an email.
      const part3 = parts[2];
      const isEmail = part3.includes('@');
      if (isEmail) {
        return { username: parts[0], password: parts[1], twofa: null, extra_data: part3 };
      } else {
        return { username: parts[0], password: parts[1], twofa: part3, extra_data: null };
      }
    }

    // Format: username|password|mail kp|2fa (4 parts)
    if (parts.length >= 4) {
      const [username, password, extra_data, twofa] = parts;
      return { username, password, extra_data: extra_data || null, twofa: twofa || null };
    }

    return null;
  }).filter((x) => x && x.username && x.password);
};

