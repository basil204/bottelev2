/**
 * Gmail Cleanup Service
 * Chạy định kỳ để:
 * 1. Check login status của Gmail đã bán (chưa có delete_at)
 * 2. Xóa Gmail khi đến thời gian delete_at
 */

import { query } from '../database/index.js';
import { deleteAccount, getUserInfo } from './googleAdminService.js';

// Interval IDs để có thể stop
let checkLoginInterval = null;
let cleanupInterval = null;

// Lấy setting number
const getSettingNumber = async (key, defaultValue = 0) => {
    try {
        const rows = await query('SELECT `value` FROM settings WHERE `key` = ?', [key]);
        if (rows && rows[0]) {
            return Number(rows[0].value) || defaultValue;
        }
        return defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

/**
 * Check login status của tất cả Gmail đã bán nhưng chưa có delete_at
 * Nếu đã login → set delete_at = lastLoginTime + 1 giờ
 */
export const checkSoldAccountsLogin = async () => {
    try {
        console.log('[GMAIL_CLEANUP] Đang check login status của Gmail đã bán...');

        // Lấy accounts đã bán, chưa có delete_at
        const accounts = await query(
            'SELECT * FROM gmail_accounts WHERE status = "sold" AND delete_at IS NULL'
        );

        if (!accounts || accounts.length === 0) {
            console.log('[GMAIL_CLEANUP] Không có Gmail nào cần check login');
            return { checked: 0, scheduled: 0 };
        }

        console.log(`[GMAIL_CLEANUP] Có ${accounts.length} Gmail cần check login`);

        let scheduled = 0;
        const deleteHours = await getSettingNumber('gmail_edu_delete_hours', 1);

        for (const account of accounts) {
            try {
                // Lấy thông tin từ Google Admin API
                const userInfo = await getUserInfo(account.email, account.type);

                if (!userInfo.success) {
                    if (userInfo.notFound) {
                        await query(
                            'UPDATE gmail_accounts SET status = "deleted" WHERE id = ?',
                            [account.id]
                        );
                        console.log(`[GMAIL_CLEANUP] Account ${account.email} không còn trên Google, đã đánh dấu deleted`);
                        continue;
                    }
                    console.log(`[GMAIL_CLEANUP] Không lấy được info cho ${account.email}: ${userInfo.error}`);
                    continue;
                }

                const googleLastLogin = userInfo.lastLoginTime;

                // Kiểm tra nếu user đã login (not null và không phải 1970)
                if (googleLastLogin &&
                    googleLastLogin !== '1970-01-01T00:00:00.000Z' &&
                    new Date(googleLastLogin).getTime() > 0) {

                    const lastLoginTime = new Date(googleLastLogin);

                    // Tính thời gian xóa = lastLoginTime + deleteHours
                    const deleteAt = new Date(lastLoginTime.getTime() + deleteHours * 60 * 60 * 1000);

                    // Cập nhật DB
                    await query(
                        'UPDATE gmail_accounts SET lastLoginTime = ?, delete_at = ? WHERE id = ?',
                        [lastLoginTime, deleteAt, account.id]
                    );

                    console.log(`[GMAIL_CLEANUP] ✅ ${account.email} đã login lúc ${lastLoginTime.toISOString()}, sẽ xóa lúc ${deleteAt.toISOString()}`);
                    scheduled++;
                }

                // Delay để tránh rate limit
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (err) {
                console.error(`[GMAIL_CLEANUP] Lỗi khi check ${account.email}:`, err.message);
            }
        }

        console.log(`[GMAIL_CLEANUP] Đã check ${accounts.length} accounts, scheduled ${scheduled} để xóa`);
        return { checked: accounts.length, scheduled };

    } catch (error) {
        console.error('[GMAIL_CLEANUP] Lỗi khi check login:', error.message);
        return { checked: 0, scheduled: 0, error: error.message };
    }
};

/**
 * Xóa Gmail đã đến thời gian delete_at
 */
export const cleanupExpiredAccounts = async () => {
    try {
        console.log('[GMAIL_CLEANUP] Đang xóa Gmail hết hạn...');

        // Lấy accounts có delete_at <= NOW() và chưa bị xóa
        const accounts = await query(
            'SELECT * FROM gmail_accounts WHERE status = "sold" AND delete_at IS NOT NULL AND delete_at <= NOW()'
        );

        if (!accounts || accounts.length === 0) {
            console.log('[GMAIL_CLEANUP] Không có Gmail nào cần xóa');
            return { deleted: 0 };
        }

        console.log(`[GMAIL_CLEANUP] Có ${accounts.length} Gmail cần xóa`);

        let deleted = 0;

        for (const account of accounts) {
            try {
                console.log(`[GMAIL_CLEANUP] Đang xóa ${account.email}...`);

                // Xóa trên Google Admin
                const deleteResult = await deleteAccount(account.email, account.type);

                if (deleteResult.success) {
                    // Cập nhật status trong DB
                    await query(
                        'UPDATE gmail_accounts SET status = "deleted" WHERE id = ?',
                        [account.id]
                    );

                    console.log(`[GMAIL_CLEANUP] ✅ Đã xóa ${account.email}`);
                    deleted++;
                } else {
                    console.error(`[GMAIL_CLEANUP] ❌ Không thể xóa ${account.email}: ${deleteResult.error}`);

                    // Nếu account không tồn tại trên Google, vẫn đánh dấu deleted
                    if (deleteResult.error.includes('Resource Not Found') || deleteResult.error.includes('notFound')) {
                        await query(
                            'UPDATE gmail_accounts SET status = "deleted" WHERE id = ?',
                            [account.id]
                        );
                        console.log(`[GMAIL_CLEANUP] ⚠️ Account ${account.email} không tồn tại trên Google, đã đánh dấu deleted`);
                        deleted++;
                    }
                }

                // Delay để tránh rate limit
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (err) {
                console.error(`[GMAIL_CLEANUP] Lỗi khi xóa ${account.email}:`, err.message);
            }
        }

        console.log(`[GMAIL_CLEANUP] Đã xóa ${deleted}/${accounts.length} accounts`);
        return { deleted };

    } catch (error) {
        console.error('[GMAIL_CLEANUP] Lỗi khi cleanup:', error.message);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Chạy cả 2 tasks: check login và cleanup
 */
export const runCleanupCycle = async () => {
    console.log('\n[GMAIL_CLEANUP] ========== BẮT ĐẦU CLEANUP CYCLE ==========');

    // 1. Check login status và schedule delete
    const checkResult = await checkSoldAccountsLogin();

    // 2. Xóa accounts hết hạn
    const cleanupResult = await cleanupExpiredAccounts();

    console.log('[GMAIL_CLEANUP] ========== KẾT THÚC CLEANUP CYCLE ==========\n');

    return {
        checkLogin: checkResult,
        cleanup: cleanupResult
    };
};

/**
 * Khởi động cleanup service
 * @param {number} checkLoginMinutes - Interval check login (default 5 phút)
 * @param {number} cleanupMinutes - Interval cleanup (default 5 phút)
 */
export const startGmailCleanup = (checkLoginMinutes = 5, cleanupMinutes = 5) => {
    console.log(`[GMAIL_CLEANUP] ✅ Khởi động Gmail Cleanup Service`);
    console.log(`[GMAIL_CLEANUP] Check login interval: ${checkLoginMinutes} phút`);
    console.log(`[GMAIL_CLEANUP] Cleanup interval: ${cleanupMinutes} phút`);

    // Chạy ngay lần đầu
    setTimeout(async () => {
        await runCleanupCycle();
    }, 10000); // 10 giây sau khi start

    // Set interval cho check login
    checkLoginInterval = setInterval(async () => {
        await checkSoldAccountsLogin();
    }, checkLoginMinutes * 60 * 1000);

    // Set interval cho cleanup
    cleanupInterval = setInterval(async () => {
        await cleanupExpiredAccounts();
    }, cleanupMinutes * 60 * 1000);
};

/**
 * Dừng cleanup service
 */
export const stopGmailCleanup = () => {
    if (checkLoginInterval) {
        clearInterval(checkLoginInterval);
        checkLoginInterval = null;
    }
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    console.log('[GMAIL_CLEANUP] ⏹️ Đã dừng Gmail Cleanup Service');
};

export default {
    checkSoldAccountsLogin,
    cleanupExpiredAccounts,
    runCleanupCycle,
    startGmailCleanup,
    stopGmailCleanup
};
