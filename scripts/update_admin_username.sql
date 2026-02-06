-- Migration: Update Super Admin username
-- Run this script to change admin username from manhit to adminsp

-- Update admin username in settings table
UPDATE settings SET `value` = 'adminsp' WHERE `key` = 'admin_username';

-- Also update in admin_accounts table if exists
UPDATE admin_accounts SET username = 'adminsp' WHERE username = 'manhit' AND role = 'super_admin';

-- Verify changes
SELECT 'Settings:' as source, `key`, `value` FROM settings WHERE `key` LIKE 'admin_username%'
UNION ALL
SELECT 'Admin Accounts:', username, role FROM admin_accounts WHERE role = 'super_admin';
