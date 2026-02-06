import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

// Check if request is from super_admin
function isSuperAdmin(request: Request): boolean {
    const cookieHeader = request.headers.get('cookie') || '';
    const adminRoleMatch = cookieHeader.match(/admin_role=([^;]+)/);
    const adminRole = adminRoleMatch ? adminRoleMatch[1] : 'admin';
    return adminRole === 'super_admin';
}

// GET - List all admin accounts
export async function GET(request: Request) {
    if (!isSuperAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, fullname, username, role FROM admin_accounts ORDER BY id ASC'
        );
        return NextResponse.json(rows);
    } catch (error: any) {
        // If table doesn't exist, create it
        if (error.code === 'ER_NO_SUCH_TABLE') {
            await pool.query(`
                CREATE TABLE admin_accounts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fullname VARCHAR(255),
                    username VARCHAR(255) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    role ENUM('super_admin', 'admin') NOT NULL DEFAULT 'admin',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            // Migrate existing admin accounts from settings
            const [settings] = await pool.query<RowDataPacket[]>(
                "SELECT `key`, `value` FROM settings WHERE `key` IN ('admin_fullname', 'admin_username', 'admin_password', 'admin_fullname2', 'admin_username2', 'admin_password2')"
            );

            const settingsMap: Record<string, string> = {};
            settings.forEach((row: any) => {
                settingsMap[row.key] = row.value;
            });

            // Insert super admin
            if (settingsMap['admin_username'] && settingsMap['admin_password']) {
                await pool.query(
                    'INSERT INTO admin_accounts (fullname, username, password, role) VALUES (?, ?, ?, ?)',
                    [settingsMap['admin_fullname'] || '', settingsMap['admin_username'], settingsMap['admin_password'], 'super_admin']
                );
            }

            // Insert admin 2
            if (settingsMap['admin_username2'] && settingsMap['admin_password2']) {
                await pool.query(
                    'INSERT INTO admin_accounts (fullname, username, password, role) VALUES (?, ?, ?, ?)',
                    [settingsMap['admin_fullname2'] || '', settingsMap['admin_username2'], settingsMap['admin_password2'], 'admin']
                );
            }

            const [newRows] = await pool.query<RowDataPacket[]>(
                'SELECT id, fullname, username, role FROM admin_accounts ORDER BY id ASC'
            );
            return NextResponse.json(newRows);
        }

        console.error('Error fetching admin accounts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Create new admin account
export async function POST(request: Request) {
    if (!isSuperAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { fullname, username, password, role } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!username || !password) {
            return NextResponse.json({ error: 'Username và password là bắt buộc' }, { status: 400 });
        }

        // Check if username already exists
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM admin_accounts WHERE username = ?',
            [username]
        );

        if (existing.length > 0) {
            return NextResponse.json({ error: 'Username đã tồn tại' }, { status: 400 });
        }

        await pool.query(
            'INSERT INTO admin_accounts (fullname, username, password, role) VALUES (?, ?, ?, ?)',
            [fullname || '', username, password, role || 'admin']
        );

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'ADMIN_ACCOUNT',
            details: { username, role },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error creating admin account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT - Update admin account
export async function PUT(request: Request) {
    if (!isSuperAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const body = await request.json();
        const { fullname, username, password, role } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // Check if username is taken by another account
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM admin_accounts WHERE username = ? AND id != ?',
            [username, id]
        );

        if (existing.length > 0) {
            return NextResponse.json({ error: 'Username đã được sử dụng bởi tài khoản khác' }, { status: 400 });
        }

        // If password is provided, update it too
        if (password) {
            await pool.query(
                'UPDATE admin_accounts SET fullname = ?, username = ?, password = ?, role = ? WHERE id = ?',
                [fullname || '', username, password, role || 'admin', id]
            );
        } else {
            await pool.query(
                'UPDATE admin_accounts SET fullname = ?, username = ?, role = ? WHERE id = ?',
                [fullname || '', username, role || 'admin', id]
            );
        }

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'ADMIN_ACCOUNT',
            targetId: Number(id),
            details: { username, role },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating admin account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE - Delete admin account
export async function DELETE(request: Request) {
    if (!isSuperAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const { ipAddress, userAgent } = getRequestInfo(request);

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // Prevent deleting the last super_admin
        const [superAdmins] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM admin_accounts WHERE role = 'super_admin'"
        );

        const [targetAccount] = await pool.query<RowDataPacket[]>(
            'SELECT role FROM admin_accounts WHERE id = ?',
            [id]
        );

        if (targetAccount.length > 0 && targetAccount[0].role === 'super_admin' && superAdmins.length <= 1) {
            return NextResponse.json({ error: 'Không thể xóa Super Admin cuối cùng' }, { status: 400 });
        }

        await pool.query('DELETE FROM admin_accounts WHERE id = ?', [id]);

        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'DELETE',
            targetType: 'ADMIN_ACCOUNT',
            targetId: Number(id),
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting admin account:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
