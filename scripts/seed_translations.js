/**
 * Script chuyển đổi bộ ngôn ngữ từ file includes/lang/messages.js vào CSDL MySQL (bảng translations)
 */
import { messages } from '../includes/lang/messages.js';
import { query, initDb } from '../includes/database/index.js';
import { config } from '../config.js';

export const seedAllTranslationsToDb = async () => {
  try {
    await initDb(config);
    console.log('[SEED_TRANSLATIONS] Đang chuyển đổi dữ liệu từ includes/lang/messages.js vào CSDL MySQL...');

    let insertedCount = 0;
    let updatedCount = 0;

    for (const [lang, keyValues] of Object.entries(messages)) {
      for (const [msg_key, msg_value] of Object.entries(keyValues)) {
        try {
          const res = await query(
            `INSERT INTO translations (msg_key, lang, msg_value) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE msg_value = VALUES(msg_value)`,
            [msg_key, lang, msg_value]
          );
          if (res.affectedRows === 1) insertedCount++;
          else if (res.affectedRows === 2) updatedCount++;
        } catch (err) {
          console.error(`[SEED_ERR] Key: ${msg_key}, Lang: ${lang}:`, err.message);
        }
      }
    }

    console.log(`[SEED_TRANSLATIONS] ✅ Hoàn tất! Đã thêm mới ${insertedCount} bản dịch và cập nhật ${updatedCount} bản dịch vào CSDL MySQL.`);
    return { success: true, insertedCount, updatedCount };
  } catch (error) {
    console.error('[SEED_TRANSLATIONS_ERR]', error);
    return { success: false, error: error.message };
  }
};

// Nếu chạy trực tiếp script: node scripts/seed_translations.js
if (process.argv[1] && process.argv[1].includes('seed_translations.js')) {
  seedAllTranslationsToDb()
    .then(() => {
      console.log('🎉 Chuyển đổi thành công! Nhấn Ctrl+C để thoát.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Lỗi:', err);
      process.exit(1);
    });
}
