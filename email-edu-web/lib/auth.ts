import pool from './db';
import { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';

export interface User {
    id: number;
    username: string;
    name: string;
    role: 'admin' | 'user';
    email_quota: number;
    emails_created: number;
    created_at: Date;
}

export async function validateLogin(username: string, password: string): Promise<User | null> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) return null;

        const user = rows[0];
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) return null;

        return {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            email_quota: user.email_quota,
            emails_created: user.emails_created,
            created_at: user.created_at,
        };
    } catch (error) {
        console.error('Login validation error:', error);
        return null;
    }
}

export async function registerUser(email: string, password: string, name: string): Promise<{ success: boolean; error?: string; userId?: number }> {
    try {
        // Check if email exists
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return { success: false, error: 'Email already exists' };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await pool.query(
            'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, "user")',
            [email, hashedPassword, name]
        );

        const insertResult = result as any;
        return { success: true, userId: insertResult.insertId };
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: 'Registration failed' };
    }
}

export async function getUserById(id: number): Promise<User | null> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, email, name, role, email_quota, emails_created, created_at FROM users WHERE id = ?',
            [id]
        );

        if (rows.length === 0) return null;

        const user = rows[0];
        return {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            email_quota: user.email_quota,
            emails_created: user.emails_created,
            created_at: user.created_at,
        };
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

export async function getUserFromCookie(userId: string | undefined): Promise<User | null> {
    if (!userId) return null;
    const id = parseInt(userId);
    if (isNaN(id)) return null;
    return getUserById(id);
}
