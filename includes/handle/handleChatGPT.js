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

// Helper for 3-lang text
const L = (lang, vi, en, zh) => ({ en, zh }[lang] || vi);

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
    message = `🤖 *ChatGPT Pro (Team Slot)*\n\n`;
    message += `💰 ${L(lang, 'Giá', 'Price', '价格')}: *${formatCurrency(price)}* / ${days} ${L(lang, 'ngày', 'days', '天')}\n`;
    message += `📊 ${L(lang, 'Còn slot', 'Available', '可用')}: ${hasSlot ? L(lang, '✅ Có', '✅ Yes', '✅ 有') : L(lang, '❌ Hết slot', '❌ No slots available', '❌ 无可用名额')}\n\n`;

    // Display active rentals
    if (activeRentals.length > 0) {
        message += `📋 *${L(lang, 'GÓI CƯỚC CỦA BẠN', 'YOUR SUBSCRIPTIONS', '您的订阅')}:*\n`;

        activeRentals.forEach((rental, index) => {
            const endDate = new Date(rental.end_date);
            const now = new Date();
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            const statusIcon = daysLeft > 0 ? '🟢' : '🔴';

            message += `\n${index + 1}. 📧 \`${rental.email}\`\n`;
            message += `   📅 ${L(lang, 'Hết hạn', 'Expire', '到期')}: ${endDate.toLocaleDateString('vi-VN')}\n`;
            message += `   ⏳ ${L(lang, 'Còn lại', 'Remaining', '剩余')}: *${daysLeft} ${L(lang, 'ngày', 'days', '天')}* ${statusIcon}\n`;
        });
        message += '\n-------------------\n\n';
    }

    // Call to action
    if (hasSlot) {
        message += L(lang,
            '📧 Nhập email để thuê thêm slot ChatGPT Team MỚI:',
            '📧 Enter your email to rent a NEW ChatGPT Team slot:',
            '📧 输入您的邮箱以租用新的 ChatGPT Team 名额：'
        );
    } else {
        message += L(lang,
            '⚠️ Hiện tại hết slot đăng ký mới.',
            '⚠️ Currently no slots available for new purchase.',
            '⚠️ 当前没有可用的新名额。'
        );
    }

    const { createCallbackData } = await import('../../utils/index.js'); // Import helper

    // Build inline keyboard with warranty button if user has active rentals
    const inlineKeyboard = [
        [
            { text: L(lang, '📅 Kiểm tra hạn', '📅 Check Expiry', '📅 检查到期'), callback_data: createCallbackData({ action: 'chatgpt_check_expiry' }) }
        ]
    ];

    // Add warranty button if user has active rentals
    if (activeRentals.length > 0) {
        inlineKeyboard.push([
            { text: L(lang, '🛡️ Bảo hành', '🛡️ Warranty Check', '🛡️ 保修检查'), callback_data: createCallbackData({ action: 'chatgpt_warranty' }) }
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
                    [{ text: L(lang, '❌ Huỷ', '❌ Cancel', '❌ 取消') }]
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
        const user = await getUserByTelegram(msg.from.id);
        const lang = user?.language || 'vi';
        const errorMsg = L(lang,
            '❌ Email không hợp lệ. Vui lòng nhập lại:',
            '❌ Invalid email format. Please enter a valid email:',
            '❌ 邮箱格式无效，请重新输入：'
        );
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
            const unknown = L(lang, 'Không rõ', 'Unknown', '未知');
            const message = L(lang,
                `✅ Email này đang có slot hoạt động!\n\n📧 Email: ${email}\n📅 Còn lại: ${daysLeft} ngày\n🏷️ FAM: ${renewResult.fam?.name || unknown}`,
                `✅ This email already has an active rental!\n\n📧 Email: ${email}\n📅 Days remaining: ${daysLeft} days\n🏷️ FAM: ${renewResult.fam?.name || unknown}`,
                `✅ 此邮箱已有活跃订阅！\n\n📧 邮箱: ${email}\n📅 剩余: ${daysLeft} 天\n🏷️ FAM: ${renewResult.fam?.name || unknown}`
            );

            delCache(cacheKey);
            await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

            // Return to menu
            const { sendMenu } = await import('./handleUser.js');
            await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
            return true;
        }

        if (renewResult.renewed) {
            const message = L(lang,
                `🔄 Email đã được chuyển sang FAM mới!\n\n📧 Email: ${email}\n🏷️ FAM mới: ${renewResult.newFam?.name}\n\nVui lòng kiểm tra email để nhận lời mời mới.`,
                `🔄 Email moved to new FAM!\n\n📧 Email: ${email}\n🏷️ New FAM: ${renewResult.newFam?.name}\n\nPlease check your email for the new invitation.`,
                `🔄 邮箱已转移至新 FAM！\n\n📧 邮箱: ${email}\n🏷️ 新 FAM: ${renewResult.newFam?.name}\n\n请检查邮箱以接收新的邀请。`
            );

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
        const message = L(lang,
            `❌ Số dư không đủ!\n\n💰 Cần: ${formatCurrency(price)}\n💵 Số dư: ${formatCurrency(user.balance)}\n\nVui lòng nạp tiền trước.`,
            `❌ Insufficient balance!\n\n💰 Required: ${formatCurrency(price)}\n💵 Your balance: ${formatCurrency(user.balance)}\n\nPlease deposit first.`,
            `❌ 余额不足！\n\n💰 需要: ${formatCurrency(price)}\n💵 余额: ${formatCurrency(user.balance)}\n\n请先充值。`
        );

        delCache(cacheKey);
        await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

        const { sendMenu } = await import('./handleUser.js');
        await sendMenu(bot, msg.chat.id, user, config.TELEGRAM_GROUP_LINKS);
        return true;
    }

    // Get available FAM
    const fam = await getAvailableFam();
    if (!fam) {
        const message = L(lang,
            '❌ Hiện tại hết slot. Vui lòng thử lại sau.',
            '❌ No slots available at the moment. Please try again later.',
            '❌ 当前无可用名额，请稍后再试。'
        );

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

            const successMsg = L(lang,
                `✅ *Mua thành công!*\n\n📧 Email: \`${email}\`\n🏷️ FAM: ${fam.name}\n💰 Giá: ${formatCurrency(price)}\n📅 Thời hạn: ${days} ngày\n\n📨 Lời mời đã được gửi đến email của bạn.\nVui lòng kiểm tra và chấp nhận lời mời để tham gia Team.`,
                `✅ *Purchase Successful!*\n\n📧 Email: \`${email}\`\n🏷️ FAM: ${fam.name}\n💰 Price: ${formatCurrency(price)}\n📅 Duration: ${days} days\n\n📨 An invitation has been sent to your email.\nPlease check and accept the invitation to join the Team.`,
                `✅ *购买成功！*\n\n📧 邮箱: \`${email}\`\n🏷️ FAM: ${fam.name}\n💰 价格: ${formatCurrency(price)}\n📅 有效期: ${days} 天\n\n📨 邀请已发送至您的邮箱。\n请查收并接受邀请以加入团队。`
            );

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

            const errorMsg = L(lang,
                `⚠️ *Đã mua nhưng lỗi gửi lời mời!*\n\n📧 Email: ${email}\n\nVui lòng liên hệ hỗ trợ để nhận lời mời thủ công.`,
                `⚠️ *Purchase recorded but invitation failed!*\n\n📧 Email: ${email}\n\nPlease contact support to receive your invitation manually.`,
                `⚠️ *已购买但发送邀请失败！*\n\n📧 邮箱: ${email}\n\n请联系客服手动接收邀请。`
            );

            await bot.sendMessage(msg.chat.id, errorMsg, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error('[ChatGPT] Purchase error:', error);
        const errorMsg = L(lang,
            '❌ Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
            '❌ An error occurred. Please try again or contact support.',
            '❌ 出现错误，请重试或联系客服。'
        );
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
        const msg = L(lang,
            '❌ Bạn chưa đăng ký gói ChatGPT nào đang hoạt động.',
            '❌ You do not have any active ChatGPT subscription.',
            '❌ 您还没有任何活跃的 ChatGPT 订阅。'
        );
        await bot.sendMessage(chatId, msg);
        return;
    }

    let message = `📋 *${L(lang, 'GÓI CƯỚC CỦA BẠN', 'YOUR SUBSCRIPTIONS', '您的订阅')}:*\n`;

    activeRentals.forEach((rental, index) => {
        const endDate = new Date(rental.end_date);
        const now = new Date();
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        const statusIcon = daysLeft > 0 ? '🟢' : '🔴';

        message += `\n${index + 1}. 📧 \`${rental.email}\`\n`;
        message += `   📅 ${L(lang, 'Hết hạn', 'Expire', '到期')}: ${endDate.toLocaleDateString('vi-VN')}\n`;
        message += `   ⏳ ${L(lang, 'Còn lại', 'Remaining', '剩余')}: *${daysLeft} ${L(lang, 'ngày', 'days', '天')}* ${statusIcon}\n`;
    });

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

/**
 * Xử lý bảo hành - check tất cả email của user và chuyển FAM nếu cần
 */
export async function handleWarrantyCheck(bot, chatId, user, config) {
    const lang = user.language || 'vi';

    // Show loading message
    const loadingMsg = L(lang,
        '⏳ Đang kiểm tra bảo hành cho tất cả email của bạn...',
        '⏳ Checking warranty status for all your emails...',
        '⏳ 正在检查您所有邮箱的保修状态...'
    );
    await bot.sendMessage(chatId, loadingMsg);

    try {
        const results = await checkWarrantyForUser(user.id);

        let message = '';

        if (results.noRentals) {
            message = L(lang,
                '❌ Bạn chưa có gói ChatGPT nào đang hoạt động để kiểm tra.',
                '❌ You do not have any active ChatGPT subscription to check.',
                '❌ 您没有任何活跃的 ChatGPT 订阅可供检查。'
            );
            await bot.sendMessage(chatId, message);
            return;
        }

        if (results.allOk && results.needsSupport.length === 0) {
            message = L(lang,
                '✅ *KIỂM TRA BẢO HÀNH HOÀN TẤT*\n\nTất cả gói cước của bạn đều hoạt động bình thường!',
                '✅ *WARRANTY CHECK COMPLETE*\n\nAll your subscriptions are working correctly!',
                '✅ *保修检查完成*\n\n您的所有订阅都运行正常！'
            );

            // List all OK emails
            const okEmails = results.processed.filter(p => p.status === 'ok');
            if (okEmails.length > 0) {
                message += `\n\n📧 *${L(lang, 'Emails OK', 'Emails OK', '邮箱正常')}:*`;
                okEmails.forEach((item, i) => {
                    message += `\n${i + 1}. \`${item.email}\` (${item.fam})`;
                });
            }

            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            return;
        }

        // Some changes were made
        message = `🛡️ *${L(lang, 'KẾT QUẢ KIỂM TRA BẢO HÀNH', 'WARRANTY CHECK RESULT', '保修检查结果')}*\n\n`;

        // Show moved emails
        const movedEmails = results.processed.filter(p => p.status === 'moved');
        if (movedEmails.length > 0) {
            message += `✅ *${L(lang, 'ĐÃ CHUYỂN THÀNH CÔNG', 'SUCCESSFULLY MOVED', '成功转移')}:*\n`;
            movedEmails.forEach((item, i) => {
                message += `${i + 1}. \`${item.email}\`\n`;
                message += `   ${item.oldFam} → ${item.newFam}\n`;
            });
            message += L(lang,
                '\n📨 Lời mời mới đã được gửi. Vui lòng kiểm tra email.\n\n',
                '\n📨 New invitations have been sent. Please check your email.\n\n',
                '\n📨 新邀请已发送，请检查邮箱。\n\n'
            );
        }

        // Show OK emails
        const okEmails = results.processed.filter(p => p.status === 'ok');
        if (okEmails.length > 0) {
            message += `✅ *${L(lang, 'HOẠT ĐỘNG TỐT', 'WORKING OK', '运行正常')}:*\n`;
            okEmails.forEach((item, i) => {
                message += `${i + 1}. \`${item.email}\` (${item.fam})\n`;
            });
            message += '\n';
        }

        // Show emails needing support
        if (results.needsSupport.length > 0) {
            message += `⚠️ *${L(lang, 'CẦN LIÊN HỆ ADMIN', 'NEEDS ADMIN SUPPORT', '需要联系管理员')}:*\n`;
            results.needsSupport.forEach((item, i) => {
                message += `${i + 1}. \`${item.email}\`\n`;
                message += `   ${L(lang, 'Lý do: Hết FAM để chuyển', 'Reason: No available FAM to switch', '原因: 没有可用的 FAM 可切换')}\n`;
            });
            message += L(lang,
                '\n📞 Vui lòng liên hệ admin để được hỗ trợ thủ công.',
                '\n📞 Please contact admin for manual support.',
                '\n📞 请联系管理员获取人工支持。'
            );

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
        const errorMsg = L(lang,
            '❌ Có lỗi xảy ra khi kiểm tra bảo hành. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
            '❌ An error occurred while checking warranty. Please try again or contact support.',
            '❌ 检查保修时出现错误，请重试或联系客服。'
        );
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
