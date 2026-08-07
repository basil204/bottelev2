/**
 * Google Admin Service - Quản lý Gmail EDU qua Google Admin API
 * Sử dụng credentials từ database/google/
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to credential files
const CREDENTIALS_PATH = path.join(__dirname, '../../database/google/client_secret.json');
const TOKEN_PATH = path.join(__dirname, '../../database/google/token.json');

// Default EDU domain 
const DEFAULT_EDU_DOMAIN = 'suafpoly.app';
const DEFAULT_NON_DOMAIN = 'krishokerbondhu.org';

let authClient = null;
let adminService = null;

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
        console.error('[GOOGLE_ADMIN] ❌ Error initializing auth:', error.message);
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
 * Generate random username
 */
export const generateRandomUsername = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let username = '';

    // Bắt đầu bằng chữ cái
    username += chars.charAt(Math.floor(Math.random() * 26));

    // Thêm 7 ký tự ngẫu nhiên
    for (let i = 0; i < 7; i++) {
        username += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return username;
};

/**
 * Tạo tài khoản Gmail EDU
 */
export const createEduAccount = async (username, domain = DEFAULT_EDU_DOMAIN, password = 'Vietcombank9338739954') => {
    try {
        const admin = await getAdminService();
        const email = `${username}@${domain}`;

        console.log(`[GOOGLE_ADMIN] Creating EDU account: ${email}`);

        const response = await admin.users.insert({
            requestBody: {
                primaryEmail: email,
                password: password,
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
            id: response.data.id,
            data: response.data
        };
    } catch (error) {
        console.error(`[GOOGLE_ADMIN] ❌ Error creating EDU account:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Tạo tài khoản Gmail Non-EDU
 */
export const createNonAccount = async (username, domain = DEFAULT_NON_DOMAIN, password = 'Vietcombank9338739954') => {
    return createEduAccount(username, domain, password);
};

/**
 * Xóa tài khoản Gmail
 */
export const deleteAccount = async (email, type = 'edu') => {
    try {
        const admin = await getAdminService();

        console.log(`[GOOGLE_ADMIN] Deleting account: ${email}`);

        await admin.users.delete({
            userKey: email
        });

        console.log(`[GOOGLE_ADMIN] ✅ Deleted account: ${email}`);

        return { success: true, email };
    } catch (error) {
        console.error(`[GOOGLE_ADMIN] ❌ Error deleting account:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Lấy thông tin user (bao gồm lastLoginTime)
 */
export const getUserInfo = async (email, type = 'edu') => {
    try {
        const admin = await getAdminService();

        const response = await admin.users.get({
            userKey: email,
            projection: 'full'
        });

        return {
            success: true,
            data: response.data,
            lastLoginTime: response.data.lastLoginTime || null
        };
    } catch (error) {
        const notFound = error?.code === 404 || error?.response?.status === 404 ||
            String(error.message || '').includes('Resource Not Found') ||
            String(error.message || '').includes('notFound');
        if (!notFound) {
            console.error(`[GOOGLE_ADMIN] ❌ Error getting user info:`, error.message);
        }
        return {
            success: false,
            error: error.message,
            notFound
        };
    }
};

/**
 * Lấy danh sách domains
 */
export const getDomains = async (type = 'edu') => {
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
        console.error(`[GOOGLE_ADMIN] ❌ Error getting domains:`, error.message);
        return {
            success: false,
            error: error.message,
            domains: []
        };
    }
};

/**
 * Gửi sign-in instructions đến email phụ
 */
export const sendSignInInstructions = async (userEmail, backupEmail, type = 'edu') => {
    // Trong thực tế, có thể sử dụng Gmail API để gửi email
    // Hiện tại chỉ log thông tin
    console.log(`[GOOGLE_ADMIN] Sign-in instructions would be sent to ${backupEmail} for ${userEmail}`);
    return { success: true };
};

export default {
    initializeAuth,
    getAdminService,
    generateRandomUsername,
    createEduAccount,
    createNonAccount,
    deleteAccount,
    getUserInfo,
    getDomains,
    sendSignInInstructions
};
