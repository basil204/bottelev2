import pool from './db';
import { ResultSetHeader } from 'mysql2';

export type AdminAction =
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'VIEW'
    | 'LOGIN'
    | 'LOGOUT'
    | 'APPROVE'
    | 'REJECT'
    | 'BROADCAST';

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
    | 'SYSTEM';

interface LogParams {
    adminId?: number | null;
    adminName?: string | null;
    action: AdminAction;
    targetType: TargetType;
    targetId?: string | number | null;
    details?: string | object | null;
    ipAddress?: string | null;
    userAgent?: string | null;
}

/**
 * Log admin activity
 */
export async function logAdminAction(params: LogParams): Promise<boolean> {
    try {
        const {
            adminId = null,
            adminName = null,
            action,
            targetType,
            targetId = null,
            details = null,
            ipAddress = null,
            userAgent = null
        } = params;

        const detailsStr = details
            ? (typeof details === 'object' ? JSON.stringify(details) : details)
            : null;

        await pool.query<ResultSetHeader>(
            `INSERT INTO admin_logs 
                (admin_id, admin_name, action, target_type, target_id, details, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [adminId, adminName, action, targetType, targetId?.toString() || null, detailsStr, ipAddress, userAgent]
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

export default { logAdminAction, getRequestInfo };
