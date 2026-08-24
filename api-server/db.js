import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '103.139.155.175',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'testv1',
  password: process.env.DB_PASS || 'skeLdYCEGkFESpdZ',
  database: process.env.DB_NAME || 'testv1',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export const query = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};//aa

export const execute = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);
  return result;
};

export default pool;
