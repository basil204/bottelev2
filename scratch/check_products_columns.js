import { query, initDb } from '../includes/database/index.js';
import { config } from '../config.js';

async function checkColumns() {
  await initDb(config);
  try {
    const rows = await query('SHOW COLUMNS FROM products');
    console.log('Columns in products table:');
    console.log(rows.map(r => r.Field));
  } catch (err) {
    console.error('Error fetching columns:', err);
  }
  process.exit(0);
}

checkColumns();
