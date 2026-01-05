import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc config
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let pool;

// Khởi tạo kết nối database
const initConnection = async () => {
  pool = mysql.createPool({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  // Test connection
  try {
    const [result] = await pool.execute('SELECT DATABASE() as db');
    console.log('✅ Đã kết nối database:', result[0]?.db);
  } catch (err) {
    console.error('❌ Lỗi kết nối database:', err.message);
    process.exit(1);
  }
};

// Xóa toàn bộ dữ liệu (theo thứ tự để tránh lỗi foreign key)
const deleteAllData = async () => {
  console.log('\n🗑️  Bắt đầu xóa toàn bộ dữ liệu...\n');
  
  const tables = [
    'vip_gmail_usage',
    'vip_packages',
    'balance_logs',
    'orders',
    'deposits',
    'accounts',
    'gmail_accounts',
    'products',
    'users',
    'gmail_pricing'
  ];
  
  for (const table of tables) {
    try {
      await pool.execute(`DELETE FROM ${table}`);
      const [result] = await pool.execute(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`✅ Đã xóa dữ liệu bảng: ${table} (còn lại: ${result[0].count} records)`);
    } catch (err) {
      // Nếu bảng không tồn tại, bỏ qua
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.log(`⚠️  Bảng ${table} không tồn tại, bỏ qua`);
      } else {
        console.error(`❌ Lỗi khi xóa bảng ${table}:`, err.message);
      }
    }
  }
  
  // Reset AUTO_INCREMENT
  console.log('\n🔄 Đang reset AUTO_INCREMENT...\n');
  for (const table of tables) {
    try {
      await pool.execute(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
      console.log(`✅ Đã reset AUTO_INCREMENT cho bảng: ${table}`);
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') {
        console.error(`⚠️  Không thể reset AUTO_INCREMENT cho ${table}:`, err.message);
      }
    }
  }
  
  console.log('\n✅ Đã xóa toàn bộ dữ liệu!\n');
};

// Seed lại data mẫu
const seedData = async () => {
  console.log('🌱 Bắt đầu seed data mẫu...\n');
  
  try {
    // Seed gmail_pricing
    console.log('📧 Đang seed giá Gmail...');
    const gmailPricing = [
      { type: 'edu', duration: 'single', quantity: 1, price: 700 },
      { type: 'edu', duration: 'single', quantity: 10, price: 6500 },
      { type: 'edu', duration: 'daily', quantity: 1, price: 4000 },
      { type: 'edu', duration: 'daily', quantity: 10, price: 35000 },
      { type: 'non', duration: 'single', quantity: 1, price: 4000 },
      { type: 'non', duration: 'single', quantity: 10, price: 35000 },
      { type: 'non', duration: 'daily', quantity: 1, price: 4000 },
      { type: 'non', duration: 'daily', quantity: 10, price: 35000 }
    ];
    
    for (const pricing of gmailPricing) {
      await pool.execute(
        `INSERT INTO gmail_pricing (type, duration, quantity, price) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE price = ?`,
        [pricing.type, pricing.duration, pricing.quantity, pricing.price, pricing.price]
      );
    }
    console.log(`✅ Đã seed ${gmailPricing.length} bản ghi giá Gmail`);
    
    // Seed products mẫu (nếu muốn)
    console.log('\n📦 Đang seed sản phẩm mẫu...');
    const sampleProducts = [
      {
        name: 'Sản phẩm mẫu 1',
        price: 10000,
        description: 'Mô tả sản phẩm mẫu 1',
        stock: 0,
        type: 'auto'
      },
      {
        name: 'Sản phẩm Order',
        price: 50000,
        description: 'Sản phẩm yêu cầu thông tin từ user',
        stock: 0,
        type: 'manual'
      }
    ];
    
    for (const product of sampleProducts) {
      await pool.execute(
        `INSERT INTO products (name, price, description, stock, type) 
         VALUES (?, ?, ?, ?, ?)`,
        [product.name, product.price, product.description, product.stock, product.type]
      );
    }
    console.log(`✅ Đã seed ${sampleProducts.length} sản phẩm mẫu`);
    
    console.log('\n✅ Hoàn tất seed data!\n');
  } catch (err) {
    console.error('❌ Lỗi khi seed data:', err.message);
    throw err;
  }
};

// Main function
const main = async () => {
  try {
    console.log('🚀 Bắt đầu reset database...\n');
    
    await initConnection();
    
    // Xác nhận từ user
    console.log('⚠️  CẢNH BÁO: Script này sẽ XÓA TOÀN BỘ dữ liệu trong database!');
    console.log('📋 Các bảng sẽ bị xóa:');
    console.log('   - vip_gmail_usage');
    console.log('   - vip_packages');
    console.log('   - balance_logs');
    console.log('   - orders');
    console.log('   - deposits');
    console.log('   - accounts');
    console.log('   - gmail_accounts');
    console.log('   - products');
    console.log('   - users');
    console.log('   - gmail_pricing\n');
    
    // Để an toàn, yêu cầu nhập "YES" để xác nhận
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const question = (query) => {
      return new Promise((resolve) => {
        rl.question(query, (answer) => {
          resolve(answer);
        });
      });
    };
    
    const answer = await question('Nhập "YES" để xác nhận xóa toàn bộ dữ liệu: ');
    
    if (answer.trim() !== 'YES') {
      rl.close();
      console.log('\n❌ Đã hủy. Không có thay đổi nào được thực hiện.');
      process.exit(0);
    }
    
    // Xóa dữ liệu
    await deleteAllData();
    
    // Seed lại data
    const seedAnswer = await question('Bạn có muốn seed lại data mẫu? (y/n): ');
    rl.close();
    
    if (seedAnswer === 'y' || seedAnswer === 'yes') {
      await seedData();
    } else {
      console.log('⏭️  Bỏ qua seed data.');
    }
    
    // Đóng kết nối
    await pool.end();
    
    console.log('\n✅ Hoàn tất! Database đã được reset.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Lỗi:', err.message);
    if (pool) await pool.end();
    process.exit(1);
  }
};

// Chạy script
main();

