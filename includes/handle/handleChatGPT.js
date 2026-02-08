import {
    getAllFams,
    getAvailableFam,
    getRentalByEmail,
    createRental,
    getSlotPrice,
    getSlotDays,
    inviteEmailToFam,
    updateRentalInviteStatus,
    checkAndRenewFam
} from '../controllers/chatgptController.js';
import { getUserByTelegramId, updateBalance } from '../controllers/userController.js';
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

    const availableFam = await getAvailableFam();
    const hasSlot = !!availableFam;

    let message = '';
    if (lang === 'en') {
        message = `🤖 *ChatGPT Pro (Team Slot)*\n\n`;
        message += `💰 Price: *${formatCurrency(price)}* / ${days} days\n`;
        message += `📊 Available: ${hasSlot ? '✅ Yes' : '❌ No slots available'}\n\n`;
        message += hasSlot
            ? `📧 Enter your email to rent a ChatGPT Team slot:`
            : `⚠️ Currently no slots available. Please try again later.`;
    } else {
        message = `🤖 *ChatGPT Pro (Team Slot)*\n\n`;
        message += `💰 Giá: *${formatCurrency(price)}* / ${days} ngày\n`;
        message += `📊 Còn slot: ${hasSlot ? '✅ Có' : '❌ Hết slot'}\n\n`;
        message += hasSlot
            ? `📧 Nhập email của bạn để thuê slot ChatGPT Team:`
            : `⚠️ Hiện tại hết slot. Vui lòng thử lại sau.`;
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
                keyboard: [
                    [{ text: '❌ Huỷ' }]
                ],
                resize_keyboard: true
            }
        });
    } else {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
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

    const user = await getUserByTelegramId(msg.from.id);
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
 * Xử lý callback từ inline button
 */
export async function handleChatGPTCallback(bot, query, data, config) {
    const chatId = query.message.chat.id;
    const user = await getUserByTelegramId(query.from.id);

    switch (data.action) {
        case 'chatgpt_info':
            return showChatGPTInfo(bot, chatId, user);

        case 'chatgpt_buy':
            return showChatGPTInfo(bot, chatId, user);

        default:
            return false;
    }
}
