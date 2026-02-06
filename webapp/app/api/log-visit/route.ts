import { NextResponse } from 'next/server';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';
import { verifyJWT } from '@/lib-edge/jwt';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lat, lon, display_name, address } = body;

        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = (await getAdminFromCookie(request)) || 'Visitor';

        // Check role from JWT
        let role = 'admin';
        const cookieHeader = request.headers.get('cookie') || '';
        const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
        if (tokenMatch) {
            const token = decodeURIComponent(tokenMatch[1]);
            if (token && token !== 'true') {
                const payload = await verifyJWT(token);
                if (payload) {
                    role = payload.role;
                }
            }
        }

        // Build location details - full details for all admins
        const locationDetails = { lat, lon, display_name, address };

        await logAdminAction({
            adminId: null,
            adminName,
            action: 'VISIT',
            targetType: 'WEBSITE',
            targetId: null,
            details: locationDetails,
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[LOG_VISIT] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to log visit' }, { status: 500 });
    }
}
