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

/**
 * Lấy danh sách tất cả users từ Google Workspace
 */
export async function listAllGoogleUsers(domain?: string): Promise<{
    success: boolean;
    users?: { email: string; name: string; creationTime: string }[];
    error?: string;
}> {
    try {
        const auth = getOAuth2Client();
        const admin = google.admin({ version: 'directory_v1', auth });

        const allUsers: { email: string; name: string; creationTime: string }[] = [];
        let pageToken: string | undefined;

        do {
            const response = await admin.users.list({
                customer: 'my_customer',
                domain: domain || undefined,
                maxResults: 500,
                pageToken: pageToken,
            });

            if (response.data.users) {
                for (const user of response.data.users) {
                    allUsers.push({
                        email: user.primaryEmail || '',
                        name: `${user.name?.givenName || ''} ${user.name?.familyName || ''}`.trim(),
                        creationTime: user.creationTime || '',
                    });
                }
            }

            pageToken = response.data.nextPageToken || undefined;
        } while (pageToken);

        return {
            success: true,
            users: allUsers,
        };
    } catch (error: any) {
        console.error('Error listing Google users:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

/**
 * Xóa tất cả users từ Google Workspace (trừ super admin)
 * Xử lý theo batch 7 accounts một lần
 */
export async function deleteAllGoogleUsers(domain?: string): Promise<{
    success: boolean;
    deleted: number;
    failed: { email: string; error: string }[];
    error?: string;
}> {
    try {
        const auth = getOAuth2Client();
        const admin = google.admin({ version: 'directory_v1', auth });

        // Lấy danh sách users
        const listResult = await listAllGoogleUsers(domain);
        if (!listResult.success || !listResult.users) {
            return {
                success: false,
                deleted: 0,
                failed: [],
                error: listResult.error || 'Cannot list users',
            };
        }

        let deleted = 0;
        const failed: { email: string; error: string }[] = [];
        const BATCH_SIZE = 7;

        // Chia thành các batch 7 accounts
        for (let i = 0; i < listResult.users.length; i += BATCH_SIZE) {
            const batch = listResult.users.slice(i, i + BATCH_SIZE);
            console.log(`[GOOGLE_ADMIN] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(listResult.users.length / BATCH_SIZE)} (${batch.length} users)`);

            // Xóa 7 accounts cùng lúc
            const deletePromises = batch.map(async (user) => {
                try {
                    await admin.users.delete({
                        userKey: user.email,
                    });
                    console.log(`[GOOGLE_ADMIN] ✅ Deleted: ${user.email}`);
                    return { success: true, email: user.email };
                } catch (error: any) {
                    // Skip if user is super admin hoặc không thể xóa
                    if (error.message?.includes('Cannot delete a user') || error.message?.includes('super admin')) {
                        console.log(`[GOOGLE_ADMIN] ⚠️ Skipped (admin): ${user.email}`);
                        return { success: true, email: user.email, skipped: true };
                    } else {
                        console.error(`[GOOGLE_ADMIN] ❌ Failed: ${user.email}:`, error.message);
                        return { success: false, email: user.email, error: error.message || 'Unknown error' };
                    }
                }
            });

            const results = await Promise.all(deletePromises);

            for (const result of results) {
                if (result.success) {
                    if (!result.skipped) {
                        deleted++;
                    }
                } else {
                    failed.push({ email: result.email, error: result.error || 'Unknown error' });
                }
            }

            // Delay giữa các batch để tránh rate limit
            if (i + BATCH_SIZE < listResult.users.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return {
            success: true,
            deleted,
            failed,
        };
    } catch (error: any) {
        console.error('Error deleting all Google users:', error);
        return {
            success: false,
            deleted: 0,
            failed: [],
            error: error.message || 'Unknown error',
        };
    }
}

