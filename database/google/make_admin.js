
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const TARGET_USER = 'nttp@nttp.edu.pl';

const makeSuperAdmin = async () => {
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

        console.log(`Promoting ${TARGET_USER} to Super Admin...`);

        try {
            // users.makeAdmin makes the user a Super Admin
            const res = await service.users.makeAdmin({
                userKey: TARGET_USER,
                requestBody: {
                    status: true // true = Make Admin
                }
            });

            console.log(`✅ Success! User ${TARGET_USER} is now a Super Admin.`);
            console.log(`Is Admin: ${res.data.isAdmin}`);

        } catch (error) {
            console.error(`❌ Failed to make admin: ${error.message}`);
            if (error.response) {
                console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
            }
        }

    } catch (error) {
        console.error('Script Failed:', error.message);
    }
};

makeSuperAdmin();
