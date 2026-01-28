
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

        // Insert default USDT settings
        console.log("Checking USDT settings...");
        const [usdtSettings] = await connection.query("SELECT `key` FROM settings WHERE `key` IN ('usdt_wallet_address', 'usdt_network')");
        const existingKeys = usdtSettings.map(s => s.key);

        if (!existingKeys.includes('usdt_network')) {
            await connection.query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", ['usdt_network', 'BEP20']);
            console.log("Added default usdt_network.");
        }

        if (!existingKeys.includes('usdt_wallet_address')) {
            await connection.query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", ['usdt_wallet_address', 'Chưa cập nhật']);
            console.log("Added default usdt_wallet_address.");
        }

        // Check language column for users
        console.log("Checking language column...");
        const [userColumns] = await connection.query("SHOW COLUMNS FROM users");
        if (!userColumns.some(c => c.Field === 'language')) {
            console.log("Adding column 'language' to users...");
            await connection.query("ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'vi'");
            console.log("Added 'language' column.");
        }

        // Check exchange_rate setting
        console.log("Checking exchange_rate...");
        const [rateSetting] = await connection.query("SELECT `key` FROM settings WHERE `key` = 'exchange_rate'");
        if (rateSetting.length === 0) {
            console.log("Adding default exchange_rate...");
            await connection.query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", ['exchange_rate', '26000']);
            console.log("Added default exchange_rate.");
        }

        // Check type column in deposits
        console.log("Checking deposits.type column...");
        const [depositColumns] = await connection.query("SHOW COLUMNS FROM deposits");
        if (!depositColumns.some(c => c.Field === 'type')) {
            console.log("Adding column 'type' to deposits...");
            await connection.query("ALTER TABLE deposits ADD COLUMN type VARCHAR(10) DEFAULT 'bank'");
            console.log("Added 'type' column.");
            // Backfill existing USDT deposits
            console.log("Backfilling type for existing USDT deposits...");
            await connection.query("UPDATE deposits SET type = 'usdt' WHERE content LIKE '%BYBIT%' OR content LIKE '%USDT%'");
            console.log("Backfill complete.");
        }

        console.log('Migration completed successfully.');
        await connection.end();
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

export default migrate;
