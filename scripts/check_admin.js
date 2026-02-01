// Script để kiểm tra admin credentials trong database
import mysql from 'mysql2/promise';

async function checkAdminCredentials() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'adminv1',
        password: 'adminv1',
        database: 'huyml',
        waitForConnections: true
    });

    try {
        const [rows] = await pool.query(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('admin_username', 'admin_password')"
        );

        console.log('=== Admin Credentials trong Database ===');
        if (rows.length === 0) {
            console.log('❌ KHÔNG TÌM THẤY admin_username và admin_password trong database!');
            console.log('');
            console.log('Chạy SQL sau để thêm:');
            console.log("INSERT INTO settings (`key`, `value`) VALUES ('admin_username', 'admin');");
            console.log("INSERT INTO settings (`key`, `value`) VALUES ('admin_password', 'admin123');");
        } else {
            rows.forEach(row => {
                console.log(`${row.key}: ${row.value}`);
            });
        }

        await pool.end();
    } catch (error) {
        console.error('Lỗi:', error.message);
        await pool.end();
    }
}

checkAdminCredentials();
