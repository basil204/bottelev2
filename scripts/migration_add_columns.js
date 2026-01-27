
import { createConnection } from 'mysql2/promise';
import config from '../config.js';

async function migrate() {
    try {
        console.log('Starting migration...');
        const connection = await createConnection({
            host: config.DB_HOST,
            user: config.DB_USER,
            password: config.DB_PASS,
            database: config.DB_NAME
        });

        console.log('Connected to database.');

        // Check columns
        const [columns] = await connection.query("SHOW COLUMNS FROM accounts");
        const hasTwofa = columns.some(c => c.Field === 'twofa');
        const hasExtraData = columns.some(c => c.Field === 'extra_data');

        if (!hasTwofa) {
            console.log("Adding column 'twofa'...");
            await connection.query("ALTER TABLE accounts ADD COLUMN twofa VARCHAR(255) DEFAULT NULL");
            console.log("Added 'twofa' column.");
        } else {
            console.log("'twofa' column already exists.");
        }

        if (!hasExtraData) {
            console.log("Adding column 'extra_data'...");
            await connection.query("ALTER TABLE accounts ADD COLUMN extra_data TEXT DEFAULT NULL");
            console.log("Added 'extra_data' column.");
        } else {
            console.log("'extra_data' column already exists.");
        }

        console.log('Migration completed successfully.');
        await connection.end();
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

export default migrate;
