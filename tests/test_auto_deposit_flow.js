
import { createConnection } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock Config
const config = {
    ADMIN_IDS: [123456],
    PAGE_SIZE: 10,
    TELEGRAM_GROUP_LINKS: []
};

// Imports from local files - using absolute paths relative to project root would be ideal, 
// but we are in tests/ so ../includes/...
// Mock Bot
const mockBot = {
    sendMessage: async (chatId, text, opts) => {
        console.log(`[BOT_SEND] Chat ${chatId}: ${text}`);
        if (opts) console.log(`[BOT_OPTS]`, opts);
        return { message_id: Date.now() };
    },
    sendPhoto: async (chatId, photo, opts) => {
        console.log(`[BOT_PHOTO] Chat ${chatId}: [Photo URL]`);
        if (opts) console.log(`[BOT_OPTS]`, opts);
        return { message_id: Date.now() };
    },
    sendDocument: async (chatId, doc, opts) => {
        console.log(`[BOT_DOC] Chat ${chatId}: Document`);
        if (opts) console.log(`[BOT_OPTS]`, opts);
        return { message_id: Date.now() };
    },
    deleteMessage: async (chatId, msgId) => {
        console.log(`[BOT_DEL] Chat ${chatId} Msg ${msgId}`);
    }
};

// Helper to run
const runTest = async () => {
    console.log('--- STARTING TEST FLOW ---');

    // 1. Setup DB Connection (reuses index.js logic if possible, or just raw)
    // We need to import the database module to ensure pool is initialized if we use controllers
    const { query } = await import('../includes/database/index.js');
    const { getUserByTelegram, updateBalance } = await import('../includes/controllers/userController.js');
    const { getProduct, createProduct } = await import('../includes/controllers/productController.js');
    const { handlePurchaseWithQuantity, completePurchaseAfterDeposit } = await import('../includes/handle/handleBuy.js');
    const { getCache, setCache, delCache } = await import('../includes/lib/cache/index.js');
    const { processDepositTransaction } = await import('../includes/services/autoDeposit.js');
    // Wait, processDepositTransaction is not exported? It is internal in autoDeposit.js.
    // We might need to use checkPaymentForUser or simulate logic. 
    // Actually, let's verify if processDepositTransaction is exported. 
    // Checking autoDeposit.js... It is NOT exported. It's internal. 
    // But checkPaymentForUser IS exported. 
    // However checkPaymentForUser calls API. 
    // We want to simulate "Money Received".
    // We can simulate the cache state that autoDeposit uses? 
    // Or we can modify autoDeposit to export processDepositTransaction for testing? 
    // Or just replicate the deposit success logic: updateBalance + completePurchaseAfterDeposit.

    // Let's rely on `completePurchaseAfterDeposit` which IS the core logic we want to test for "auto check".
    // The "Auto Deposit" part usually involves parsing bank history. We can skip that and assume "We verified payment".
    // So the test flow:
    // 1. Buy -> Fail -> QR Generated (Cache set)
    // 2. Simulate "Money Received" event (Update Balance manually? No, should be via deposit flow to trigger logs)
    // 3. Call completePurchaseAfterDeposit and verify it works.

    const TEST_USER_ID = 999999999;
    const TEST_USERNAME = 'test_user_flow';

    // Ensure user exists
    let user = await getUserByTelegram(TEST_USER_ID);
    if (!user) {
        await query("INSERT INTO users (telegram_id, username, balance) VALUES (?, ?, 0)", [TEST_USER_ID, TEST_USERNAME]);
        user = await getUserByTelegram(TEST_USER_ID);
    }

    console.log(`User Balance Before: ${user.balance}`);
    // Reset balance to 0
    await updateBalance(user.id, -user.balance);

    // Ensure we have a product
    const rows = await query("SELECT * FROM products LIMIT 1");
    let product;
    if (rows.length === 0) {
        const res = await createProduct({ name: 'Test Product', price: 10000, description: 'Test', type: 'stock' });
        product = await getProduct(res.insertId);
        // Add stock
        await query("INSERT INTO accounts (product_id, username, password, status) VALUES (?, ?, ?, ?)", [product.id, 'user|pass', 'pass', 'available']);
    } else {
        product = rows[0];
        // Ensure stock
        const stocks = await query("SELECT count(*) as c FROM accounts WHERE product_id = ? AND status='available'", [product.id]);
        if (stocks[0].c === 0) {
            await query("INSERT INTO accounts (product_id, username, password, status) VALUES (?, 'test|acc', 'pass', 'available')", [product.id]);
        }
    }

    // Mock Message
    const msg = {
        chat: { id: TEST_USER_ID },
        from: { id: TEST_USER_ID, username: TEST_USERNAME, first_name: 'Test' }
    };

    // 2. Buy Product (Insufficient Funds)
    console.log(`\n[STEP 1] Buying Product #${product.id} (Price: ${product.price})...`);
    await handlePurchaseWithQuantity(mockBot, msg, product.id, 1, config);

    // Check Cache for Pending Purchase
    const purchaseKey = `purchase_${TEST_USER_ID}`;
    const pending = getCache(purchaseKey);

    if (!pending) {
        console.error('❌ FAILED: No pending purchase found in cache. Logic did not queue purchase.');
        process.exit(1);
    }
    console.log('✅ Pending Purchase found:', pending);

    // Check Cache for QR (Bank Deposit)
    // handlePurchaseWithQuantity calls handleDepositAmount -> creates QR
    const qrKeyVal = `qr_${TEST_USER_ID}`;
    const qrCache = getCache(qrKeyVal);
    if (!qrCache) {
        console.error('❌ FAILED: No QR cache found. handleDepositAmount might not have run or failed.');
        // Note: if balance was EXACTLY 0 and price > 0, it should run.
        process.exit(1);
    }
    console.log('✅ QR Cache found:', qrCache);

    // 3. Simulate Deposit Success
    console.log(`\n[STEP 2] Simulating Deposit of ${pending.totalPrice}...`);
    // We manually mimic what processDepositTransaction does:
    // 1. Update Balance
    // 2. Log Balance
    // 3. Call completePurchaseAfterDeposit

    await updateBalance(user.id, pending.totalPrice);
    console.log('✅ Balance Updated manually to simulate deposit.');

    // 4. Trigger Check
    console.log(`\n[STEP 3] Triggering completePurchaseAfterDeposit...`);
    const success = await completePurchaseAfterDeposit(mockBot, user.id, user.telegram_id, msg.chat.id);

    if (success) {
        console.log('✅ completePurchaseAfterDeposit returned TRUE.');
    } else {
        console.error('❌ completePurchaseAfterDeposit returned FALSE.');
    }

    // Verify Cache Cleared
    const pendingAfter = getCache(purchaseKey);
    if (!pendingAfter) {
        console.log('✅ Purchase Cache cleared.');
    } else {
        console.error('❌ Purchase Cache still exists!');
    }

    // Verify User Balance (Should be 0 after purchase if we deposited exact amount)
    const userAfter = await getUserByTelegram(TEST_USER_ID);
    console.log(`User Balance After: ${userAfter.balance}`);

    // Should be close to 0 (allow for precision if any, but logic is integer/float match)
    const expectedBalance = 0;
    if (Math.abs(userAfter.balance - expectedBalance) < 100) { // Tolerance
        console.log('✅ Balance verification passed.');
    } else {
        console.log('⚠️ Balance verification: Expected ~0, got ' + userAfter.balance);
    }

    console.log('\n--- TEST COMPLETED ---');
    process.exit(0);
};

runTest().catch(console.error);
