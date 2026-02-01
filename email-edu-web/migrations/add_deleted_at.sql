-- Migration: Add deleted_at column for auto-cleanup feature
-- Run this SQL manually or via your database tool

-- Add deleted_at column to edu_emails
ALTER TABLE edu_emails ADD COLUMN deleted_at TIMESTAMP NULL AFTER delete_at;

-- Add index for deleted_at
CREATE INDEX idx_deleted_at ON edu_emails(deleted_at);

-- Add auto_cleanup_days setting
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('auto_cleanup_days', '3');

-- Create tmail_domains table (admin quản lý)
CREATE TABLE IF NOT EXISTS tmail_domains (
    id INT PRIMARY KEY AUTO_INCREMENT,
    domain VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
);

-- Insert default tMail domain
INSERT IGNORE INTO tmail_domains (domain) VALUES ('fthcapital.com');

-- Create tmail_accounts table
CREATE TABLE IF NOT EXISTS tmail_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    account_id VARCHAR(100),
    domain VARCHAR(100) DEFAULT 'fthcapital.com',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_email (email)
);
