import pool from './db';
import { RowDataPacket } from 'mysql2';
import fs from 'fs';
import path from 'path';

export function parseTokens(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(/[\r\n,;|]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 10 && t.includes(':'));
}

export async function getBotTokens(): Promise<string[]> {
    const tokens: string[] = [];
    if (process.env.TELEGRAM_BOT_TOKENS) {
        tokens.push(...parseTokens(process.env.TELEGRAM_BOT_TOKENS));
    }
    if (process.env.TELEGRAM_BOT_TOKEN) {
        tokens.push(...parseTokens(process.env.TELEGRAM_BOT_TOKEN));
    }

    if (tokens.length === 0) {
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT `value` FROM settings WHERE `key` = 'telegram_bot_token' LIMIT 1"
            );
            if (rows && rows[0]?.value) {
                tokens.push(...parseTokens(String(rows[0].value)));
            }
        } catch (e) {
            console.error('Error fetching bot token from settings:', e);
        }
    }

    return [...new Set(tokens)];
}

export async function getBotToken(): Promise<string> {
    const tokens = await getBotTokens();
    return tokens[0] || '';
}

export async function sendMessage(chatId: number | string, text: string, token?: string): Promise<boolean> {
    const tokens = token ? [token] : await getBotTokens();
    if (tokens.length === 0) {
        console.error("TELEGRAM_BOT_TOKEN is not set in env or settings");
        return false;
    }

    for (const currentToken of tokens) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${currentToken}/sendMessage`, {
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
            if (data.ok) {
                return true;
            }

            const desc = String(data.description || '').toLowerCase();
            if (
                desc.includes('chat not found') ||
                desc.includes('bot was blocked') ||
                desc.includes('forbidden') ||
                desc.includes('user is deactivated') ||
                desc.includes('bot was kicked')
            ) {
                // Try next bot token
                continue;
            } else {
                console.error("Failed to send Telegram message:", data);
            }
        } catch (error) {
            console.error("Error sending Telegram message:", error);
        }
    }

    return false;
}

export async function sendPhoto(
    chatId: number | string,
    photo: string,
    caption?: string,
    token?: string,
    replyMarkup?: any
): Promise<boolean> {
    const tokens = token ? [token] : await getBotTokens();
    if (tokens.length === 0) {
        console.error("TELEGRAM_BOT_TOKEN is not set in env or settings");
        return false;
    }

    let isLocalFile = false;
    let localFilePath = '';

    let cleanRel = photo;
    if (cleanRel.includes('/uploads/')) {
        cleanRel = 'uploads/' + cleanRel.split('/uploads/')[1];
    } else {
        cleanRel = cleanRel.replace(/^\//, '');
    }

    const candidates = [
        path.join(process.cwd(), cleanRel),
        path.join(process.cwd(), 'public', cleanRel),
        path.join(process.cwd(), 'webapp', 'public', cleanRel),
        path.join(process.cwd(), '..', 'webapp', 'public', cleanRel),
        photo
    ];

    for (const c of candidates) {
        try {
            if (c && fs.existsSync(c) && fs.statSync(c).isFile()) {
                isLocalFile = true;
                localFilePath = c;
                break;
            }
        } catch (e) {}
    }

    for (const useToken of tokens) {
        try {
            let response: Response;

            if (isLocalFile) {
                console.log(`[TELEGRAM] 📸 Sending photo from local file: ${localFilePath}`);
                const fileBuffer = fs.readFileSync(localFilePath);
                const blob = new Blob([fileBuffer]);
                const formData = new FormData();
                formData.append('chat_id', String(chatId));
                formData.append('photo', blob, path.basename(localFilePath));
                if (caption) {
                    formData.append('caption', caption);
                    formData.append('parse_mode', 'HTML');
                }
                if (replyMarkup) {
                    formData.append('reply_markup', typeof replyMarkup === 'string' ? replyMarkup : JSON.stringify(replyMarkup));
                }

                response = await fetch(`https://api.telegram.org/bot${useToken}/sendPhoto`, {
                    method: 'POST',
                    body: formData,
                });
            } else {
                console.log(`[TELEGRAM] 🌐 Sending photo from URL: ${photo}`);
                response = await fetch(`https://api.telegram.org/bot${useToken}/sendPhoto`, {
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
            }

            const data = await response.json();
            if (data.ok) {
                return true;
            }

            const desc = String(data.description || '').toLowerCase();
            if (
                desc.includes('chat not found') ||
                desc.includes('bot was blocked') ||
                desc.includes('forbidden') ||
                desc.includes('user is deactivated') ||
                desc.includes('bot was kicked')
            ) {
                // Try next bot token
                continue;
            }

            console.error("Failed to send Telegram photo:", data);
            if (caption) {
                console.log(`[TELEGRAM] ⚠️ Photo send failed (${data.description || 'Unknown'}), fallback to sendMessage...`);
                const fallbackOk = await sendMessage(chatId, caption.replace(/<[^>]*>/g, ''), useToken);
                if (fallbackOk) return true;
            }
        } catch (error) {
            console.error("Error sending Telegram photo:", error);
            if (caption) {
                const fallbackOk = await sendMessage(chatId, caption.replace(/<[^>]*>/g, ''), useToken);
                if (fallbackOk) return true;
            }
        }
    }

    return false;
}
