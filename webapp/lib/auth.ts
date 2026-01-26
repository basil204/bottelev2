import pool from './db';
import { RowDataPacket } from 'mysql2';

export async function validateAdminCredentials(username?: string, password?: string): Promise<boolean> {
    if (!username || !password) return false;

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('admin_username', 'admin_password')"
        );

        let dbUser = '';
        let dbPass = '';

        rows.forEach((r: any) => {
            if (r.key === 'admin_username') dbUser = r.value;
            if (r.key === 'admin_password') dbPass = r.value;
        });

        // If fetch failed or keys missing, fail safe
        if (!dbUser || !dbPass) {
            // Fallback for initial setup if needed? Or just fail. 
            // For security, if not set in DB, no one can login.
            return false;
        }

        return username === dbUser && password === dbPass;
    } catch (error) {
        console.error('Validate Admin Error:', error);
        return false;
    }
}
