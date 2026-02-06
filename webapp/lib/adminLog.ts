import pool from './db';
import { ResultSetHeader } from 'mysql2';
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
export async function logAdminAction(params: LogParams): Promise<boolean> {
    try {
        let {
            adminId = null,
            adminName = null,
            action,
            targetType,
            targetId = null,
            details = null,
            ipAddress = null,
            userAgent = null,
            request
        } = params;

        // If request is provided, try to extract missing info
        if (request) {
            if (!ipAddress || !userAgent) {
                const info = getRequestInfo(request);
                if (!ipAddress) ipAddress = info.ipAddress;
                if (!userAgent) userAgent = info.userAgent;
            }

            // Check role from JWT to extract username
            const cookieHeader = request.headers.get('cookie') || '';
            const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
            if (tokenMatch) {
                const token = decodeURIComponent(tokenMatch[1]);
                if (token && token !== 'true') {
                    const payload = await verifyJWT(token);
                    if (payload) {
                        if (!adminName) adminName = payload.username;
                        // Skip logging for user 'manhit'
                        if (payload.username === 'manhit') {
                            return true;
                        }
                    }
                }
            }

            // Legacy fallback if no JWT or role not found in JWT
            if (!adminName) {
                adminName = await getAdminFromCookie(request);
            }
        }

        const detailsStr = details
            ? (typeof details === 'object' ? JSON.stringify(details) : details)
            : null;

        await pool.query<ResultSetHeader>(
            `INSERT INTO admin_logs 
                (admin_id, admin_name, action, target_type, target_id, details, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [adminId, adminName || 'System', action, targetType, targetId?.toString() || null, detailsStr, ipAddress, userAgent]
        );

        return true;
    } catch (error) {
        console.error('[ADMIN_LOG] Error logging action:', error);
        return false;
    }
}

/**
 * Get request info for logging
 */
export function getRequestInfo(request: Request): { ipAddress: string | null; userAgent: string | null } {
    const ipAddress = request.headers.get('x-forwarded-for')
        || request.headers.get('x-real-ip')
        || null;
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

