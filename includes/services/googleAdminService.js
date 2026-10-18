/**
 * Google Admin Service - Quản lý Gmail EDU qua Google Admin API (Directory v1)
 * Hỗ trợ tự động refresh token, tạo/xóa tài khoản, quản lý Domain.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_EDU_DOMAIN = process.env.GOOGLE_ADMIN_DOMAIN || 'nttp.edu.pl';
export const DEFAULT_NON_DOMAIN = process.env.GOOGLE_ADMIN_NON_DOMAIN || 'suafpoly.app';

function findFile(paths) {
    for (const p of paths) {
        const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
        if (fs.existsSync(full)) return full;
    }
    return paths[0];
}

export const getCredentialsPath = () => findFile([
    path.join(__dirname, '../../database/google/client_secret.json'),
    'database/google/client_secret.json',
    'webapp/database/google/client_secret.json',
    '../database/google/client_secret.json'
]);

export const getTokenPath = () => findFile([
    path.join(__dirname, '../../database/google/token.json'),
    'database/google/token.json',
    'webapp/database/google/token.json',
    '../database/google/token.json'
]);

let authClient = null;
let adminService = null;

/**
 * Khởi tạo OAuth2 client từ credentials & tự động quản lý token
 */
export const initializeAuth = async () => {
    try {
        const credPath = getCredentialsPath();
        const tokenPath = getTokenPath();

        if (!fs.existsSync(credPath)) {
            throw new Error(`Credentials file not found at: ${credPath}`);
        }
        if (!fs.existsSync(tokenPath)) {
            throw new Error(`Token file not found at: ${tokenPath}`);
        }

        const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        const keys = credentials.web || credentials.installed;
        if (!keys) {
            throw new Error('Invalid client_secret.json format. Missing "web" or "installed" key.');
        }

        const { client_id, client_secret, redirect_uris } = keys;
        authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris[0] : undefined);

        let token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        authClient.setCredentials(token);

        // Kiểm tra hạn token và tự động refresh nếu hết hạn
        const now = Date.now();
        if (token.expiry_date && token.expiry_date <= (now + 60000)) {
            console.log('[GOOGLE_ADMIN] 🔄 Token expired or expiring soon. Refreshing...');
            try {
                const { credentials: newCredentials } = await authClient.refreshAccessToken();
                token = { ...token, ...newCredentials };
                fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
                authClient.setCredentials(token);
                console.log('[GOOGLE_ADMIN] ✅ Token refreshed & saved successfully');
            } catch (refErr) {
                console.error('[GOOGLE_ADMIN] ⚠️ Token refresh error:', refErr.message);
            }
        }

        // Lắng nghe sự kiện token thay đổi
        authClient.on('tokens', (tokens) => {
            try {
                const currentToken = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                const updatedToken = { ...currentToken, ...tokens };
                fs.writeFileSync(tokenPath, JSON.stringify(updatedToken, null, 2));
            } catch (e) {
                console.error('[GOOGLE_ADMIN] Failed to persist new tokens:', e.message);
            }
        });

        return authClient;
    } catch (error) {
        console.error('[GOOGLE_ADMIN] ❌ Error initializing auth:', error.message);
        throw error;
    }
};

/**
 * Lấy Google Admin Directory Service instance
 */
export const getAdminService = async () => {
    const auth = await initializeAuth();
    adminService = google.admin({ version: 'directory_v1', auth });
    return adminService;
};

/**
 * Sinh mật khẩu ngẫu nhiên bảo mật cao (chữ hoa, chữ thường, số, ký tự đặc biệt)
 */
export const generateRandomPassword = (length = 12) => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const special = '!@#$%&*';

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    const allChars = uppercase + lowercase + numbers + special;
    const remainingLength = Math.max(8, length - 4);
    for (let i = 0; i < remainingLength; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Sinh username hợp lệ theo tiêu chuẩn Google Workspace
 */
export const generateRandomUsername = (prefix = '') => {
    if (prefix && String(prefix).trim()) {
        const cleanPrefix = String(prefix)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
        if (cleanPrefix) {
            const randomSuffix = Math.floor(100 + Math.random() * 900);
            return `${cleanPrefix}${randomSuffix}`;
        }
    }
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let str = '';
    for (let i = 0; i < 7; i++) {
        str += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${str}${Math.floor(10 + Math.random() * 89)}`;
};

/**
 * Tạo tài khoản Gmail EDU trên Google Workspace Admin SDK
 */
export const createEduAccount = async (
    username,
    domain = DEFAULT_EDU_DOMAIN,
    password = null,
    givenName = 'Student',
    familyName = 'User'
) => {
    const finalPassword = password || generateRandomPassword();
    const cleanUsername = username ? String(username).trim().toLowerCase() : generateRandomUsername();
    const email = `${cleanUsername}@${domain}`;

    try {
        const admin = await getAdminService();

        console.log(`[GOOGLE_ADMIN] 🚀 Đang tạo tài khoản Gmail EDU: ${email}`);

        const response = await admin.users.insert({
            requestBody: {
                primaryEmail: email,
                password: finalPassword,
                name: {
                    givenName: givenName || cleanUsername,
                    familyName: familyName || 'User'
                },
                changePasswordAtNextLogin: false,
                includeInGlobalAddressList: true
            }
        });

        console.log(`[GOOGLE_ADMIN] ✅ Tạo tài khoản thành công: ${email}, ID: ${response.data.id}`);

        return {
            success: true,
            email,
            password: finalPassword,
            id: response.data.id,
            domain,
            data: response.data
        };
    } catch (error) {
        let errorMsg = error.message || 'Lỗi không xác định khi tạo tài khoản Google';
        if (error.response?.data?.error?.message) {
            errorMsg = error.response.data.error.message;
        }

        console.error(`[GOOGLE_ADMIN] ❌ Lỗi tạo tài khoản ${email}:`, errorMsg);
        return {
            success: false,
            email,
            password: finalPassword,
            error: errorMsg
        };
    }
};

/**
 * Tạo tài khoản Gmail Non-EDU
 */
export const createNonAccount = async (username, domain = DEFAULT_NON_DOMAIN, password = null) => {
    return createEduAccount(username, domain, password);
};

/**
 * Xóa tài khoản trên Google Admin
 */
export const deleteAccount = async (email) => {
    try {
        const admin = await getAdminService();
        console.log(`[GOOGLE_ADMIN] 🗑️ Đang xóa tài khoản: ${email}`);

        await admin.users.delete({ userKey: email });
        console.log(`[GOOGLE_ADMIN] ✅ Đã xóa tài khoản: ${email}`);

        return { success: true, email };
    } catch (error) {
        console.error(`[GOOGLE_ADMIN] ❌ Lỗi xóa tài khoản ${email}:`, error.message);
        return {
            success: false,
            email,
            error: error.message
        };
    }
};

/**
 * Xóa nhiều tài khoản
 */
export const deleteMultipleAccounts = async (emails = []) => {
    const deleted = [];
    const failed = [];

    for (const email of emails) {
        try {
            const res = await deleteAccount(email);
            if (res.success) deleted.push(email);
            else failed.push({ email, error: res.error });
            await new Promise(r => setTimeout(r, 400));
        } catch (err) {
            failed.push({ email, error: err.message });
        }
    }

    return {
        success: failed.length === 0,
        deleted,
        failed
    };
};

/**
 * Lấy thông tin user
 */
export const getUserInfo = async (email) => {
    try {
        const admin = await getAdminService();
        const response = await admin.users.get({
            userKey: email,
            projection: 'full'
        });

        return {
            success: true,
            data: response.data,
            lastLoginTime: response.data.lastLoginTime || null,
            creationTime: response.data.creationTime || null,
            suspended: response.data.suspended || false
        };
    } catch (error) {
        const notFound = error?.code === 404 || error?.response?.status === 404;
        return {
            success: false,
            error: error.message,
            notFound
        };
    }
};

/**
 * Lấy danh sách Domains quản lý
 */
export const getDomains = async () => {
    try {
        const admin = await getAdminService();
        const response = await admin.domains.list({
            customer: 'my_customer'
        });

        return {
            success: true,
            domains: response.data.domains || []
        };
    } catch (error) {
        console.error(`[GOOGLE_ADMIN] ❌ Lỗi lấy danh sách domains:`, error.message);
        return {
            success: false,
            error: error.message,
            domains: []
        };
    }
};

export default {
    DEFAULT_EDU_DOMAIN,
    DEFAULT_NON_DOMAIN,
    initializeAuth,
    getAdminService,
    generateRandomPassword,
    generateRandomUsername,
    createEduAccount,
    createNonAccount,
    deleteAccount,
    deleteMultipleAccounts,
    getUserInfo,
    getDomains
};
