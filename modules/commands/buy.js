import { sendProductList } from '../../includes/handle/handleBuy.js';

export default {
  command: 'buy',
  handler: async (bot, msg, config) => {
    await sendProductList(bot, msg.chat.id, 1, config.PAGE_SIZE);
  }
};

