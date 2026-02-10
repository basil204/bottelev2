import {
    getAllFams,
    getAvailableFam,
    getRentalByEmail,
    getRentalsByUserId,
    createRental,
    getSlotPrice,
    getSlotDays,
    inviteEmailToFam,
    updateRentalInviteStatus,
    checkAndRenewFam,
    checkWarrantyForUser
} from '../controllers/chatgptController.js';
import { getUserByTelegram, updateBalance } from '../controllers/userController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { formatCurrency } from '../../utils/index.js';
import { setCache, getCache, delCache } from '../../lib/cache/index.js';

const CHATGPT_CACHE_KEY = (telegramId) => `chatgpt_waiting_${telegramId}`;

/**
 * Hiển thị thông tin ChatGPT và nút mua
 */
export async function showChatGPTInfo(bot, chatId, user) {
    const lang = user.language || 'vi';
    const price = await getSlotPrice();
    const days = await getSlotDays();

    // Check user rentals
    const rentals = await getRentalsByUserId(user.id);
    const activeRentals = rentals.filter(r => r.status === 'active');

    const availableFam = await getAvailableFam();
    const hasSlot = !!availableFam;

    let message = '';

    // Header info
    if (lang === 'en') {
        message = `🤖 *ChatGPT Pro (Team Slot)*\n\n`;
        message += `💰 Price: *${formatCurrency(price)}* / ${days} days\n`;
        message += `📊 Available: ${hasSlot ? '✅ Yes' : '❌ No slots available'}\n\n`;
    } else {
        message = `🤖 *ChatGPT Pro (Team Slot)*\n\n`;
        message += `💰 Giá: *${formatCurrency(price)}* / ${days} ngày\n`;
        message += `📊 Còn slot: ${hasSlot ? '✅ Có' : '❌ Hết slot'}\n\n`;
    }

    // Display active rentals
    if (activeRentals.length > 0) {
        if (lang === 'en') {
            message += `📋 *YOUR SUBSCRIPTIONS:*\n`;
        } else {
            message += `📋 *GÓI CƯỚC CỦA BẠN:*\n`;
        }

        activeRentals.forEach((rental, index) => {
            const endDate = new Date(rental.end_date);
            const now = new Date();
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            const statusIcon = daysLeft > 0 ? '🟢' : '🔴';

            message += `\n${index + 1}. 📧 \`${rental.email}\`\n`;
            message += `   📅 Expire: ${endDate.toLocaleDateString('vi-VN')}\n`;
            message += `   ⏳ Remaining: *${daysLeft} days* ${statusIcon}\n`;
        });
        message += '\n-------------------\n\n';
    }

    // Call to action
    if (lang === 'en') {
        message += hasSlot
            ? `📧 Enter your email to rent a NEW ChatGPT Team slot:`
            : `⚠️ Currently no slots available for new purchase.`;
    } else {
        message += hasSlot
            ? `📧 Nhập email để thuê thêm slot ChatGPT Team MỚI:`
            : `⚠️ Hiện tại hết slot đăng ký mới.`;
    }

    const { createCallbackData } = await import('../../utils/index.js'); // Import helper

    // Build inline keyboard with warranty button if user has active rentals
    const inlineKeyboard = [
        [
            { text: lang === 'en' ? '📅 Check Expiry' : '📅 Kiểm tra hạn', callback_data: createCallbackData({ action: 'chatgpt_check_expiry' }) }
        ]
    ];

    // Add warranty button if user has active rentals
    if (activeRentals.length > 0) {
        inlineKeyboard.push([
            { text: lang === 'en' ? '🛡️ Warranty Check' : '🛡️ Bảo hành', callback_data: createCallbackData({ action: 'chatgpt_warranty' }) }
        ]);
    }

    if (hasSlot) {
        // Set waiting state
        setCache(CHATGPT_CACHE_KEY(user.telegram_id), {
            waiting: true,
            step: 'email'
        }, 10 * 60 * 1000);

        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: inlineKeyboard,
                keyboard: [
                    [{ text: '❌ Huỷ' }]
                ],
                resize_keyboard: true
            }
        });
    } else {
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        });
    }
}

/**
 * Xử lý input email từ user
 */
export async function handleChatGPTEmailInput(bot, msg, config) {
    const cacheKey = CHATGPT_CACHE_KEY(msg.from.id);
    const state = getCache(cacheKey);

    if (!state || !state.waiting || state.step !== 'email') {
        return false;
    }

    const email = msg.text.trim().toLowerCase();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        const lang = state.lang || 'vi';
        const errorMsg = lang === 'en'
            ? '❌ Invalid email format. Please enter a valid email:'
            : '❌ Email không hợp lệ. Vui lòng nhập lại:';
        await bot.sendMessage(msg.chat.id, errorMsg);
        return true;
    }

    const user = await getUserByTelegram(msg.from.id);
    const lang = user?.language || 'vi';

    // Check if email already has active rental
    const existingRental = await getRentalByEmail(email);
    if (existingRental) {
        const renewResult = await checkAndRenewFam(email);

        if (renewResult.active) {
            const daysLeft = Math.ceil((new Date(renewResult.rental.end_date) - new Date()) / (1000 * 60 * 60 * 24));
            const message = lang === 'en'
                ? `✅ This email already has an active rental!\n\n📧 Email: ${email}\n📅 Days remaining: ${daysLeft} days\n🏷️ FAM: ${renewResult.fam?.name || 'Unknown'}`
                : `✅ Email này đang có slot hoạt động!\n\n📧 Email: ${email}\n📅 Còn lại: ${daysLeft} ngày\n🏷️ FAM: ${renewResult.fam?.name || 'Không rõ'}`;

            delCache(cacheKey);
            await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

            // Return to menu
            const { sendMenu } = await import('./handleUser.js');
            await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
            return true;
        }

        if (renewResult.renewed) {
            const message = lang === 'en'
                ? `🔄 Email moved to new FAM!\n\n📧 Email: ${email}\n🏷️ New FAM: ${renewResult.newFam?.name}\n\nPlease check your email for the new invitation.`
                : `🔄 Email đã được chuyển sang FAM mới!\n\n📧 Email: ${email}\n🏷️ FAM mới: ${renewResult.newFam?.name}\n\nVui lòng kiểm tra email để nhận lời mời mới.`;

            delCache(cacheKey);
            await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

            const { sendMenu } = await import('./handleUser.js');
            await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
            return true;
        }
    }

    // Check balance
    const price = await getSlotPrice();
    const days = await getSlotDays();

    if (Number(user.balance) < price) {
        const message = lang === 'en'
            ? `❌ Insufficient balance!\n\n💰 Required: ${formatCurrency(price)}\n💵 Your balance: ${formatCurrency(user.balance)}\n\nPlease deposit first.`
            : `❌ Số dư không đủ!\n\n💰 Cần: ${formatCurrency(price)}\n💵 Số dư: ${formatCurrency(user.balance)}\n\nVui lòng nạp tiền trước.`;

        delCache(cacheKey);
        await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

        const { sendMenu } = await import('./handleUser.js');
        await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
        return true;
    }

    // Get available FAM
    const fam = await getAvailableFam();
    if (!fam) {
        const message = lang === 'en'
            ? '❌ No slots available at the moment. Please try again later.'
            : '❌ Hiện tại hết slot. Vui lòng thử lại sau.';

        delCache(cacheKey);
        await bot.sendMessage(msg.chat.id, message);

        const { sendMenu } = await import('./handleUser.js');
        await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
        return true;
    }

    // Process purchase
    try {
        // Deduct balance
        await updateBalance(user.id, -price);
        await addBalanceLog({
            userId: user.id,
            amount: -price,
            reason: `chatgpt_slot_${email}`,
            adminId: null
        });

        // Create rental
        const rentalId = await createRental({
            user_id: user.id,
            fam_id: fam.id,
            email: email,
            price: price,
            days: days
        });

        // Invite email to FAM
        const inviteResult = await inviteEmailToFam(fam, email);

        if (inviteResult.success) {
            await updateRentalInviteStatus(rentalId, 'sent');

            const successMsg = lang === 'en'
                ? `✅ *Purchase Successful!*\n\n📧 Email: \`${email}\`\n🏷️ FAM: ${fam.name}\n💰 Price: ${formatCurrency(price)}\n📅 Duration: ${days} days\n\n📨 An invitation has been sent to your email.\nPlease check and accept the invitation to join the Team.`
                : `✅ *Mua thành công!*\n\n📧 Email: \`${email}\`\n🏷️ FAM: ${fam.name}\n💰 Giá: ${formatCurrency(price)}\n📅 Thời hạn: ${days} ngày\n\n📨 Lời mời đã được gửi đến email của bạn.\nVui lòng kiểm tra và chấp nhận lời mời để tham gia Team.`;

            await bot.sendMessage(msg.chat.id, successMsg, { parse_mode: 'Markdown' });

            // Notify admins
            if (config.ADMIN_IDS && config.ADMIN_IDS.length > 0) {
                const adminMsg = `🤖 *ChatGPT Slot Purchased*\n\n👤 User: ${user.username || user.telegram_id}\n📧 Email: ${email}\n🏷️ FAM: ${fam.name}\n💰 Price: ${formatCurrency(price)}`;
                for (const adminId of config.ADMIN_IDS) {
                    try {
                        await bot.sendMessage(adminId, adminMsg, { parse_mode: 'Markdown' });
                    } catch (e) {
                        console.error('[ChatGPT] Failed to notify admin:', e);
                    }
                }
            }
        } else {
            await updateRentalInviteStatus(rentalId, 'failed');

            const errorMsg = lang === 'en'
                ? `⚠️ *Purchase recorded but invitation failed!*\n\n📧 Email: ${email}\n\nPlease contact support to receive your invitation manually.`
                : `⚠️ *Đã mua nhưng lỗi gửi lời mời!*\n\n📧 Email: ${email}\n\nVui lòng liên hệ hỗ trợ để nhận lời mời thủ công.`;

            await bot.sendMessage(msg.chat.id, errorMsg, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error('[ChatGPT] Purchase error:', error);
        const errorMsg = lang === 'en'
            ? '❌ An error occurred. Please try again or contact support.'
            : '❌ Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hỗ trợ.';
        await bot.sendMessage(msg.chat.id, errorMsg);
    }

    delCache(cacheKey);

    // Return to menu
    const { sendMenu } = await import('./handleUser.js');
    await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);

    return true;
}

/**
 * Hiển thị trạng thái gói thuê
 */
export async function showRentalStatus(bot, chatId, user) {
    const lang = user.language || 'vi';
    const rentals = await getRentalsByUserId(user.id);
    const activeRentals = rentals.filter(r => r.status === 'active');

    if (activeRentals.length === 0) {
        const msg = lang === 'en'
            ? '❌ You do not have any active ChatGPT subscription.'
            : '❌ Bạn chưa đăng ký gói ChatGPT nào đang hoạt động.';
        await bot.sendMessage(chatId, msg);
        return;
    }

    let message = '';
    if (lang === 'en') {
        message += `📋 *YOUR SUBSCRIPTIONS:*\n`;
    } else {
        message += `📋 *GÓI CƯỚC CỦA BẠN:*\n`;
    }

    activeRentals.forEach((rental, index) => {
        const endDate = new Date(rental.end_date);
        const now = new Date();
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        const statusIcon = daysLeft > 0 ? '🟢' : '🔴';

        message += `\n${index + 1}. 📧 \`${rental.email}\`\n`;
        message += `   📅 Expire: ${endDate.toLocaleDateString('vi-VN')}\n`;
        message += `   ⏳ Remaining: *${daysLeft} days* ${statusIcon}\n`;
    });

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

/**
 * Xử lý bảo hành - check tất cả email của user và chuyển FAM nếu cần
 */
export async function handleWarrantyCheck(bot, chatId, user, config) {
    const lang = user.language || 'vi';

    // Show loading message
    const loadingMsg = lang === 'en'
        ? '⏳ Checking warranty status for all your emails...'
        : '⏳ Đang kiểm tra bảo hành cho tất cả email của bạn...';
    await bot.sendMessage(chatId, loadingMsg);

    try {
        const results = await checkWarrantyForUser(user.id);

        let message = '';

        if (results.noRentals) {
            message = lang === 'en'
                ? '❌ You do not have any active ChatGPT subscription to check.'
                : '❌ Bạn chưa có gói ChatGPT nào đang hoạt động để kiểm tra.';
            await bot.sendMessage(chatId, message);
            return;
        }

        if (results.allOk && results.needsSupport.length === 0) {
            message = lang === 'en'
                ? '✅ *WARRANTY CHECK COMPLETE*\n\nAll your subscriptions are working correctly!'
                : '✅ *KIỂM TRA BẢO HÀNH HOÀN TẤT*\n\nTất cả gói cước của bạn đều hoạt động bình thường!';

            // List all OK emails
            const okEmails = results.processed.filter(p => p.status === 'ok');
            if (okEmails.length > 0) {
                message += '\n\n📧 *Emails OK:*';
                okEmails.forEach((item, i) => {
                    message += `\n${i + 1}. \`${item.email}\` (${item.fam})`;
                });
            }

            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            return;
        }

        // Some changes were made
        message = lang === 'en'
            ? '🛡️ *WARRANTY CHECK RESULT*\n\n'
            : '🛡️ *KẾT QUẢ KIỂM TRA BẢO HÀNH*\n\n';

        // Show moved emails
        const movedEmails = results.processed.filter(p => p.status === 'moved');
        if (movedEmails.length > 0) {
            message += lang === 'en' ? '✅ *SUCCESSFULLY MOVED:*\n' : '✅ *ĐÃ CHUYỂN THÀNH CÔNG:*\n';
            movedEmails.forEach((item, i) => {
                message += `${i + 1}. \`${item.email}\`\n`;
                message += `   ${item.oldFam} → ${item.newFam}\n`;
            });
            message += lang === 'en'
                ? '\n📨 New invitations have been sent. Please check your email.\n\n'
                : '\n📨 Lời mời mới đã được gửi. Vui lòng kiểm tra email.\n\n';
        }

        // Show OK emails
        const okEmails = results.processed.filter(p => p.status === 'ok');
        if (okEmails.length > 0) {
            message += lang === 'en' ? '✅ *WORKING OK:*\n' : '✅ *HOẠT ĐỘNG TỐT:*\n';
            okEmails.forEach((item, i) => {
                message += `${i + 1}. \`${item.email}\` (${item.fam})\n`;
            });
            message += '\n';
        }

        // Show emails needing support
        if (results.needsSupport.length > 0) {
            message += lang === 'en'
                ? '⚠️ *NEEDS ADMIN SUPPORT:*\n'
                : '⚠️ *CẦN LIÊN HỆ ADMIN:*\n';
            results.needsSupport.forEach((item, i) => {
                message += `${i + 1}. \`${item.email}\`\n`;
                message += lang === 'en'
                    ? `   Reason: No available FAM to switch\n`
                    : `   Lý do: Hết FAM để chuyển\n`;
            });
            message += lang === 'en'
                ? '\n📞 Please contact admin for manual support.'
                : '\n📞 Vui lòng liên hệ admin để được hỗ trợ thủ công.';

            // Notify admins about warranty issues
            if (config.ADMIN_IDS && config.ADMIN_IDS.length > 0) {
                const adminMsg = `🛡️ *WARRANTY SUPPORT NEEDED*\n\n👤 User: ${user.username || user.telegram_id}\n\n` +
                    results.needsSupport.map(item => `📧 ${item.email} - ${item.reason}`).join('\n');
                for (const adminId of config.ADMIN_IDS) {
                    try {
                        await bot.sendMessage(adminId, adminMsg, { parse_mode: 'Markdown' });
                    } catch (e) {
                        console.error('[ChatGPT Warranty] Failed to notify admin:', e);
                    }
                }
            }
        }

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error('[ChatGPT Warranty] Error:', error);
        const errorMsg = lang === 'en'
            ? '❌ An error occurred while checking warranty. Please try again or contact support.'
            : '❌ Có lỗi xảy ra khi kiểm tra bảo hành. Vui lòng thử lại hoặc liên hệ hỗ trợ.';
        await bot.sendMessage(chatId, errorMsg);
    }
}

/**
 * Xử lý callback từ inline button
 */
export async function handleChatGPTCallback(bot, query, data, config) {
    const chatId = query.message.chat.id;
    const user = await getUserByTelegram(query.from.id);

    switch (data.action) {
        case 'chatgpt_info':
            return showChatGPTInfo(bot, chatId, user);

        case 'chatgpt_buy':
            return showChatGPTInfo(bot, chatId, user);

        case 'chatgpt_check_expiry':
            return showRentalStatus(bot, chatId, user);

        case 'chatgpt_warranty':
            return handleWarrantyCheck(bot, chatId, user, config);

        default:
            return false;
    }
}
