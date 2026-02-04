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
