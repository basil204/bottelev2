-- Migration: Add 2FA secret column to edu_emails table
-- Run: npx tsx scripts/run-migration.ts

-- Add 2fa_secret column
ALTER TABLE edu_emails ADD COLUMN IF NOT EXISTS 2fa_secret VARCHAR(255) NULL AFTER password;

-- Alternatively, if the above syntax doesn't work in your MySQL version:
-- ALTER TABLE edu_emails ADD COLUMN `2fa_secret` VARCHAR(255) NULL AFTER password;
