CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  balance DECIMAL(18,2) DEFAULT 0,
  credit INT DEFAULT 0,
  referral_code VARCHAR(50) UNIQUE,
  language VARCHAR(5) DEFAULT NULL,
  customer_tag VARCHAR(50) NULL,
  admin_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(18,2) NOT NULL,
  description TEXT,
  stock INT DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  sold_adjustment INT NOT NULL DEFAULT 0,
  type ENUM('auto', 'manual') DEFAULT 'auto',
  priority INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  status ENUM('available','sold') DEFAULT 'available',
  delete_at TIMESTAMP NULL DEFAULT NULL,
  twofa VARCHAR(255) DEFAULT NULL,
  extra_data TEXT DEFAULT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_delete_at (delete_at)
);

CREATE TABLE IF NOT EXISTS deposits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  tx_ref VARCHAR(64),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  price DECIMAL(18,2) NOT NULL,
  email TEXT NULL,
  note TEXT NULL,
  status ENUM('pending', 'completed') DEFAULT 'completed',
  invoice_code VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_invoice_code (invoice_code)
);

CREATE TABLE IF NOT EXISTS balance_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  admin_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gmail_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  type ENUM('edu', 'non') NOT NULL,
  domain VARCHAR(255),
  status ENUM('available', 'sold', 'deleted') DEFAULT 'available',
  lastLoginTime TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sold_at TIMESTAMP NULL DEFAULT NULL,
  delete_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_type_status (type, status),
  INDEX idx_status (status),
  INDEX idx_delete_at (delete_at)
);

CREATE TABLE IF NOT EXISTS vip_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  package_type VARCHAR(50) DEFAULT 'vip',
  total_gmail INT NOT NULL DEFAULT 400,
  used_gmail INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  status ENUM('active', 'used_up', 'expired') DEFAULT 'active',
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status),
  INDEX idx_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS vip_gmail_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vip_package_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vip_package_id) REFERENCES vip_packages(id) ON DELETE CASCADE,
  INDEX idx_vip_package (vip_package_id)
);

CREATE TABLE IF NOT EXISTS gmail_pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('edu', 'non') NOT NULL,
  duration ENUM('single', 'daily') NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(18,2) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_type_duration_quantity (type, duration, quantity)
);

CREATE TABLE IF NOT EXISTS deposit_promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  bonus_percentage DECIMAL(5,2) NOT NULL COMMENT 'Phần trăm khuyến mại (ví dụ: 10.00 = 10%)',
  min_amount DECIMAL(18,2) NOT NULL COMMENT 'Số tiền nạp tối thiểu để được khuyến mại',
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_time_range (start_time, end_time)
);

CREATE TABLE IF NOT EXISTS checkins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_checked (user_id, checked_at)
);

CREATE TABLE IF NOT EXISTS referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,
  referred_id INT NOT NULL,
  credit_rewarded INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_referral (referrer_id, referred_id),
  INDEX idx_referrer (referrer_id),
  INDEX idx_referred (referred_id)
);

CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (`key`)
);

-- Default admin credentials (username: admin, password: admin123)
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('admin_username', 'admin');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('admin_password', 'admin123');

-- Account types table (loại tài khoản cho kho lưu trữ)
CREATE TABLE IF NOT EXISTS account_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stored accounts table (kho lưu tài khoản)
CREATE TABLE IF NOT EXISTS stored_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_type_id INT NOT NULL,
    data TEXT NOT NULL,
    payment_status ENUM('pending', 'paid', 'invalid') DEFAULT 'pending',
    sale_status ENUM('in_stock', 'sold') DEFAULT 'in_stock',
    paid_at TIMESTAMP NULL,
    sold_at TIMESTAMP NULL,
    note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_type_id) REFERENCES account_types(id) ON DELETE CASCADE,
    INDEX idx_type (account_type_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_sale_status (sale_status)
);

-- Bank Transaction History table (lưu lịch sử giao dịch Viettel Money)
CREATE TABLE IF NOT EXISTS bank_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bank_trans_id VARCHAR(100) UNIQUE NOT NULL COMMENT 'Mã giao dịch từ ngân hàng',
    trans_date DATETIME NOT NULL COMMENT 'Thời gian giao dịch',
    amount DECIMAL(18,2) NOT NULL COMMENT 'Số tiền giao dịch',
    balance DECIMAL(18,2) NULL COMMENT 'Số dư sau giao dịch',
    payment_type ENUM('CREDIT', 'DEBIT') NOT NULL COMMENT 'CREDIT = nhận, DEBIT = chi',
    msg_content TEXT NULL COMMENT 'Nội dung giao dịch',
    account_id VARCHAR(50) NULL COMMENT 'Số tài khoản',
    client_id VARCHAR(100) NULL COMMENT 'Client ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trans_date (trans_date),
    INDEX idx_payment_type (payment_type),
    INDEX idx_bank_trans_id (bank_trans_id)
);

-- ChatGPT Accounts table (Kho tài khoản ChatGPT: TK, MK, 2FA, Plus/Free, Live/Die)
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
