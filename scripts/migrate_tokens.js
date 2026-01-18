import { initDb, query } from '../includes/database/index.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

// Initial DB connection
await initDb(config);

const migrateTokens = async () => {
    console.log('Starting token migration...');

    // Ensure table exists (in case migration didn't run automatically)
    await query(`
    CREATE TABLE IF NOT EXISTS google_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(50) UNIQUE NOT NULL,
      client_credentials TEXT,
      token TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

    const types = ['edu', 'non'];

    for (const type of types) {
        console.log(`Processing ${type} tokens...`);

        const clientSecretFile = type === 'edu'
            ? path.join(process.cwd(), 'TokenGGW', 'client_secret.json')
            : path.join(process.cwd(), 'TokenGGW', 'client_secret-v2.json');

        const tokenFile = type === 'edu'
            ? path.join(process.cwd(), 'TokenGGW', 'token.json')
            : path.join(process.cwd(), 'TokenGGW', 'token-v2.json');

        let credentialsContent = null;
        let tokenContent = null;

        if (fs.existsSync(clientSecretFile)) {
            credentialsContent = fs.readFileSync(clientSecretFile, 'utf8');
        } else {
            console.warn(`Warning: Client secret file not found for ${type}: ${clientSecretFile}`);
        }

        if (fs.existsSync(tokenFile)) {
            tokenContent = fs.readFileSync(tokenFile, 'utf8');
        } else {
            console.warn(`Warning: Token file not found for ${type}: ${tokenFile}`);
        }

        if (credentialsContent || tokenContent) {
            await query(`
        INSERT INTO google_tokens (type, client_credentials, token)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
        client_credentials = VALUES(client_credentials),
        token = VALUES(token)
      `, [type, credentialsContent, tokenContent]);
            console.log(`✅ Migrated ${type} tokens to database.`);
        } else {
            console.log(`ℹ️ No data found for ${type}, skipping.`);
        }
    }

    console.log('Migration completed.');
    process.exit(0);
};

migrateTokens().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
