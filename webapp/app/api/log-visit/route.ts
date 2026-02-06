import { NextResponse } from 'next/server';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lat, lon, display_name, address } = body;

        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = getAdminFromCookie(request) || 'Visitor';

        // Build location details
        const locationDetails = {
            lat,
            lon,
            display_name,
            address,
        };

        await logAdminAction({
            adminId: null,
            adminName,
            action: 'VISIT',
            targetType: 'WEBSITE',
            targetId: null,
            details: locationDetails,
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[LOG_VISIT] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to log visit' }, { status: 500 });
    }
}
