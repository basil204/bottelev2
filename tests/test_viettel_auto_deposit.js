/**
 * Test Script: Auto Deposit Flow Demo
 * 
 * Mô phỏng quy trình:
 * 1. User mua sản phẩm nhưng không đủ tiền
 * 2. Hệ thống tạo QR nạp tiền
 * 3. Mock API Viettel trả về giao dịch phù hợp
 * 4. Hệ thống tự động duyệt và hoàn thành mua hàng
 * 
 * Chạy: node tests/test_viettel_auto_deposit.js
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// --- MOCK DATA (từ user) ---
const MOCK_VIETTEL_RESPONSE = {
    "status": {
        "code": "00",
        "message": "Thành công.",
        "responseTime": "2026-01-27T08:23:02.827Z",
        "displayMessage": "Thành công."
    },
    "data": {
        "content": [
            {
                "msisdn": "84869780178",
                "clientCode": "VTP",
                "clientId": "250127DEMO1234CREDIT",
                "channelType": "ALL",
                "msgType": "BDSD",
                "msgContent": "DEMO1234 NAP TIEN TEST", // Token: DEMO1234
                "requestId": "250127DEMO1234",
                "orderId": "250127DEMO1234CREDIT",
                "transDate": "2026-01-27 15:20:00",
                "accountId": "9704...1338",
                "amount": "50000", // 50k VND
                "fee": "0",
                "balance": "50000",
                "bankTransId": "250127DEMO1234",
                "description": "DEMO1234 NAP TIEN TEST",
                "paymentType": "CREDIT",
                "status": 2,
                "retry": false
            }
        ],
        "pageMetadata": {
            "size": 20,
            "page": 1,
            "totalPages": 1,
            "totalElements": 1
        }
    }
};

// --- CONFIG ---
const TEST_USER_TELEGRAM_ID = '999888777';
const TEST_TOKEN = 'DEMO1234';
const TEST_DEPOSIT_AMOUNT = 50000;

// --- MOCK BOT ---
const mockBot = {
    sendMessage: async (chatId, text, opts) => {
        console.log(`\n📨 [BOT -> ${chatId}]:\n${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
        return { message_id: Date.now() };
    },
    sendPhoto: async (chatId, photo, opts) => {
        console.log(`\n🖼️ [BOT PHOTO -> ${chatId}]: QR Code sent`);
        return { message_id: Date.now() };
    },
    deleteMessage: async (chatId, msgId) => {
        console.log(`\n🗑️ [BOT DELETE] Chat ${chatId} Msg ${msgId}`);
    }
};

// --- MAIN TEST ---
const runTest = async () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   🧪 TEST: Auto Deposit Flow với Mock Viettel API');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Setup Database Connection
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'telegram_bot',
        waitForConnections: true,
        connectionLimit: 5,
    });

    const query = async (sql, params = []) => {
        const [rows] = await pool.execute(sql, params);
        return rows;
    };

    try {
        // 2. Setup Test User
        console.log('📌 STEP 1: Tạo/Reset Test User...');
        let userRows = await query('SELECT * FROM users WHERE telegram_id = ?', [TEST_USER_TELEGRAM_ID]);
        let testUser;

        if (userRows.length === 0) {
            await query('INSERT INTO users (telegram_id, username, balance) VALUES (?, ?, 0)', [TEST_USER_TELEGRAM_ID, 'test_auto_deposit']);
            userRows = await query('SELECT * FROM users WHERE telegram_id = ?', [TEST_USER_TELEGRAM_ID]);
        }
        testUser = userRows[0];

        // Reset balance to 0
        await query('UPDATE users SET balance = 0 WHERE id = ?', [testUser.id]);
        console.log(`   ✅ User ID: ${testUser.id}, Telegram: ${TEST_USER_TELEGRAM_ID}, Balance: 0`);

        // 3. Setup Test Product
        console.log('\n📌 STEP 2: Kiểm tra sản phẩm test...');
        let productRows = await query('SELECT * FROM products WHERE price <= ? LIMIT 1', [TEST_DEPOSIT_AMOUNT]);
        let testProduct;

        if (productRows.length === 0) {
            await query('INSERT INTO products (name, price, description, type) VALUES (?, ?, ?, ?)',
                ['Test Product Auto', 30000, 'Sản phẩm test', 'stock']);
            productRows = await query('SELECT * FROM products ORDER BY id DESC LIMIT 1');
        }
        testProduct = productRows[0];

        // Ensure stock
        const stockRows = await query('SELECT COUNT(*) as c FROM accounts WHERE product_id = ? AND status = ?', [testProduct.id, 'available']);
        if (stockRows[0].c === 0) {
            await query('INSERT INTO accounts (product_id, username, password, status) VALUES (?, ?, ?, ?)',
                [testProduct.id, 'test_acc|pass123', 'pass123', 'available']);
        }
        console.log(`   ✅ Product: ${testProduct.name}, Price: ${testProduct.price}, Stock: ${stockRows[0].c + 1}`);

        // 4. Simulate Purchase Attempt (Insufficient Funds)
        console.log('\n📌 STEP 3: Mô phỏng mua hàng (không đủ tiền)...');
        console.log(`   💰 Số dư: 0 VNĐ`);
        console.log(`   🛒 Giá sản phẩm: ${testProduct.price} VNĐ`);
        console.log(`   ❌ Không đủ tiền -> Yêu cầu nạp thêm`);

        // 5. Simulate QR Creation (Cache setup)
        console.log('\n📌 STEP 4: Tạo QR nạp tiền...');
        const depositToken = TEST_TOKEN;
        const depositAmount = testProduct.price; // Nạp đủ tiền mua
        const expiresAt = Date.now() + 5 * 60 * 1000;

        // Create deposit record
        await query('INSERT INTO deposits (user_id, amount, content, status) VALUES (?, ?, ?, ?)',
            [testUser.id, depositAmount, depositToken, 'pending']);
        const depositRows = await query('SELECT * FROM deposits WHERE user_id = ? ORDER BY id DESC LIMIT 1', [testUser.id]);
        const testDeposit = depositRows[0];

        console.log(`   ✅ Deposit ID: ${testDeposit.id}`);
        console.log(`   📝 Token: ${depositToken}`);
        console.log(`   💵 Số tiền: ${depositAmount} VNĐ`);

        // 6. Simulate Viettel API Check (Mock)
        console.log('\n📌 STEP 5: Kiểm tra giao dịch Viettel (Mock API)...');
        console.log('   🔄 Calling mock API...');

        // Find matching transaction in mock data
        const transactions = MOCK_VIETTEL_RESPONSE.data.content;
        let matchedTx = null;

        for (const tx of transactions) {
            if (tx.paymentType !== 'CREDIT') continue;

            const note = tx.msgContent || tx.description || '';
            // Extract token (4 letters + 4 digits)
            const match = note.toUpperCase().match(/([A-Z]{4}[0-9]{4})/);
            const txToken = match ? match[1] : null;

            if (txToken === depositToken) {
                matchedTx = tx;
                break;
            }
        }

        if (!matchedTx) {
            console.log('   ❌ Không tìm thấy giao dịch phù hợp!');
            console.log('   ⚠️ Trong thực tế, user cần chuyển khoản với nội dung đúng token.');

            // Cleanup and exit
            await query('DELETE FROM deposits WHERE id = ?', [testDeposit.id]);
            await pool.end();
            process.exit(1);
        }

        console.log(`   ✅ Tìm thấy giao dịch phù hợp!`);
        console.log(`   📝 Bank Trans ID: ${matchedTx.bankTransId}`);
        console.log(`   💵 Số tiền: ${matchedTx.amount} VNĐ`);
        console.log(`   📄 Nội dung: ${matchedTx.msgContent}`);

        // 7. Process Deposit (Simulate autoDeposit logic)
        console.log('\n📌 STEP 6: Xử lý nạp tiền tự động...');
        const creditAmount = Number(matchedTx.amount);
        const txRef = `VIETTEL-${matchedTx.bankTransId}`;

        // Update deposit status
        await query('UPDATE deposits SET status = ?, tx_ref = ? WHERE id = ?', ['approved', txRef, testDeposit.id]);

        // Update user balance
        await query('UPDATE users SET balance = balance + ? WHERE id = ?', [creditAmount, testUser.id]);

        // Add balance log
        await query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)',
            [testUser.id, creditAmount, `deposit:${txRef}`]);

        console.log(`   ✅ Đã duyệt deposit #${testDeposit.id}`);
        console.log(`   💰 Cộng ${creditAmount} VNĐ vào tài khoản`);

        // Get updated balance
        const updatedUserRows = await query('SELECT * FROM users WHERE id = ?', [testUser.id]);
        const updatedUser = updatedUserRows[0];
        console.log(`   💵 Số dư mới: ${updatedUser.balance} VNĐ`);

        // 8. Complete Purchase (Simulate completePurchaseAfterDeposit)
        console.log('\n📌 STEP 7: Hoàn thành mua hàng...');

        if (Number(updatedUser.balance) >= testProduct.price) {
            // Get available account
            const accRows = await query('SELECT * FROM accounts WHERE product_id = ? AND status = ? LIMIT 1',
                [testProduct.id, 'available']);

            if (accRows.length > 0) {
                const account = accRows[0];

                // Create order
                await query('INSERT INTO orders (user_id, product_id, price, status) VALUES (?, ?, ?, ?)',
                    [testUser.id, testProduct.id, testProduct.price, 'completed']);

                // Update account status
                await query('UPDATE accounts SET status = ? WHERE id = ?', ['sold', account.id]);

                // Deduct balance
                await query('UPDATE users SET balance = balance - ? WHERE id = ?', [testProduct.price, testUser.id]);

                // Add balance log
                await query('INSERT INTO balance_logs (user_id, amount, reason) VALUES (?, ?, ?)',
                    [testUser.id, -testProduct.price, `order:${testProduct.name}`]);

                console.log(`   ✅ Đã tạo đơn hàng thành công!`);
                console.log(`   🎁 Sản phẩm: ${testProduct.name}`);
                console.log(`   🔑 Tài khoản: ${account.username}`);

                // Final balance
                const finalUserRows = await query('SELECT * FROM users WHERE id = ?', [testUser.id]);
                console.log(`   💵 Số dư còn lại: ${finalUserRows[0].balance} VNĐ`);
            } else {
                console.log('   ❌ Hết hàng!');
            }
        } else {
            console.log(`   ❌ Vẫn không đủ tiền (Balance: ${updatedUser.balance}, Need: ${testProduct.price})`);
        }

        // 9. Summary
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('   ✅ TEST HOÀN THÀNH!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n📋 Tóm tắt quy trình:');
        console.log('   1. User mua hàng -> Không đủ tiền');
        console.log('   2. Hệ thống tạo QR với token: ' + depositToken);
        console.log('   3. User chuyển khoản (mock)');
        console.log('   4. Hệ thống check API Viettel -> Tìm thấy giao dịch');
        console.log('   5. Tự động duyệt nạp tiền');
        console.log('   6. Tự động hoàn thành đơn hàng');
        console.log('\n💡 Trong thực tế, bước 3-6 diễn ra tự động bởi autoDeposit watcher.');

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR:', error);
        await pool.end();
        process.exit(1);
    }
};

runTest();
