import { messages as defaultMessages } from '../lang/messages.js';
import { query } from '../database/index.js';

let exchangeRateCache = 26000;
let lastRateUpdate = 0;

let dbTranslations = { vi: {}, en: {}, zh: {} };
let lastTranslationUpdate = 0;
let isSeeding = false;

export const loadTranslationsFromDb = async () => {
    try {
        const rows = await query('SELECT msg_key, lang, msg_value FROM translations');
        if ((!rows || rows.length === 0) && !isSeeding) {
            isSeeding = true;
            console.log('[TRANSLATIONS] Tự động nạp dữ liệu ngôn ngữ mặc định vào CSDL...');
            for (const [lang, keyValues] of Object.entries(defaultMessages)) {
                for (const [msg_key, msg_value] of Object.entries(keyValues)) {
                    await query(
                        'INSERT IGNORE INTO translations (msg_key, lang, msg_value) VALUES (?, ?, ?)',
                        [msg_key, lang, msg_value]
                    );
                }
            }
            isSeeding = false;
            return loadTranslationsFromDb();
        }

        const map = { vi: {}, en: {}, zh: {} };
        if (rows && Array.isArray(rows)) {
            for (const row of rows) {
                if (!map[row.lang]) map[row.lang] = {};
                map[row.lang][row.msg_key] = row.msg_value;
            }
        }
        dbTranslations = map;
        lastTranslationUpdate = Date.now();
        return map;
    } catch (e) {
        if (e.code !== 'ER_NO_SUCH_TABLE') {
            console.error('[TRANSLATIONS_DB_ERR]', e.message);
        }
        return dbTranslations;
    }
};

export const clearTranslationCache = () => {
    lastTranslationUpdate = 0;
};

export const getExchangeRate = async () => {
    const now = Date.now();
    if (now - lastRateUpdate > 5 * 60 * 1000) { // Update every 5 mins
        try {
            const rows = await query("SELECT `value` FROM settings WHERE `key` = 'exchange_rate'");
            if (rows.length > 0) {
                exchangeRateCache = parseInt(rows[0].value) || 26000;
            }
        } catch (e) {
            console.error('Failed to fetch exchange rate:', e);
        }
        lastRateUpdate = now;
    }
    return exchangeRateCache;
};

export const t = (key, lang = 'vi', params = {}) => {
    if (Date.now() - lastTranslationUpdate > 60 * 1000) {
        loadTranslationsFromDb().catch(() => {});
    }

    const targetLang = ['vi', 'en', 'zh'].includes(lang) ? lang : 'vi';
    const dict = dbTranslations[targetLang] || defaultMessages[targetLang] || defaultMessages['vi'];
    let str = dict[key] || defaultMessages[targetLang]?.[key] || defaultMessages['vi']?.[key] || key;

    for (const [k, v] of Object.entries(params)) {
        const valStr = v !== undefined && v !== null ? String(v) : '';
        str = str.split(`{${k}}`).join(valStr);
    }
    return str;
};

export const formatBalanceByLang = async (amountVnd, lang = 'vi') => {
    const num = Number(amountVnd || 0);
    if (lang === 'en' || lang === 'zh') {
        const rate = await getExchangeRate();
        const safeRate = (rate && rate > 0) ? rate : 26000;
        const usdt = num / safeRate;
        if (usdt === 0) return '0 USDT';
        const formattedUsdt = usdt >= 1
            ? Number(usdt.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 })
            : Number(usdt.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 });
        return `${formattedUsdt} USDT`;
    }
    const rounded = Math.round(num);
    return `${rounded.toLocaleString('vi-VN')} VNĐ`;
};

export const formatBalanceByLangSync = (amountVnd, lang = 'vi') => {
    const num = Number(amountVnd || 0);
    if (lang === 'en' || lang === 'zh') {
        const safeRate = (exchangeRateCache && exchangeRateCache > 0) ? exchangeRateCache : 26000;
        const usdt = num / safeRate;
        if (usdt === 0) return '0 USDT';
        const formattedUsdt = usdt >= 1
            ? Number(usdt.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 })
            : Number(usdt.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 });
        return `${formattedUsdt} USDT`;
    }
    const rounded = Math.round(num);
    return `${rounded.toLocaleString('vi-VN')} VNĐ`;
};

export const formatMoney = async (amount, lang = 'vi') => {
    return await formatBalanceByLang(amount, lang);
};

export const isMatchButton = (text, key, lang = 'vi') => {
    if (!text || !key) return false;

    const normalize = (str) => {
        if (!str || typeof str !== 'string') return '';
        return str
            .replace(/<[^>]*>/g, '') // Bỏ thẻ HTML
            .replace(/huỷ/gi, 'hủy') // Chuẩn hóa chính tả Tiếng Việt huỷ/hủy
            .replace(/[^\p{L}\p{N}\s]/gu, '') // Bỏ emoji & ký tự đặc biệt, giữ chữ/số/khoảng trắng
            .trim()
            .toLowerCase();
    };

    const cleanText = text.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const normText = normalize(text);

    const languages = Array.from(new Set([lang, 'vi', 'en', 'zh'])).filter(Boolean);

    for (const l of languages) {
        const val = t(key, l);
        if (!val) continue;

        const cleanVal = val.replace(/<[^>]*>/g, '').trim().toLowerCase();
        if (cleanText === cleanVal) return true;

        const normVal = normalize(val);
        if (normText && normVal && normText === normVal) return true;
    }
    return false;
};
