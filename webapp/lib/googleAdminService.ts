/**
 * Google Admin Service - Quản lý Gmail EDU qua Google Admin API (TypeScript)
 * Sử dụng credentials từ database/google/
 */

import { google, Auth, admin_directory_v1 } from 'googleapis';
import fs from 'fs';
import path from 'path';

function findFile(relativePaths: string[]): string {
    for (const rel of relativePaths) {
        const full = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
        if (fs.existsSync(full)) return full;
    }
    return path.join(process.cwd(), relativePaths[0]);
}

export const DEFAULT_EDU_DOMAIN = process.env.GOOGLE_ADMIN_DOMAIN || 'nttp.edu.pl';
export const DEFAULT_NON_DOMAIN = process.env.GOOGLE_ADMIN_NON_DOMAIN || 'suafpoly.app';

export const getCredentialsPath = () => findFile([
    'database/google/client_secret.json',
    '../database/google/client_secret.json',
    'webapp/database/google/client_secret.json'
]);

export const getTokenPath = () => findFile([
    'database/google/token.json',
    '../database/google/token.json',
    'webapp/database/google/token.json'
]);

let authClient: Auth.OAuth2Client | null = null;
let adminService: admin_directory_v1.Admin | null = null;

/**
 * Khởi tạo OAuth2 client từ credentials & tự động quản lý token
 */
export const initializeAuth = async () => {
    try {
        if (authClient) return authClient;

        const credPath = getCredentialsPath();
        const tokenPath = getTokenPath();

        if (!fs.existsSync(credPath)) {
            throw new Error(`Client secret file not found at: ${credPath}`);
        }
        if (!fs.existsSync(tokenPath)) {
            throw new Error(`Token file not found at: ${tokenPath}`);
        }

        // Đọc credentials
        const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        const web = credentials.web || credentials.installed;
        if (!web) {
            throw new Error('Invalid client_secret.json format');
        }
        const { client_id, client_secret, redirect_uris } = web;

        // Tạo OAuth2 client
        authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris[0] : undefined);

        // Đọc token đã lưu
        let token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        authClient.setCredentials(token);

        // Kiểm tra hạn token
        const now = Date.now();
        if (token.expiry_date && token.expiry_date <= (now + 60000)) {
            try {
                const { credentials: newCredentials } = await authClient.refreshAccessToken();
                token = { ...token, ...newCredentials };
                fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
                authClient.setCredentials(token);
            } catch (e) {
                console.error('[GOOGLE_ADMIN_TS] Error auto refreshing token:', (e as Error).message);
            }
        }

        // Auto-refresh token nếu hết hạn
        authClient.on('tokens', (tokens) => {
            if (tokens.refresh_token || tokens.access_token) {
                try {
                    const currentToken = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                    const merged = { ...currentToken, ...tokens };
                    fs.writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
                } catch (e) {}
            }
        });

        return authClient;
    } catch (error) {
        console.error('[GOOGLE_ADMIN_TS] ❌ Error initializing auth:', (error as Error).message);
        throw error;
    }
};

/**
 * Lấy Admin Directory Service
 */
export const getAdminService = async () => {
    if (adminService) return adminService;

    const auth = await initializeAuth();
    adminService = google.admin({ version: 'directory_v1', auth });
    return adminService;
};

/**
 * Sinh password ngẫu nhiên 12 ký tự hợp lệ theo chính sách bảo mật Google
 */
export const generateRandomPassword = (length: number = 12): string => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const special = '!@#$%&*';

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    const all = uppercase + lowercase + numbers + special;
    const remaining = Math.max(8, length - 4);
    for (let i = 0; i < remaining; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Sinh username ngẫu nhiên
 */
export const generateRandomUsername = (prefix?: string): string => {
    if (prefix && prefix.trim()) {
        const cleanPrefix = prefix
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
        if (cleanPrefix) return `${cleanPrefix}${Math.floor(Math.random() * 899 + 100)}`;
    }
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let str = '';
    for (let i = 0; i < 7; i++) str += chars[Math.floor(Math.random() * chars.length)];
    return `${str}${Math.floor(Math.random() * 89 + 10)}`;
};

/**
 * Tạo tài khoản Gmail EDU thực tế trên Google Admin API
 */
export const createEduAccount = async (
    username: string,
    domain: string = DEFAULT_EDU_DOMAIN,
    password?: string
): Promise<{ success: boolean; email: string; password?: string; id?: string; error?: string; data?: any }> => {
    const finalPassword = password || generateRandomPassword();
    const cleanUsername = username ? username.trim().toLowerCase() : generateRandomUsername();
    const email = `${cleanUsername}@${domain}`;

    try {
        const admin = await getAdminService();

        console.log(`[GOOGLE_ADMIN_TS] Creating EDU account: ${email}`);

        const response = await admin.users.insert({
            requestBody: {
                primaryEmail: email,
                password: finalPassword,
                name: {
                    givenName: cleanUsername,
                    familyName: 'User'
                },
                changePasswordAtNextLogin: false,
                includeInGlobalAddressList: true
            }
        });

        console.log(`[GOOGLE_ADMIN_TS] ✅ Created EDU account: ${email}, ID: ${response.data.id}`);

        return {
            success: true,
            email: email,
            password: finalPassword,
            id: response.data.id || undefined,
            data: response.data
        };
    } catch (error) {
        let errorMessage = (error as Error).message;
        const errAny = error as any;
        if (errAny?.response?.data?.error?.message) {
            errorMessage = errAny.response.data.error.message;
        }

        console.error(`[GOOGLE_ADMIN_TS] ❌ Error creating EDU account for ${email}:`, errorMessage);
        return {
            success: false,
            email: email,
            password: finalPassword,
            error: errorMessage
        };
    }
};

/**
 * Xóa tài khoản Gmail trên Google Admin
 */
export const deleteAccount = async (email: string): Promise<{ success: boolean; email?: string; error?: string }> => {
    try {
        const admin = await getAdminService();

        console.log(`[GOOGLE_ADMIN_TS] Deleting account: ${email}`);

        await admin.users.delete({
            userKey: email
        });

        console.log(`[GOOGLE_ADMIN_TS] ✅ Deleted account: ${email}`);

        return { success: true, email };
    } catch (error) {
        const errorMessage = (error as Error).message;
        console.error(`[GOOGLE_ADMIN_TS] ❌ Error deleting account:`, errorMessage);
        return {
            success: false,
            error: errorMessage
        };
    }
};

/**
 * Xóa nhiều tài khoản Gmail trên Google Admin
 */
export const deleteMultipleAccounts = async (emails: string[]): Promise<{
    success: boolean;
    deleted: string[];
    failed: { email: string; error: string }[]
}> => {
    const deleted: string[] = [];
    const failed: { email: string; error: string }[] = [];

    for (const email of emails) {
        try {
            const result = await deleteAccount(email);
            if (result.success) {
                deleted.push(email);
            } else {
                failed.push({ email, error: result.error || 'Unknown error' });
            }
            await new Promise(resolve => setTimeout(resolve, 400));
        } catch (error) {
            failed.push({ email, error: (error as Error).message });
        }
    }

    return {
        success: failed.length === 0,
        deleted,
        failed
    };
};
/**
 * Cập nhật/Set mật khẩu cho tài khoản Google Workspace (EDU/Non-EDU)
 */
export const updateAccountPassword = async (
    email: string,
    newPassword: string
): Promise<{ success: boolean; email?: string; password?: string; error?: string }> => {
    try {
        if (!email || !newPassword) {
            return { success: false, error: 'Thiếu email hoặc mật khẩu mới' };
        }
        const cleanPassword = String(newPassword).trim();
        if (cleanPassword.length < 8) {
            return { success: false, error: 'Mật khẩu phải có tối thiểu 8 ký tự theo tiêu chuẩn bảo mật Google Workspace' };
        }
        const admin = await getAdminService();
        const cleanEmail = String(email).trim().toLowerCase();

        console.log(`[GOOGLE_ADMIN_TS] 🔑 Đang đổi mật khẩu cho tài khoản: ${cleanEmail}`);

        await admin.users.patch({
            userKey: cleanEmail,
            requestBody: {
                password: cleanPassword,
                changePasswordAtNextLogin: false
            }
        });

        console.log(`[GOOGLE_ADMIN_TS] ✅ Đã đổi mật khẩu thành công cho: ${cleanEmail}`);
        return { success: true, email: cleanEmail, password: cleanPassword };
    } catch (error) {
        let errorMessage = (error as Error).message;
        const errAny = error as any;
        if (errAny?.response?.data?.error?.message) {
            errorMessage = errAny.response.data.error.message;
        }

        console.error(`[GOOGLE_ADMIN_TS] ❌ Error updating password for ${email}:`, errorMessage);
        return {
            success: false,
            email,
            error: errorMessage
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
    deleteAccount,
    deleteMultipleAccounts,
    updateAccountPassword
};
