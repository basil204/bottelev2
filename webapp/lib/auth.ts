import pool from './db';
import { RowDataPacket } from 'mysql2';

export async function validateAdminCredentials(username?: string, password?: string): Promise<boolean> {
    if (!username || !password) return false;

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('admin_username', 'admin_password', 'admin_username2', 'admin_password2')"
        );

        let dbUser1 = '';
        let dbPass1 = '';
        let dbUser2 = '';
        let dbPass2 = '';

        rows.forEach((r: any) => {
            if (r.key === 'admin_username') dbUser1 = r.value;
            if (r.key === 'admin_password') dbPass1 = r.value;
            if (r.key === 'admin_username2') dbUser2 = r.value;
            if (r.key === 'admin_password2') dbPass2 = r.value;
        });

        // Check admin 1 credentials
        if (dbUser1 && dbPass1 && username === dbUser1 && password === dbPass1) {
            return true;
        }

        // Check admin 2 credentials
        if (dbUser2 && dbPass2 && username === dbUser2 && password === dbPass2) {
            return true;
        }

        return false;
    } catch (error) {
        console.error('Validate Admin Error:', error);
        return false;
    }
}
