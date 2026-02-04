/**
 * Handle mua Gmail EDU qua Telegram Bot
 * Logic:
 * 1. Hiển thị thông tin mua Gmail EDU
 * 2. User nhập số lượng
 * 3. Kiểm tra số dư
 * 4. Tạo Gmail EDU mới qua Google Admin API
 * 5. Gửi email + password cho user
 * 6. Cleanup script sẽ tự động xóa sau 1 giờ khi user login
 */

import { query } from '../database/index.js';
import { createGmailAccountForSale, getGmailEduPrice, markAccountSold } from '../controllers/gmailController.js';
import { updateBalance, getUserByTelegram } from '../controllers/userController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { createOrder } from '../controllers/orderController.js';
import { notifyAdminAboutPurchase, getAdminIds } from './handleNotify.js';
import { formatCurrency } from '../../utils/index.js';
import { getCache, setCache, delCache } from '../../lib/cache/index.js';

// Cache key cho Gmail EDU quantity input
const gmailEduCacheKey = (telegramId) => `gmail_edu_waiting_${telegramId}`;

// Lấy setting string
const getSettingString = async (key, defaultValue = '') => {
    try {
        const rows = await query('SELECT `value` FROM settings WHERE `key` = ?', [key]);
        if (rows && rows[0]) {
            return rows[0].value || defaultValue;
        }
        return defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

// Lấy setting boolean
const getSettingBoolean = async (key, defaultValue = true) => {
    try {
        const rows = await query('SELECT `value` FROM settings WHERE `key` = ?', [key]);
        if (rows && rows[0]) {
            return rows[0].value === 'true';
        }
        return defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

// Lấy số giờ xóa
const getDeleteHours = async () => {
    try {
        const rows = await query('SELECT `value` FROM settings WHERE `key` = ?', ['gmail_edu_delete_hours']);
        if (rows && rows[0]) {
            return Number(rows[0].value) || 1;
        }
        return 1;
    } catch (e) {
        return 1;
    }
};

/**
 * Xử lý input số lượng Gmail EDU từ user
 * @returns {boolean} true nếu đã xử lý, false nếu không phải Gmail input
 */
export const handleGmailEduQuantityInput = async (bot, msg, config) => {
    const telegramId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    // Kiểm tra xem có đang chờ input Gmail EDU không
    const waitingState = getCache(gmailEduCacheKey(telegramId));
    if (!waitingState) {
        return false; // Không phải Gmail EDU input
    }

    const lang = waitingState.lang || 'vi';

    // Nếu đang chờ input password
    if (waitingState.waitingPassword) {
        delCache(gmailEduCacheKey(telegramId));

        // Validate password
        if (text.length < 8) {
            const errorMsg = lang === 'en'
                ? '❌ Password must be at least 8 characters.'
                : '❌ Mật khẩu phải có ít nhất 8 ký tự.';
            await bot.sendMessage(chatId, errorMsg);
            return true;
        }

        // Gọi hàm mua Gmail với password tùy chỉnh
        const user = await getUserByTelegram(telegramId);
        if (user) {
            await handleBuyGmailEdu(bot, msg, user, waitingState.quantity, lang, text);
        }
        return true;
    }

    // Xóa state chờ số lượng
    delCache(gmailEduCacheKey(telegramId));

    // Parse số lượng
    const quantity = parseInt(text, 10);
    if (isNaN(quantity) || quantity < 1) {
        const errorMsg = lang === 'en'
            ? '❌ Invalid quantity. Please enter a positive integer (e.g., 1, 2, 5).'
            : '❌ Số lượng không hợp lệ. Vui lòng nhập số nguyên dương (ví dụ: 1, 2, 5).';
        await bot.sendMessage(chatId, errorMsg);
        return true;
    }

    // Giới hạn số lượng tối đa
    if (quantity > 10) {
        const errorMsg = lang === 'en'
            ? '❌ Maximum 10 Gmail accounts per purchase.'
            : '❌ Tối đa 10 tài khoản Gmail mỗi lần mua.';
        await bot.sendMessage(chatId, errorMsg);
        return true;
    }

    // Hiển thị lựa chọn password
    const { createCallbackData } = await import('../../utils/index.js');

    const message = lang === 'en'
        ? `📧 Buying **${quantity} Gmail EDU**\n\n🔐 **Password option:**\nDo you want to set a custom password or use auto-generated?`
        : `📧 Mua **${quantity} Gmail EDU**\n\n🔐 **Lựa chọn mật khẩu:**\nBạn muốn tự đặt mật khẩu hay để hệ thống tự tạo?`;

    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: lang === 'en' ? '🔄 Auto-generate password' : '🔄 Tự động tạo password',
                        callback_data: createCallbackData({ action: 'gmail_pw_auto', qty: quantity })
                    }
                ],
                [
                    {
                        text: lang === 'en' ? '✏️ Set custom password' : '✏️ Tự đặt mật khẩu',
                        callback_data: createCallbackData({ action: 'gmail_pw_custom', qty: quantity })
                    }
                ],
                [
                    {
                        text: lang === 'en' ? '❌ Cancel' : '❌ Huỷ',
                        callback_data: createCallbackData({ action: 'gmail_pw_cancel' })
                    }
                ]
            ]
        }
    });

    return true;
};

/**
 * Mua Gmail EDU
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message
 * @param {Object} user - User object từ DB
 * @param {number} quantity - Số lượng Gmail cần mua
 * @param {string} lang - Ngôn ngữ (vi/en)
 * @param {string|null} customPassword - Mật khẩu tùy chỉnh (null = tự động tạo)
 */
export const handleBuyGmailEdu = async (bot, msg, user, quantity = 1, lang = 'vi', customPassword = null, config = null) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
        // Kiểm tra tính năng có bật không
        const enabled = await getSettingBoolean('gmail_edu_enabled', true);
        if (!enabled) {
            const errorMsg = lang === 'en'
                ? '❌ Gmail EDU purchase is currently disabled.'
                : '❌ Tính năng mua Gmail EDU hiện đang tắt.';
            return bot.sendMessage(chatId, errorMsg);
        }

        // Lấy giá Gmail EDU từ settings
        const pricePerGmail = await getGmailEduPrice();
        const totalPrice = pricePerGmail * quantity;

        // Lấy lại số dư mới nhất
        const currentUser = await getUserByTelegram(telegramId);
        if (!currentUser) {
            const errorMsg = lang === 'en'
                ? '❌ Please /start to create an account.'
                : '❌ Vui lòng /start để tạo tài khoản.';
            return bot.sendMessage(chatId, errorMsg);
        }

        const currentBalance = Number(currentUser.balance) || 0;

        // Kiểm tra số dư - nếu không đủ, hiện lựa chọn nạp tiền
        if (currentBalance < totalPrice) {
            let missingAmount = totalPrice - currentBalance;

            // Đảm bảo số tiền nạp tối thiểu là 5,000 VND cho Bank
            const minBankDeposit = 5000;
            if (missingAmount < minBankDeposit) {
                missingAmount = minBankDeposit;
            }

            // Lưu thông tin purchase vào cache để hoàn tất sau khi nạp tiền
            const purchaseKey = `gmail_edu_purchase_${telegramId}`;
            setCache(purchaseKey, {
                type: 'gmail_edu',
                quantity,
                totalPrice,
                pricePerGmail: await getGmailEduPrice(),
                userId: currentUser.id,
                telegramId: telegramId,
                chatId: chatId,
                lang: lang,
                missingAmount: missingAmount
            }, 30 * 60 * 1000); // 30 phút

            // Tính số USDT cần nạp (tối thiểu 1 USDT)
            let exchangeRate = 26000;
            try {
                const rateRows = await query('SELECT `value` FROM settings WHERE `key` = ?', ['exchange_rate']);
                if (rateRows && rateRows[0]?.value) {
                    exchangeRate = Number(rateRows[0].value) || 26000;
                }
            } catch (e) { }

            let usdtNeeded = Math.ceil(missingAmount / exchangeRate * 10) / 10; // Làm tròn lên 0.1
            if (usdtNeeded < 1) usdtNeeded = 1;

            const { createCallbackData } = await import('../../utils/index.js');

            const notifyMsg = lang === 'en'
                ? `❌ **Insufficient balance!**\n\n💵 Required: ${formatCurrency(totalPrice)}\n💰 You have: ${formatCurrency(currentBalance)}\n💸 Missing: ${formatCurrency(missingAmount)}\n\n💡 Please choose a payment method:`
                : `❌ **Số dư không đủ!**\n\n💵 Cần: ${formatCurrency(totalPrice)}\n💰 Bạn có: ${formatCurrency(currentBalance)}\n💸 Thiếu: ${formatCurrency(missingAmount)}\n\n💡 Vui lòng chọn phương thức nạp tiền:`;

            await bot.sendMessage(chatId, notifyMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: lang === 'en' ? `🏦 Bank QR (${formatCurrency(missingAmount)})` : `🏦 Chuyển khoản (${formatCurrency(missingAmount)})`,
                                callback_data: createCallbackData({ action: 'gmail_deposit_bank', amount: missingAmount })
                            }
                        ],
                        [
                            {
                                text: `💵 USDT (≥${usdtNeeded}U)`,
                                callback_data: createCallbackData({ action: 'gmail_deposit_usdt', amount: usdtNeeded })
                            }
                        ],
                        [
                            {
                                text: lang === 'en' ? '❌ Cancel' : '❌ Huỷ',
                                callback_data: createCallbackData({ action: 'gmail_deposit_cancel' })
                            }
                        ]
                    ]
                }
            });

            return { success: false, needDeposit: true, missingAmount };
        }

        // Lấy domain từ settings
        const domain = await getSettingString('gmail_edu_domain', 'suafpoly.app');
        const deleteHours = await getDeleteHours();

        // Thông báo đang tạo
        const creatingText = lang === 'en'
            ? `⏳ Creating ${quantity} Gmail EDU...`
            : `⏳ Đang tạo ${quantity} Gmail EDU...`;
        const creatingMsg = await bot.sendMessage(chatId, creatingText);

        // Tạo Gmail EDU
        const createdAccounts = [];
        for (let i = 0; i < quantity; i++) {
            const result = await createGmailAccountForSale('edu', domain, customPassword);

            if (result.success) {
                // Đánh dấu account đã bán
                const [account] = await query('SELECT id FROM gmail_accounts WHERE email = ? LIMIT 1', [result.email]);
                if (account) {
                    await markAccountSold(account.id);
                }
                createdAccounts.push(result);
            } else {
                console.error(`[BUY_GMAIL_EDU] Error creating account ${i + 1}:`, result.error);
            }

            // Delay để tránh rate limit
            if (i < quantity - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Kiểm tra xem có tạo được account nào không
        if (createdAccounts.length === 0) {
            try { await bot.deleteMessage(chatId, creatingMsg.message_id); } catch (e) { }
            const errorMsg = lang === 'en'
                ? '❌ Unable to create Gmail EDU. Please try again later.'
                : '❌ Không thể tạo Gmail EDU. Vui lòng thử lại sau.';
            return bot.sendMessage(chatId, errorMsg);
        }

        // Tính giá thực tế (chỉ tính cho số account tạo thành công)
        const actualPrice = pricePerGmail * createdAccounts.length;

        // Trừ tiền
        await updateBalance(currentUser.id, -actualPrice);
        await addBalanceLog({
            userId: currentUser.id,
            amount: -actualPrice,
            reason: `buy_gmail_edu_${createdAccounts.length}`,
            adminId: null
        });

        // Lấy lại số dư sau khi trừ
        const updatedUser = await getUserByTelegram(telegramId);
        const finalBalance = Number(updatedUser.balance);

        // Create Order Log and Notify Admin
        try {
            const actualPrice = pricePerGmail * createdAccounts.length;
            let orderId = 'GMAIL_EDU';
            const orderResult = await createOrder({
                userId: currentUser.id,
                productId: 0, // 0 for Gmail EDU
                price: actualPrice,
                status: 'completed',
                note: `Mua ${createdAccounts.length} Gmail EDU`
            });
            if (orderResult && orderResult.insertId) orderId = orderResult.insertId;

            // Notify Admins - fetch from database
            const adminIds = await getAdminIds(config?.ADMIN_IDS || []);
            if (adminIds.length > 0) {
                await notifyAdminAboutPurchase(bot, adminIds, {
                    orderId: orderId,
                    productName: `Gmail EDU`,
                    username: user.username,
                    telegramId: user.telegram_id,
                    quantity: createdAccounts.length,
                    price: actualPrice,
                    finalBalance: finalBalance,
                    accounts: createdAccounts
                });
            }
        } catch (logErr) {
            console.error('[BUY_GMAIL_EDU] Error logging/notifying:', logErr);
        }

        // Xóa message đang tạo
        try { await bot.deleteMessage(chatId, creatingMsg.message_id); } catch (e) { }

        // Gửi kết quả
        let resultMessage;
        if (lang === 'en') {
            resultMessage = `✅ **Gmail EDU purchased successfully!**\n\n`;
            resultMessage += `📧 Quantity: ${createdAccounts.length}\n`;
            resultMessage += `💰 Price: ${formatCurrency(actualPrice)}\n`;
            resultMessage += `💵 New balance: ${formatCurrency(finalBalance)}\n\n`;
            resultMessage += `⚠️ **Note:** Account will be automatically deleted ${deleteHours} hour(s) after first login.`;
        } else {
            resultMessage = `✅ **Mua Gmail EDU thành công!**\n\n`;
            resultMessage += `📧 Số lượng: ${createdAccounts.length}\n`;
            resultMessage += `💰 Giá: ${formatCurrency(actualPrice)}\n`;
            resultMessage += `💵 Số dư mới: ${formatCurrency(finalBalance)}\n\n`;
            resultMessage += `⚠️ **Lưu ý:** Tài khoản sẽ tự động xóa sau ${deleteHours} giờ kể từ khi bạn đăng nhập lần đầu.`;
        }

        await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });

        // Gửi từng tài khoản riêng để dễ copy
        for (let i = 0; i < createdAccounts.length; i++) {
            const acc = createdAccounts[i];
            const accountMsg = lang === 'en'
                ? `📧 **Account ${i + 1}:**\n\n🔹 **TK:**\n\`${acc.email}\`\n\n🔹 **MK:**\n\`${acc.password}\``
                : `📧 **Tài khoản ${i + 1}:**\n\n🔹 **TK:**\n\`${acc.email}\`\n\n🔹 **MK:**\n\`${acc.password}\``;

            await bot.sendMessage(chatId, accountMsg, { parse_mode: 'Markdown' });
        }

        console.log(`[BUY_GMAIL_EDU] ✅ User ${telegramId} purchased ${createdAccounts.length} Gmail EDU`);

        return { success: true, accounts: createdAccounts };

    } catch (error) {
        console.error('[BUY_GMAIL_EDU] Error:', error);
        const errorMsg = lang === 'en'
            ? '❌ An error occurred while purchasing Gmail EDU. Please try again later.'
            : '❌ Có lỗi xảy ra khi mua Gmail EDU. Vui lòng thử lại sau.';
        await bot.sendMessage(chatId, errorMsg);
        return { success: false, error: error.message };
    }
};

/**
 * Hiển thị thông tin mua Gmail EDU và chờ input số lượng
 */
export const showGmailEduInfo = async (bot, chatId, user) => {
    try {
        const lang = user.language || 'vi';

        const enabled = await getSettingBoolean('gmail_edu_enabled', true);
        if (!enabled) {
            const errorMsg = lang === 'en'
                ? '❌ Gmail EDU purchase is currently disabled.'
                : '❌ Tính năng mua Gmail EDU hiện đang tắt.';
            return bot.sendMessage(chatId, errorMsg);
        }

        const price = await getGmailEduPrice();
        const domain = await getSettingString('gmail_edu_domain', 'suafpoly.app');
        const deleteHours = await getDeleteHours();
        const currentBalance = Number(user.balance) || 0;

        let message;
        if (lang === 'en') {
            message = `📧 **BUY GMAIL EDU**\n\n` +
                `💰 Price: ${formatCurrency(price)} / 1 Gmail\n` +
                `🌐 Domain: @${domain}\n` +
                `💵 Your balance: ${formatCurrency(currentBalance)}\n\n` +
                `⚠️ **Note:**\n` +
                `- Account will be auto-deleted ${deleteHours} hour(s) after first login\n` +
                `- No refunds after purchase\n` +
                `- Maximum 10 accounts per purchase\n\n` +
                `Enter the quantity you want to buy (e.g., 1, 2, 5):`;
        } else {
            message = `📧 **MUA GMAIL EDU**\n\n` +
                `💰 Giá: ${formatCurrency(price)} / 1 Gmail\n` +
                `🌐 Domain: @${domain}\n` +
                `💵 Số dư của bạn: ${formatCurrency(currentBalance)}\n\n` +
                `⚠️ **Lưu ý:**\n` +
                `- Tài khoản sẽ tự động xóa sau ${deleteHours} giờ kể từ khi login\n` +
                `- Không hoàn tiền sau khi mua\n` +
                `- Tối đa 10 tài khoản mỗi lần mua\n\n` +
                `Nhập số lượng Gmail bạn muốn mua (ví dụ: 1, 2, 5):`;
        }

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

        // Lưu state chờ input số lượng (10 phút)
        setCache(gmailEduCacheKey(user.telegram_id), {
            waiting: true,
            lang: lang
        }, 10 * 60 * 1000);

        return true;
    } catch (error) {
        console.error('[GMAIL_EDU_INFO] Error:', error);
        return false;
    }
};

/**
 * Hoàn tất mua Gmail EDU sau khi nạp tiền thành công
 * @param {Object} bot - Telegram bot instance
 * @param {string|number} telegramId - Telegram user ID
 * @returns {boolean} true nếu có pending purchase và đã xử lý
 */
export const completeGmailEduPurchaseAfterDeposit = async (bot, telegramId) => {
    try {
        const purchaseKey = `gmail_edu_purchase_${telegramId}`;
        const purchaseInfo = getCache(purchaseKey);

        if (!purchaseInfo || purchaseInfo.type !== 'gmail_edu') {
            return false; // Không có pending Gmail EDU purchase
        }

        const { quantity, totalPrice, chatId, lang } = purchaseInfo;

        // Kiểm tra số dư sau khi nạp
        const user = await getUserByTelegram(telegramId);
        if (!user) {
            return false;
        }

        const currentBalance = Number(user.balance) || 0;
        if (currentBalance < totalPrice) {
            // Vẫn chưa đủ tiền
            return false;
        }

        // Xóa cache purchase
        delCache(purchaseKey);

        console.log(`[GMAIL_EDU_AUTO_COMPLETE] Processing pending purchase for user ${telegramId}: ${quantity} Gmail EDU`);

        // Gọi hàm mua Gmail EDU (sẽ không tạo QR lại vì đã đủ tiền)
        const fakeMsg = {
            chat: { id: chatId },
            from: { id: telegramId }
        };

        await handleBuyGmailEdu(bot, fakeMsg, user, quantity, lang || 'vi');

        return true;

    } catch (error) {
        console.error('[GMAIL_EDU_AUTO_COMPLETE] Error:', error);
        return false;
    }
};

export default {
    handleBuyGmailEdu,
    showGmailEduInfo,
    handleGmailEduQuantityInput,
    completeGmailEduPurchaseAfterDeposit
};
