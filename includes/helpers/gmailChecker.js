
import fetch from 'node-fetch'; // Bot environment might need node-fetch if on older Node
import { query } from '../database/index.js';

// Fetch the dynamic _t token from the homepage
const fetchToken = async () => {
    try {
        const res = await fetch("https://www.gmailchecklive.com/", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
            }
        });
        const html = await res.text();
        const match = html.match(/'_t'\s*,\s*'([a-f0-9]+)'/);
        if (match) return match[1];
        // Fallback: try another common pattern
        const match2 = html.match(/name="_t"\s+value="([a-f0-9]+)"/);
        if (match2) return match2[1];
        console.warn('[Gmail Checker Helper] Could not extract _t token from page');
        return null;
    } catch (e) {
        console.error('[Gmail Checker Helper] Error fetching token:', e);
        return null;
    }
};

export const checkGmailLive = async (emails) => {
    try {
        // Fetch API keys from settings
        const rows = await query(
            "SELECT `value` FROM settings WHERE `key` = 'gmail_checker_api_keys'"
        );

        let apiKeys = [];
        try {
            apiKeys = rows.length > 0 ? JSON.parse(rows[0].value) : [];
        } catch (e) {
            console.error('[Gmail Checker Helper] Error parsing api keys:', e);
        }

        if (apiKeys.length === 0) {
            console.warn('[Gmail Checker Helper] No API Keys configured');
            return null;
        }

        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
        const emailList = Array.isArray(emails) ? emails.join('\r\n') : emails;

        // Dynamically fetch the _t token before each request
        const token = await fetchToken();
        if (!token) {
            console.warn('[Gmail Checker Helper] No _t token, request may fail');
        }

        const body = new URLSearchParams();
        body.append('emails', emailList);
        body.append('original_lines', emailList);
        body.append('_t', token || '');
        body.append('chunk_id', 'chunk_1');
        body.append('chunk_total', '1');

        const response = await fetch("https://www.gmailchecklive.com/index.php", {
            method: "POST",
            headers: {
                "Accept": "*/*",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
                "Referer": "https://www.gmailchecklive.com/",
                "Origin": "https://www.gmailchecklive.com",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body
        });

        const rawData = await response.json();
        console.log('[Gmail Checker] Response:', JSON.stringify(rawData));
        return rawData;
    } catch (error) {
        console.error('[Gmail Checker Helper] Error:', error);
        return null;
    }
};
