import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const pool = mysql.createPool({ host: 'localhost', port: 3306, user: 'root', password: '0000', waitForConnections: true });

async function reset() {
  const conn = await pool.getConnection();
  await conn.query('DROP DATABASE IF EXISTS hr');
  await conn.query('CREATE DATABASE hr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  console.log('Database hr recreated');
  conn.release();
  
  const hrPool = mysql.createPool({ host: 'localhost', port: 3306, user: 'root', password: '0000', database: 'hr', waitForConnections: true });
  await hrPool.query('SET FOREIGN_KEY_CHECKS=0');
  const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.mysql.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const stmts = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    if (!stmt) continue;
    try {
      await hrPool.query(stmt);
    } catch (e) {
      console.error('Schema stmt failed:', e.message, stmt.slice(0,80));
    }
  }
  await hrPool.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('Schema applied');
  const [rows] = await hrPool.query('SHOW TABLES');
  console.log('Tables:', rows.map(r => Object.values(r)[0]).join(', '));
  await hrPool.end();
  await pool.end();
}

reset().catch(e => { console.error(e); process.exit(1); });
