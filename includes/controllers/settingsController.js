import { query } from '../database/index.js';

// Lấy setting theo key
export const getSetting = async (key, defaultValue = null) => {
  try {
    const rows = await query('SELECT value FROM settings WHERE `key` = ?', [key]);
    if (rows && rows.length > 0) {
      const value = rows[0].value;
      // Parse JSON nếu có thể
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return defaultValue;
  } catch (error) {
    console.error(`[GET_SETTING] Lỗi khi lấy setting ${key}:`, error);
    return defaultValue;
  }
};

// Lấy setting dạng boolean (mặc định true nếu chưa có)
export const getSettingBoolean = async (key, defaultValue = true) => {
  try {
    const rows = await query('SELECT value FROM settings WHERE `key` = ?', [key]);
    if (rows && rows.length > 0) {
      const value = rows[0].value;
      // Parse boolean
      if (value === 'true' || value === '1' || value === 1 || value === true) {
        return true;
      }
      if (value === 'false' || value === '0' || value === 0 || value === false) {
        return false;
      }
    }
    return defaultValue;
  } catch (error) {
    console.error(`[GET_SETTING_BOOLEAN] Lỗi khi lấy setting ${key}:`, error);
    return defaultValue;
  }
};

// Set setting
export const setSetting = async (key, value) => {
  try {
    // Convert value to string
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    await query(
      'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
      [key, valueStr, valueStr]
    );
    return { success: true };
  } catch (error) {
    console.error(`[SET_SETTING] Lỗi khi lưu setting ${key}:`, error);
    return { success: false, error: error.message };
  }
};

// Toggle setting boolean
export const toggleSetting = async (key, defaultValue = true) => {
  try {
    const currentValue = await getSettingBoolean(key, defaultValue);
    const newValue = !currentValue;
    await setSetting(key, newValue);
    return { success: true, value: newValue, previousValue: currentValue };
  } catch (error) {
    console.error(`[TOGGLE_SETTING] Lỗi khi toggle setting ${key}:`, error);
    return { success: false, error: error.message };
  }
};

// Lấy tất cả settings
export const getAllSettings = async () => {
  try {
    const rows = await query('SELECT `key`, value FROM settings');
    const settings = {};
    rows.forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch (e) {
        settings[row.key] = row.value;
      }
    });
    return settings;
  } catch (error) {
    console.error('[GET_ALL_SETTINGS] Lỗi:', error);
    return {};
  }
};

