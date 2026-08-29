/**
 * Google Admin Service - Quản lý Gmail EDU qua Google Admin API
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

const getCredentialsPath = () => findFile([
    'database/google/client_secret.json',
    '../database/google/client_secret.json',
    'webapp/database/google/client_secret.json'
]);

const getTokenPath = () => findFile([
    'database/google/token.json',
    '../database/google/token.json',
    'webapp/database/google/token.json'
]);

let authClient: Auth.OAuth2Client | null = null;
let adminService: admin_directory_v1.Admin | null = null;

/**
 * Khởi tạo OAuth2 client từ credentials
 */
export const initializeAuth = async () => {
    try {
        if (authClient) return authClient;

        const credPath = getCredentialsPath();
        const tokenPath = getTokenPath();

        if (!fs.existsSync(credPath)) {
            throw new Error(`Client secret file not found at: ${credPath}`);
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
        if (fs.existsSync(tokenPath)) {
            const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            authClient.setCredentials(token);

            // Auto-refresh token nếu hết hạn
            authClient.on('tokens', (tokens) => {
                if (tokens.refresh_token) {
                    try {
                        const currentToken = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                        currentToken.refresh_token = tokens.refresh_token;
                        fs.writeFileSync(tokenPath, JSON.stringify(currentToken, null, 2));
                    } catch (e) {}
                }
            });
        } else {
            throw new Error(`Token file not found at: ${tokenPath}. Please run OAuth flow first.`);
        }

        console.log('[GOOGLE_ADMIN] ✅ Auth initialized successfully');
        return authClient;
    } catch (error) {
        console.error('[GOOGLE_ADMIN] ❌ Error initializing auth:', (error as Error).message);
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
export const generateRandomPassword = (): string => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%&*';

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    const all = uppercase + lowercase + numbers + special;
    for (let i = 0; i < 8; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Sinh username ngẫu nhiên
 */
export const generateRandomUsername = (prefix?: string): string => {
    if (prefix && prefix.trim()) {
        const cleanPrefix = prefix.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
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
    domain: string = 'suafpoly.app',
    password?: string
): Promise<{ success: boolean; email: string; id?: string; error?: string; data?: any }> => {
    const email = `${username}@${domain}`;
    try {
        const admin = await getAdminService();
        const finalPassword = password || generateRandomPassword();

        console.log(`[GOOGLE_ADMIN] Creating EDU account: ${email}`);

        const response = await admin.users.insert({
            requestBody: {
                primaryEmail: email,
                password: finalPassword,
                name: {
                    givenName: username,
                    familyName: 'User'
                },
                changePasswordAtNextLogin: false
            }
        });

        console.log(`[GOOGLE_ADMIN] ✅ Created EDU account: ${email}, ID: ${response.data.id}`);

        return {
            success: true,
            email: email,
            id: response.data.id || undefined,
            data: response.data
        };
    } catch (error) {
        const errorMessage = (error as Error).message;
        console.error(`[GOOGLE_ADMIN] ❌ Error creating EDU account for ${email}:`, errorMessage);
        return {
            success: false,
            email: email,
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

        console.log(`[GOOGLE_ADMIN] Deleting account: ${email}`);

        await admin.users.delete({
            userKey: email
        });

        console.log(`[GOOGLE_ADMIN] ✅ Deleted account: ${email}`);

        return { success: true, email };
    } catch (error) {
        const errorMessage = (error as Error).message;
        console.error(`[GOOGLE_ADMIN] ❌ Error deleting account:`, errorMessage);
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
            await new Promise(resolve => setTimeout(resolve, 500));
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

export default {
    initializeAuth,
    getAdminService,
    generateRandomPassword,
    generateRandomUsername,
    createEduAccount,
    deleteAccount,
    deleteMultipleAccounts
};
