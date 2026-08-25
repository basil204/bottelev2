-- Migration: Add advanced product fields to products table
ALTER TABLE products ADD COLUMN delivery_type VARCHAR(50) NULL;
ALTER TABLE products ADD COLUMN prompt_message TEXT NULL;
ALTER TABLE products ADD COLUMN item_structure VARCHAR(255) NULL;
ALTER TABLE products ADD COLUMN account_prefix VARCHAR(100) NULL;
ALTER TABLE products ADD COLUMN file_delivery_mode VARCHAR(50) NULL;
ALTER TABLE products ADD COLUMN telegram_file_id VARCHAR(255) NULL;
ALTER TABLE products ADD COLUMN telegram_file_unique_id VARCHAR(255) NULL;
ALTER TABLE products ADD COLUMN access_duration_enabled TINYINT(1) DEFAULT 0;
ALTER TABLE products ADD COLUMN access_duration_days INT DEFAULT 30;
ALTER TABLE products ADD COLUMN preorder_enabled TINYINT(1) DEFAULT 0;
ALTER TABLE products ADD COLUMN preorder_fee_vnd DECIMAL(15,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN preorder_fee_usdt DECIMAL(15,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN preorder_max_per_user INT DEFAULT 5;
ALTER TABLE products ADD COLUMN preorder_total_limit INT DEFAULT 100;
ALTER TABLE products ADD COLUMN image_url TEXT NULL;
