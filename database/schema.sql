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

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  priority INT DEFAULT 0,
  emoji VARCHAR(50) DEFAULT NULL,
  custom_emoji_id VARCHAR(100) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NULL,
  price DECIMAL(18,2) NOT NULL,
  description TEXT,
  stock INT DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  sold_adjustment INT NOT NULL DEFAULT 0,
  type VARCHAR(50) DEFAULT 'stock',
  category_id INT NULL DEFAULT NULL,
  priority INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  require_email TINYINT(1) DEFAULT 0,
  check_live TINYINT(1) DEFAULT 0,
  delivery_type VARCHAR(50) NULL,
  prompt_message TEXT NULL,
  item_structure VARCHAR(255) NULL,
  account_prefix VARCHAR(100) NULL,
  file_delivery_mode VARCHAR(50) NULL,
  telegram_file_id VARCHAR(255) NULL,
  telegram_file_unique_id VARCHAR(255) NULL,
  access_duration_enabled TINYINT(1) DEFAULT 0,
  access_duration_days INT DEFAULT 30,
  preorder_enabled TINYINT(1) DEFAULT 0,
  preorder_fee_vnd DECIMAL(15,2) DEFAULT 0,
  preorder_fee_usdt DECIMAL(15,2) DEFAULT 0,
  preorder_max_per_user INT DEFAULT 5,
  preorder_total_limit INT DEFAULT 100,
  image_url TEXT NULL,
  emoji VARCHAR(50) NULL,
  custom_emoji_id VARCHAR(100) NULL,
  telegram_emoji VARCHAR(50) NULL,
  telegram_custom_emoji_id VARCHAR(100) NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
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
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_enabled', 'true');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_price', '25000');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_headless', 'true');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_concurrency', '1');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('netflix_proxies', '');

-- Netflix Tasks & Queue Table (Hàng chờ & Tác vụ Auto Netflix 30 Ngày)
CREATE TABLE IF NOT EXISTS netflix_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  telegram_id VARCHAR(64) NULL,
  email VARCHAR(255) NOT NULL,
  price DECIMAL(15, 2) DEFAULT 0,
  proxy_used VARCHAR(255) NULL,
  status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  step_status VARCHAR(255) NULL,
  error_message TEXT NULL,
  screenshot_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  INDEX idx_netflix_status (status),
  INDEX idx_netflix_tg (telegram_id),
  INDEX idx_netflix_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin Accounts table
CREATE TABLE IF NOT EXISTS admin_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fullname VARCHAR(255) NULL,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  telegram_id VARCHAR(50) NULL,
  role ENUM('super_admin', 'admin') NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admin_telegram_id (telegram_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- CapCut Workspaces Table
CREATE TABLE IF NOT EXISTS capcut_admin_workspaces (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_email VARCHAR(255) NOT NULL,
  admin_password VARCHAR(255) NOT NULL,
  admin_cookie TEXT NOT NULL,
  workspace_id VARCHAR(100) NOT NULL UNIQUE,
  workspace_name VARCHAR(255) NULL,
  member_limit INT DEFAULT 7,
  member_cnt INT DEFAULT 1,
  team_vip_end BIGINT DEFAULT 0,
  status ENUM('active', 'full', 'expired', 'disabled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_ws_id (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CapCut User Warranties Table
CREATE TABLE IF NOT EXISTS capcut_user_warranties (
  id INT PRIMARY KEY AUTO_INCREMENT,
  telegram_id VARCHAR(50) NOT NULL,
  user_capcut_email VARCHAR(255) NOT NULL,
  user_capcut_uid VARCHAR(100) NULL,
  workspace_id VARCHAR(100) NOT NULL,
  admin_email VARCHAR(255) NULL,
  price_paid DECIMAL(15,2) DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  status ENUM('active', 'expired', 'refunded') DEFAULT 'active',
  note TEXT NULL,
  INDEX idx_tg_id (telegram_id),
  INDEX idx_user_email (user_capcut_email),
  INDEX idx_ws_id (workspace_id),
  INDEX idx_admin_email (admin_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Broadcast Templates Table
CREATE TABLE IF NOT EXISTS broadcast_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  message TEXT NOT NULL,
  image_url TEXT NULL,
  inline_keyboard JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Support Requests Table
CREATE TABLE IF NOT EXISTS support_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  telegram_id BIGINT NULL,
  request_type VARCHAR(50) DEFAULT 'SUPPORT',
  status VARCHAR(50) DEFAULT 'processing',
  customer_message TEXT NULL,
  admin_reply TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User API Keys Table
CREATE TABLE IF NOT EXISTS user_api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(100) NULL,
  permissions VARCHAR(255) DEFAULT 'all',
  status ENUM('active', 'revoked') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_api_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bank Transaction History table (lưu lịch sử giao dịch)
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

-- Canva Teams Table (Quản lý các Đội Canva & Cookie Pool)
CREATE TABLE IF NOT EXISTS canva_teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cookies TEXT NOT NULL,
  local_storage TEXT NULL,
  member_limit INT DEFAULT 500,
  current_members INT DEFAULT 0,
  role VARCHAR(50) DEFAULT 'member',
  status ENUM('active', 'full', 'expired', 'disabled') DEFAULT 'active',
  proxy VARCHAR(255) NULL,
  last_checked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_canva_team_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Canva Tasks Table (Hàng chờ, Đơn mua & Lịch sử mời Canva)
CREATE TABLE IF NOT EXISTS canva_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  telegram_id VARCHAR(64) NULL,
  team_id INT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  price DECIMAL(15, 2) DEFAULT 0,
  proxy_used VARCHAR(255) NULL,
  invite_link TEXT NULL,
  invite_token VARCHAR(255) NULL,
  team_name VARCHAR(255) NULL,
  status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  step_status VARCHAR(255) NULL,
  error_message TEXT NULL,
  screenshot_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  INDEX idx_canva_task_status (status),
  INDEX idx_canva_task_tg (telegram_id),
  INDEX idx_canva_task_team (team_id),
  INDEX idx_canva_task_created_at (created_at),
  FOREIGN KEY (team_id) REFERENCES canva_teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default Canva Settings
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_enabled', 'true');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_price', '15000');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_headless', 'true');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_concurrency', '1');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_default_role', 'member');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('canva_proxies', '');

