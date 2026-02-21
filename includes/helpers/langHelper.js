import { messages } from '../lang/messages.js';
import { query } from '../database/index.js';

let exchangeRateCache = 26000;
let lastRateUpdate = 0;

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
    const locale = messages[lang] ? messages[lang] : messages['vi'];
    let str = locale[key] || key;

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
