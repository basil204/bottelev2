
import { createConnection } from 'mysql2/promise';
import config from '../config.js';

async function migrate() {
    try {
        console.log('Starting Admin Logs migration...');
        const connection = await createConnection({
            host: config.DB_HOST,
            user: config.DB_USER,
            password: config.DB_PASS,
            database: config.DB_NAME
        });

        console.log('Connected to database.');

        // Create admin_logs table
        console.log("Creating admin_logs table if not exists...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT DEFAULT NULL,
                admin_name VARCHAR(100) DEFAULT NULL,
                action VARCHAR(50) NOT NULL,
                target_type VARCHAR(50) NOT NULL,
                target_id VARCHAR(100) DEFAULT NULL,
                details TEXT DEFAULT NULL,
                ip_address VARCHAR(50) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_id (admin_id),
                INDEX idx_action (action),
                INDEX idx_target_type (target_type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log("admin_logs table ready.");

        console.log('Migration completed successfully.');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
