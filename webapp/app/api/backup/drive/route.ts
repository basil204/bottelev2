import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const quoteIdentifier = (value: string) => `\`${value.replace(/`/g, '``')}\``;

const quoteValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL';
    if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
    if (value instanceof Date) {
        return `'${value.toISOString().slice(0, 23).replace('T', ' ')}'`;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'boolean') return value ? '1' : '0';

    const escaped = String(value)
        .replace(/\\/g, '\\\\')
        .replace(/\0/g, '\\0')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\x1a/g, '\\Z')
        .replace(/'/g, "\\'");
    return `'${escaped}'`;
};

// Generate full SQL Database Dump string
async function generateSqlDump(): Promise<string> {
    const connection = await pool.getConnection();
    try {
        const databaseName = String(process.env.DB_NAME || 'database');
        const [tableRows] = await connection.query<RowDataPacket[]>(
            "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"
        );
        const tableNames = tableRows
            .map((row) => String(Object.values(row)[0] || ''))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        const generatedAt = new Date();
        const output: string[] = [
            `-- Database backup: ${databaseName}`,
            `-- Generated at: ${generatedAt.toISOString()}`,
            'SET NAMES utf8mb4;',
            "SET time_zone = '+00:00';",
            'SET FOREIGN_KEY_CHECKS = 0;',
            "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
            ''
        ];

        for (const tableName of tableNames) {
            const identifier = quoteIdentifier(tableName);
            const [createRows] = await connection.query<RowDataPacket[]>(`SHOW CREATE TABLE ${identifier}`);
            const createSql = String(createRows[0]?.['Create Table'] || '');
            if (!createSql) continue;

            output.push(`-- Structure for table ${identifier}`, `DROP TABLE IF EXISTS ${identifier};`, `${createSql};`, '');

            const [dataRows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ${identifier}`);
            if (!dataRows.length) continue;

            const columns = Object.keys(dataRows[0]);
            const columnSql = columns.map(quoteIdentifier).join(', ');
            output.push(`-- Data for table ${identifier}`);

            const batchSize = 250;
            for (let offset = 0; offset < dataRows.length; offset += batchSize) {
                const batch = dataRows.slice(offset, offset + batchSize);
                const values = batch.map((row) =>
                    `(${columns.map((column) => quoteValue(row[column])).join(', ')})`
                );
                output.push(`INSERT INTO ${identifier} (${columnSql}) VALUES\n${values.join(',\n')};`);
            }
            output.push('');
        }

        output.push('SET FOREIGN_KEY_CHECKS = 1;', '');
        return output.join('\n');
    } finally {
        connection.release();
    }
}

// Get Google Drive Client
async function getDriveClient(customSettings?: Record<string, string>) {
    let folderId = customSettings?.google_drive_folder_id || '';
    let refreshToken = customSettings?.google_drive_refresh_token || '';
    let clientId = customSettings?.google_drive_client_id || '';
    let clientSecret = customSettings?.google_drive_client_secret || '';
    let serviceAccountJson = customSettings?.google_drive_service_account_json || '';

    // Load settings from DB if not passed
    if (!folderId || (!refreshToken && !serviceAccountJson)) {
        const [settingsRows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('google_drive_folder_id', 'google_drive_refresh_token', 'google_drive_client_id', 'google_drive_client_secret', 'google_drive_service_account_json')"
        );
        settingsRows.forEach(row => {
            if (row.key === 'google_drive_folder_id') folderId = row.value;
            if (row.key === 'google_drive_refresh_token') refreshToken = row.value;
            if (row.key === 'google_drive_client_id') clientId = row.value;
            if (row.key === 'google_drive_client_secret') clientSecret = row.value;
            if (row.key === 'google_drive_service_account_json') serviceAccountJson = row.value;
        });
    }

    const driveScopes = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
    ];

    let authClient: any = null;

    // 1. Service Account authentication (Highest priority)
    if (serviceAccountJson) {
        try {
            const sa = JSON.parse(serviceAccountJson);
            if (sa.client_email && sa.private_key) {
                authClient = new google.auth.JWT({
                    email: sa.client_email,
                    key: sa.private_key,
                    scopes: driveScopes
                });
            }
        } catch (e) {
            console.error('[DRIVE_BACKUP] Error parsing Service Account JSON:', e);
        }
    }

    // 2. Custom OAuth Settings stored in Database (Medium priority)
    if (!authClient && clientId && clientSecret && refreshToken) {
        const auth = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
        auth.setCredentials({
            refresh_token: refreshToken,
            scope: driveScopes.join(' ')
        });
        authClient = auth;
    }

    // 3. Local Filesystem Credentials (drive_token.json or token.json ONLY IF scope contains drive)
    if (!authClient) {
        const rootDir = process.cwd();
        const candidateCreds = [
            path.join(rootDir, 'database', 'google', 'client_secret.json'),
            path.join(rootDir, '..', 'database', 'google', 'client_secret.json'),
            path.join(rootDir, 'database', 'google', 'service_account.json'),
            path.join(rootDir, '..', 'database', 'google', 'service_account.json')
        ];
        const candidateDriveTokens = [
            path.join(rootDir, 'database', 'google', 'drive_token.json'),
            path.join(rootDir, '..', 'database', 'google', 'drive_token.json'),
            path.join(rootDir, 'database', 'google', 'token.json'),
            path.join(rootDir, '..', 'database', 'google', 'token.json')
        ];

        // Check for Service Account file
        for (const saPath of [candidateCreds[2], candidateCreds[3]]) {
            if (fs.existsSync(saPath)) {
                try {
                    const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
                    if (sa.type === 'service_account' && sa.client_email && sa.private_key) {
                        authClient = new google.auth.JWT({
                            email: sa.client_email,
                            key: sa.private_key,
                            scopes: driveScopes
                        });
                        break;
                    }
                } catch (err) {}
            }
        }

        // Check for OAuth client_secret.json + token.json
        if (!authClient) {
            for (let i = 0; i < candidateCreds.length; i++) {
                for (let j = 0; j < candidateDriveTokens.length; j++) {
                    if (fs.existsSync(candidateCreds[i]) && fs.existsSync(candidateDriveTokens[j])) {
                        try {
                            const creds = JSON.parse(fs.readFileSync(candidateCreds[i], 'utf8'));
                            const token = JSON.parse(fs.readFileSync(candidateDriveTokens[j], 'utf8'));
                            // Check if token scope actually has drive permission!
                            const tokenScope = String(token.scope || '');
                            if (tokenScope && !tokenScope.includes('drive')) {
                                // Skip token.json because it does not have Google Drive scope!
                                continue;
                            }
                            const web = creds.web || creds.installed;
                            if (web) {
                                const auth = new google.auth.OAuth2(web.client_id, web.client_secret, web.redirect_uris?.[0]);
                                auth.setCredentials(token);
                                authClient = auth;
                                break;
                            }
                        } catch (err) {
                            console.error('[DRIVE_BACKUP] Error reading local Google creds file:', err);
                        }
                    }
                }
                if (authClient) break;
            }
        }
    }

    if (!authClient) {
        return null;
    }

    const drive = google.drive({ version: 'v3', auth: authClient });
    return { drive, folderId };
}

// Upload file to Google Drive
async function uploadToGoogleDrive(filePath: string, fileName: string, customSettings?: Record<string, string>) {
    const client = await getDriveClient(customSettings);
    if (!client) {
        return { success: false, error: 'Chưa có thông tin xác thực Google Drive (Vui lòng nhập Refresh Token hoặc Tải lên file JSON credentials)' };
    }

    const { drive, folderId } = client;
    const fileMetadata: any = {
        name: fileName,
        mimeType: 'application/sql'
    };

    if (folderId && folderId.trim()) {
        fileMetadata.parents = [folderId.trim()];
    }

    const media = {
        mimeType: 'application/sql',
        body: fs.createReadStream(filePath)
    };

    try {
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, size, createdTime'
        });

        return {
            success: true,
            fileId: response.data.id,
            webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
            size: response.data.size,
            createdTime: response.data.createdTime
        };
    } catch (err: any) {
        console.error('[DRIVE_UPLOAD] Error uploading file to Google Drive:', err);
        return { success: false, error: err.message || 'Lỗi khi tải file lên Google Drive' };
    }
}

// Read Backup History from DB settings
async function getBackupHistory(): Promise<any[]> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>("SELECT `value` FROM settings WHERE `key` = 'database_backups_history'");
        if (rows.length > 0 && rows[0].value) {
            return JSON.parse(rows[0].value);
        }
    } catch (e) {}
    return [];
}

// Save Backup History to DB settings
async function saveBackupHistory(history: any[]) {
    await pool.query(
        "INSERT INTO settings (`key`, `value`) VALUES ('database_backups_history', ?) ON DUPLICATE KEY UPDATE `value` = ?",
        [JSON.stringify(history), JSON.stringify(history)]
    );
}

// Create complete Database Backup (Save locally + Upload to Google Drive)
async function performBackup(customSettings?: Record<string, string>) {
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
    const databaseName = process.env.DB_NAME || 'database';
    const fileName = `database_backup_${databaseName}_${timestamp}.sql`;
    const filePath = path.join(backupDir, fileName);

    // 1. Export SQL
    const sqlData = await generateSqlDump();
    fs.writeFileSync(filePath, sqlData, 'utf8');

    const stats = fs.statSync(filePath);
    const sizeKb = Math.round(stats.size / 1024);

    // 2. Upload to Google Drive
    let driveResult: any = { success: false };
    try {
        driveResult = await uploadToGoogleDrive(filePath, fileName, customSettings);
    } catch (err: any) {
        console.error('[BACKUP] Drive upload failed:', err);
        driveResult = { success: false, error: err.message || 'Lỗi upload Drive' };
    }

    // 3. Log into History
    const history = await getBackupHistory();
    const newEntry = {
        id: `bk_${Date.now()}`,
        fileName,
        filePath: `/backups/${fileName}`,
        sizeKb,
        createdAt: new Date().toISOString(),
        driveUploaded: Boolean(driveResult.success),
        driveFileId: driveResult.fileId || null,
        driveLink: driveResult.webViewLink || null,
        error: driveResult.error || null
    };

    history.unshift(newEntry);

    // Keep last 15 backups (cleanup old files)
    if (history.length > 15) {
        const removed = history.splice(15);
        removed.forEach(oldItem => {
            const oldPath = path.join(backupDir, oldItem.fileName);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch {}
            }
        });
    }

    await saveBackupHistory(history);

    // Update last_backup_time setting
    const nowIso = new Date().toISOString();
    await pool.query(
        "INSERT INTO settings (`key`, `value`) VALUES ('last_backup_time', ?) ON DUPLICATE KEY UPDATE `value` = ?",
        [nowIso, nowIso]
    );

    return {
        success: true,
        entry: newEntry,
        history
    };
}

export async function GET(request: Request) {
    try {
        // Check if Google Drive is connected
        const driveClient = await getDriveClient();
        const isDriveConnected = Boolean(driveClient);

        const history = await getBackupHistory();

        // Get Backup Settings from DB
        const [settingsRows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('google_drive_folder_id', 'auto_backup_enabled', 'auto_backup_interval', 'last_backup_time', 'google_drive_client_id', 'google_drive_client_secret', 'google_drive_refresh_token', 'google_drive_service_account_json')"
        );

        const config: Record<string, any> = {
            google_drive_folder_id: '',
            auto_backup_enabled: true,
            auto_backup_interval: '24h',
            last_backup_time: 'Chưa có bản sao lưu nào',
            google_drive_client_id: '',
            google_drive_client_secret: '',
            google_drive_refresh_token: '',
            has_service_account: false
        };

        settingsRows.forEach(r => {
            if (r.key === 'google_drive_folder_id') config.google_drive_folder_id = r.value;
            if (r.key === 'auto_backup_enabled') config.auto_backup_enabled = r.value === 'true' || r.value === '1';
            if (r.key === 'auto_backup_interval') config.auto_backup_interval = r.value;
            if (r.key === 'last_backup_time') config.last_backup_time = r.value;
            if (r.key === 'google_drive_client_id') config.google_drive_client_id = r.value;
            if (r.key === 'google_drive_client_secret') config.google_drive_client_secret = r.value;
            if (r.key === 'google_drive_refresh_token') config.google_drive_refresh_token = r.value;
            if (r.key === 'google_drive_service_account_json' && r.value) config.has_service_account = true;
        });

        return NextResponse.json({
            success: true,
            isDriveConnected,
            config,
            history
        });
    } catch (error: any) {
        console.error('Get Backup Info Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, folderId, autoEnabled, autoInterval, clientId, clientSecret, refreshToken, fileName, jsonContent } = body;
        const adminName = await getAdminFromCookie(request);

        if (action === 'upload_json' && jsonContent) {
            try {
                const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
                const googleDir = path.join(process.cwd(), 'database', 'google');
                if (!fs.existsSync(googleDir)) {
                    fs.mkdirSync(googleDir, { recursive: true });
                }

                if (parsed.type === 'service_account') {
                    // Service Account JSON
                    const savePath = path.join(googleDir, 'service_account.json');
                    fs.writeFileSync(savePath, JSON.stringify(parsed, null, 2), 'utf8');
                    await pool.query(
                        "INSERT INTO settings (`key`, `value`) VALUES ('google_drive_service_account_json', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                        [JSON.stringify(parsed), JSON.stringify(parsed)]
                    );
                    return NextResponse.json({
                        success: true,
                        message: 'Đã tải lên và cấu hình Service Account JSON thành công! Google Drive sẵn sàng 24/7.'
                    });
                } else if (parsed.web || parsed.installed) {
                    // OAuth client_secret.json
                    const web = parsed.web || parsed.installed;
                    const savePath = path.join(googleDir, 'client_secret.json');
                    fs.writeFileSync(savePath, JSON.stringify(parsed, null, 2), 'utf8');

                    if (web.client_id) {
                        await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('google_drive_client_id', ?) ON DUPLICATE KEY UPDATE `value` = ?", [web.client_id, web.client_id]);
                    }
                    if (web.client_secret) {
                        await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('google_drive_client_secret', ?) ON DUPLICATE KEY UPDATE `value` = ?", [web.client_secret, web.client_secret]);
                    }

                    return NextResponse.json({
                        success: true,
                        message: 'Đã nhập thành công file client_secret.json (Client ID & Client Secret)!'
                    });
                } else if (parsed.refresh_token || parsed.access_token) {
                    // OAuth drive_token.json
                    const savePath = path.join(googleDir, 'drive_token.json');
                    fs.writeFileSync(savePath, JSON.stringify(parsed, null, 2), 'utf8');
                    if (parsed.refresh_token) {
                        await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('google_drive_refresh_token', ?) ON DUPLICATE KEY UPDATE `value` = ?", [parsed.refresh_token, parsed.refresh_token]);
                    }
                    return NextResponse.json({
                        success: true,
                        message: 'Đã nhập thành công file drive_token.json (Refresh Token)!'
                    });
                } else {
                    return NextResponse.json({ error: 'File JSON không đúng cấu trúc Google Credentials / Service Account' }, { status: 400 });
                }
            } catch (err: any) {
                return NextResponse.json({ error: 'File JSON không hợp lệ: ' + err.message }, { status: 400 });
            }
        }

        if (action === 'save_config') {
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES ('google_drive_folder_id', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [folderId || '', folderId || '']
            );
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES ('auto_backup_enabled', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [autoEnabled ? 'true' : 'false', autoEnabled ? 'true' : 'false']
            );
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES ('auto_backup_interval', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [autoInterval || '24h', autoInterval || '24h']
            );

            if (clientId !== undefined) {
                await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('google_drive_client_id', ?) ON DUPLICATE KEY UPDATE `value` = ?", [clientId, clientId]);
            }
            if (clientSecret !== undefined) {
                await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('google_drive_client_secret', ?) ON DUPLICATE KEY UPDATE `value` = ?", [clientSecret, clientSecret]);
            }
            if (refreshToken !== undefined) {
                await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('google_drive_refresh_token', ?) ON DUPLICATE KEY UPDATE `value` = ?", [refreshToken, refreshToken]);
            }

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SYSTEM',
                details: 'Updated Google Drive Auto Backup Configuration',
                request
            });

            return NextResponse.json({ success: true, message: 'Đã lưu cấu hình sao lưu Google Drive thành công!' });
        }

        if (action === 'create_backup') {
            const result = await performBackup({
                google_drive_folder_id: folderId,
                google_drive_client_id: clientId,
                google_drive_client_secret: clientSecret,
                google_drive_refresh_token: refreshToken
            });

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'CREATE',
                targetType: 'SYSTEM',
                details: `Manually created database backup: ${result.entry.fileName} (Drive: ${result.entry.driveUploaded ? 'YES' : 'NO'})`,
                request
            });

            if (!result.entry.driveUploaded) {
                return NextResponse.json({
                    success: false,
                    error: `Không thể tải lên Google Drive: ${result.entry.error || 'Vui lòng nhập Refresh Token (đã tick chọn scope Drive) hoặc nạp file JSON Service Account.'}`,
                    entry: result.entry,
                    history: result.history
                }, { status: 400 });
            }

            return NextResponse.json({
                success: true,
                message: 'Đã tạo bản sao lưu CSDL & tải lên Google Drive thành công!',
                entry: result.entry,
                history: result.history
            });
        }

        if (action === 'delete_backup' && fileName) {
            const backupDir = path.join(process.cwd(), 'backups');
            const targetPath = path.join(backupDir, fileName);
            if (fs.existsSync(targetPath)) {
                try { fs.unlinkSync(targetPath); } catch {}
            }

            const history = await getBackupHistory();
            const updated = history.filter(h => h.fileName !== fileName);
            await saveBackupHistory(updated);

            return NextResponse.json({ success: true, message: 'Đã xóa bản sao lưu thành công!', history: updated });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Backup Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
