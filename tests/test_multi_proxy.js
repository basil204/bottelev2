import { createMultiBotProxy } from '../includes/helpers/multiBotHelper.js';
import assert from 'assert';

console.log('Testing createMultiBotProxy...');

let bot1Calls = 0;
let bot2Calls = 0;

const mockBot1 = {
  getMe: async () => ({ username: 'bot_one' }),
  sendMessage: async (chatId, text) => {
    bot1Calls++;
    if (chatId === 'user_only_on_bot2') {
      const err = new Error('ETELEGRAM: 403 Forbidden: bot was blocked by the user');
      throw err;
    }
    return { message_id: 101, text };
  }
};

const mockBot2 = {
  getMe: async () => ({ username: 'bot_two' }),
  sendMessage: async (chatId, text) => {
    bot2Calls++;
    return { message_id: 102, text };
  }
};

const proxy = createMultiBotProxy([mockBot1, mockBot2]);

// Test 1: Successful send on bot 1
const res1 = await proxy.sendMessage('user_on_both', 'Hello');
assert.strictEqual(res1.message_id, 101);
assert.strictEqual(bot1Calls, 1);
assert.strictEqual(bot2Calls, 0);

// Test 2: Fallback to bot 2 when bot 1 is blocked/not started
const res2 = await proxy.sendMessage('user_only_on_bot2', 'Fallback message');
assert.strictEqual(res2.message_id, 102);
assert.strictEqual(bot1Calls, 2);
assert.strictEqual(bot2Calls, 1);

console.log('✅ createMultiBotProxy passed all tests!');
process.exit(0);
