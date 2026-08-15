-- Migration: Create chatgpt_accounts table for storing and managing ChatGPT accounts (TK, MK, 2FA, Plus/Free, Live/Die)
CREATE TABLE IF NOT EXISTS chatgpt_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  twofa_secret VARCHAR(255) NULL,
  is_plus TINYINT(1) NOT NULL DEFAULT 0,
  plan_type VARCHAR(50) NOT NULL DEFAULT 'free',
  status ENUM('live', 'die', 'wrong_pass', 'twofa_error', 'uncheck') NOT NULL DEFAULT 'uncheck',
  sale_status ENUM('in_stock', 'sold', 'used', 'reserved') NOT NULL DEFAULT 'in_stock',
  note TEXT NULL,
  last_checked_at TIMESTAMP NULL,
  plus_updated_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chatgpt_email (email),
  INDEX idx_chatgpt_is_plus (is_plus),
  INDEX idx_chatgpt_status (status),
  INDEX idx_chatgpt_sale_status (sale_status),
  INDEX idx_chatgpt_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
