import { adminMenu, requireAdmin } from '../../includes/handle/handleAdmin.js';

export default {
  command: 'admin',
  handler: async (bot, msg, config) => {
    if (!requireAdmin(config.ADMIN_IDS, msg.from.id)) return bot.sendMessage(msg.chat.id, 'Không có quyền.');
    await adminMenu(bot, msg.chat.id);
  }
};

