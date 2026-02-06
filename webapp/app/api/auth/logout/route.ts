import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });

    // Clear auth cookies
    response.cookies.set('auth_token', '', {
        expires: new Date(0),
        path: '/',
    });

    response.cookies.set('admin_role', '', {
        expires: new Date(0),
        path: '/',
    });

    response.cookies.set('admin_username', '', {
        expires: new Date(0),
        path: '/',
    });

    return response;
}
