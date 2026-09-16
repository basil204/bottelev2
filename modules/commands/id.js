import { handleGetId } from '../../includes/handle/handleId.js';

export default {
  command: 'id',
  aliases: ['uid', 'myid', 'chatid', 'boxid', 'getid', 'groupid', 'channelid'],
  handler: async (bot, msg) => {
    await handleGetId(bot, msg);
  }
};
