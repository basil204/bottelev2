
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendMessage(chatId: number | string, text: string, token?: string) {
    const useToken = token || TELEGRAM_BOT_TOKEN;
    if (!useToken) {
        console.error("TELEGRAM_BOT_TOKEN is not set");
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

export async function sendPhoto(chatId: number | string, photo: string, caption?: string, token?: string): Promise<boolean> {
    const useToken = token || TELEGRAM_BOT_TOKEN;
    if (!useToken) {
        console.error("TELEGRAM_BOT_TOKEN is not set");
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
            }),
        });

        const data = await response.json();
        if (!data.ok) {
            console.error("Failed to send Telegram photo:", data);
            // Fallback: send as text message if photo fails
            if (caption) {
                console.log("Falling back to text message...");
                await sendMessage(chatId, caption.replace(/<[^>]*>/g, ''), token); // Strip HTML
                return true; // Consider it success with fallback
            }
            return false;
        }
        return true;
    } catch (error) {
        console.error("Error sending Telegram photo:", error);
        // Fallback: send as text message
        if (caption) {
            await sendMessage(chatId, caption.replace(/<[^>]*>/g, ''), token);
            return true;
        }
        return false;
    }
}
