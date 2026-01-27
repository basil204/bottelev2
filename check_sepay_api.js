import dotenv from 'dotenv';
import { query, initDb } from './includes/database/index.js';
import { getTransactions } from './includes/services/sepayService.js';
import { config } from './config.js';

dotenv.config();

const checkSepay = async () => {
    console.log("🔍 Checking SePay API...");
    await initDb(config);

    try {
        // 1. Get Settings from DB
        const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` IN ('sepay_enabled', 'sepay_token', 'sepay_account_no')");
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);

        console.log("⚙️ Settings:", settings);

        if (!settings.sepay_token) {
            console.error("❌ Error: 'sepay_token' is missing in database settings.");
            process.exit(1);
        }

        // 2. Call SePay API
        console.log("📡 Fetching transactions from SePay...");
        const data = await getTransactions(settings.sepay_token, {
            account_number: settings.sepay_account_no,
            limit: 5
        });

        // 3. Output
        console.log("✅ API Response Status: Success");
        console.log("📄 Raw Data:", JSON.stringify(data, null, 2));

        if (data.transactions && data.transactions.length > 0) {
            console.log(`📊 Found ${data.transactions.length} transactions.`);
        } else {
            console.log("⚠️ No transactions found (or empty list returned).");
        }

    } catch (error) {
        console.error("❌ API Call Failed:", error.message);
        if (error.response) {
            console.error("🔴 Status:", error.response.status);
            console.error("🔴 Data:", JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        process.exit();
    }
};

checkSepay();
