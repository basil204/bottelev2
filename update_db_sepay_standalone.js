import mysql from 'mysql2/promise';
import fs from 'fs';

const up = async () => {
    try {
        const configContent = fs.readFileSync('./config.json', 'utf8');
        const config = JSON.parse(configContent);

        const connection = await mysql.createConnection({
            host: config.DB_HOST,
            user: config.DB_USER,
            password: config.DB_PASS,
            database: config.DB_NAME
        });

        console.log('Connected to DB. Inserting Sepay settings...');

        const keys = [
            { key: 'sepay_enabled', value: 'false' },
            { key: 'sepay_token', value: '' },
            { key: 'sepay_account_no', value: '' },
            { key: 'sepay_bank_code', value: 'MB' }
        ];

        for (const item of keys) {
            await connection.execute(
                'INSERT IGNORE INTO settings (`key`, `value`) VALUES (?, ?)',
                [item.key, item.value]
            );
        }

        console.log('Done!');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

up();
