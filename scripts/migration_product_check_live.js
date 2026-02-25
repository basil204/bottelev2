
import { createConnection } from 'mysql2/promise';
import config from '../config.js';

async function migrate() {
    try {
        const connection = await createConnection({
            host: config.DB_HOST,
            user: config.DB_USER,
            password: config.DB_PASS,
            database: config.DB_NAME
        });

        console.log('Migrating products table...');

        // Check if column already exists
        const [columns] = await connection.query("SHOW COLUMNS FROM products LIKE 'check_live'");
        if (columns.length === 0) {
            await connection.query("ALTER TABLE products ADD COLUMN check_live TINYINT(1) DEFAULT 0");
            console.log('✅ Added check_live column to products table.');
        } else {
            console.log('ℹ️ check_live column already exists.');
        }

        await connection.end();
        console.log('Migration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
