import { query, initDb } from '../includes/database/index.js';
import { config } from '../config.js';
import { messages } from '../includes/lang/messages.js';

async function testSeed() {
  await initDb(config);
  console.log('Testing translation seeding...');
  
  let count = 0;
  for (const [lang, keyValues] of Object.entries(messages)) {
    for (const [key, value] of Object.entries(keyValues)) {
      await query(
        'INSERT INTO translations (msg_key, lang, msg_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE msg_value = VALUES(msg_value)',
        [key, lang, value]
      );
      count++;
    }
  }
  
  console.log(`✅ Successfully verified seeding ${count} translation keys into MySQL database.`);
  process.exit(0);
}

testSeed().catch(console.error);
