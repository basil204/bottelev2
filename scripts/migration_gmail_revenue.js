
import { createConnection } from 'mysql2/promise';
import config from '../config.js';

async function migrate() {
    try {
        console.log('Starting Gmail Revenue migration...');
        const connection = await createConnection({
            host: config.DB_HOST,
            user: config.DB_USER,
            password: config.DB_PASS,
            database: config.DB_NAME
        });

        console.log('Connected to database.');

        // Check gmail_accounts columns
        const [columns] = await connection.query("SHOW COLUMNS FROM gmail_accounts");
        const hasSoldPrice = columns.some(c => c.Field === 'sold_price');
        const hasOrderId = columns.some(c => c.Field === 'order_id');
        const hasSoldTo = columns.some(c => c.Field === 'sold_to_user_id');

        if (!hasSoldTo) {
            console.log("Adding column 'sold_to_user_id'...");
            await connection.query("ALTER TABLE gmail_accounts ADD COLUMN sold_to_user_id INT DEFAULT NULL"); // Should already exist probably
        }

        if (!hasSoldPrice) {
            console.log("Adding column 'sold_price'...");
            await connection.query("ALTER TABLE gmail_accounts ADD COLUMN sold_price DECIMAL(10, 2) DEFAULT NULL");
            console.log("Added 'sold_price' column.");

            // Backfill sold_price for existing sold accounts
            const [priceSetting] = await connection.query("SELECT `value` FROM settings WHERE `key` = 'gmail_edu_price'");
            const currentPrice = Number(priceSetting[0]?.value) || 10000;

            console.log(`Backfilling sold_price with current price (${currentPrice}) for already sold accounts...`);
            await connection.query("UPDATE gmail_accounts SET sold_price = ? WHERE status = 'sold' AND sold_price IS NULL", [currentPrice]);
        } else {
            console.log("'sold_price' column already exists.");
        }

        if (!hasOrderId) {
            console.log("Adding column 'order_id'...");
            await connection.query("ALTER TABLE gmail_accounts ADD COLUMN order_id VARCHAR(50) DEFAULT NULL");
            console.log("Added 'order_id' column.");
        } else {
            console.log("'order_id' column already exists.");
        }

        console.log('Migration completed successfully.');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
