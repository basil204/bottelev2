import { startDepositFlow } from '../../includes/handle/handleDeposit.js';
import { ensureUser } from '../../includes/handle/handleUser.js';

export default {
  command: 'nap',
  handler: async (bot, msg) => {
    const user = await ensureUser(bot, msg);
    await startDepositFlow(bot, msg, user);
  }
};

