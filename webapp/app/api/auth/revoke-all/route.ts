import { NextResponse } from 'next/server';
import dbPool from '@/lib/db';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';

export async function POST(request: Request) {
    try {
        // Only super_admin can revoke all tokens
        const cookieHeader = request.headers.get('cookie') || '';
        const adminRoleMatch = cookieHeader.match(/admin_role=([^;]+)/);
        const adminRole = adminRoleMatch ? adminRoleMatch[1] : 'admin';

        if (adminRole !== 'super_admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Increment admin_auth_version in settings
        await dbPool.query(
            "INSERT INTO settings (`key`, `value`) VALUES ('admin_auth_version', '1') ON DUPLICATE KEY UPDATE `value` = CAST(`value` AS UNSIGNED) + 1"
        );

        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'SYSTEM',
            details: 'Revoked all admin sessions (incremented auth_version)',
            request
        });

        return NextResponse.json({ success: true, message: 'All sessions revoked' });
    } catch (error: any) {
        console.error('Revoke All Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
