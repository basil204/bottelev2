/**
 * Google Admin Service - Quản lý Gmail EDU qua Google Admin API
 * Sử dụng credentials từ database/google/
 */

import { google, Auth, admin_directory_v1 } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Paths to credential files
const CREDENTIALS_PATH = path.join(process.cwd(), '../database/google/client_secret.json');
const TOKEN_PATH = path.join(process.cwd(), '../database/google/token.json');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authClient: Auth.OAuth2Client | null = null;
let adminService: admin_directory_v1.Admin | null = null;


/**
 * Khởi tạo OAuth2 client từ credentials
 */
export const initializeAuth = async () => {
    try {
        if (authClient) return authClient;

        // Đọc credentials
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        const { client_id, client_secret, redirect_uris } = credentials.web;

        // Tạo OAuth2 client
        authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        // Đọc token đã lưu
        if (fs.existsSync(TOKEN_PATH)) {
            const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
            authClient.setCredentials(token);

            // Auto-refresh token nếu hết hạn
            authClient.on('tokens', (tokens) => {
                if (tokens.refresh_token) {
                    // Lưu token mới
                    const currentToken = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
                    currentToken.refresh_token = tokens.refresh_token;
                    fs.writeFileSync(TOKEN_PATH, JSON.stringify(currentToken, null, 2));
                }
            });
        } else {
            throw new Error('Token file not found. Please run OAuth flow first.');
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
            // Delay để tránh rate limit
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
    deleteAccount,
    deleteMultipleAccounts
};
