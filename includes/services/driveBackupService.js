import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { query } from '../database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper quote SQL identifiers
const quoteIdentifier = (val) => `\`${String(val).replace(/`/g, '``')}\``;

const quoteValue = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
    if (val instanceof Date) return `'${val.toISOString().slice(0, 23).replace('T', ' ')}'`;
    if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
    if (typeof val === 'bigint') return val.toString();
    if (typeof val === 'boolean') return val ? '1' : '0';

    const escaped = String(val)
        .replace(/\\/g, '\\\\')
        .replace(/\0/g, '\\0')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\x1a/g, '\\Z')
        .replace(/'/g, "\\'");
    return `'${escaped}'`;
};

/**
 * Dump entire MySQL DB to SQL String
 */
export async function dumpDatabaseToSql() {
    const tableRows = await query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const tableNames = tableRows
        .map((row) => String(Object.values(row)[0] || ''))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    const generatedAt = new Date();
    const output = [
        `-- Auto Database backup`,
        `-- Generated at: ${generatedAt.toISOString()}`,
        'SET NAMES utf8mb4;',
        "SET time_zone = '+00:00';",
        'SET FOREIGN_KEY_CHECKS = 0;',
        "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
        ''
    ];

    for (const tableName of tableNames) {
        const identifier = quoteIdentifier(tableName);
        const createRows = await query(`SHOW CREATE TABLE ${identifier}`);
        const createSql = String(createRows[0]?.['Create Table'] || '');
        if (!createSql) continue;

        output.push(`-- Structure for table ${identifier}`, `DROP TABLE IF EXISTS ${identifier};`, `${createSql};`, '');

        const dataRows = await query(`SELECT * FROM ${identifier}`);
        if (!dataRows || !dataRows.length) continue;

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
}

/**
 * Get Google Drive OAuth2 Client
 */
async function getDriveAuth() {
    const driveScopes = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
    ];

    // Check settings DB keys first
    try {
        const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('google_drive_client_id', 'google_drive_client_secret', 'google_drive_refresh_token', 'google_drive_service_account_json')");
        let clientId = '', clientSecret = '', refreshToken = '', saJson = '';
        rows.forEach(r => {
            if (r.key === 'google_drive_client_id') clientId = r.value;
            if (r.key === 'google_drive_client_secret') clientSecret = r.value;
            if (r.key === 'google_drive_refresh_token') refreshToken = r.value;
            if (r.key === 'google_drive_service_account_json') saJson = r.value;
        });

        if (saJson) {
            try {
                const sa = JSON.parse(saJson);
                if (sa.client_email && sa.private_key) {
                    return new google.auth.JWT({
                        email: sa.client_email,
                        key: sa.private_key,
                        scopes: driveScopes
                    });
                }
            } catch (e) {}
        }

        if (clientId && clientSecret && refreshToken) {
            const auth = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
            auth.setCredentials({
                refresh_token: refreshToken,
                scope: driveScopes.join(' ')
            });
            return auth;
        }
    } catch (e) {}

    // Check local Filesystem credentials (ignoring token.json if scope has no drive)
    const rootDir = path.join(__dirname, '../../');
    const credPath = path.join(rootDir, 'database/google/client_secret.json');
    const driveTokenPath = path.join(rootDir, 'database/google/drive_token.json');
    const saPath = path.join(rootDir, 'database/google/service_account.json');

    if (fs.existsSync(saPath)) {
        try {
            const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
            if (sa.type === 'service_account' && sa.client_email && sa.private_key) {
                return new google.auth.JWT({
                    email: sa.client_email,
                    key: sa.private_key,
                    scopes: driveScopes
                });
            }
        } catch (e) {}
    }

    if (fs.existsSync(credPath) && fs.existsSync(driveTokenPath)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
            const token = JSON.parse(fs.readFileSync(driveTokenPath, 'utf8'));
            const web = creds.web || creds.installed;
            if (web) {
                const auth = new google.auth.OAuth2(web.client_id, web.client_secret, web.redirect_uris?.[0]);
                auth.setCredentials(token);
                return auth;
            }
        } catch (e) {}
    }

    return null;
}

import { getAdminIds } from '../handle/handleNotify.js';

let globalBot = null;
let globalConfig = null;

export function setBackupBotInstance(bot, config) {
    if (bot) globalBot = bot;
    if (config) globalConfig = config;
}

/**
 * Gửi tệp sao lưu CSDL (.sql) đến các Admin Telegram IDs
 */
export async function sendBackupToTelegramAdmins({
    filePath,
    fileName,
    sizeKb,
    driveLink = null,
    bot = null,
    config = null,
    specificChatId = null
}) {
    try {
        const targetBot = bot || globalBot;
        const targetConfig = config || globalConfig;

        let targetChatIds = [];
        if (specificChatId) {
            targetChatIds = [specificChatId];
        } else {
            const adminIds = await getAdminIds(targetConfig?.ADMIN_IDS || []);
            targetChatIds = [...adminIds];
        }

        if (targetChatIds.length === 0) {
            console.warn('[TELE_BACKUP] ⚠️ Không tìm thấy Telegram Admin ID nào để gửi bản sao lưu CSDL.');
            return;
        }

        const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb} KB`;
        const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const caption = `📦 *BẢN SAO LƯU CSDL HỆ THỐNG (DAILY BACKUP)*\n\n` +
            `📅 *Thời gian:* \`${nowStr}\`\n` +
            `📁 *Tệp tin:* \`${fileName}\`\n` +
            `📊 *Dung lượng:* \`${sizeFormatted}\`\n` +
            (driveLink ? `☁️ *Google Drive:* [Mở file trên Drive](${driveLink})\n` : '') +
            `🛡️ *Trạng thái:* Sao lưu toàn bộ Database tự động định kỳ thành công!`;

        // 1. Nếu có bot instance (chạy từ main.js)
        if (targetBot && typeof targetBot.sendDocument === 'function') {
            for (const adminId of targetChatIds) {
                try {
                    await targetBot.sendDocument(adminId, filePath, {
                        caption,
                        parse_mode: 'Markdown'
                    }, {
                        filename: fileName,
                        contentType: 'application/sql'
                    });
                    console.log(`[TELE_BACKUP] ✅ Đã gửi bản sao lưu CSDL đến Admin ID: ${adminId}`);
                } catch (sendErr) {
                    console.error(`[TELE_BACKUP] ❌ Lỗi gửi file sao lưu đến Admin ID ${adminId}:`, sendErr.message);
                }
            }
            return;
        }

        // 2. Fallback: Nếu không có bot instance (ví dụ gọi từ Next.js API / standalone), gọi trực tiếp qua Telegram Bot API
        let botToken = targetConfig?.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            try {
                const tokenRows = await query("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token' LIMIT 1");
                if (tokenRows && tokenRows.length > 0 && tokenRows[0].value) {
                    let parsed;
                    try { parsed = JSON.parse(tokenRows[0].value); } catch {}
                    botToken = Array.isArray(parsed) ? parsed[0] : String(tokenRows[0].value).split(/[\r\n,;|]+/)[0]?.trim();
                }
            } catch {}
        }
        if (!botToken) {
            botToken = process.env.TELEGRAM_BOT_TOKEN;
        }

        if (botToken) {
            const fileBuffer = fs.readFileSync(filePath);
            for (const adminId of targetChatIds) {
                try {
                    const formData = new FormData();
                    formData.append('chat_id', String(adminId));
                    formData.append('caption', caption);
                    formData.append('parse_mode', 'Markdown');
                    const blob = new Blob([fileBuffer], { type: 'application/sql' });
                    formData.append('document', blob, fileName);

                    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
                        method: 'POST',
                        body: formData
                    });
                    const resJson = await resp.json();
                    if (resJson.ok) {
                        console.log(`[TELE_BACKUP_HTTP] ✅ Đã gửi file backup qua Telegram API đến Admin ID: ${adminId}`);
                    } else {
                        console.error(`[TELE_BACKUP_HTTP] ❌ Telegram API trả về lỗi:`, resJson.description);
                    }
                } catch (httpErr) {
                    console.error(`[TELE_BACKUP_HTTP] ❌ Lỗi gọi Telegram API:`, httpErr.message);
                }
            }
        }
    } catch (e) {
        console.error('[TELE_BACKUP] ❌ Lỗi trong quy trình gửi sao lưu đến Telegram Admin:', e.message);
    }
}

/**
 * Create Auto Backup, upload to Google Drive & send to Admin Telegram IDs
 */
export async function runAutoDriveBackup(bot = null, config = null, specificChatId = null) {
    try {
        console.log('[AUTO_BACKUP] 🚀 Bắt đầu quy trình tự động sao lưu dữ liệu...');
        
        const backupDir = path.join(__dirname, '../../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
        const fileName = `database_backup_auto_${timestamp}.sql`;
        const filePath = path.join(backupDir, fileName);

        // Dump SQL
        const sqlData = await dumpDatabaseToSql();
        fs.writeFileSync(filePath, sqlData, 'utf8');

        // Check Folder ID in settings
        const settingsRows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('google_drive_folder_id', 'database_backups_history')");
        let folderId = '';
        let historyJson = '[]';

        settingsRows.forEach(r => {
            if (r.key === 'google_drive_folder_id') folderId = r.value;
            if (r.key === 'database_backups_history') historyJson = r.value;
        });

        let history = [];
        try { history = JSON.parse(historyJson); } catch (e) {}

        // Upload to Drive if auth available
        const auth = await getDriveAuth();
        let driveUploaded = false;
        let driveFileId = null;
        let driveLink = null;

        if (auth) {
            try {
                const drive = google.drive({ version: 'v3', auth });
                const fileMetadata = { name: fileName, mimeType: 'application/sql' };
                if (folderId && folderId.trim()) {
                    fileMetadata.parents = [folderId.trim()];
                }
                const media = { mimeType: 'application/sql', body: fs.createReadStream(filePath) };

                const res = await drive.files.create({
                    requestBody: fileMetadata,
                    media: media,
                    fields: 'id, webViewLink'
                });

                driveUploaded = true;
                driveFileId = res.data.id;
                driveLink = res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`;
                console.log(`[AUTO_BACKUP] ✅ Đã tải bản sao lưu lên Google Drive: ${driveLink}`);
            } catch (err) {
                console.error('[AUTO_BACKUP] ❌ Lỗi upload Google Drive:', err.message);
            }
        } else {
            console.log('[AUTO_BACKUP] 💾 Đã lưu bản sao lưu CSDL ở máy chủ local.');
        }

        const stats = fs.statSync(filePath);
        const sizeKb = Math.round(stats.size / 1024);

        const newEntry = {
            id: `bk_${Date.now()}`,
            fileName,
            filePath: `/backups/${fileName}`,
            sizeKb,
            createdAt: new Date().toISOString(),
            driveUploaded,
            driveFileId,
            driveLink
        };

        history.unshift(newEntry);
        if (history.length > 15) history = history.slice(0, 15);

        // Update settings
        const nowIso = new Date().toISOString();
        await query("INSERT INTO settings (`key`, `value`) VALUES ('database_backups_history', ?) ON DUPLICATE KEY UPDATE `value` = ?", [JSON.stringify(history), JSON.stringify(history)]);
        await query("INSERT INTO settings (`key`, `value`) VALUES ('last_backup_time', ?) ON DUPLICATE KEY UPDATE `value` = ?", [nowIso, nowIso]);

        // Gửi bản sao lưu trực tiếp đến Telegram Admin ID(s)
        await sendBackupToTelegramAdmins({
            filePath,
            fileName,
            sizeKb,
            driveLink,
            bot: bot || globalBot,
            config: config || globalConfig,
            specificChatId
        });

        return newEntry;
    } catch (error) {
        console.error('[AUTO_BACKUP] ❌ Lỗi chạy sao lưu CSDL:', error);
    }
}

/**
 * Schedule Auto Backup Job Check (hằng ngày / định kỳ)
 */
export function startDriveBackupCron(bot = null, config = null) {
    if (bot) globalBot = bot;
    if (config) globalConfig = config;

    console.log('[AUTO_BACKUP] ⏰ Khởi chạy tiến trình Auto Backup Scheduler (Gửi Admin Telegram & Google Drive)...');
    
    const checkAndRunBackup = async () => {
        try {
            const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('auto_backup_enabled', 'auto_backup_interval', 'last_backup_time')");
            let enabled = true;
            let interval = '24h';
            let lastBackup = null;

            rows.forEach(r => {
                if (r.key === 'auto_backup_enabled') enabled = r.value === 'true' || r.value === '1';
                if (r.key === 'auto_backup_interval') interval = r.value;
                if (r.key === 'last_backup_time') lastBackup = r.value;
            });

            if (!enabled) return;

            let intervalMs = 24 * 60 * 60 * 1000; // default 24h (hằng ngày)
            if (interval === '6h') intervalMs = 6 * 60 * 60 * 1000;
            if (interval === '12h') intervalMs = 12 * 60 * 60 * 1000;
            if (interval === 'weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;

            const now = Date.now();
            const lastTimeMs = lastBackup ? new Date(lastBackup).getTime() : 0;

            // Kiểm tra: Đã qua chu kỳ interval HOẶC sang ngày mới và cách lần backup trước trên 12 tiếng
            const isDifferentDay = lastBackup && new Date().toDateString() !== new Date(lastBackup).toDateString() && (now - lastTimeMs >= 12 * 60 * 60 * 1000);

            if (!lastBackup || (now - lastTimeMs >= intervalMs) || isDifferentDay) {
                console.log('[DAILY_BACKUP] ⏰ Đến thời điểm sao lưu CSDL tự động hằng ngày. Đang tiến hành...');
                await runAutoDriveBackup(globalBot, globalConfig);
            }
        } catch (e) {
            console.error('[AUTO_BACKUP] Error in cron check:', e.message);
        }
    };

    // Kiểm tra lần đầu sau 15 giây khởi động server
    setTimeout(() => {
        checkAndRunBackup();
    }, 15000);

    // Kiểm tra định kỳ mỗi 15 phút
    setInterval(checkAndRunBackup, 15 * 60 * 1000);
}

export default {
    dumpDatabaseToSql,
    runAutoDriveBackup,
    startDriveBackupCron,
    sendBackupToTelegramAdmins,
    setBackupBotInstance
};
