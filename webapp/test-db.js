import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const test = async () => {
    for (const [user, password] of [
        ['root', ''],
        ['root', 'root'],
        ['root', 'admin'],
        ['root', '123456'],
        ['adminv1', 'adminv1']
    ]) {
        try {
            const conn = await mysql.createConnection({ host: 'localhost', user, password });
            console.log(`✅ Connected with user: ${user}, pass: ${password}`);
            const [dbs] = await conn.query('SHOW DATABASES');
            console.log('Databases:', dbs);
            await conn.end();
            return;
        } catch (err) {
            console.log(`❌ Failed with user: ${user}, pass: ${password} -> ${err.message}`);
        }
    }
};

test();
