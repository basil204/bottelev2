import { NextResponse } from 'next/server';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';

export async function POST(request: Request) {
    // Log action before clearing cookies
    const adminName = await getAdminFromCookie(request);
    await logAdminAction({
        adminName: adminName || 'System',
        action: 'LOGOUT',
        targetType: 'SYSTEM',
        details: 'Admin logged out',
        request
    });

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
