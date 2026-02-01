-- Database: webapi
-- Schema cho Email EDU Website

-- Bảng users (người dùng)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    role ENUM('admin', 'user') DEFAULT 'user',
    email_quota INT DEFAULT 10,
    emails_created INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
);

-- Bảng domains EDU
CREATE TABLE IF NOT EXISTS edu_domains (
    id INT PRIMARY KEY AUTO_INCREMENT,
    domain VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
);

-- Bảng emails đã tạo
CREATE TABLE IF NOT EXISTS edu_emails (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    domain_id INT NOT NULL,
    delete_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,
    status ENUM('active', 'deleted') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (domain_id) REFERENCES edu_domains(id) ON DELETE RESTRICT,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_delete_at (delete_at),
    INDEX idx_deleted_at (deleted_at)
);

-- Bảng settings
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT
);

-- Insert domains mặc định
INSERT IGNORE INTO edu_domains (domain) VALUES ('suafpoly.app');
INSERT IGNORE INTO edu_domains (domain) VALUES ('student.edu.vn');
INSERT IGNORE INTO edu_domains (domain) VALUES ('fpoly.edu.vn');

-- Bảng tMail domains (admin quản lý)
CREATE TABLE IF NOT EXISTS tmail_domains (
    id INT PRIMARY KEY AUTO_INCREMENT,
    domain VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
);

-- Insert default tMail domain
INSERT IGNORE INTO tmail_domains (domain) VALUES ('fthcapital.com');

-- Bảng tMail accounts (temporary emails)
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

-- Bảng settings
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('default_email_quota', '10');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('default_delete_hours', '24');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('auto_cleanup_days', '3');
