
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const TARGET_USER = 'nttp@nttp.edu.pl';

const forceRestore = async () => {
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

        const service = google.admin({ version: 'directory_v1', auth: authClient });

        console.log(`Checking ALL records for: ${TARGET_USER}`);

        // 1. Check Active
        try {
            const user = await service.users.get({ userKey: TARGET_USER });
            console.log(`✅ User is ALREADY ACTIVE. ID: ${user.data.id}`);
            if (user.data.suspended) {
                console.log('User is suspended. Unsuspending...');
                await service.users.update({ userKey: user.data.id, requestBody: { suspended: false } });
                console.log('Unsuspended.');
            }
            return;
        } catch (e) {
            console.log('User not found in active list. Checking deleted...');
        }

        // 2. List ALL Deleted
        try {
            const deletedUsers = await service.users.list({
                customer: 'my_customer',
                showDeleted: true,
                query: `email:${TARGET_USER}`
            });

            if (deletedUsers.data.users && deletedUsers.data.users.length > 0) {
                console.log(`Found ${deletedUsers.data.users.length} deleted record(s).`);

                // Sort by deletionTime descending (newest first)
                deletedUsers.data.users.sort((a, b) => {
                    return new Date(b.deletionTime) - new Date(a.deletionTime);
                });

                for (const user of deletedUsers.data.users) {
                    console.log(`\n---------------------------------------------------`);
                    console.log(`Attempting to restore ID: ${user.id} (Deletion Time: ${user.deletionTime})`);
                    try {
                        await service.users.undelete({
                            userKey: user.id,
                            requestBody: { orgUnitPath: '/' }
                        });
                        console.log(`✅ API says Undelete OK for ID: ${user.id}`);

                        // VERIFY
                        console.log('Verifying restoration...');
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        try {
                            const activeUser = await service.users.get({ userKey: user.id });
                            console.log(`🎉 SUCCESS! User restored and verified active. Email: ${activeUser.data.primaryEmail}`);

                            if (activeUser.data.suspended) {
                                console.log('User is suspended. Unsuspending...');
                                await service.users.update({ userKey: user.id, requestBody: { suspended: false } });
                                console.log('✅ User unsuspended.');
                            }
                            return; // Truly stop now
                        } catch (verifyErr) {
                            console.error(`⚠️ Restoration seemingly failed. User ID ${user.id} not found in active list after undelete.`);
                            console.log('Continuing to next deleted record...');
                        }

                    } catch (err) {
                        console.error(`❌ Failed to restore ID ${user.id}: ${err.message}`);
                    }
                }
                console.log('\n❌ Tried all deleted records. None could be successfully restored to active state.');
            } else {
                console.log('No deleted records found.');
            }
        } catch (listErr) {
            console.error('Error listing deleted users:', listErr.message);
        }

    } catch (error) {
        console.error('Script Failed:', error.message);
    }
};

forceRestore();
