import pool from './db';
import { RowDataPacket } from 'mysql2';

export async function getBotToken(): Promise<string> {
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.trim()) {
        return process.env.TELEGRAM_BOT_TOKEN.trim();
    }
    try {
        const [rows] = await pool.query<RowDataPacket[]>("SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token' LIMIT 1");
        if (rows && rows[0]?.value) {
            return String(rows[0].value).trim();
        }
    } catch (e) {
        console.error('Error fetching bot token from settings:', e);
    }
    return '';
}

export async function sendMessage(chatId: number | string, text: string, token?: string) {
    const useToken = token || (await getBotToken());
    if (!useToken) {
        console.error("TELEGRAM_BOT_TOKEN is not set in env or settings");
        return;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${useToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown',
            }),
        });

        const data = await response.json();
        if (!data.ok) {
            console.error("Failed to send Telegram message:", data);
        }
    } catch (error) {
        console.error("Error sending Telegram message:", error);
    }
}

export async function sendPhoto(chatId: number | string, photo: string, caption?: string, token?: string, replyMarkup?: any): Promise<boolean> {
    const useToken = token || (await getBotToken());
    if (!useToken) {
        console.error("TELEGRAM_BOT_TOKEN is not set in env or settings");
        return false;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${useToken}/sendPhoto`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                photo: photo,
                caption: caption,
                parse_mode: 'HTML',
                reply_markup: replyMarkup
            }),
        });

        const data = await response.json();
        if (!data.ok) {
            console.error("Failed to send Telegram photo:", data);
            if (caption) {
                await sendMessage(chatId, caption.replace(/<[^>]*>/g, ''), useToken);
                return true;
            }
            return false;
        }
        return true;
    } catch (error) {
        console.error("Error sending Telegram photo:", error);
        if (caption) {
            await sendMessage(chatId, caption.replace(/<[^>]*>/g, ''), useToken);
            return true;
        }
        return false;
    }
}
