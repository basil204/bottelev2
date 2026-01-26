
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Adjust path to config.json based on where Next.js runs (usually root of webapp, mapping to root of project?)
// In this setup, we assume we can connect to DB using same credentials.
// Or we read from environment variables.
// Use process.cwd() to find config.

const CACHE_FILE = path.join(process.cwd(), 'timo_cache.json');
const CONFIG_FILE = path.join(process.cwd(), '../config.json'); // Assuming webapp is in /webapp and config is in root

// Credentials
const getDbConfig = async () => {
    // Try reading global config file first
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const file = fs.readFileSync(CONFIG_FILE, 'utf8');
            const conf = JSON.parse(file);
            return {
                host: conf.DB_HOST,
                user: conf.DB_USER,
                password: conf.DB_PASS,
                database: conf.DB_NAME
            };
        }
    } catch (e) { }
    // Fallback to env or default
    return {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'telegram_bot'
    };
};

const getCredentials = async () => {
    try {
        const dbConf = await getDbConfig();
        const connection = await mysql.createConnection(dbConf);
        const [rows] = await connection.query("SELECT `key`, `value` FROM settings WHERE `key` IN ('timo_username', 'timo_password')");
        await connection.end();

        let username = '';
        let password = '';
        if (Array.isArray(rows)) {
            rows.forEach((r: any) => {
                if (r.key === 'timo_username') username = r.value;
                if (r.key === 'timo_password') password = r.value;
            });
        }
        return { username, password };
    } catch (e) {
        console.error('DB Error:', e);
        return { username: '', password: '' };
    }
};

const hashPassword = (password: string) => {
    if (/^[a-f0-9]{128}$/i.test(password)) return password;
    return crypto.createHash('sha512').update(password).digest('hex');
};

const generateDeviceReg = () => {
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `${randomBytes}:WEB:WEB:301:WEB:desktop:chrome`;
};

const generateContextId = () => {
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const uuid = crypto.randomUUID();
    return `${randomBytes}.${uuid}`;
};

const loadCache = () => {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        }
    } catch (e) { }
    return {};
};

const saveCache = (data: any) => {
    try {
        const current = loadCache();
        const updated = { ...current, ...data };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(updated, null, 2));
    } catch (e) { }
};

export const timoService = {
    async login(otp?: string): Promise<{ success: boolean; needOTP?: boolean; message?: string; error?: string }> {
        const cache = loadCache();
        const { username, password } = await getCredentials();

        if (!username || !password) throw new Error("Missing credentials");

        const hashedPassword = hashPassword(password);

        let deviceReg = cache.deviceReg || generateDeviceReg();
        let contextId = cache.contextId || generateContextId();

        // 1. If OTP provided, submit OTP
        if (otp && cache.refNo && cache.token) {
            const response = await fetch("https://app2.timo.vn/login/commit", {
                headers: {
                    "accept": "application/json",
                    "content-type": "application/json; charset=UTF-8",
                    "token": cache.token,
                    "x-gofs-context-id": contextId,
                    "x-timo-devicereg": deviceReg,
                    "Referer": "https://my.timo.vn/"
                },
                body: JSON.stringify({
                    "otp": otp,
                    "refNo": cache.refNo
                }),
                method: "POST"
            });
            const data = await response.json();
            if (data.code === 200) {
                // Success
                // save cache
                // Note: response might contain new deviceId?
                saveCache({
                    token: data.data.token || cache.token, // Usually same token promoted
                    loginTime: new Date().toISOString()
                });
                return { success: true };
            } else {
                return { success: false, error: data.message || "OTP Failed" };
            }
        }

        // 2. Normal Login Step 1
        const response = await fetch("https://app2.timo.vn/login", {
            headers: {
                "accept": "application/json",
                "content-type": "application/json; charset=UTF-8",
                "x-gofs-context-id": contextId,
                "x-timo-devicereg": deviceReg,
                "Referer": "https://my.timo.vn/"
            },
            body: JSON.stringify({
                "username": username,
                "password": hashedPassword,
                "lang": "vn"
            }),
            method: "POST"
        });
        const data = await response.json();

        if (data.code === 200) {
            // Logged in directly
            const deviceKey = data.data.timoDeviceId || deviceReg.split(':')[0] + 'IkNuE';
            saveCache({
                username, hashedPassword, deviceReg, contextId,
                token: data.data.token,
                deviceKey,
                loginTime: new Date().toISOString()
            });
            return { success: true };
        } else if (data.code === 6001 || data.code === 201) {
            // Need OTP
            saveCache({
                username, hashedPassword, deviceReg, contextId,
                token: data.data.token,
                refNo: data.data.refNo
            });
            return { success: false, needOTP: true, message: "OTP Required" };
        } else {
            return { success: false, error: data.message };
        }
    },

    async getHistory(): Promise<{ success: boolean; data?: any; error?: string }> {
        const cache = loadCache();
        if (!cache.token) {
            // Try login first?
            const loginRes = await this.login();
            if (!loginRes.success) return { success: false, error: "Not logged in" };
            // Reload cache
            Object.assign(cache, loadCache());
        }

        const { token, contextId, deviceKey } = cache;
        const finalDeviceKey = deviceKey + ':WEB:WEB:301:WEB:desktop:chrome';

        // Get Account
        const bankInfoRes = await fetch("https://app2.timo.vn/user/bankinfo", {
            headers: {
                "accept": "application/json",
                "token": token,
                "x-gofs-context-id": contextId,
                "x-timo-devicekey": finalDeviceKey,
                "Referer": "https://my.timo.vn/"
            },
            method: "GET"
        });
        const bankInfo = await bankInfoRes.json();

        if (bankInfo.code !== 200) {
            // Maybe expired
            const loginRes = await this.login();
            if (!loginRes.success) return { success: false, error: "Session expired & Login failed" };
            // Retry?
            return this.getHistory(); // Recursion once?
        }

        const accountNo = bankInfo.data.accountNumber;

        // Get Tx
        const today = new Date();
        const d = String(today.getDate()).padStart(2, '0');
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const y = today.getFullYear();
        const dateStr = `${d}/${m}/${y}`;

        const txRes = await fetch("https://app2.timo.vn/user/account/transaction/list", {
            headers: {
                "accept": "application/json",
                "content-type": "application/json; charset=UTF-8",
                "token": token,
                "x-gofs-context-id": contextId,
                "x-timo-devicekey": finalDeviceKey,
                "Referer": "https://my.timo.vn/"
            },
            body: JSON.stringify({
                "format": "group",
                "index": 0,
                "offset": -1,
                "accountNo": accountNo,
                "accountType": "1025",
                "fromDate": dateStr,
                "toDate": dateStr
            }),
            method: "POST"
        });
        const txData = await txRes.json();
        return { success: true, data: txData };
    }
};
