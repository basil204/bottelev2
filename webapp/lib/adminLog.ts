import { verifyJWT } from '../lib-edge/jwt';

export type AdminAction =
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'VIEW'
    | 'LOGIN'
    | 'LOGOUT'
    | 'APPROVE'
    | 'REJECT'
    | 'BROADCAST'
    | 'VISIT';

export type TargetType =
    | 'USER'
    | 'PRODUCT'
    | 'ORDER'
    | 'DEPOSIT'
    | 'SETTING'
    | 'PROMOTION'
    | 'ACCOUNT_TYPE'
    | 'STORED_ACCOUNT'
    | 'GMAIL_ACCOUNT'
    | 'BROADCAST'
    | 'ADMIN_ACCOUNT'
    | 'SYSTEM'
    | 'WEBSITE';

interface LogParams {
    adminId?: number | null;
    adminName?: string | null;
    action: AdminAction;
    targetType: TargetType;
    targetId?: string | number | null;
    details?: string | object | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    request?: Request; // Optional request to extract info from
}

/**
 * Log admin activity
 */
export async function logAdminAction(_params: LogParams): Promise<boolean> {
    // Admin activity logging is intentionally disabled.
    return true;
}

/**
 * Get request info for logging
 */
export function getRequestInfo(request: Request): { ipAddress: string | null; userAgent: string | null } {
    const rawIp = request.headers.get('x-forwarded-for')
        || request.headers.get('x-real-ip')
        || null;

    // Take the first IP if it's a comma-separated list (from proxies like Cloudflare/Nginx)
    const ipAddress = rawIp ? rawIp.split(',')[0].trim() : null;
    const userAgent = request.headers.get('user-agent') || null;

    return { ipAddress, userAgent };
}


/**
 * Get admin username from JWT or legacy cookie
 */
export async function getAdminFromCookie(request: Request): Promise<string | null> {
    const cookieHeader = request.headers.get('cookie') || '';

    // 1. Try to get from JWT first (the new way)
    const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
    if (tokenMatch) {
        const token = decodeURIComponent(tokenMatch[1]);
        if (token && token !== 'true') { // Transition check
            const payload = await verifyJWT(token);
            if (payload && payload.username) {
                return payload.username;
            }
        }
    }

    // 2. Fallback to legacy admin_username cookie
    const adminNameMatch = cookieHeader.match(/admin_username=([^;]+)/);
    return adminNameMatch ? decodeURIComponent(adminNameMatch[1]) : null;
}

export default { logAdminAction, getRequestInfo, getAdminFromCookie };

