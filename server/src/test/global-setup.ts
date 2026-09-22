import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

// Runs once before all test files (separate process).
// Ensures the isolated hr_test database exists so app migrations can run.
// NOTE: credentials come from the environment (or local server/.env), but the
// database name is ALWAYS forced to hr_test so tests never touch the dev DB.
export default async function globalSetup() {
  const host = process.env.MYSQL_HOST || 'localhost';
  const port = Number(process.env.MYSQL_PORT || '3306');
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.TEST_MYSQL_DATABASE || 'hr_test';

  const conn = await mysql.createConnection({ host, port, user, password });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`[TestSetup] Database ready: ${database}`);
    // Clear rate-limit state from previous runs (hr_test persists)
    try {
      await conn.query(`USE \`${database}\``);
      await conn.query('DELETE FROM rate_limits');
      await conn.query('DELETE FROM api_cache');
    } catch {}
  } finally {
    await conn.end();
  }
}
