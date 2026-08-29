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
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
            return NextResponse.redirect(new URL(`/settings?tab=backup&auth_error=${encodeURIComponent(error)}`, request.url));
        }

        if (!code) {
            return NextResponse.redirect(new URL('/settings?tab=backup&auth_error=missing_code', request.url));
        }

        let clientId = '';
        let clientSecret = '';

        const [settingsRows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('google_drive_client_id', 'google_drive_client_secret')"
        );
        settingsRows.forEach(r => {
            if (r.key === 'google_drive_client_id') clientId = r.value;
            if (r.key === 'google_drive_client_secret') clientSecret = r.value;
        });

        if (!clientId || !clientSecret) {
            const rootDir = process.cwd();
            const cp = path.join(rootDir, 'database', 'google', 'client_secret.json');
            if (fs.existsSync(cp)) {
                try {
                    const parsed = JSON.parse(fs.readFileSync(cp, 'utf8'));
                    const web = parsed.web || parsed.installed;
                    if (web) {
                        clientId = web.client_id;
                        clientSecret = web.client_secret;
                    }
                } catch (e) {}
            }
        }

        const protocol = url.protocol;
        const host = request.headers.get('host') || url.host;
        const redirectUri = `${protocol}//${host}/api/backup/drive/auth/callback`;

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const { tokens } = await oauth2Client.getToken(code);

        if (tokens.refresh_token) {
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES ('google_drive_refresh_token', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [tokens.refresh_token, tokens.refresh_token]
            );
        }

        // Save tokens to drive_token.json file locally
        const googleDir = path.join(process.cwd(), 'database', 'google');
        if (!fs.existsSync(googleDir)) {
            fs.mkdirSync(googleDir, { recursive: true });
        }
        const driveTokenPath = path.join(googleDir, 'drive_token.json');
        fs.writeFileSync(driveTokenPath, JSON.stringify(tokens, null, 2), 'utf8');

        return NextResponse.redirect(new URL('/settings?tab=backup&auth=success', request.url));

    } catch (err: any) {
        console.error('[DRIVE_AUTH_CALLBACK] Error:', err);
        return NextResponse.redirect(new URL(`/settings?tab=backup&auth_error=${encodeURIComponent(err.message || 'auth_failed')}`, request.url));
    }
}
