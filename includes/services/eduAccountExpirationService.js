/**
 * eduAccountExpirationService.js
 * 
 * Quản trị vòng đời tài khoản Gmail EDU:
 * 1. Khách mua xong nếu chưa đăng nhập thì KHÔNG ĐƯỢC XÓA (bảo toàn tài khoản).
 * 2. Tự động kiểm tra Google Admin API Directory (lastLoginTime).
 *    Khi phát hiện khách đăng nhập lần đầu, bắt đầu kích hoạt đếm ngược thời gian live.
 * 3. Khi hết thời gian live kể từ khi đăng nhập, tự động xóa vĩnh viễn tài khoản trên Google Workspace.
 */

import { query } from '../database/index.js';
import { getUserInfo, deleteAccount } from './googleAdminService.js';

let isRunningCheck = false;
let checkIntervalTimer = null;

/**
 * Kiểm tra xem timestamp lastLoginTime từ Google có phải là lượt đăng nhập thật hay không
 */
function isValidGoogleLoginTime(lastLoginTime) {
    if (!lastLoginTime) return false;
    const ts = new Date(lastLoginTime).getTime();
    // Epoch timestamp <= 1 ngày (1970-01-01) là chưa đăng nhập
    if (isNaN(ts) || ts <= 86400000) return false;
    return true;
}

/**
 * Quét và xử lý tài khoản Gmail EDU
 */
export async function checkAndProcessEduExpiration() {
    if (isRunningCheck) return;
    isRunningCheck = true;

    try {
        // 1. Đọc cài đặt hệ thống
        const settingsRows = await query(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('gmail_edu_delete_hours', 'gmail_edu_enabled', 'buy_gmail_edu')"
        );
        const settings = {};
        if (Array.isArray(settingsRows)) {
            settingsRows.forEach(r => settings[r.key] = r.value);
        }

        const isEnabled = settings.gmail_edu_enabled !== 'false' && settings.buy_gmail_edu !== 'false';
        if (!isEnabled) {
            return;
        }

        const deleteHours = Number(settings.gmail_edu_delete_hours) ?? 1;
        // Nếu delete_hours = 0 tức là chế độ live vĩnh viễn, không xóa tự động
        if (deleteHours <= 0) {
            return;
        }

        // 2. BƯỚC A: Quét các tài khoản đã bán nhưng CHƯA ghi nhận đăng nhập
        // Kiểm tra qua Google Admin SDK xem khách đã đăng nhập hay chưa
        const unloggedAccounts = await query(
            `SELECT id, email, created_at 
             FROM gmail_accounts 
             WHERE status = 'sold' 
               AND (is_logged_in = 0 OR is_logged_in IS NULL)
             ORDER BY id ASC
             LIMIT 15`
        );

        if (Array.isArray(unloggedAccounts) && unloggedAccounts.length > 0) {
            for (const acc of unloggedAccounts) {
                try {
                    const info = await getUserInfo(acc.email);
                    if (info.notFound) {
                        // Tài khoản không tồn tại trên Google (có thể do xóa thủ công), đánh dấu deleted
                        await query("UPDATE gmail_accounts SET status = 'deleted' WHERE id = ?", [acc.id]);
                        continue;
                    }

                    if (info.success && isValidGoogleLoginTime(info.lastLoginTime)) {
                        // Người dùng ĐÃ ĐĂNG NHẬP!
                        const loginDate = new Date(info.lastLoginTime);
                        await query(
                            `UPDATE gmail_accounts 
                             SET is_logged_in = 1, 
                                 first_login_at = NOW(), 
                                 last_login_at = ?,
                                 delete_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
                             WHERE id = ?`,
                            [loginDate, deleteHours, acc.id]
                        );
                        console.log(`[EDU_EXPIRATION] 🟢 Khách đã đăng nhập email: ${acc.email} (${info.lastLoginTime}). Đặt hạn xóa sau ${deleteHours} giờ!`);
                    }
                    // Nếu chưa đăng nhập: giữ nguyên, tuyệt đối KHÔNG XÓA!
                    await new Promise(r => setTimeout(r, 300));
                } catch (checkErr) {
                    console.warn(`[EDU_EXPIRATION] Lỗi kiểm tra đăng nhập ${acc.email}:`, checkErr.message);
                }
            }
        }

        // 3. BƯỚC B: Quét các tài khoản ĐÃ ĐĂNG NHẬP và ĐÃ HẾT HẠN LIVE (delete_at <= NOW())
        const expiredAccounts = await query(
            `SELECT id, email, delete_at, first_login_at 
             FROM gmail_accounts 
             WHERE status = 'sold' 
               AND is_logged_in = 1 
               AND delete_at IS NOT NULL 
               AND delete_at <= NOW()
             ORDER BY delete_at ASC
             LIMIT 20`
        );

        if (Array.isArray(expiredAccounts) && expiredAccounts.length > 0) {
            for (const exp of expiredAccounts) {
                try {
                    console.log(`[EDU_EXPIRATION] ⏳ Đang xóa tài khoản hết hạn live: ${exp.email} (Đăng nhập lúc: ${exp.first_login_at}, Hết live lúc: ${exp.delete_at})`);
                    const delRes = await deleteAccount(exp.email);

                    if (delRes.success || delRes.error?.includes('404') || delRes.error?.includes('notFound') || delRes.error?.includes('Resource Not Found')) {
                        await query("UPDATE gmail_accounts SET status = 'deleted', updated_at = NOW() WHERE id = ?", [exp.id]);
                        console.log(`[EDU_EXPIRATION] ✅ Đã xóa vĩnh viễn email hết live trên Google Workspace: ${exp.email}`);
                    } else {
                        console.error(`[EDU_EXPIRATION] ❌ Lỗi xóa email ${exp.email} trên Google:`, delRes.error);
                    }
                    await new Promise(r => setTimeout(r, 400));
                } catch (delErr) {
                    console.error(`[EDU_EXPIRATION] Lỗi xử lý xóa ${exp.email}:`, delErr.message);
                }
            }
        }

    } catch (err) {
        console.error('[EDU_EXPIRATION_SERVICE_ERR]', err.message);
    } finally {
        isRunningCheck = false;
    }
}

/**
 * Khởi động background service chạy định kỳ mỗi 60 giây
 */
export function startEduAccountExpirationService(intervalMs = 60000) {
    if (checkIntervalTimer) {
        clearInterval(checkIntervalTimer);
    }

    console.log(`🚀 [EDU_EXPIRATION] Dịch vụ tự động theo dõi đăng nhập & xóa Gmail EDU hết live đã khởi chạy (chu kỳ: ${intervalMs / 1000}s)`);

    // Chạy kiểm tra lần đầu sau 10 giây
    setTimeout(() => {
        checkAndProcessEduExpiration().catch(e => console.error('[EDU_EXPIRATION_INIT_ERR]', e));
    }, 10000);

    checkIntervalTimer = setInterval(() => {
        checkAndProcessEduExpiration().catch(e => console.error('[EDU_EXPIRATION_TICK_ERR]', e));
    }, intervalMs);

    return checkIntervalTimer;
}

export function stopEduAccountExpirationService() {
    if (checkIntervalTimer) {
        clearInterval(checkIntervalTimer);
        checkIntervalTimer = null;
        console.log('🛑 [EDU_EXPIRATION] Đã dừng dịch vụ xóa Gmail EDU');
    }
}
