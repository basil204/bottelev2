-- ChatGPT Team Slot Management Schema
-- Created: 2026-02-08

-- Bảng lưu FAM (workspace ChatGPT Team)
CREATE TABLE IF NOT EXISTS chatgpt_fams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'Tên FAM để dễ quản lý',
  workspace_id VARCHAR(100) NOT NULL UNIQUE COMMENT 'chatgpt_account_id từ ChatGPT',
  authorization TEXT NOT NULL COMMENT 'Bearer token',
  max_slots INT DEFAULT 5 COMMENT 'Tổng số slot (bao gồm owner)',
  used_slots INT DEFAULT 0 COMMENT 'Số slot đã sử dụng',
  status ENUM('active', 'full', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu email đang thuê slot
CREATE TABLE IF NOT EXISTS chatgpt_rentals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT 'Telegram user ID',
  fam_id INT NOT NULL COMMENT 'FAM được gán',
  email VARCHAR(255) NOT NULL COMMENT 'Email khách hàng',
  price DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT 'Giá đã thanh toán',
  start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP NOT NULL COMMENT 'Ngày hết hạn',
  status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
  invite_status ENUM('pending', 'sent', 'accepted', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (fam_id) REFERENCES chatgpt_fams(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_fam (fam_id),
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_end_date (end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cài đặt giá slot mặc định
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('chatgpt_slot_price', '60000');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('chatgpt_slot_days', '30');
