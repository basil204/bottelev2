import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        let clientId = '';
        let clientSecret = '';

        // Read from DB settings
        const [settingsRows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('google_drive_client_id', 'google_drive_client_secret')"
        );
        settingsRows.forEach(r => {
            if (r.key === 'google_drive_client_id') clientId = r.value;
            if (r.key === 'google_drive_client_secret') clientSecret = r.value;
        });

        // Fallback to client_secret.json
        if (!clientId || !clientSecret) {
            const rootDir = process.cwd();
            const credPaths = [
                path.join(rootDir, 'database', 'google', 'client_secret.json'),
                path.join(rootDir, '..', 'database', 'google', 'client_secret.json')
            ];
            for (const cp of credPaths) {
                if (fs.existsSync(cp)) {
                    try {
                        const parsed = JSON.parse(fs.readFileSync(cp, 'utf8'));
                        const web = parsed.web || parsed.installed;
                        if (web) {
                            clientId = web.client_id;
                            clientSecret = web.client_secret;
                            break;
                        }
                    } catch (e) {}
                }
            }
        }

        if (!clientId || !clientSecret) {
            return NextResponse.json({
                error: 'Chưa có Client ID & Client Secret. Vui lòng nhập Client ID & Client Secret hoặc tải file client_secret.json lên trước!'
            }, { status: 400 });
        }

        // Get dynamic hostname
        const url = new URL(request.url);
        const protocol = url.protocol;
        const host = request.headers.get('host') || url.host;
        const redirectUri = `${protocol}//${host}/api/backup/drive/auth/callback`;

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: [
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file'
            ]
        });

        return NextResponse.redirect(authUrl);

    } catch (error: any) {
        console.error('[DRIVE_AUTH_INIT] Error:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khởi tạo đăng nhập Google' }, { status: 500 });
    }
}
