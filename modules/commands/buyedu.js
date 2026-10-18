import { ensureUser } from '../../includes/handle/handleUser.js';
import { sendBuyEduMenu } from '../../includes/handle/handleBuy.js';

export default {
  command: 'buyedu',
  description: '🎓 Mua tài khoản Gmail EDU trực tiếp',
  handler: async (bot, msg) => {
    const user = await ensureUser(bot, msg);
    await sendBuyEduMenu(bot, msg.chat.id, user);
  }
};
