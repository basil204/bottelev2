const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'webapp/.env' }); // Load from webapp/.env where we saved it

async function main() {
    console.log('Connecting to DB...');
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Updating admin credentials...');
        const username = 'admin';
        const password = 'manhhuy1@';

        // Check if keys exist
        const [rows] = await pool.query("SELECT `key` FROM settings WHERE `key` IN ('admin_username', 'admin_password')");
        const keys = rows.map(r => r.key);

        if (!keys.includes('admin_username')) {
            await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('admin_username', ?)", [username]);
            console.log('Inserted admin_username');
        } else {
            await pool.query("UPDATE settings SET `value` = ? WHERE `key` = 'admin_username'", [username]);
            console.log('Updated admin_username');
        }

        if (!keys.includes('admin_password')) {
            await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('admin_password', ?)", [password]);
            console.log('Inserted admin_password');
        } else {
            await pool.query("UPDATE settings SET `value` = ? WHERE `key` = 'admin_password'", [password]);
            console.log('Updated admin_password');
        }

        console.log('Credentials updated successfully!');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

main();
