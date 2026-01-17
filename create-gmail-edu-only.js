#!/usr/bin/env node

/**
 * Script tạo Gmail Edu không lưu vào database
 * Chỉ tạo tài khoản trên Google Admin
 * 
 * Cách sử dụng:
 *   node create-gmail-edu-only.js <domain> <quantity> [password]
 * 
 * Ví dụ:
 *   node create-gmail-edu-only.js example.edu 5
 *   node create-gmail-edu-only.js example.edu 10 Vietcombank9338739954
 */

import { createEduAccount, generateRandomUsername } from './includes/services/googleAdminService.js';

// Parse arguments từ command line
const args = process.argv.slice(2);

// Validate arguments
if (args.length < 2 || args.length > 3) {
  console.error('❌ Sai cú pháp!\n');
  console.log('📝 Cú pháp:');
  console.log('   node create-gmail-edu-only.js <domain> <quantity> [password]\n');
  console.log('💡 Ví dụ:');
  console.log('   node create-gmail-edu-only.js example.edu 5');
  console.log('   node create-gmail-edu-only.js example.edu 10 Vietcombank9338739954\n');
  process.exit(1);
}

const domain = args[0];
const quantityStr = args[1];
const password = args[2] || 'Vietcombank9338739954';

// Validate domain
if (!domain || !domain.includes('.')) {
  console.error('❌ Domain không hợp lệ! Domain phải có định dạng: example.edu');
  process.exit(1);
}

// Validate quantity
const quantity = parseInt(quantityStr, 10);
if (isNaN(quantity) || quantity < 1 || quantity > 100) {
  console.error('❌ Số lượng không hợp lệ! Số lượng phải từ 1 đến 100.');
  process.exit(1);
}

// Main function
async function main() {
  console.log(`\n🚀 Bắt đầu tạo ${quantity} Gmail Edu với domain: ${domain}`);
  console.log(`🔑 Password mặc định: ${password}\n`);
  console.log('─'.repeat(60));

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < quantity; i++) {
    try {
      const username = generateRandomUsername();
      const email = `${username}@${domain}`;
      
      console.log(`\n[${i + 1}/${quantity}] Đang tạo: ${email}...`);
      
      const result = await createEduAccount(username, domain, password);
      
      if (result.success) {
        successCount++;
        results.push({
          email: result.email,
          password: password,
          id: result.id
        });
        console.log(`✅ Thành công: ${result.email} (ID: ${result.id})`);
      } else {
        failCount++;
        console.error(`❌ Thất bại: ${result.error}`);
      }

      // Delay nhỏ để tránh rate limit (trừ account cuối cùng)
      if (i < quantity - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      failCount++;
      console.error(`❌ Exception khi tạo account ${i + 1}:`, error.message);
    }
  }

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log('\n📊 KẾT QUẢ:\n');
  console.log(`✅ Thành công: ${successCount} account(s)`);
  if (failCount > 0) {
    console.log(`❌ Thất bại: ${failCount} account(s)`);
  }
  console.log(`📧 Domain: ${domain}`);
  console.log(`🔑 Password: ${password}`);

  // Hiển thị danh sách accounts
  if (results.length > 0) {
    console.log('\n📋 DANH SÁCH ACCOUNTS:\n');
    console.log('Format: email|password');
    console.log('─'.repeat(60));
    results.forEach((acc, index) => {
      console.log(`${acc.email}|${acc.password}`);
    });
    console.log('─'.repeat(60));

    // Lưu vào file (tùy chọn)
    if (results.length > 0) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        const fileName = `gmail_edu_${domain.replace(/\./g, '_')}_${Date.now()}.txt`;
        const filePath = path.join(__dirname, 'temp', fileName);
        
        // Đảm bảo thư mục temp tồn tại
        const tempDir = path.dirname(filePath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Tạo nội dung file
        const fileContent = results.map(acc => `${acc.email}|${acc.password}`).join('\n');
        
        // Ghi file
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`\n💾 Đã lưu danh sách vào file: ${filePath}`);
      } catch (fileError) {
        console.warn(`\n⚠️ Không thể lưu file: ${fileError.message}`);
      }
    }
  }

  console.log('\n✨ Hoàn thành!\n');
}

// Run
main().catch(error => {
  console.error('\n❌ Lỗi:', error.message);
  process.exit(1);
});
