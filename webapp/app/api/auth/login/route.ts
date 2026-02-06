import { NextResponse } from 'next/server';
import { validateAdminCredentials, signJWT } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        const authResult = await validateAdminCredentials(username, password);

        if (authResult.isValid) {
            // Get current auth version from settings
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT `value` FROM settings WHERE `key` = 'admin_auth_version'"
            );
            const authVersion = rows.length > 0 ? parseInt(rows[0].value) || 0 : 0;

            // Generate JWT
            const token = await signJWT({
                username,
                role: authResult.role || 'admin',
                auth_version: authVersion
            });

            // Set Cookie
            const response = NextResponse.json({ success: true, role: authResult.role });

            // Set cookie for 3 days
            const expires = new Date();
            expires.setTime(expires.getTime() + 3 * 24 * 60 * 60 * 1000);

            response.cookies.set('auth_token', token, {
                expires: expires,
                httpOnly: true, // Secure it
                path: '/',
                sameSite: 'lax',
            });

            // Keep legacy cookies for compatibility/UI if needed, but the main auth is now JWT
            response.cookies.set('admin_role', authResult.role || 'admin', {
                expires: expires,
                httpOnly: false,
                path: '/',
                sameSite: 'lax',
            });

            response.cookies.set('admin_username', username, {
                expires: expires,
                httpOnly: false,
                path: '/',
                sameSite: 'lax',
            });

            return response;
        } else {
            return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }
    } catch (e: any) {
        console.error('Login error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
