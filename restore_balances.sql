-- ============================================
-- BACKUP & RESTORE USERS (ID + Telegram ID + Balance)
-- Insert user nếu chưa tồn tại, update balance nếu đã có
-- ============================================

USE bottele2026;

-- Insert hoặc Update users (chỉ những người có balance > 0)
INSERT INTO users (telegram_id, username, balance) VALUES
(1645636506, 'nlmsp2025', 5900.00),
(8228217247, 'manhnlit', 10000.00),
(1342031373, 'Callmesenpay', 45100.00),
(1916010403, 'zika179', 148700.00),
(1994997132, 'Skylinevnn', 66300.00),
(5839689693, 'mrjonny8386', 23750.00),
(1477470142, NULL, 42600.00),
(7244904874, NULL, 33900.00),
(7720649607, 'nguyenminhman2001', 20000.00),
(6440267265, 'tuthaison', 19500.00),
(1733633137, 'droptext_T', 4200.00),
(778073255, 'tienichcongnghe', 20500.00),
(2136762369, 'PDH0109', 60520.00),
(7187353537, 'llavas', 36700.00),
(6628521239, 'melodycrush', 36500.00),
(7571139892, 'Huyne1412', 24000.00),
(1595666007, 'MYKPLUSCHINHHANG', 42900.00),
(1353746336, 'vuluanhinla', 38000.00),
(8115342957, 'nlmne2026', 334500.00),
(7028049001, 'Siuthimmo', 49000.00)
ON DUPLICATE KEY UPDATE 
  balance = VALUES(balance),
  username = COALESCE(VALUES(username), username);

-- Kiểm tra kết quả
SELECT id, telegram_id, username, balance 
FROM users 
WHERE balance > 0 
ORDER BY balance DESC;
