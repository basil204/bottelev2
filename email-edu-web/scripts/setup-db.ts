import 'dotenv/config';
import pool from '../lib/db';
import bcrypt from 'bcryptjs';

async function setupDatabase() {
    console.log('🔧 Setting up database...\n');

    try {
        // Create users table
        console.log('Creating users table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(100),
                role ENUM('admin', 'user') DEFAULT 'user',
                email_quota INT DEFAULT 10,
                emails_created INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_username (username),
                INDEX idx_role (role)
            )
        `);
        console.log('✅ users table ready\n');

        // Create edu_domains table
        console.log('Creating edu_domains table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS edu_domains (
                id INT PRIMARY KEY AUTO_INCREMENT,
                domain VARCHAR(255) UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_active (is_active)
            )
        `);
        console.log('✅ edu_domains table ready\n');

        // Create edu_emails table
        console.log('Creating edu_emails table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS edu_emails (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                domain_id INT NOT NULL,
                delete_at TIMESTAMP NULL,
                status ENUM('active', 'deleted') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (domain_id) REFERENCES edu_domains(id) ON DELETE RESTRICT,
                INDEX idx_user (user_id),
                INDEX idx_status (status),
                INDEX idx_delete_at (delete_at)
            )
        `);
        console.log('✅ edu_emails table ready\n');

        // Create settings table
        console.log('Creating settings table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                \`key\` VARCHAR(100) PRIMARY KEY,
                \`value\` TEXT
            )
        `);
        console.log('✅ settings table ready\n');

        // Insert default domains
        console.log('Inserting default domains...');
        await pool.query(`INSERT IGNORE INTO edu_domains (domain) VALUES ('suafpoly.app')`);
        await pool.query(`INSERT IGNORE INTO edu_domains (domain) VALUES ('student.edu.vn')`);
        await pool.query(`INSERT IGNORE INTO edu_domains (domain) VALUES ('fpoly.edu.vn')`);
        console.log('✅ Default domains inserted\n');

        // Insert default settings
        console.log('Inserting default settings...');
        await pool.query(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('default_email_quota', '10')`);
        await pool.query(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('default_delete_hours', '24')`);
        console.log('✅ Default settings inserted\n');

        // Check and create admin user
        console.log('Checking admin user...');
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']) as any;

        if (existing.length === 0) {
            const hashedPassword = await bcrypt.hash('admin', 10);
            await pool.query(
                'INSERT INTO users (username, password, name, role, email_quota) VALUES (?, ?, ?, ?, ?)',
                ['admin', hashedPassword, 'Administrator', 'admin', 9999]
            );
            console.log('✅ Admin user created');
            console.log('   Username: admin');
            console.log('   Password: admin\n');
        } else {
            console.log('✅ Admin user already exists\n');
        }

        console.log('🎉 Database setup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error setting up database:', error);
        process.exit(1);
    }
}

setupDatabase();
