import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const test = async () => {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'bottele2026'
    };
    console.log('Connecting with config:', config);
    try {
        const conn = await mysql.createConnection(config);
        console.log('✅ Connected.');
        const [tables] = await conn.query('SHOW TABLES');
        console.log('Tables:', tables);
        
        try {
            const [columns] = await conn.query('SHOW COLUMNS FROM products');
            console.log('Products columns:', columns);
        } catch (e) {
            console.error('Error showing columns from products:', e.message);
        }
        
        try {
            const [categories] = await conn.query('SELECT * FROM categories');
            console.log('Categories rows:', categories);
        } catch (e) {
            console.error('Error querying categories:', e.message);
        }
        
        await conn.end();
    } catch (err) {
        console.error('❌ Connection error:', err.message);
    }
};

test();
