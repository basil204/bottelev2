import { ensureUser, sendMenu } from '../../includes/handle/handleUser.js';

export default {
  command: 'menu',
  handler: async (bot, msg) => {
    const user = await ensureUser(bot, msg);
    await sendMenu(bot, msg.chat.id, user);
  }
};

