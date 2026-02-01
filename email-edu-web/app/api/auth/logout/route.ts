import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true, message: 'Đăng xuất thành công' });

    // Clear all auth cookies
    response.cookies.set('auth_token', '', {
        expires: new Date(0),
        path: '/',
    });

    response.cookies.set('user_id', '', {
        expires: new Date(0),
        path: '/',
    });

    response.cookies.set('user_role', '', {
        expires: new Date(0),
        path: '/',
    });

    return response;
}
