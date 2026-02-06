import { NextResponse } from 'next/server';
import { validateAdminCredentials } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        const authResult = await validateAdminCredentials(username, password);

        if (authResult.isValid) {
            // Set Cookie
            const response = NextResponse.json({ success: true, role: authResult.role });

            // Set cookie for 1 day
            const expires = new Date();
            expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000);

            response.cookies.set('auth_token', 'true', {
                expires: expires,
                httpOnly: false,
                path: '/',
                sameSite: 'lax',
            });

            // Set admin role cookie
            response.cookies.set('admin_role', authResult.role || 'admin', {
                expires: expires,
                httpOnly: false,
                path: '/',
                sameSite: 'lax',
            });

            // Set admin username cookie for logging
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
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
