
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to credential files - assuming script is run from project root or inside database/google
// Adjust relative paths to be robust
const CREDENTIALS_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

const getAccountInfo = async () => {
    try {
        console.log('Reading credentials from:', CREDENTIALS_PATH);
        if (!fs.existsSync(CREDENTIALS_PATH)) {
            throw new Error(`Credentials file not found at ${CREDENTIALS_PATH}`);
        }
        if (!fs.existsSync(TOKEN_PATH)) {
            throw new Error(`Token file not found at ${TOKEN_PATH}. Please authenticate first.`);
        }

        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        // Handle different client_secret.json structures (web vs installed)
        const keys = credentials.web || credentials.installed;
        if (!keys) {
            throw new Error('Invalid credentials file format. Missing "web" or "installed" property.');
        }

        const { client_id, client_secret, redirect_uris } = keys;
        const authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris[0] : undefined);

        let token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        authClient.setCredentials(token);

        // Check if token is expired
        const now = Date.now();
        if (token.expiry_date && token.expiry_date <= now) {
            console.log('Token expired. Refreshing...');
            try {
                const { credentials: newCredentials } = await authClient.refreshAccessToken();
                // Merge new credentials with existing ones (to keep refresh_token if not returned)
                token = { ...token, ...newCredentials };
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
                console.log('Token refreshed and saved.');
                authClient.setCredentials(token);
            } catch (refreshError) {
                console.error('Error refreshing token:', refreshError.message);
                throw new Error('Failed to refresh token. Please re-authenticate.');
            }
        }

        console.log('Token Scopes:', token.scope);

        // Try to get user info (requires profile scope)
        try {
            console.log('Attempting to fetch user info via OAuth2...');
            const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
            const userInfo = await oauth2.userinfo.get();

            console.log('\n--- Google Account Information ---');
            console.log('ID:', userInfo.data.id);
            console.log('Email:', userInfo.data.email);
            console.log('Name:', userInfo.data.name);
            console.log('Given Name:', userInfo.data.given_name);
            console.log('Family Name:', userInfo.data.family_name);
            console.log('Picture:', userInfo.data.picture);
            console.log('----------------------------------\n');

            return userInfo.data;
        } catch (error) {
            console.log('Failed to fetch user info via OAuth2 (likely due to missing scope).');
            // Fallback: Try Admin Directory API if scope permits
            if (token.scope.includes('admin.directory')) {
                console.log('Attempting to fetch Customer/Domain info via Admin SDK...');
                // Note: userKey 'my_customer' is for domains.list but for users.list we can use 'my_customer' as customerId
                const service = google.admin({ version: 'directory_v1', auth: authClient });

                try {
                    // Start by checking domains
                    const domains = await service.domains.list({ customer: 'my_customer' });
                    console.log('\n--- Admin Domain Information ---');
                    if (domains.data.domains) {
                        console.log('Domains managed:', domains.data.domains.map(d => d.domainName).join(', '));
                    } else {
                        console.log('No domains found or no access.');
                    }
                    console.log('--------------------------------\n');

                    // List Admin Users
                    console.log('Fetching all Admin users...');
                    const adminUsersReq = await service.users.list({
                        customer: 'my_customer',
                        query: 'isAdmin=true',
                        maxResults: 500
                    });

                    console.log('\n--- List of Admin Users ---');
                    if (adminUsersReq.data.users && adminUsersReq.data.users.length > 0) {
                        adminUsersReq.data.users.forEach(user => {
                            console.log(`- ${user.primaryEmail} (${user.name.fullName}) - Admin: ${user.isAdmin}`);
                        });
                    } else {
                        console.log('No admin users found.');
                    }
                    console.log('---------------------------\n');

                } catch (adminError) {
                    console.error('Failed to fetch Admin SDK info:', adminError.message);
                    if (adminError.response) {
                        console.error('Admin SDK Error Details:', JSON.stringify(adminError.response.data, null, 2));
                    }
                }
            } else {
                throw error;
            }
        }

        // If we reached here, either userinfo succeeded or we caught an error but it was handled (unlikely given the structure above, but let's be safe).
        // Actually, the structure above has a try-catch. If catch executes and falls through (which it does if scope includes admin.directory), we continue.
        // But the previous `else { throw error }` in the catch block means we only continue if we handled the error or if the original try succeeded.

        // Regardless of how we got here, if we have the admin scope, let's try to list admins.
        // We need to check if we already listed them in the catch block?
        // Simpler approach: 
        // 1. Try userinfo. 
        // 2. Separately, try to list admins if permissions allow.

        if (token.scope.includes('admin.directory.user')) {
            const service = google.admin({ version: 'directory_v1', auth: authClient });
            try {
                console.log('Fetching all Admin users...');
                const adminUsersReq = await service.users.list({
                    customer: 'my_customer',
                    query: 'isAdmin=true',
                    maxResults: 500
                });

                console.log('\n--- List of Admin Users ---');
                if (adminUsersReq.data.users && adminUsersReq.data.users.length > 0) {
                    adminUsersReq.data.users.forEach(user => {
                        console.log(`- ${user.primaryEmail} (${user.name.fullName}) - Admin: ${user.isAdmin}`);
                    });
                } else {
                    console.log('No admin users found.');
                }
                console.log('---------------------------\n');
            } catch (err) {
                console.error('Error listing admins:', err.message);
            }
        }

    } catch (error) {
        console.error('Error fetching account info:', error.message);
        if (error.response) {
            console.error('API Error Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
};

getAccountInfo();
