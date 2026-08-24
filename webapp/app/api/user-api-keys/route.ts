import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';
import crypto from 'crypto';

// Helper: Ensure user_api_keys table exists
async function ensureApiKeysTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_api_keys (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            api_key VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(100) DEFAULT 'Gmail EDU API Key',
            is_active TINYINT(1) DEFAULT 1,
            last_used_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
}

// GET - Lấy danh sách API Keys
export async function GET(request: Request) {
    try {
        await ensureApiKeysTable();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        let whereClause = '';
        const params: any[] = [];

        if (search && search.trim()) {
            whereClause = 'WHERE u.username LIKE ? OR u.name LIKE ? OR CAST(u.telegram_id AS CHAR) LIKE ? OR k.api_key LIKE ?';
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT k.*, u.username, u.name as user_name, u.telegram_id, u.balance
            FROM user_api_keys k
            INNER JOIN users u ON k.user_id = u.id
            ${whereClause}
            ORDER BY k.created_at DESC
        `, params);

        return NextResponse.json(rows);
    } catch (error) {
        console.error('[API_KEYS_GET]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Tạo API Key mới cho User
export async function POST(request: Request) {
    try {
        await ensureApiKeysTable();
        const body = await request.json();
        const { userId, name } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (!userId) {
            return NextResponse.json({ error: 'Vui lòng chọn người dùng' }, { status: 400 });
        }

        // Verify user exists
        const [users] = await pool.query<RowDataPacket[]>('SELECT id, username, name FROM users WHERE id = ? LIMIT 1', [userId]);
        if (!users.length) {
            return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 400 });
        }

        // Generate unique secure API Key: sk_edu_<32 hex chars>
        const apiKey = `sk_edu_${crypto.randomBytes(16).toString('hex')}`;
        const keyName = name && name.trim() ? name.trim() : 'Gmail EDU API Key';

        const [res] = await pool.query<ResultSetHeader>(`
            INSERT INTO user_api_keys (user_id, api_key, name, is_active)
            VALUES (?, ?, ?, 1)
        `, [userId, apiKey, keyName]);

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'CREATE',
            targetType: 'SETTING',
            targetId: res.insertId,
            details: { userId, apiKey, keyName },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({
            success: true,
            id: res.insertId,
            api_key: apiKey,
            name: keyName,
            message: 'Đã tạo API Key mới thành công'
        });
    } catch (error: any) {
        console.error('[API_KEYS_POST]', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH - Bật/Tắt trạng thái API Key
export async function PATCH(request: Request) {
    try {
        await ensureApiKeysTable();
        const body = await request.json();
        const { id, is_active } = body;
        const adminName = await getAdminFromCookie(request);

        if (!id) return NextResponse.json({ error: 'Missing API Key ID' }, { status: 400 });

        const nextActive = is_active ? 1 : 0;
        await pool.query('UPDATE user_api_keys SET is_active = ? WHERE id = ?', [nextActive, id]);

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'SETTING',
            targetId: id,
            details: { is_active: nextActive },
            request
        });

        return NextResponse.json({ success: true, is_active: nextActive });
    } catch (error) {
        console.error('[API_KEYS_PATCH]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE - Xóa API Key
export async function DELETE(request: Request) {
    try {
        await ensureApiKeysTable();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await pool.query('DELETE FROM user_api_keys WHERE id = ?', [id]);
        return NextResponse.json({ success: true, message: 'Đã xóa API Key' });
    } catch (error) {
        console.error('[API_KEYS_DELETE]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
