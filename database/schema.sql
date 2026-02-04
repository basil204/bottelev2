CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  balance DECIMAL(18,2) DEFAULT 0,
  credit INT DEFAULT 0,
  referral_code VARCHAR(50) UNIQUE,
  language VARCHAR(5) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(18,2) NOT NULL,
  description TEXT,
  stock INT DEFAULT 0,
  type ENUM('auto', 'manual') DEFAULT 'auto'
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
  email VARCHAR(255) NULL,
  note TEXT NULL,
  status ENUM('pending', 'completed') DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_status (status)
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
