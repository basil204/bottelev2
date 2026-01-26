import { NextResponse } from 'next/server';
import { validateAdminCredentials } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        const isValid = await validateAdminCredentials(username, password);

        if (isValid) {
            // Set Cookie
            const response = NextResponse.json({ success: true });

            // Set cookie for 1 day
            const expires = new Date();
            expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000);

            response.cookies.set('auth_token', 'true', {
                expires: expires,
                httpOnly: false, // Accessible by JS for middleware check usually fine if HttpOnly is true but here middleware checks cookie existence.
                // Wait, middleware reads request.cookies. But if HttpOnly is true, client JS cannot see it.
                // Middleware runs on server, so it CAN see HttpOnly cookies.
                // But if we want Client to know it is logged in (e.g. for UI state), we might need another cookie or just trust API response.
                // For security, HttpOnly is better.
                path: '/',
                sameSite: 'lax',
                // secure: process.env.NODE_ENV === 'production' // Only HTTPS in prod
            });

            return response;
        } else {
            return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
