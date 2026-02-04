/**
 * Migration script to add bot_status column to stored_accounts table
 * Run: node scripts/migration_bot_status.js
 */

import mysql from 'mysql2/promise';
import config from '../config.js';

async function migrate() {
    console.log('🚀 Starting migration: Add bot_status column...');

    const connection = await mysql.createConnection({
        host: config.DB_HOST,
        user: config.DB_USER,
        password: config.DB_PASS,
        database: config.DB_NAME
    });

    try {
        // Check if column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'stored_accounts' AND COLUMN_NAME = 'bot_status'
        `, [config.DB_NAME]);

        if (columns.length > 0) {
            console.log('⚠️  Column bot_status already exists. Skipping...');
        } else {
            // Add bot_status column
            await connection.query(`
                ALTER TABLE stored_accounts 
                ADD COLUMN bot_status ENUM('not_uploaded', 'uploaded') DEFAULT 'not_uploaded' AFTER sale_status
            `);
            console.log('✅ Added bot_status column to stored_accounts table');
        }

        console.log('🎉 Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await connection.end();
    }
}

migrate().catch(console.error);
