
import { createConnection } from 'mysql2/promise';
import config from '../config.js';

async function migrate() {
    try {
        console.log('Starting migration...');
        const connection = await createConnection({
            host: config.DB_HOST,
            user: config.DB_USER,
            password: config.DB_PASS,
            database: config.DB_NAME
        });

        console.log('Connected to database.');

        // Check columns
        const [columns] = await connection.query("SHOW COLUMNS FROM accounts");
        const hasTwofa = columns.some(c => c.Field === 'twofa');
        const hasExtraData = columns.some(c => c.Field === 'extra_data');

        if (!hasTwofa) {
            console.log("Adding column 'twofa'...");
            await connection.query("ALTER TABLE accounts ADD COLUMN twofa VARCHAR(255) DEFAULT NULL");
            console.log("Added 'twofa' column.");
        } else {
            console.log("'twofa' column already exists.");
        }

        if (!hasExtraData) {
            console.log("Adding column 'extra_data'...");
            await connection.query("ALTER TABLE accounts ADD COLUMN extra_data TEXT DEFAULT NULL");
            console.log("Added 'extra_data' column.");
        } else {
            console.log("'extra_data' column already exists.");
        }

        // Insert default USDT settings
        console.log("Checking USDT settings...");
        const [usdtSettings] = await connection.query("SELECT `key` FROM settings WHERE `key` IN ('usdt_wallet_address', 'usdt_network')");
        const existingKeys = usdtSettings.map(s => s.key);

        if (!existingKeys.includes('usdt_network')) {
            await connection.query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", ['usdt_network', 'BEP20']);
            console.log("Added default usdt_network.");
        }

        if (!existingKeys.includes('usdt_wallet_address')) {
            await connection.query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", ['usdt_wallet_address', 'Chưa cập nhật']);
            console.log("Added default usdt_wallet_address.");
        }

        // Check language column for users
        console.log("Checking language column...");
        const [userColumns] = await connection.query("SHOW COLUMNS FROM users");
        if (!userColumns.some(c => c.Field === 'language')) {
            console.log("Adding column 'language' to users...");
            await connection.query("ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'vi'");
            console.log("Added 'language' column.");
        }

        // Check exchange_rate setting
        console.log("Checking exchange_rate...");
        const [rateSetting] = await connection.query("SELECT `key` FROM settings WHERE `key` = 'exchange_rate'");
        if (rateSetting.length === 0) {
            console.log("Adding default exchange_rate...");
            await connection.query("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", ['exchange_rate', '26000']);
            console.log("Added default exchange_rate.");
        }

        // Check type column in deposits
        console.log("Checking deposits.type column...");
        const [depositColumns] = await connection.query("SHOW COLUMNS FROM deposits");
        if (!depositColumns.some(c => c.Field === 'type')) {
            console.log("Adding column 'type' to deposits...");
            await connection.query("ALTER TABLE deposits ADD COLUMN type VARCHAR(10) DEFAULT 'bank'");
            console.log("Added 'type' column.");
            // Backfill existing USDT deposits
            console.log("Backfilling type for existing USDT deposits...");
            await connection.query("UPDATE deposits SET type = 'usdt' WHERE content LIKE '%BYBIT%' OR content LIKE '%USDT%'");
            console.log("Backfill complete.");
        }

        // Fix products.type column to accept all values
        console.log("Checking products.type column...");
        const [productColumns] = await connection.query("SHOW COLUMNS FROM products");
        const typeCol = productColumns.find(c => c.Field === 'type');
        if (typeCol && typeCol.Type.includes('enum')) {
            console.log("Converting products.type from ENUM to VARCHAR...");
            await connection.query("ALTER TABLE products MODIFY COLUMN type VARCHAR(20) DEFAULT 'stock'");
            console.log("Fixed products.type column.");
        }

        // Check categories table
        console.log("Checking categories table...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                priority INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Categories table checked/created.");

        // Check products.category_id column
        console.log("Checking products.category_id column...");
        if (!productColumns.some(c => c.Field === 'category_id')) {
            console.log("Adding column 'category_id' to products...");
            await connection.query("ALTER TABLE products ADD COLUMN category_id INT NULL DEFAULT NULL");
            try {
                await connection.query("ALTER TABLE products ADD CONSTRAINT fk_products_categories FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL");
            } catch (fkErr) {
                console.log("Foreign key constraint addition skipped or already exists:", fkErr.message);
            }
            console.log("Added 'category_id' column.");
        }

        // Check if orders.product_id is nullable
        console.log("Checking orders.product_id column...");
        const [orderColumns] = await connection.query("SHOW COLUMNS FROM orders");
        const productIdCol = orderColumns.find(c => c.Field === 'product_id');
        if (productIdCol && productIdCol.Null === 'NO') {
            console.log("Converting orders.product_id to allow NULL...");
            await connection.query("ALTER TABLE orders MODIFY COLUMN product_id INT NULL");
            console.log("Fixed orders.product_id column.");
        }

        // Ensure default category 'Khác' exists
        await connection.query("INSERT IGNORE INTO categories (name, priority) VALUES ('Khác', 0)");

        // Migrate text categories to category_id
        try {
            // Get unique text categories from products that don't have category_id set
            const [existingTextCats] = await connection.query(
                "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' AND category_id IS NULL"
            );
            if (existingTextCats.length > 0) {
                console.log(`Migrating ${existingTextCats.length} categories to categories table...`);
                for (const row of existingTextCats) {
                    if (row.category) {
                        await connection.query("INSERT IGNORE INTO categories (name, priority) VALUES (?, 0)", [row.category]);
                    }
                }
                // Backfill category_id
                await connection.query(
                    "UPDATE products p JOIN categories c ON p.category = c.name SET p.category_id = c.id WHERE p.category_id IS NULL"
                );
                console.log("Category data migration and backfill completed.");
            }
        } catch (migErr) {
            console.error("Error during category data migration:", migErr.message);
        }

        // Backfill remaining products (that have null category_id) to default category 'Khác'
        try {
            const [defaultCatRows] = await connection.query("SELECT id FROM categories WHERE name = 'Khác'");
            if (defaultCatRows.length > 0) {
                const defaultCatId = defaultCatRows[0].id;
                await connection.query("UPDATE products SET category_id = ? WHERE category_id IS NULL", [defaultCatId]);
            }
        } catch (dfErr) {
            console.error("Error setting default category_id:", dfErr.message);
        }

        // -------------------------------------------------------------
        // NEW AUTO-MIGRATIONS (Consolidated from separate scripts)
        // -------------------------------------------------------------
        
        // 1. Gmail Accounts Revenue Columns
        console.log("Checking gmail_accounts columns for revenue stats...");
        const [gmailCols] = await connection.query("SHOW COLUMNS FROM gmail_accounts");
        const hasSoldPrice = gmailCols.some(c => c.Field === 'sold_price');
        const hasOrderId = gmailCols.some(c => c.Field === 'order_id');
        const hasSoldTo = gmailCols.some(c => c.Field === 'sold_to_user_id');

        if (!hasSoldTo) {
            console.log("Adding column 'sold_to_user_id' to gmail_accounts...");
            await connection.query("ALTER TABLE gmail_accounts ADD COLUMN sold_to_user_id INT DEFAULT NULL");
        }
        if (!hasSoldPrice) {
            console.log("Adding column 'sold_price' to gmail_accounts...");
            await connection.query("ALTER TABLE gmail_accounts ADD COLUMN sold_price DECIMAL(10, 2) DEFAULT NULL");
            
            // Backfill sold_price for existing sold accounts
            const [priceSetting] = await connection.query("SELECT `value` FROM settings WHERE `key` = 'gmail_edu_price'");
            const currentPrice = Number(priceSetting[0]?.value) || 10000;
            console.log(`Backfilling sold_price with current price (${currentPrice}) for already sold accounts...`);
            await connection.query("UPDATE gmail_accounts SET sold_price = ? WHERE status = 'sold' AND sold_price IS NULL", [currentPrice]);
        }
        if (!hasOrderId) {
            console.log("Adding column 'order_id' to gmail_accounts...");
            await connection.query("ALTER TABLE gmail_accounts ADD COLUMN order_id VARCHAR(50) DEFAULT NULL");
        }

        // 2. Stored Accounts Columns (New Features & Bot Status)
        console.log("Checking stored_accounts columns...");
        const [storedCols] = await connection.query("SHOW COLUMNS FROM stored_accounts");
        const hasStoredCode = storedCols.some(c => c.Field === 'code');
        const hasStoredSoldTo = storedCols.some(c => c.Field === 'sold_to_user_id');
        const hasBotStatus = storedCols.some(c => c.Field === 'bot_status');

        if (!hasStoredCode) {
            console.log("Adding column 'code' to stored_accounts...");
            await connection.query("ALTER TABLE stored_accounts ADD COLUMN code VARCHAR(100) NULL AFTER data");
        }
        if (!hasStoredSoldTo) {
            console.log("Adding column 'sold_to_user_id' to stored_accounts...");
            await connection.query("ALTER TABLE stored_accounts ADD COLUMN sold_to_user_id INT NULL AFTER sold_at");
        }
        if (!hasBotStatus) {
            console.log("Adding column 'bot_status' to stored_accounts...");
            await connection.query("ALTER TABLE stored_accounts ADD COLUMN bot_status ENUM('not_uploaded', 'uploaded') DEFAULT 'not_uploaded' AFTER sale_status");
        }

        // 3. Update payment_status ENUM
        console.log("Updating stored_accounts payment_status ENUM...");
        try {
            await connection.query("ALTER TABLE stored_accounts MODIFY COLUMN payment_status ENUM('pending', 'paid', 'invalid', 'package_error', 'wrong_info') DEFAULT 'pending'");
        } catch (e) {
            console.log("Failed to update payment_status ENUM:", e.message);
        }

        // 4. Products Columns (Code & Check Live)
        console.log("Checking products columns for new features...");
        const [prodCols] = await connection.query("SHOW COLUMNS FROM products");
        const hasProdCode = prodCols.some(c => c.Field === 'code');
        const hasCheckLive = prodCols.some(c => c.Field === 'check_live');

        if (!hasProdCode) {
            console.log("Adding column 'code' to products...");
            await connection.query("ALTER TABLE products ADD COLUMN code VARCHAR(100) NULL AFTER name");
        }
        if (!hasCheckLive) {
            console.log("Adding column 'check_live' to products...");
            await connection.query("ALTER TABLE products ADD COLUMN check_live TINYINT(1) DEFAULT 0");
        }

        // 5. Add index for stored_accounts sold_to_user_id
        console.log("Ensuring index for stored_accounts.sold_to_user_id...");
        try {
            await connection.query("ALTER TABLE stored_accounts ADD INDEX idx_sold_to_user (sold_to_user_id)");
        } catch (e) {
            if (e.code !== 'ER_DUP_KEYNAME') {
                console.log("Failed to add index:", e.message);
            }
        }

        // 6. Admin Logs Table
        console.log("Ensuring admin_logs table...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT DEFAULT NULL,
                admin_name VARCHAR(100) DEFAULT NULL,
                action VARCHAR(50) NOT NULL,
                target_type VARCHAR(50) NOT NULL,
                target_id VARCHAR(100) DEFAULT NULL,
                details TEXT DEFAULT NULL,
                ip_address VARCHAR(255) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_id (admin_id),
                INDEX idx_action (action),
                INDEX idx_target_type (target_type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 7. Ensure bank_transactions table has bank column
        console.log("Checking bank_transactions bank column...");
        try {
            const [btCols] = await connection.query("SHOW COLUMNS FROM bank_transactions");
            if (!btCols.some(c => c.Field === 'bank')) {
                console.log("Adding column 'bank' to bank_transactions...");
                await connection.query("ALTER TABLE bank_transactions ADD COLUMN bank VARCHAR(20) DEFAULT 'VIETTEL' AFTER msg_content");
            }
        } catch (e) {
            console.log("Failed to alter bank_transactions table:", e.message);
        }

        console.log('Migration completed successfully.');
        await connection.end();
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

export default migrate;
