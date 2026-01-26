const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
    console.log('Connecting to DB...');
    console.log('Host:', process.env.DB_HOST);
    console.log('User:', process.env.DB_USER);
    console.log('DB:', process.env.DB_NAME);

    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Testing COUNT query...');
        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM deposits');
        console.log('Count Result:', countResult);
        console.log('Total:', countResult[0].total);

        console.log('Testing SELECT query...');
        const limit = 10;
        const offset = 0;
        const [rows] = await pool.query(`
            SELECT deposits.*, users.username, users.telegram_id
            FROM deposits
            LEFT JOIN users ON deposits.user_id = users.id
            ORDER BY deposits.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        console.log('Rows found:', rows.length);
        if (rows.length > 0) {
            console.log('First row:', rows[0]);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

main();
