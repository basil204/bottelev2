import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// Đường dẫn đến credentials
const CREDENTIALS_PATH = path.join(process.cwd(), '..', 'database', 'google', 'client_secret.json');
const TOKEN_PATH = path.join(process.cwd(), '..', 'database', 'google', 'token.json');

// Đọc credentials và token
function getOAuth2Client() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));

    const { client_id, client_secret, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);

    return oAuth2Client;
}

// Interface cho thông tin user
export interface GoogleUserInfo {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

/**
 * Tạo email trên Google Workspace
 */
export async function createGoogleUser(userInfo: GoogleUserInfo): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const auth = getOAuth2Client();
        const admin = google.admin({ version: 'directory_v1', auth });

        const response = await admin.users.insert({
            requestBody: {
                primaryEmail: userInfo.email,
                name: {
                    givenName: userInfo.firstName,
                    familyName: userInfo.lastName,
                },
                password: userInfo.password,
                changePasswordAtNextLogin: false,
            },
        });

        return {
            success: true,
            data: response.data,
        };
    } catch (error: any) {
        console.error('Error creating Google user:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

/**
 * Xóa email trên Google Workspace
 */
export async function deleteGoogleUser(email: string): Promise<{ success: boolean; error?: string }> {
    try {
        const auth = getOAuth2Client();
        const admin = google.admin({ version: 'directory_v1', auth });

        await admin.users.delete({
            userKey: email,
        });

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting Google user:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

/**
 * Lấy danh sách domain từ Google Workspace
 */
export async function getGoogleDomains(): Promise<{ success: boolean; domains?: string[]; error?: string }> {
    try {
        const auth = getOAuth2Client();
        const admin = google.admin({ version: 'directory_v1', auth });

        const response = await admin.domains.list({
            customer: 'my_customer',
        });

        const domains = response.data.domains?.map((d) => d.domainName || '') || [];

        return {
            success: true,
            domains,
        };
    } catch (error: any) {
        console.error('Error getting Google domains:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

/**
 * Kiểm tra xem email đã tồn tại chưa
 */
export async function checkEmailExists(email: string): Promise<{ exists: boolean; error?: string }> {
    try {
        const auth = getOAuth2Client();
        const admin = google.admin({ version: 'directory_v1', auth });

        await admin.users.get({
            userKey: email,
        });

        return { exists: true };
    } catch (error: any) {
        if (error.code === 404) {
            return { exists: false };
        }
        return { exists: false, error: error.message };
    }
}

/**
 * Kiểm tra xem user đã login vào email chưa
 * Trả về lastLoginTime nếu đã login, null nếu chưa login
 */
export async function checkUserLoginStatus(email: string): Promise<{
    hasLoggedIn: boolean;
    lastLoginTime?: string;
    error?: string
}> {
    try {
        const auth = getOAuth2Client();
        const admin = google.admin({ version: 'directory_v1', auth });

        const response = await admin.users.get({
            userKey: email,
            projection: 'full',
        });

        const lastLoginTime = response.data.lastLoginTime;

        // Google trả về "1970-01-01T00:00:00.000Z" nếu chưa từng login
        const hasLoggedIn = lastLoginTime &&
            lastLoginTime !== '1970-01-01T00:00:00.000Z' &&
            new Date(lastLoginTime).getTime() > 0;

        return {
            hasLoggedIn: !!hasLoggedIn,
            lastLoginTime: lastLoginTime || undefined,
        };
    } catch (error: any) {
        console.error('Error checking user login status:', error);
        return {
            hasLoggedIn: false,
            error: error.message || 'Unknown error',
        };
    }
}
