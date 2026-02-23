
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const TARGET_USER = 'nttp@nttp.edu.pl';

const checkUserStatus = async () => {
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

        console.log(`Checking DETAILED status for: ${TARGET_USER}`);

        // Check Domains First
        try {
            const domains = await service.domains.list({ customer: 'my_customer' });
            console.log('\n--- Managed Domains ---');
            if (domains.data.domains) {
                domains.data.domains.forEach(d => {
                    console.log(`- ${d.domainName} (Verified: ${d.verified})`);
                });
            }
            console.log('-----------------------\n');
        } catch (domErr) {
            console.error('Error checking domains:', domErr.message);
        }

        try {
            const user = await service.users.get({ userKey: TARGET_USER });
            console.log('\n--- User Status ---');
            console.log(`Email: ${user.data.primaryEmail}`);
            console.log(`ID: ${user.data.id}`);
            console.log(`Suspended: ${user.data.suspended} ${user.data.suspended ? `(Reason: ${user.data.suspensionReason})` : ''}`);
            console.log(`Archived: ${user.data.archived}`);
            console.log(`Change Password At Next Login: ${user.data.changePasswordAtNextLogin}`);
            console.log(`Agreed to Terms: ${user.data.agreedToTerms}`);
            console.log(`Org Unit Path: ${user.data.orgUnitPath}`);
            console.log(`Is Admin: ${user.data.isAdmin}`);
            console.log(`Creation Time: ${user.data.creationTime}`);
            console.log(`Last Login Time: ${user.data.lastLoginTime}`);
            console.log('-------------------\n');

            if (user.data.suspended) {
                console.log('⚠️ User is SUSPENDED. Attempting to unsuspend...');
                await service.users.update({
                    userKey: TARGET_USER,
                    requestBody: { suspended: false }
                });
                console.log('✅ User unsuspended.');
            }

            // Optional: Reset password if asked (commented out for now, waiting for user confirmation)
            // console.log('Resetting password to default: Vietcombank9338739954');
            // await service.users.update({
            //     userKey: TARGET_USER,
            //     requestBody: { password: 'Vietcombank9338739954', changePasswordAtNextLogin: false }
            // });

        } catch (error) {
            console.error(`❌ User check failed: ${error.message}`);
            if (error.response) {
                console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
            }

            // Check if in deleted list
            try {
                console.log('\nChecking DELETED list...');
                const deletedUsers = await service.users.list({
                    customer: 'my_customer',
                    showDeleted: true,
                    query: `email:${TARGET_USER}`
                });

                if (deletedUsers.data.users && deletedUsers.data.users.length > 0) {
                    const deletedUser = deletedUsers.data.users[0];
                    console.log(`⚠️ User found in DELETED list (Restoration might have failed or pending).`);
                    console.log(`ID: ${deletedUser.id}`);
                    console.log(`Suspended: ${deletedUser.suspended}`);
                } else {
                    console.log(`❌ User NOT found in Deleted list either. The account might not exist or the email is incorrect.`);
                }
            } catch (delError) {
                console.error('Error checking deleted list:', delError.message);
            }
        }

    } catch (error) {
        console.error('Script Failed:', error.message);
    }
};

checkUserStatus();
