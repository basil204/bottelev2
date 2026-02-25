
import fetch from 'node-fetch'; // Bot environment might need node-fetch if on older Node
import { query } from '../database/index.js';

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

        // Use the first key for now, or shuffle
        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

        const emailList = Array.isArray(emails) ? emails.join('\r\n') : emails;

        // Simulating FormData for node environment
        // We can use URLSearchParams if the server accepts it, 
        // but let's try to match the multipart/form-data if possible.
        // Actually, many APIs accept urlencoded too. Let's see.
        // If not, we might need 'form-data' package.

        const body = new URLSearchParams();
        body.append('emails', emailList);
        body.append('original_lines', emailList);
        body.append('_t', '02497f2c');
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
        return rawData;
    } catch (error) {
        console.error('[Gmail Checker Helper] Error:', error);
        return null;
    }
};
