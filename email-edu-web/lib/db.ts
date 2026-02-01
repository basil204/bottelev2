import { createPool, Pool } from 'mysql2/promise';

const pool = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
});

// Flag to track if migration has run
let migrationRun = false;

// Auto-migrate: create tables if not exist
export async function initDatabase() {
    if (migrationRun) return;
    migrationRun = true;

    try {
        const connection = await pool.getConnection();
        console.log('[DB] Connected to database:', process.env.DB_NAME);

        // Create tables if not exist
        const createTablesSQL = `
            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(100),
                role ENUM('admin', 'user') DEFAULT 'user',
                email_quota INT DEFAULT 10,
                emails_created INT DEFAULT 0,
                twofa_secret VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_username (username),
                INDEX idx_role (role)
            );

            -- EDU domains table
            CREATE TABLE IF NOT EXISTS edu_domains (
                id INT PRIMARY KEY AUTO_INCREMENT,
                domain VARCHAR(255) UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_active (is_active)
            );

            -- EDU emails table
            CREATE TABLE IF NOT EXISTS edu_emails (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                domain_id INT NOT NULL,
                delete_at TIMESTAMP NULL,
                deleted_at TIMESTAMP NULL,
                status ENUM('active', 'deleted') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_status (status),
                INDEX idx_delete_at (delete_at),
                INDEX idx_deleted_at (deleted_at)
            );

            -- Settings table
            CREATE TABLE IF NOT EXISTS settings (
                \`key\` VARCHAR(100) PRIMARY KEY,
                \`value\` TEXT
            );

            -- tMail domains table
            CREATE TABLE IF NOT EXISTS tmail_domains (
                id INT PRIMARY KEY AUTO_INCREMENT,
                domain VARCHAR(255) UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_active (is_active)
            );

            -- tMail accounts table
            CREATE TABLE IF NOT EXISTS tmail_accounts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                account_id VARCHAR(100),
                domain VARCHAR(100) DEFAULT 'fthcapital.com',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_email (email)
            );

            -- 2FA items table
            CREATE TABLE IF NOT EXISTS twofa_items (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                secret VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id)
            );
        `;

        await connection.query(createTablesSQL);
        console.log('[DB] ✅ Tables checked/created successfully');

        // Insert default settings if not exist
        const defaultSettings = [
            ['default_email_quota', '10'],
            ['default_delete_hours', '24'],
            ['auto_cleanup_days', '3'],
        ];

        for (const [key, value] of defaultSettings) {
            await connection.query(
                'INSERT IGNORE INTO settings (`key`, `value`) VALUES (?, ?)',
                [key, value]
            );
        }

        // Insert default domains if not exist
        const defaultDomains = ['suafpoly.app', 'student.edu.vn', 'fpoly.edu.vn'];
        for (const domain of defaultDomains) {
            await connection.query(
                'INSERT IGNORE INTO edu_domains (domain) VALUES (?)',
                [domain]
            );
        }

        // Insert default tMail domain
        await connection.query(
            'INSERT IGNORE INTO tmail_domains (domain) VALUES (?)',
            ['fthcapital.com']
        );

        console.log('[DB] ✅ Default data initialized');
        connection.release();
    } catch (error) {
        console.error('[DB] ❌ Migration error:', error);
    }
}

// Run migration on first import
initDatabase();

export default pool;
