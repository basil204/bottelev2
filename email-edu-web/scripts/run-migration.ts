import 'dotenv/config';
import pool from '../lib/db';

async function runMigration() {
    console.log('Running migration...');

    try {
        // Add deleted_at column to edu_emails (may already exist)
        try {
            await pool.query(`
                ALTER TABLE edu_emails ADD COLUMN deleted_at TIMESTAMP NULL AFTER delete_at
            `);
            console.log('✓ Added deleted_at column to edu_emails');
        } catch (err: any) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('→ deleted_at column already exists');
            } else {
                throw err;
            }
        }

        // Add index for deleted_at (may already exist)
        try {
            await pool.query(`CREATE INDEX idx_deleted_at ON edu_emails(deleted_at)`);
            console.log('✓ Created index idx_deleted_at');
        } catch (err: any) {
            if (err.code === 'ER_DUP_KEYNAME') {
                console.log('→ Index idx_deleted_at already exists');
            } else {
                throw err;
            }
        }

        // Add auto_cleanup_days setting
        await pool.query(`
            INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('auto_cleanup_days', '3')
        `);
        console.log('✓ Added auto_cleanup_days setting');

        // Create tmail_domains table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tmail_domains (
                id INT PRIMARY KEY AUTO_INCREMENT,
                domain VARCHAR(255) UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_active (is_active)
            )
        `);
        console.log('✓ Created tmail_domains table');

        // Insert default tMail domain
        await pool.query(`
            INSERT IGNORE INTO tmail_domains (domain) VALUES ('fthcapital.com')
        `);
        console.log('✓ Added default tMail domain');

        // Create tmail_accounts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tmail_accounts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                account_id VARCHAR(100),
                domain VARCHAR(100) DEFAULT 'fthcapital.com',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user (user_id),
                INDEX idx_email (email)
            )
        `);
        console.log('✓ Created tmail_accounts table');

        // Add 2fa_secret column to edu_emails (may already exist)
        try {
            await pool.query(`
                ALTER TABLE edu_emails ADD COLUMN 2fa_secret VARCHAR(255) NULL AFTER password
            `);
            console.log('✓ Added 2fa_secret column to edu_emails');
        } catch (err: any) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('→ 2fa_secret column already exists');
            } else {
                throw err;
            }
        }

        // Create twofa_items table for standalone 2FA feature
        await pool.query(`
            CREATE TABLE IF NOT EXISTS twofa_items (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                secret VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user (user_id)
            )
        `);
        console.log('✓ Created twofa_items table');

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
