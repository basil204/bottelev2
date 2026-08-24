import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Cấu hình thông tin kết nối từ .env
const dbConfig = {
    host: process.env.DB_HOST || '103.139.155.175',
    user: process.env.DB_USER || 'testv1',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || 'skeLdYCEGkFESpdZ',
    database: process.env.DB_NAME || 'testv1',
    port: Number(process.env.DB_PORT) || 3306
};

async function testConnection() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Kết nối thành công đến cơ sở dữ liệu MySQL!');

        const [rows] = await connection.execute('SELECT 1 + 1 AS solution');
        console.log('Kết quả kiểm tra truy vấn:', rows[0].solution);

        await connection.end();
    } catch (error) {
        console.error('Kết nối thất bại! Lỗi:', error.message);
    }
}

testConnection();