import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';
import crypto from 'crypto';

// Helper: Ensure user_api_keys table and columns exist
async function ensureApiKeysTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                api_key VARCHAR(100) NOT NULL UNIQUE,
                name VARCHAR(100) DEFAULT 'Gmail EDU API Key',
                is_active TINYINT(1) DEFAULT 1,
                last_used_at DATETIME NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Safe add missing columns
        const safeAddColumn = async (column: string, colDef: string) => {
            try {
                const [cols] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM user_api_keys LIKE ?', [column]);
                if (!cols.length) {
                    await pool.query(`ALTER TABLE user_api_keys ADD COLUMN ${column} ${colDef}`);
                }
            } catch (e) {}
        };

        await safeAddColumn('name', "VARCHAR(100) DEFAULT 'Gmail EDU API Key'");
        await safeAddColumn('is_active', 'TINYINT(1) DEFAULT 1');

        // Safe add users.name column if missing
        try {
            const [uCols] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM users LIKE ?', ['name']);
            if (!uCols.length) {
                await pool.query('ALTER TABLE users ADD COLUMN name VARCHAR(255) NULL');
            }
        } catch (e) {}
    } catch (e) {
        console.error('[ENSURE_API_KEYS_TABLE_ERR]', e);
    }
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
            whereClause = 'WHERE u.username LIKE ? OR CAST(u.telegram_id AS CHAR) LIKE ? OR k.api_key LIKE ?';
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT k.*, u.username, u.telegram_id, u.balance,
                   COALESCE(u.username, CAST(u.id AS CHAR)) as user_name
            FROM user_api_keys k
            INNER JOIN users u ON k.user_id = u.id
            ${whereClause}
            ORDER BY k.created_at DESC
        `, params);

        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('[API_KEYS_GET]', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Tạo/Cập nhật API Key mới cho User
export async function POST(request: Request) {
    try {
        await ensureApiKeysTable();
        const body = await request.json();
        const { userId, name } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        const targetId = parseInt(userId, 10);
        if (!targetId || isNaN(targetId)) {
            return NextResponse.json({ error: 'Vui lòng truyền ID người dùng hợp lệ' }, { status: 400 });
        }

        // Verify user exists by id OR telegram_id
        const [users] = await pool.query<RowDataPacket[]>(
            'SELECT id, username FROM users WHERE id = ? OR telegram_id = ? LIMIT 1',
            [targetId, targetId]
        );

        if (!users.length) {
            return NextResponse.json({ error: 'Người dùng không tồn tại trong CSDL' }, { status: 404 });
        }

        const realUser = users[0];
        const apiKey = `sk_edu_${crypto.randomBytes(16).toString('hex')}`;
        const keyName = name && name.trim() ? name.trim() : 'Gmail EDU API Key';

        // Check if user already has an API Key
        const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM user_api_keys WHERE user_id = ? LIMIT 1',
            [realUser.id]
        );

        let insertId = 0;
        if (existing.length) {
            insertId = existing[0].id;
            await pool.query(
                'UPDATE user_api_keys SET api_key = ?, name = ?, is_active = 1, created_at = NOW() WHERE id = ?',
                [apiKey, keyName, insertId]
            );
        } else {
            const [res] = await pool.query<ResultSetHeader>(`
                INSERT INTO user_api_keys (user_id, api_key, name, is_active)
                VALUES (?, ?, ?, 1)
            `, [realUser.id, apiKey, keyName]);
            insertId = res.insertId;
        }

        try {
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'CREATE',
                targetType: 'SETTING',
                targetId: insertId,
                details: { userId: realUser.id, apiKey, keyName },
                ipAddress,
                userAgent,
                request
            });
        } catch (e) {}

        return NextResponse.json({
            success: true,
            id: insertId,
            api_key: apiKey,
            name: keyName,
            message: 'Đã tạo/đổi API Key mới thành công'
        });
    } catch (error: any) {
        console.error('[API_KEYS_POST]', error);
        return NextResponse.json({ error: error.message || 'Lỗi hệ thống khi tạo API Key' }, { status: 500 });
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

        try {
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SETTING',
                targetId: id,
                details: { is_active: nextActive },
                request
            });
        } catch (e) {}

        return NextResponse.json({ success: true, is_active: nextActive });
    } catch (error: any) {
        console.error('[API_KEYS_PATCH]', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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
    } catch (error: any) {
        console.error('[API_KEYS_DELETE]', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
