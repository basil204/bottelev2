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
        str = str.replace(new RegExp(`{${k}}`, 'g'), v);
    }
    return str;
};

export const formatMoney = async (amount, lang = 'vi') => {
    if (lang === 'en') {
        const rate = await getExchangeRate();
        const usd = amount / rate;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd);
    } else if (lang === 'zh') {
        const rate = await getExchangeRate();
        const usd = amount / rate;
        return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'USD' }).format(usd);
    } else {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }
};

export const isMatchButton = (text, key, lang = 'vi') => {
    if (!text || !key) return false;
    const cleanText = text.replace(/<[^>]*>/g, '').trim().toLowerCase();

    // So sánh với ngôn ngữ hiện tại của người dùng
    const userVal = t(key, lang).replace(/<[^>]*>/g, '').trim().toLowerCase();
    if (cleanText === userVal) return true;

    // So sánh với tất cả các bản dịch ngôn ngữ khác (vi, en, zh)
    for (const l of ['vi', 'en', 'zh']) {
        const val = t(key, l).replace(/<[^>]*>/g, '').trim().toLowerCase();
        if (cleanText === val) return true;
    }
    return false;
};
