import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { logError } from '../../utils/log.js';

let pool;

export const initDb = async (config) => {
  // Ensure database exists first (connect without database)
  const adminConn = await mysql.createConnection({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    multipleStatements: true
  });
  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await adminConn.end();

  pool = mysql.createPool({
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASS,
    database: config.DB_NAME,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Verify connection
  try {
    const [result] = await pool.execute('SELECT DATABASE() as db');
    console.log('Connected to database:', result[0]?.db);
  } catch (err) {
    console.error('Database connection verification failed:', err.message);
  }

  // bootstrap schema if available
  try {
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      // Use a connection from pool to execute schema
      const conn = await pool.getConnection();
      try {
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        for (const statement of statements) {
          try {
            await conn.execute(statement.trim());
          } catch (e) {
            // Ignore errors for IF NOT EXISTS cases
            if (!e.message.includes('already exists') && !e.message.includes('Duplicate') && !e.message.includes('Table')) {
              console.error('Schema execution error:', e.message);
            }
          }
        }
      } finally {
        conn.release();
      }
    }
    
    // Ensure columns exist (migration for existing tables)
    try {
      // Check and add telegram_id to users table if it doesn't exist
      const [columns] = await pool.execute('SHOW COLUMNS FROM users LIKE ?', ['telegram_id']);
      if (columns.length === 0) {
        await pool.execute('ALTER TABLE users ADD COLUMN telegram_id BIGINT UNIQUE');
        // If there's existing data, you might need to handle migration here
      }
    } catch (e) {
      // Table might not exist yet, which is fine
    }
    
    // ensure tx_ref column exists for auto deposit
    try {
      await pool.execute('ALTER TABLE deposits ADD COLUMN tx_ref VARCHAR(64)');
    } catch (e) {
      // ignore if already exists
    }
  } catch (err) {
    logError(err);
  }
};

export const getPool = () => {
  if (!pool) throw new Error('DB not initialized');
  return pool;
};

export const query = async (sql, params = []) => {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    // Log full error details for debugging
    logError({ 
      context: 'database_query', 
      sql, 
      params, 
      error: error.message, 
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    throw error;
  }
};

