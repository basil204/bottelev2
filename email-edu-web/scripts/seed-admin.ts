import pool from '../lib/db';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
    try {
        // Hash password 'admin'
        const hashedPassword = await bcrypt.hash('admin', 10);

        // Check if admin exists
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE username = ?',
            ['admin']
        ) as any;

        if (existing.length > 0) {
            console.log('Admin account already exists');
            process.exit(0);
        }

        // Insert admin user
        await pool.query(
            'INSERT INTO users (username, password, name, role, email_quota) VALUES (?, ?, ?, ?, ?)',
            ['admin', hashedPassword, 'Administrator', 'admin', 9999]
        );

        console.log('✅ Admin account created successfully!');
        console.log('Username: admin');
        console.log('Password: admin');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
}

seedAdmin();
