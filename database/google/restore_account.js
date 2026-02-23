
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const TARGET_USER = 'nttp@nttp.edu.pl';

const restoreAccount = async () => {
    try {
        console.log('Reading credentials...');
        if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
            throw new Error('Missing credentials or token file.');
        }

        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        const keys = credentials.web || credentials.installed;
        const { client_id, client_secret, redirect_uris } = keys;
        const authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris[0] : undefined);

        let token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        authClient.setCredentials(token);

        // Token Refresh Logic
        const now = Date.now();
        if (token.expiry_date && token.expiry_date <= now) {
            console.log('Token expired. Refreshing...');
            const { credentials: newCredentials } = await authClient.refreshAccessToken();
            token = { ...token, ...newCredentials };
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
            authClient.setCredentials(token);
        }

        const service = google.admin({ version: 'directory_v1', auth: authClient });

        console.log(`Checking status for: ${TARGET_USER}`);

        // 1. Check if user exists (Active or Suspended)
        try {
            const user = await service.users.get({ userKey: TARGET_USER });
            console.log(`User found! Status: Suspended=${user.data.suspended}, Archived=${user.data.archived}`);

            if (user.data.suspended) {
                console.log('User is suspended. Attempting to unsuspend...');
                await service.users.update({
                    userKey: TARGET_USER,
                    requestBody: { suspended: false }
                });
                console.log(`✅ Successfully unsuspended user: ${TARGET_USER}`);
            } else {
                console.log('User is already active.');
            }
            return;
        } catch (error) {
            console.log(`User not found in active/suspended list (${error.message}). Checking deleted users...`);
        }

        // 2. Check if user is in Deleted Users
        try {
            // Note: 'my_customer' is a special alias for the customer ID
            const deletedUsers = await service.users.list({
                customer: 'my_customer',
                showDeleted: true,
                query: `email:${TARGET_USER}`
            });

            if (deletedUsers.data.users && deletedUsers.data.users.length > 0) {
                const deletedUser = deletedUsers.data.users[0];
                console.log(`User found in DELETED list. ID: ${deletedUser.id}`);

                console.log('Attempting to UNDELETE...');
                // Try restore to root OU if original fails or just standard undelete
                try {
                    await service.users.undelete({
                        userKey: deletedUser.id,
                        requestBody: { orgUnitPath: '/' }
                    });
                    console.log(`✅ Successfully undeleted user: ${TARGET_USER}`);
                } catch (undeleteError) {
                    console.error(`❌ Undelete failed: ${undeleteError.message}`);
                    if (undeleteError.response) {
                        console.error('Error Details:', JSON.stringify(undeleteError.response.data, null, 2));
                    }
                }
            } else {
                console.log(`❌ User ${TARGET_USER} not found in Active, Suspended, or Deleted lists. Account may be permanently deleted or never existed.`);
            }
        } catch (listError) {
            console.error(`Error listing deleted users: ${listError.message}`);
        }

    } catch (error) {
        console.error('Script Failed:', error.message);
    }
};

restoreAccount();
