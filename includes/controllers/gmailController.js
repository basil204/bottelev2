/**
 * Gmail Controller - Quản lý Gmail EDU accounts
 * Logic: Tạo Gmail → Check login → Nếu đã login → lên lịch xóa sau 1 giờ
 */

import { query } from '../database/index.js';
import {
    createEduAccount,
    createNonAccount,
    deleteAccount,
    getUserInfo,
    getDomains,
    generateRandomUsername,
    sendSignInInstructions
} from '../services/googleAdminService.js';

// Sinh password ngẫu nhiên 12 ký tự (bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt)
const generateRandomPassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%&*';

    // Đảm bảo có ít nhất 1 ký tự mỗi loại
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Thêm 8 ký tự nữa
    const allChars = uppercase + lowercase + numbers + special;
    for (let i = 0; i < 8; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Xáo trộn password
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Lấy setting boolean
const getSettingBoolean = async (key, defaultValue = true) => {
    try {
        const rows = await query('SELECT `value` FROM settings WHERE `key` = ?', [key]);
        if (rows && rows[0]) {
            return rows[0].value === 'true';
        }
        return defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

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
 * Tạo Gmail account và lưu vào database
 */
export const createGmailAccount = async (type, domain, password = 'Vietcombank9338739954') => {
    try {
        // Với type 'non', chỉ sử dụng domain krishokerbondhu.org
        if (type === 'non') {
            domain = 'krishokerbondhu.org';
        }

        // Generate random username
        const username = generateRandomUsername();
        const email = `${username}@${domain}`;

        // Tạo account trên Google Admin
        let result;
        if (type === 'edu') {
            result = await createEduAccount(username, domain, password);
        } else if (type === 'non') {
            result = await createNonAccount(username, domain, password);
        } else {
            return { success: false, error: 'Invalid account type' };
        }

        if (!result.success) {
            return result;
        }

        // Lưu vào database với status "available" (chưa login)
        await query(
            'INSERT INTO gmail_accounts (email, password, type, domain, status, lastLoginTime) VALUES (?, ?, ?, ?, "available", NULL)',
            [email, password, type, domain]
        );

        return {
            success: true,
            email,
            password,
            type,
            domain
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Tạo Gmail account cho user mua - status "available" (chưa login)
 * @param {string} customPassword - null = tự sinh password ngẫu nhiên
 */
export const createGmailAccountForSale = async (type, domain, customPassword = null, backupEmail = null) => {
    try {
        // Generate password: dùng custom nếu có, không thì tự sinh
        const password = customPassword || generateRandomPassword();

        // Với type 'non', chỉ sử dụng domain krishokerbondhu.org
        if (type === 'non') {
            domain = 'krishokerbondhu.org';
        }

        // Generate random username
        const username = generateRandomUsername();
        const email = `${username}@${domain}`;
        console.log(`[CREATE_GMAIL] Bắt đầu tạo account: type=${type}, domain=${domain}, username=${username}, email=${email}`);

        // Tạo account trên Google Admin
        let result;
        if (type === 'edu') {
            console.log(`[CREATE_GMAIL] Gọi createEduAccount...`);
            result = await createEduAccount(username, domain, password);
        } else if (type === 'non') {
            console.log(`[CREATE_GMAIL] Gọi createNonAccount...`);
            result = await createNonAccount(username, domain, password);
        } else {
            console.error(`[CREATE_GMAIL] Invalid account type: ${type}`);
            return { success: false, error: 'Invalid account type' };
        }

        if (!result.success) {
            console.error(`[CREATE_GMAIL] ❌ Lỗi khi tạo account: ${result.error}`);
            return result;
        }

        console.log(`[CREATE_GMAIL] ✅ Tạo thành công account: ${result.email}, ID: ${result.id}`);

        // Nếu là email non và có email phụ, gửi sign-in instructions (nếu chức năng được bật)
        if (type === 'non' && backupEmail) {
            const sendSignInEnabled = await getSettingBoolean('gmail_non_send_signin_instructions', true);
            if (sendSignInEnabled) {
                console.log(`[CREATE_GMAIL] Đang gửi sign-in instructions đến email phụ: ${backupEmail}`);
                const signInResult = await sendSignInInstructions(result.email, backupEmail, type);
                if (signInResult.success) {
                    console.log(`[CREATE_GMAIL] ✅ Đã gửi sign-in instructions đến ${backupEmail}`);
                } else {
                    console.error(`[CREATE_GMAIL] ⚠️ Không thể gửi sign-in instructions: ${signInResult.error}`);
                }
            } else {
                console.log(`[CREATE_GMAIL] ⚠️ Chức năng gửi sign-in instructions đã bị tắt, bỏ qua`);
            }
        }

        // Lưu vào database với status "available" (chưa login), delete_at = NULL
        await query(
            'INSERT INTO gmail_accounts (email, password, type, domain, status, lastLoginTime, delete_at) VALUES (?, ?, ?, ?, "available", NULL, NULL)',
            [email, password, type, domain]
        );

        console.log(`[CREATE_GMAIL] ✅ Đã lưu account vào database với status "available" (chưa login)`);

        return {
            success: true,
            email,
            password,
            type,
            domain
        };
    } catch (error) {
        console.error(`[CREATE_GMAIL] Exception:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Tạo nhiều Gmail accounts
 */
export const createMultipleGmailAccounts = async (type, domain, count, password = 'Vietcombank9338739954') => {
    const results = [];
    for (let i = 0; i < count; i++) {
        const result = await createGmailAccount(type, domain, password);
        results.push(result);
        // Delay nhỏ để tránh rate limit
        if (i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return results;
};

/**
 * Xóa Gmail account
 */
export const deleteGmailAccount = async (accountId) => {
    try {
        // Lấy thông tin account
        const [account] = await query('SELECT * FROM gmail_accounts WHERE id = ?', [accountId]);
        if (!account) {
            return { success: false, error: 'Account not found' };
        }

        // Xóa trên Google Admin
        const deleteResult = await deleteAccount(account.email, account.type);
        if (!deleteResult.success) {
            return deleteResult;
        }

        // Cập nhật status trong database
        await query(
            'UPDATE gmail_accounts SET status = "deleted" WHERE id = ?',
            [accountId]
        );

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Check login status của account từ Google API và cập nhật lịch xóa
 * Logic: Nếu đã login → cập nhật lastLoginTime → set delete_at = lastLoginTime + 1 giờ
 */
export const checkAndScheduleDelete = async (accountId) => {
    try {
        const [account] = await query('SELECT * FROM gmail_accounts WHERE id = ?', [accountId]);
        if (!account) {
            return { success: false, error: 'Account not found' };
        }

        // Lấy thông tin từ Google Admin API
        const userInfo = await getUserInfo(account.email, account.type);

        if (!userInfo.success) {
            return { success: false, error: userInfo.error };
        }

        const googleLastLogin = userInfo.lastLoginTime;

        // Kiểm tra nếu user đã login
        if (googleLastLogin && googleLastLogin !== '1970-01-01T00:00:00.000Z') {
            const lastLoginTime = new Date(googleLastLogin);

            // Lấy số giờ để xóa từ settings (mặc định 1 giờ)
            const deleteHours = await getSettingNumber('gmail_edu_delete_hours', 1);

            // Tính thời gian xóa = lastLoginTime + deleteHours
            const deleteAt = new Date(lastLoginTime.getTime() + deleteHours * 60 * 60 * 1000);

            // Cập nhật DB
            await query(
                'UPDATE gmail_accounts SET lastLoginTime = ?, delete_at = ? WHERE id = ?',
                [lastLoginTime, deleteAt, accountId]
            );

            console.log(`[GMAIL_CHECK] Account ${account.email} đã login lúc ${lastLoginTime.toISOString()}, sẽ xóa lúc ${deleteAt.toISOString()}`);

            return {
                success: true,
                accountId: account.id,
                email: account.email,
                isLoggedIn: true,
                lastLoginTime: lastLoginTime.toISOString(),
                deleteAt: deleteAt.toISOString()
            };
        }

        // Chưa login
        return {
            success: true,
            accountId: account.id,
            email: account.email,
            isLoggedIn: false,
            lastLoginTime: null,
            deleteAt: null
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Check login status cho tất cả accounts đã bán
 */
export const checkAllSoldAccountsLogin = async () => {
    try {
        // Lấy tất cả accounts đã bán nhưng chưa có delete_at (chưa login)
        const accounts = await query('SELECT * FROM gmail_accounts WHERE status = "sold" AND delete_at IS NULL');
        const results = [];

        for (const account of accounts) {
            const status = await checkAndScheduleDelete(account.id);
            results.push(status);
            // Delay để tránh rate limit
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    } catch (error) {
        return [];
    }
};

/**
 * Lấy account available để bán
 */
export const getAvailableAccount = async (type) => {
    try {
        const [account] = await query(
            'SELECT * FROM gmail_accounts WHERE type = ? AND status = "available" LIMIT 1',
            [type]
        );
        return account || null;
    } catch (error) {
        return null;
    }
};

/**
 * Đánh dấu account đã bán
 */
/**
 * Đánh dấu account đã bán
 */
export const markAccountSold = async (accountId, userId = null, price = null, orderId = null) => {
    try {
        const updates = ['status = "sold"', 'sold_at = NOW()'];
        const params = [];

        if (userId) {
            updates.push('sold_to_user_id = ?');
            params.push(userId);
        }

        if (price !== null) {
            updates.push('sold_price = ?');
            params.push(price);
        }

        if (orderId) {
            updates.push('order_id = ?');
            params.push(orderId);
        }

        params.push(accountId);

        await query(
            `UPDATE gmail_accounts SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

/**
 * Lấy danh sách accounts
 */
export const listGmailAccounts = async (type, status, offset, limit) => {
    try {
        let sql = 'SELECT * FROM gmail_accounts WHERE 1=1';
        const params = [];

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const rows = await query(sql, params);
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total').replace('ORDER BY id DESC LIMIT ? OFFSET ?', '');
        const [{ total }] = await query(countSql, params.slice(0, -2));

        return { rows, total };
    } catch (error) {
        return { rows: [], total: 0 };
    }
};

/**
 * Get domains
 */
export const getAvailableDomains = async (type) => {
    try {
        console.log(`[GET_DOMAINS] Đang lấy domains cho type: ${type}`);
        const result = await getDomains(type);
        console.log(`[GET_DOMAINS] Kết quả:`, result);
        if (!result || !result.success || !result.domains || !Array.isArray(result.domains)) {
            console.log(`[GET_DOMAINS] Không có domains hợp lệ`);
            return [];
        }
        const domains = result.domains.map(d => d.domainName || d).filter(d => d);
        console.log(`[GET_DOMAINS] Domains tìm được:`, domains);
        return domains;
    } catch (error) {
        console.error(`[GET_DOMAINS] Lỗi:`, error.message);
        return [];
    }
};

/**
 * Count available accounts by type
 */
export const countAvailableAccounts = async (type) => {
    try {
        const [{ count }] = await query(
            'SELECT COUNT(*) as count FROM gmail_accounts WHERE type = ? AND status = "available"',
            [type]
        );
        return count || 0;
    } catch (error) {
        return 0;
    }
};

/**
 * Lấy giá Gmail EDU từ settings
 */
export const getGmailEduPrice = async () => {
    return await getSettingNumber('gmail_edu_price', 10000);
};

export default {
    createGmailAccount,
    createGmailAccountForSale,
    createMultipleGmailAccounts,
    deleteGmailAccount,
    checkAndScheduleDelete,
    checkAllSoldAccountsLogin,
    getAvailableAccount,
    markAccountSold,
    listGmailAccounts,
    getAvailableDomains,
    countAvailableAccounts,
    getGmailEduPrice
};
