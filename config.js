import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const configPath = path.join(process.cwd(), 'config.json');
const fileConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath)) : {};

export const config = {
    // Telegram
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || fileConfig.TELEGRAM_BOT_TOKEN,
    BOT_USERNAME: null, // Will be set in main.js
    ADMIN_IDS: (() => {
        let ids = process.env.ADMIN_IDS ? JSON.parse(process.env.ADMIN_IDS) : fileConfig.ADMIN_IDS || [];
        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        return ids.filter(id => id);
    })(),
    NOTIFICATION_CHAT_ID: process.env.NOTIFICATION_CHAT_ID || fileConfig.NOTIFICATION_CHAT_ID || null,
    TELEGRAM_GROUP_LINKS: fileConfig.TELEGRAM_GROUP_LINKS || [
        { name: 'Group thông báo và chat', url: 'https://t.me/+SFp6Gttq18VmYThl' }
    ],
    NOTIFY_MODE: process.env.NOTIFY_MODE || fileConfig.NOTIFY_MODE || 'all',

    // Database
    DB_HOST: process.env.DB_HOST || fileConfig.DB_HOST,
    DB_NAME: process.env.DB_NAME || fileConfig.DB_NAME,
    DB_USER: process.env.DB_USER || fileConfig.DB_USER,
    DB_PASS: process.env.DB_PASS || fileConfig.DB_PASS,

    // Banking / Payment
    VIETQR_ACCOUNT_NO: process.env.VIETQR_ACCOUNT_NO || fileConfig.VIETQR_ACCOUNT_NO,
    VIETQR_BANK_CODE: process.env.VIETQR_BANK_CODE || fileConfig.VIETQR_BANK_CODE,

    MB_API_URL: process.env.MB_API_URL || fileConfig.MB_API_URL,
    MB_CHECK_INTERVAL: Number(process.env.MB_CHECK_INTERVAL || fileConfig.MB_CHECK_INTERVAL || 20000),

    TIMO_API_URL: process.env.TIMO_API_URL || fileConfig.TIMO_API_URL,
    TIMO_BANK_CODE: process.env.TIMO_BANK_CODE || fileConfig.TIMO_BANK_CODE,
    TIMO_ACCOUNT_NO: process.env.TIMO_ACCOUNT_NO || fileConfig.TIMO_ACCOUNT_NO,
    TIMO_ACCOUNT_NAME: process.env.TIMO_ACCOUNT_NAME || fileConfig.TIMO_ACCOUNT_NAME,

    // External Services
    MAIL_API_KEY: process.env.MAIL_API_KEY || fileConfig.MAIL_API_KEY,
    MAIL_API_BASE: process.env.MAIL_API_BASE || 'https://api.dongvanfb.net',

    // Products / Defaults
    PAGE_SIZE: Number(process.env.PAGE_SIZE || fileConfig.PAGE_SIZE || 10),
    GMAIL_DEFAULT_PASSWORD: process.env.GMAIL_DEFAULT_PASSWORD || fileConfig.GMAIL_DEFAULT_PASSWORD || 'Vietcombank9338739954',

    // Feature flags / Settings (can be overridden by DB settings)
    GMAIL_BUY_ENABLED: true, // Default
};

export default config;
