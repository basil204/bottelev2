
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

const CURRENT_EMAIL = 'nttp@nttp.edu.pl';
const NEW_EMAIL = '0w2jftm0@nttp.edu.pl';

const renameUser = async () => {
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

        console.log(`Attempting to rename ${CURRENT_EMAIL} to ${NEW_EMAIL}...`);

        try {
            const res = await service.users.update({
                userKey: CURRENT_EMAIL,
                requestBody: {
                    primaryEmail: NEW_EMAIL
                }
            });

            console.log(`✅ Success! User renamed.`);
            console.log(`ID: ${res.data.id}`);
            console.log(`New Email: ${res.data.primaryEmail}`);

        } catch (error) {
            console.error(`❌ Failed to rename user: ${error.message}`);
            if (error.response) {
                console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
            }
        }

    } catch (error) {
        console.error('Script Failed:', error.message);
    }
};

renameUser();
