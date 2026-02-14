require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
    console.log('Testing connection to:', process.env.DB_HOST);
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
        });
        console.log('Successfully connected to database!');
        await connection.end();
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

testConnection();
