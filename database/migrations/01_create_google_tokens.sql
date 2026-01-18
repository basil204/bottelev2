CREATE TABLE IF NOT EXISTS google_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) UNIQUE NOT NULL, -- 'edu', 'non'
    client_credentials TEXT, -- JSON content of client_secret.json
    token TEXT, -- JSON content of token.json
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
