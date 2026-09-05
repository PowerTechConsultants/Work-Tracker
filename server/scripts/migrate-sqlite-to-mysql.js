import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';

const sqlitePath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data.db');
const sqliteDb = new Database(sqlitePath, { readonly: true });

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '0000',
  database: process.env.MYSQL_DATABASE || 'hr',
  waitForConnections: true,
  connectionLimit: 10,
});

const tables = [
  'users','departments','team_members','refresh_tokens','attendance','attendance_events',
  'tasks','task_assignments','task_comments','task_attachments','task_approvals',
  'work_plans','work_reports','leaves','notifications','activity_logs','holidays','holiday_assignees',
  'password_reset_tokens','token_blacklist','app_settings','rate_limits','api_cache','schema_migrations','document_requests'
];

async function migrate() {
  console.log('[Migrate] Starting SQLite -> MySQL');
  console.log(`[Migrate] SQLite: ${sqlitePath}`);
  console.log(`[Migrate] MySQL: ${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE || 'hr'}`);
  
  for (const table of tables) {
    try {
      const exists = sqliteDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
      if (!exists) { console.log(`[Migrate] Skip ${table} (not in SQLite)`); continue; }
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      if (rows.length === 0) { console.log(`[Migrate] ${table}: 0 rows`); continue; }
      console.log(`[Migrate] ${table}: ${rows.length} rows`);
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => '?').join(',');
      const sql = `REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`;
      for (const row of rows) {
        const vals = cols.map(c => row[c]);
        await pool.query(sql, vals);
      }
      console.log(`[Migrate] ${table} done`);
    } catch (e) {
      console.error(`[Migrate] ${table} failed:`, e.message);
    }
  }
  console.log('[Migrate] Done');
  await pool.end();
  sqliteDb.close();
}

migrate().catch(e => { console.error(e); process.exit(1); });
