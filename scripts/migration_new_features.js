/**
 * Migration script: Add new features
 * - Add 'code' column to stored_accounts
 * - Add 'sold_to_user_id' column to stored_accounts  
 * - Update payment_status ENUM to add 'package_error', 'wrong_info'
 * - Add 'code' column to products
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'telegram_bot'
    });

    console.log('Connected to database. Running migration...\n');

    try {
        // 1. Add 'code' column to stored_accounts
        console.log('1. Adding "code" column to stored_accounts...');
        try {
            await connection.query(`
                ALTER TABLE stored_accounts 
                ADD COLUMN code VARCHAR(100) NULL AFTER data
            `);
            console.log('   ✓ Added "code" column to stored_accounts');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('   - Column "code" already exists in stored_accounts');
            } else {
                throw e;
            }
        }

        // 2. Add 'sold_to_user_id' column to stored_accounts
        console.log('2. Adding "sold_to_user_id" column to stored_accounts...');
        try {
            await connection.query(`
                ALTER TABLE stored_accounts 
                ADD COLUMN sold_to_user_id INT NULL AFTER sold_at
            `);
            console.log('   ✓ Added "sold_to_user_id" column to stored_accounts');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('   - Column "sold_to_user_id" already exists in stored_accounts');
            } else {
                throw e;
            }
        }

        // 3. Update payment_status ENUM to add new values
        console.log('3. Updating payment_status ENUM...');
        try {
            await connection.query(`
                ALTER TABLE stored_accounts 
                MODIFY COLUMN payment_status ENUM('pending', 'paid', 'invalid', 'package_error', 'wrong_info') DEFAULT 'pending'
            `);
            console.log('   ✓ Updated payment_status ENUM with "package_error", "wrong_info"');
        } catch (e) {
            console.log('   - Error updating ENUM:', e.message);
        }

        // 4. Add 'code' column to products
        console.log('4. Adding "code" column to products...');
        try {
            await connection.query(`
                ALTER TABLE products 
                ADD COLUMN code VARCHAR(100) NULL AFTER name
            `);
            console.log('   ✓ Added "code" column to products');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('   - Column "code" already exists in products');
            } else {
                throw e;
            }
        }

        // 5. Add index for sold_to_user_id
        console.log('5. Adding index for sold_to_user_id...');
        try {
            await connection.query(`
                ALTER TABLE stored_accounts 
                ADD INDEX idx_sold_to_user (sold_to_user_id)
            `);
            console.log('   ✓ Added index idx_sold_to_user');
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') {
                console.log('   - Index idx_sold_to_user already exists');
            } else {
                console.log('   - Error adding index:', e.message);
            }
        }

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
    } finally {
        await connection.end();
    }
}

migrate();
