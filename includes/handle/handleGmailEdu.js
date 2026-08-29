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
import { createCallbackData, formatCurrency } from '../../utils/index.js';
import { getCache, setCache, delCache } from '../../lib/cache/index.js';
import { t } from '../helpers/langHelper.js';

// Cache key cho Gmail EDU quantity input
const gmailEduCacheKey = (telegramId) => `gmail_edu_waiting_${telegramId}`;

// Helper for 3-lang text
const L = (lang, vi, en, zh) => ({ en, zh }[lang] || vi);

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

// Tổng đã bán gồm số bán thực tế và phần điều chỉnh thủ công từ trang quản trị.
const getGmailEduSoldCount = async () => {
    try {
        const soldRows = await query(
            'SELECT COUNT(*) AS total FROM gmail_accounts WHERE type = ? AND status = ?',
            ['edu', 'sold']
        );
        const adjustmentRows = await query(
            'SELECT `value` FROM settings WHERE `key` = ? LIMIT 1',
            ['gmail_edu_sold_adjustment']
        );
        const actualSold = Number(soldRows?.[0]?.total || 0);
        const adjustment = Number(adjustmentRows?.[0]?.value || 0);
        return Math.max(0, actualSold + adjustment);
    } catch (error) {
        console.error('[GMAIL_EDU_SOLD_COUNT] Error:', error.message);
        return 0;
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

    // Nếu người dùng chọn nút Menu (bắt đầu bằng emoji hoặc từ khóa menu), hủy state chờ số lượng và nhường cho handler Menu
    if (
        text.startsWith('/') ||
        /^(🛟|🛒|💰|💵|📆|🌐|👤|📜|❌|🔙|📁|📝|📦|🎁|📌)/.test(text) ||
        /Hỗ trợ|Bảo hành|Support|Warranty|Mua hàng|Nạp tiền|Deposit|Điểm danh|Check-in|Tiện ích|Utilities|Tài khoản|Lịch sử/i.test(text)
    ) {
        delCache(gmailEduCacheKey(telegramId));
        return false;
    }

    // Nếu đang chờ input password
    if (waitingState.waitingPassword) {
        delCache(gmailEduCacheKey(telegramId));

        // Validate password
        if (text.length < 8) {
            const errorMsg = L(lang,
                '❌ Mật khẩu phải có ít nhất 8 ký tự.',
                '❌ Password must be at least 8 characters.',
                '❌ 密码至少需要8个字符。'
            );
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
        const errorMsg = L(lang,
            '❌ Số lượng không hợp lệ. Vui lòng nhập số nguyên dương (ví dụ: 1, 2, 5).',
            '❌ Invalid quantity. Please enter a positive integer (e.g., 1, 2, 5).',
            '❌ 数量无效，请输入正整数（例如：1、2、5）。'
        );
        await bot.sendMessage(chatId, errorMsg);
        return true;
    }

    // Giới hạn số lượng tối đa
    if (quantity > 10) {
        const errorMsg = L(lang,
            '❌ Tối đa 10 tài khoản Gmail mỗi lần mua.',
            '❌ Maximum 10 Gmail accounts per purchase.',
            '❌ 每次最多购买10个Gmail账户。'
        );
        await bot.sendMessage(chatId, errorMsg);
        return true;
    }

    // Hiển thị lựa chọn password
    const { createCallbackData } = await import('../../utils/index.js');

    const message = L(lang,
        `📧 Mua **${quantity} Gmail EDU**\n\n🔐 **Lựa chọn mật khẩu:**\nBạn muốn tự đặt mật khẩu hay để hệ thống tự tạo?`,
        `📧 Buying **${quantity} Gmail EDU**\n\n🔐 **Password option:**\nDo you want to set a custom password or use auto-generated?`,
        `📧 购买 **${quantity} Gmail EDU**\n\n🔐 **密码选项：**\n您想自定义密码还是自动生成？`
    );

    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: L(lang, '🔄 Tự động tạo password', '🔄 Auto-generate password', '🔄 自动生成密码'),
                        callback_data: createCallbackData({ action: 'gmail_pw_auto', qty: quantity }),
                        style: 'success'
                    }
                ],
                [
                    {
                        text: L(lang, '✏️ Tự đặt mật khẩu', '✏️ Set custom password', '✏️ 自定义密码'),
                        callback_data: createCallbackData({ action: 'gmail_pw_custom', qty: quantity }),
                        style: 'primary'
                    }
                ],
                [
                    {
                        text: L(lang, '❌ Huỷ', '❌ Cancel', '❌ 取消'),
                        callback_data: createCallbackData({ action: 'gmail_pw_cancel' }),
                        style: 'danger'
                    }
                ]
            ]
        }
    });

    return true;
};

/**
 * Mua Gmail EDU
 */
export const handleBuyGmailEdu = async (bot, msg, user, quantity = 1, lang = 'vi', customPassword = null, config = null) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
        // Kiểm tra tính năng có bật không
        const enabled = await getSettingBoolean('gmail_edu_enabled', true);
        if (!enabled) {
            const errorMsg = L(lang,
                '❌ Tính năng mua Gmail EDU hiện đang tắt.',
                '❌ Gmail EDU purchase is currently disabled.',
                '❌ Gmail EDU 购买功能当前已关闭。'
            );
            return bot.sendMessage(chatId, errorMsg);
        }

        // Lấy giá Gmail EDU từ settings hoặc custom_pricing riêng cho user
        const pricePerGmail = await getGmailEduPrice(telegramId);
        const totalPrice = pricePerGmail * quantity;

        // Lấy lại số dư mới nhất
        const currentUser = await getUserByTelegram(telegramId);
        if (!currentUser) {
            const errorMsg = L(lang,
                '❌ Vui lòng /start để tạo tài khoản.',
                '❌ Please /start to create an account.',
                '❌ 请使用 /start 创建账户。'
            );
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
                pricePerGmail: await getGmailEduPrice(telegramId),
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

            const notifyMsg = L(lang,
                `❌ **Số dư không đủ!**\n\n💵 Cần: ${formatCurrency(totalPrice)}\n💰 Bạn có: ${formatCurrency(currentBalance)}\n💸 Thiếu: ${formatCurrency(missingAmount)}\n\n💡 Vui lòng chọn phương thức nạp tiền:`,
                `❌ **Insufficient balance!**\n\n💵 Required: ${formatCurrency(totalPrice)}\n💰 You have: ${formatCurrency(currentBalance)}\n💸 Missing: ${formatCurrency(missingAmount)}\n\n💡 Please choose a payment method:`,
                `❌ **余额不足！**\n\n💵 需要: ${formatCurrency(totalPrice)}\n💰 您有: ${formatCurrency(currentBalance)}\n💸 差额: ${formatCurrency(missingAmount)}\n\n💡 请选择充值方式：`
            );

            await bot.sendMessage(chatId, notifyMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: L(lang, `🏦 Chuyển khoản (${formatCurrency(missingAmount)})`, `🏦 Bank QR (${formatCurrency(missingAmount)})`, `🏦 银行转账 (${formatCurrency(missingAmount)})`),
                                callback_data: createCallbackData({ action: 'gmail_deposit_bank', amount: missingAmount }),
                                style: 'primary'
                            }
                        ],
                        [
                            {
                                text: `💵 USDT (≥${usdtNeeded}U)`,
                                callback_data: createCallbackData({ action: 'gmail_deposit_usdt', amount: usdtNeeded }),
                                style: 'success'
                            }
                        ],
                        [
                            {
                                text: L(lang, '❌ Huỷ', '❌ Cancel', '❌ 取消'),
                                callback_data: createCallbackData({ action: 'gmail_deposit_cancel' }),
                                style: 'danger'
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
        const creatingText = L(lang,
            `⏳ Đang tạo ${quantity} Gmail EDU...`,
            `⏳ Creating ${quantity} Gmail EDU...`,
            `⏳ 正在创建 ${quantity} 个 Gmail EDU...`
        );
        const creatingMsg = await bot.sendMessage(chatId, creatingText);

        // Tạo Gmail EDU
        const createdAccounts = [];
        for (let i = 0; i < quantity; i++) {
            const result = await createGmailAccountForSale('edu', domain, customPassword);

            if (result.success) {
                // Đánh dấu account đã bán
                const [account] = await query('SELECT id FROM gmail_accounts WHERE email = ? LIMIT 1', [result.email]);
                if (account) {
                    await markAccountSold(account.id, currentUser.id, pricePerGmail);
                    createdAccounts.push({ ...result, id: account.id });
                }
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
            const errorMsg = L(lang,
                '❌ Không thể tạo Gmail EDU. Vui lòng thử lại sau.',
                '❌ Unable to create Gmail EDU. Please try again later.',
                '❌ 无法创建 Gmail EDU，请稍后再试。'
            );
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
            const accountsData = createdAccounts.map(acc => `${acc.email}|${acc.password}`).join('\n');
            const orderResult = await createOrder({
                userId: currentUser.id,
                productId: 0, // 0 for Gmail EDU
                price: actualPrice,
                status: 'completed',
                email: accountsData,
                note: `Mua ${createdAccounts.length} Gmail EDU`
            });
            if (orderResult && orderResult.insertId) orderId = orderResult.insertId;

            // Update orderId cho các accounts đã tạo
            const accountIds = createdAccounts.map(acc => acc.id).filter(id => id);
            if (accountIds.length > 0) {
                const placeholders = accountIds.map(() => '?').join(',');
                await query(`UPDATE gmail_accounts SET order_id = ? WHERE id IN (${placeholders})`, [orderId, ...accountIds]);
            }

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
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const invoiceCode = `EDU-${Date.now().toString().slice(-6)}`;
        const noteMsg = L(lang,
            `⚠️ **Lưu ý:** Tài khoản sẽ tự động xóa sau ${deleteHours} giờ kể từ khi bạn đăng nhập lần đầu.`,
            `⚠️ **Note:** Account will be automatically deleted ${deleteHours} hour(s) after first login.`,
            `⚠️ **注意：** 账户将在首次登录后 ${deleteHours} 小时自动删除。`
        );
        const qtyLine = t('payment_success_qty', lang, { quantity: createdAccounts.length });

        let resultMessage = t('payment_success', lang, {
            invoiceCode: invoiceCode,
            time: timeStr,
            productName: 'Gmail EDU',
            qtyLine: qtyLine,
            price: formatCurrency(actualPrice),
            finalBalance: formatCurrency(finalBalance),
            accountInfo: noteMsg
        });

        await bot.sendMessage(chatId, resultMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{
                    text: L(lang, 'Mua tiếp', 'Buy more', '继续购买'),
                    callback_data: createCallbackData({ action: 'gmail_buy_again' }),
                    style: 'primary'
                }]]
            }
        });

        // Một tài khoản: gửi trực tiếp. Từ hai tài khoản: gom vào file TXT.
        if (createdAccounts.length >= 2) {
            const fileContent = createdAccounts
                .map((acc) => `${acc.email}|${acc.password}`)
                .join('\n');
            const fileName = `gmail_edu_${createdAccounts.length}_${Date.now()}.txt`;
            await bot.sendDocument(
                chatId,
                Buffer.from(fileContent, 'utf8'),
                {
                    caption: L(
                        lang,
                        `📄 Danh sách ${createdAccounts.length} tài khoản Gmail EDU (định dạng TK|MK)`,
                        `📄 ${createdAccounts.length} Gmail EDU accounts (username|password)`,
                        `📄 ${createdAccounts.length} 个 Gmail EDU 账号（账号|密码）`
                    )
                },
                { filename: fileName, contentType: 'text/plain' }
            );
        } else {
          for (let i = 0; i < createdAccounts.length; i++) {
            const acc = createdAccounts[i];
            const accountMsg = L(lang,
                `📧 **Tài khoản ${i + 1}:**\n\n🔹 **TK:** \`${acc.email}\`\n🔹 **MK:** \`${acc.password}\``,
                `📧 **Account ${i + 1}:**\n\n🔹 **TK:** \`${acc.email}\`\n🔹 **MK:** \`${acc.password}\``,
                `📧 **账户 ${i + 1}:**\n\n🔹 **账号:** \`${acc.email}\`\n🔹 **密码:** \`${acc.password}\``
            );

            await bot.sendMessage(chatId, accountMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: L(lang, 'Sao chép email', 'Copy email', '复制邮箱'),
                            copy_text: { text: acc.email },
                            style: 'primary'
                        },
                        {
                            text: L(lang, 'Sao chép mật khẩu', 'Copy password', '复制密码'),
                            copy_text: { text: acc.password },
                            style: 'success'
                        }
                    ]]
                }
            });
          }
        }

        console.log(`[BUY_GMAIL_EDU] ✅ User ${telegramId} purchased ${createdAccounts.length} Gmail EDU`);

        return { success: true, accounts: createdAccounts };

    } catch (error) {
        console.error('[BUY_GMAIL_EDU] Error:', error);
        const errorMsg = L(lang,
            '❌ Có lỗi xảy ra khi mua Gmail EDU. Vui lòng thử lại sau.',
            '❌ An error occurred while purchasing Gmail EDU. Please try again later.',
            '❌ 购买 Gmail EDU 时出现错误，请稍后再试。'
        );
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
            const errorMsg = L(lang,
                '❌ Tính năng mua Gmail EDU hiện đang tắt.',
                '❌ Gmail EDU purchase is currently disabled.',
                '❌ Gmail EDU 购买功能当前已关闭。'
            );
            return bot.sendMessage(chatId, errorMsg);
        }

        const price = await getGmailEduPrice(user.telegram_id || user.id);
        const domain = await getSettingString('gmail_edu_domain', 'suafpoly.app');
        const deleteHours = await getDeleteHours();
        const soldCount = await getGmailEduSoldCount();
        const currentBalance = Number(user.balance) || 0;

        const message = L(lang,
            `📧 **MUA GMAIL EDU**\n\n💰 Giá: ${formatCurrency(price)} / 1 Gmail\n🌐 Domain: @${domain}\n📊 Đã bán: ${soldCount.toLocaleString('vi-VN')} Gmail\n💵 Số dư của bạn: ${formatCurrency(currentBalance)}\n\n⚠️ **Lưu ý:**\n- Tài khoản sẽ tự động xóa sau ${deleteHours} giờ kể từ khi login\n- Không hoàn tiền sau khi mua\n- Tối đa 10 tài khoản mỗi lần mua\n\nNhập số lượng Gmail bạn muốn mua (ví dụ: 1, 2, 5):`,
            `📧 **BUY GMAIL EDU**\n\n💰 Price: ${formatCurrency(price)} / 1 Gmail\n🌐 Domain: @${domain}\n📊 Sold: ${soldCount.toLocaleString('en-US')} Gmail accounts\n💵 Your balance: ${formatCurrency(currentBalance)}\n\n⚠️ **Note:**\n- Account will be auto-deleted ${deleteHours} hour(s) after first login\n- No refunds after purchase\n- Maximum 10 accounts per purchase\n\nEnter the quantity you want to buy (e.g., 1, 2, 5):`,
            `📧 **购买 GMAIL EDU**\n\n💰 价格: ${formatCurrency(price)} / 1 个 Gmail\n🌐 域名: @${domain}\n📊 已售: ${soldCount.toLocaleString('zh-CN')} 个 Gmail\n💵 您的余额: ${formatCurrency(currentBalance)}\n\n⚠️ **注意：**\n- 账户将在首次登录后 ${deleteHours} 小时自动删除\n- 购买后不可退款\n- 每次最多购买10个账户\n\n请输入您要购买的数量（例如：1、2、5）：`
        );

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
