import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const runMigration = async () => {
    console.log('🔄 Starting migration...');

    // Lấy config từ biến môi trường
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'bot_ban_hang',
        port: process.env.DB_PORT || 3306,
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('✅ Connected to database.');

        // Check if column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chatgpt_fams' AND COLUMN_NAME = 'cookie'
        `, [config.database]);

        if (columns.length > 0) {
            console.log('⚠️ Column "cookie" already exists.');
        } else {
            console.log('➕ Adding column "cookie" to chatgpt_fams...');
            await connection.query(`
                ALTER TABLE chatgpt_fams 
                ADD COLUMN cookie TEXT NULL AFTER authorization
            `);
            console.log('✅ Migration completed successfully!');
        }

        await connection.end();
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    }
};

runMigration();
