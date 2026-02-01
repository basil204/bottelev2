-- Add admin credentials to database
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('admin_username', 'admin');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('admin_password', 'admin123');

-- Verify
SELECT * FROM settings WHERE `key` IN ('admin_username', 'admin_password');
