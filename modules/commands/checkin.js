import { ensureUser } from '../../includes/handle/handleUser.js';
import { doCheckIn, generateReferralCode, getReferralStats } from '../../includes/controllers/checkinController.js';
import { getUserCredit } from '../../includes/controllers/creditController.js';

export default {
  command: 'checkin',
  handler: async (bot, msg) => {
    const user = await ensureUser(bot, msg);
    const result = await doCheckIn(user.id);

    if (!result.success) {
      const hours = result.hoursRemaining || 0;
      const minutes = Math.ceil((hours - Math.floor(hours)) * 60);
      return bot.sendMessage(
        msg.chat.id,
        `⏰ Bạn đã check-in rồi!\n\n⏳ Thời gian còn lại: ${Math.floor(hours)} giờ ${minutes} phút\n\n💡 Hãy quay lại sau 24 giờ để check-in tiếp.`
      );
    }

    const currentCredit = await getUserCredit(user.id);
    const referralCode = await generateReferralCode(user.id);
    const referralStats = await getReferralStats(user.id);

    const message = `✅ **Check-in thành công!**\n\n` +
                   `🎁 Nhận được: **1 Credit**\n` +
                   `💰 Credit hiện tại: **${currentCredit}**\n\n` +
                   `📊 **Thống kê:**\n` +
                   `• Tổng người giới thiệu: ${referralStats.total_referrals}\n` +
                   `• Credit từ giới thiệu: ${referralStats.total_credits_earned}\n\n` +
                   `🔗 **Mã giới thiệu của bạn:**\n` +
                   `\`${referralCode}\`\n\n` +
                   `💡 Chia sẻ bot với mã này để nhận thêm 3 credit mỗi người!`;

    await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }
};

