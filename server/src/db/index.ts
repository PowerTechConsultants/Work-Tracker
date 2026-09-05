import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { AsyncLocalStorage } from 'async_hooks';

const txnStore = new AsyncLocalStorage<mysql.PoolConnection>();

const url = process.env.DATABASE_URL;
let host = process.env.MYSQL_HOST || 'localhost';
let port = Number(process.env.MYSQL_PORT || '3306');
let user = process.env.MYSQL_USER || 'root';
let password = process.env.MYSQL_PASSWORD || '0000';
let database = process.env.MYSQL_DATABASE || 'hr';
if (url) {
  try {
    const u = new URL(url);
    host = u.hostname || host;
    port = Number(u.port) || port;
    user = decodeURIComponent(u.username) || user;
    password = decodeURIComponent(u.password) || password;
    database = u.pathname.replace(/^\//, '') || database;
  } catch (e) { console.error('[DB] URL parse error:', e); }
}

const pool = mysql.createPool({ host, port, user, password, database, waitForConnections: true, connectionLimit: 10, queueLimit: 50, enableKeepAlive: true, timezone: '+00:00', connectTimeout: 10000 });
console.log(`[DB] MySQL pool: ${host}:${port}/${database}`);

try {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log('[DB] MySQL connected');
  } finally {
    conn.release();
  }
} catch (e: any) {
  console.error('[DB] MySQL connection failed:', e.message);
}

function translateSql(sql: string): string {
  return sql
    .replace(/datetime\('now', '\+' \|\| \? \|\| ' minutes'\)/g, 'NOW() + INTERVAL ? MINUTE')
    .replace(/datetime\('now', '\+' \|\| \? \|\| ' days'\)/g, 'NOW() + INTERVAL ? DAY')
    .replace(/datetime\('now', '\+' \|\| \? \|\| ' seconds'\)/g, 'NOW() + INTERVAL ? SECOND')
    .replace(/datetime\('now', '\+1 hour'\)/g, 'NOW() + INTERVAL 1 HOUR')
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/datetime\('now', '\+(\d+) seconds'\)/g, 'NOW() + INTERVAL $1 SECOND')
    .replace(/date\('now', '-(\d+) days'\)/g, 'DATE_SUB(CURDATE(), INTERVAL $1 DAY)')
    .replace(/date\('now', '\+' \|\| (\d+) \|\| ' days'\)/g, 'DATE_ADD(CURDATE(), INTERVAL $1 DAY)')
    .replace(/date\('now'\)/g, 'CURDATE()')
    .replace(/strftime\('%Y',\s*([^)]+)\)/g, 'YEAR($1)')
    .replace(/strftime\('%m',\s*([^)]+)\)/g, 'MONTH($1)')
    .replace(/strftime\('%d',\s*([^)]+)\)/g, 'DAY($1)')
    .replace(/strftime\('%H',\s*([^)]+)\)/g, 'HOUR($1)')
    .replace(/strftime\('%M',\s*([^)]+)\)/g, 'MINUTE($1)')
    .replace(/strftime\('%S',\s*([^)]+)\)/g, 'SECOND($1)')
    .replace(/julianday\(([^)]+)\)/g, 'JULIANDATE($1)')
    .replace(/substr\(/g, 'SUBSTRING(')
    .replace(/AS INTEGER/g, 'AS SIGNED');
}

function translateExec(sql: string): string {
  let s = sql
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/datetime\('now', '\+(\d+) seconds'\)/g, 'NOW() + INTERVAL $1 SECOND')
    .replace(/\bINTEGER PRIMARY KEY\b/g, 'INT PRIMARY KEY')
    .replace(/\bTEXT PRIMARY KEY\b/g, 'VARCHAR(255) PRIMARY KEY')
    .replace(/\bTEXT NOT NULL\b/g, 'VARCHAR(255) NOT NULL')
    .replace(/\bTEXT UNIQUE\b/g, 'VARCHAR(255) UNIQUE')
    .replace(/\bTEXT\b/g, 'VARCHAR(255)')
    .replace(/\bREAL\b/g, 'DECIMAL(10,2)')
    .replace(/\bINTEGER\b/g, 'INT');
  // MySQL doesn't support CREATE INDEX IF NOT EXISTS — strip it
  s = s.replace(/CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/gi, 'CREATE $1INDEX');
  return s;
}

const schemaMysqlPath = path.join(process.cwd(), 'src', 'db', 'schema.mysql.sql');
if (fs.existsSync(schemaMysqlPath)) {
  const schema = fs.readFileSync(schemaMysqlPath, 'utf-8');
  const stmts = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    if (!stmt) continue;
    try { await pool.query(translateExec(stmt)); } catch (e: any) { if (!e.message?.includes('already exists') && !e.message?.includes('Duplicate')) console.error('[DB] Schema:', e.message); }
  }
}

const db = {
  prepare: (sql: string) => {
    if (sql.includes('PRAGMA table_info')) {
      const table = sql.match(/PRAGMA table_info\(([^)]+)\)/)?.[1]?.replace(/['"]/g, '');
      return {
        all: async (...params: any[]): Promise<any[]> => {
          const conn = txnStore.getStore();
          const [rows] = await (conn ?? pool).query(`SELECT ordinal_position as cid, column_name as name, column_type as type, CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END as notnull, column_default as dflt_value, CASE WHEN column_key = 'PRI' THEN 1 ELSE 0 END as pk FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ordinal_position`, [table]);
          return rows as any[];
        },
        get: async (...params: any[]): Promise<any> => {
          const conn = txnStore.getStore();
          const [rows] = await (conn ?? pool).query(`SELECT ordinal_position as cid, column_name as name, column_type as type, CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END as notnull, column_default as dflt_value, CASE WHEN column_key = 'PRI' THEN 1 ELSE 0 END as pk FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ordinal_position`, [table]);
          return (rows as any[])[0];
        },
        run: async (): Promise<any> => ({ changes: 0, lastInsertRowid: 0 }),
      };
    }
    let finalSql = translateSql(sql);
    if (finalSql.includes('ON CONFLICT')) {
      finalSql = finalSql.replace(/ON CONFLICT\([^)]+\) DO UPDATE SET (.+?)(?:, updated_at = (?:datetime\('now'\)|NOW\(\)))?$/s, (_match: string, setClause: string) => `ON DUPLICATE KEY UPDATE ${setClause}, updated_at = NOW()`);
      finalSql = finalSql.replace(/ON CONFLICT\([^)]+\) DO NOTHING/g, 'ON DUPLICATE KEY UPDATE id=id');
      finalSql = finalSql.replace(/INSERT OR REPLACE/g, 'REPLACE').replace(/INSERT OR IGNORE/g, 'INSERT IGNORE');
    }
    finalSql = finalSql.replace(/INSERT OR REPLACE/g, 'REPLACE').replace(/INSERT OR IGNORE/g, 'INSERT IGNORE');
    return {
      get: async (...params: any[]): Promise<any> => {
        const conn = txnStore.getStore();
        const [rows] = await (conn ?? pool).query(finalSql, params);
        return (rows as any[])[0];
      },
      all: async (...params: any[]): Promise<any[]> => {
        const conn = txnStore.getStore();
        const [rows] = await (conn ?? pool).query(finalSql, params);
        return rows as any[];
      },
      run: async (...params: any[]): Promise<any> => {
        const conn = txnStore.getStore();
        const [result] = await (conn ?? pool).query(finalSql, params) as any;
        return { changes: result.affectedRows ?? 0, lastInsertRowid: result.insertId };
      },
    };
  },
  exec: async (sql: string): Promise<void> => {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    const conn = txnStore.getStore();
    for (const stmt of stmts) {
      if (!stmt) continue;
      const t = translateExec(stmt);
      if (t.includes('PRAGMA')) continue;
      try {
        await (conn ?? pool).query(t);
      } catch (e: any) {
        const msg = e.message ?? '';
        if (msg.includes('already exists') || msg.includes('Duplicate') || msg.includes('ER_DUP_ENTRY') || msg.includes('Duplicate entry')) continue;
        console.error('[DB] exec failed:', msg);
        throw e;
      }
    }
  },
  pragma: (_?: string) => {},
  transaction: <TArgs extends any[]>(fn: (...args: TArgs) => any) => {
    return async (...args: TArgs) => {
      const existingConn = txnStore.getStore();
      if (existingConn) {
        const sp = `sp_${randomUUID().slice(0, 8)}`;
        await existingConn.query(`SAVEPOINT ${sp}`);
        try {
          const result = await txnStore.run(existingConn, async () => await fn(...args));
          await existingConn.query(`RELEASE SAVEPOINT ${sp}`);
          return result;
        } catch (e) {
          try { await existingConn.query(`ROLLBACK TO SAVEPOINT ${sp}`); } catch (rbErr) { console.error('[DB] Savepoint rollback failed:', rbErr); }
          throw e;
        }
      }
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const result = await txnStore.run(conn, async () => await fn(...args));
        await conn.commit();
        return result;
      } catch (e) {
        try { await conn.rollback(); } catch (rbErr) { console.error('[DB] Transaction rollback failed:', rbErr); }
        throw e;
      } finally {
        conn.release();
      }
    };
  },
};

async function getAppliedVersions(): Promise<Set<number>> {
  try {
    const rows = await db.prepare('SELECT version FROM schema_migrations').all();
    return new Set(rows.map((r: any) => r.version));
  } catch {
    return new Set();
  }
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]) as any;
  return (rows as any[]).length > 0;
}

async function addColumnIfMissing(table: string, column: string, ddl: string): Promise<void> {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table) || !/^[a-z_][a-z0-9_]*$/i.test(column)) {
    throw new Error(`Invalid table or column name: ${table}.${column}`);
  }
  if (await hasColumn(table, column)) return;
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl.replace(/TEXT/g, 'VARCHAR(255)').replace(/REAL/g, 'DECIMAL(10,2)')}`);
}

const migrations: Array<{ version: number; name: string; up: () => Promise<void> }> = [
  {
    version: 1,
    name: 'legacy-baseline',
    up: async () => {
      await addColumnIfMissing('attendance', 'pause_start_time', 'pause_start_time TEXT');
      await addColumnIfMissing('attendance', 'pause_end_time', 'pause_end_time TEXT');
      await addColumnIfMissing('attendance', 'pause_minutes', 'pause_minutes REAL DEFAULT 0');
      await db.exec(`CREATE TABLE IF NOT EXISTS holidays (id TEXT PRIMARY KEY, date TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'public', created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (created_by) REFERENCES users(id))`);
      await db.exec(`CREATE TABLE IF NOT EXISTS holiday_assignees (holiday_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (holiday_id, user_id), FOREIGN KEY (holiday_id) REFERENCES holidays(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
      await db.exec(`CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
      await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_leaves_dates ON leaves(start_date, end_date)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at)');
      await addColumnIfMissing('task_approvals', 'request_comment', 'request_comment TEXT');
      await db.exec('DROP TABLE IF EXISTS time_entries');
      await db.exec('DROP TABLE IF EXISTS chat_messages');
      await db.exec(`CREATE TABLE IF NOT EXISTS token_blacklist (user_id TEXT PRIMARY KEY, revoked_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL)`);
      await db.exec(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
      await db.exec(`CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL)`);
      await db.exec('CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at)');
      await addColumnIfMissing('team_members', 'role', "role TEXT NOT NULL DEFAULT 'member'");
      await db.exec("UPDATE users SET role = 'director' WHERE role = 'admin'");
      await db.exec("UPDATE activity_logs SET entity_type = 'director' WHERE entity_type = 'admin'");
      await db.exec('CREATE INDEX IF NOT EXISTS idx_work_plans_user ON work_plans(user_id)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_work_plans_user_date ON work_plans(user_id, date)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_work_reports_user ON work_reports(user_id)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_work_reports_user_date ON work_reports(user_id, date)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department_id)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_task_approvals_task ON task_approvals(task_id)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_team_members_team_name ON team_members(team_name)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash)');
      await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id)');
      await db.exec(`CREATE TABLE IF NOT EXISTS api_cache (cache_key TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at TEXT NOT NULL)`);
      await db.exec('CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at)');
      await addColumnIfMissing('leaves', 'deducted_from', 'deducted_from TEXT');
      await addColumnIfMissing('attendance', 'latitude', 'latitude REAL');
      await addColumnIfMissing('attendance', 'longitude', 'longitude REAL');
      await addColumnIfMissing('attendance', 'location_accuracy', 'location_accuracy REAL');
      await addColumnIfMissing('attendance', 'location_captured_at', 'location_captured_at TEXT');
    },
  },
  {
    version: 2,
    name: 'attendance-working-hours-recompute',
    up: async () => {
      await db.exec(`
        UPDATE attendance SET
          working_hours = GREATEST(0, ROUND((TIMESTAMPDIFF(MINUTE, login_time, logout_time)/60.0 - COALESCE(pause_minutes, 0) / 60.0), 2)),
          overtime_hours = GREATEST(0, ROUND(GREATEST(0, ROUND((TIMESTAMPDIFF(MINUTE, login_time, logout_time)/60.0 - COALESCE(pause_minutes, 0) / 60.0), 2)) - 8, 2))
        WHERE logout_time IS NOT NULL AND login_time IS NOT NULL
      `);
    },
  },
  {
    version: 3,
    name: 'composite-indexes',
    up: async () => {
      await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_user_date_status ON attendance(user_id, date, status)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance(date, status)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_created ON activity_logs(actor_id, created_at)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_leaves_user_dates ON leaves(user_id, start_date, end_date)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_holidays_date_id ON holidays(date, id)');
    },
  },
  {
    version: 4,
    name: 'performance-indexes',
    up: async () => {
      await db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by_id)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_holidays_created_by ON holidays(created_by)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_leaves_status_dates ON leaves(status, start_date, end_date)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC)');
    },
  },
  {
    version: 5,
    name: 'holidays-updated-at',
    up: async () => {
      await addColumnIfMissing('holidays', 'updated_at', "updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
    },
  },
  {
    version: 6,
    name: 'leave-extra-carryover-and-attendance-events',
    up: async () => {
      await addColumnIfMissing('leaves', 'extra', 'extra INTEGER NOT NULL DEFAULT 0');
      await addColumnIfMissing('leaves', 'leave_year', 'leave_year INTEGER');
      await db.exec(`CREATE TABLE IF NOT EXISTS attendance_events (
        id TEXT PRIMARY KEY,
        attendance_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        location_accuracy REAL,
        location_captured_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);
      await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_events_att ON attendance_events(attendance_id, occurred_at)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_events_user ON attendance_events(user_id, occurred_at)');
      await db.exec(`UPDATE leaves SET leave_year = YEAR(start_date) WHERE leave_year IS NULL`);
    },
  },
  {
    version: 7,
    name: 'rename-paid-to-proposal-16',
    up: async () => {
      await db.exec(`UPDATE leaves SET type = 'proposal' WHERE type = 'paid'`);
      await db.exec(`UPDATE leaves SET deducted_from = 'proposal' WHERE deducted_from = 'paid'`);
      try { await db.exec(`UPDATE attendance SET notes = REPLACE(notes, 'paid leave', 'proposal leave') WHERE notes LIKE '%paid leave%'`); } catch (e) { console.error('[DB] Migration error:', e); }
    },
  },
  {
    version: 8,
    name: 'extended-user-profile-dob-gender-address',
    up: async () => {
      await addColumnIfMissing('users', 'dob', 'dob TEXT');
      await addColumnIfMissing('users', 'gender', 'gender TEXT');
      await addColumnIfMissing('users', 'father_name', 'father_name TEXT');
      await addColumnIfMissing('users', 'nationality', 'nationality TEXT');
      await addColumnIfMissing('users', 'qualification', 'qualification TEXT');
      await addColumnIfMissing('users', 'address_street', 'address_street TEXT');
      await addColumnIfMissing('users', 'address_city', 'address_city TEXT');
      await addColumnIfMissing('users', 'address_state', 'address_state TEXT');
      await addColumnIfMissing('users', 'address_pincode', 'address_pincode TEXT');
    },
  },
  {
    version: 9,
    name: 'document-requests',
    up: async () => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS document_requests (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          requested_by_id TEXT NOT NULL,
          doc_type TEXT NOT NULL,
          note TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          reject_reason TEXT,
          fields TEXT,
          doc_number TEXT UNIQUE,
          issued_by_id TEXT,
          issued_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (issued_by_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_document_requests_user ON document_requests(user_id, status);
        CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_document_requests_type ON document_requests(doc_type);
      `);
    },
  },
  {
    version: 10,
    name: 'report-templates-and-scheduled-reports',
    up: async () => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS report_templates (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL DEFAULT 'daily',
          fields TEXT,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_report_templates_user ON report_templates(user_id);

        CREATE TABLE IF NOT EXISTS scheduled_reports (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          recipients TEXT,
          schedule_cron TEXT NOT NULL,
          format TEXT NOT NULL DEFAULT 'pdf',
          is_active INTEGER NOT NULL DEFAULT 1,
          last_run_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user ON scheduled_reports(user_id);
        CREATE INDEX IF NOT EXISTS idx_scheduled_reports_template ON scheduled_reports(template_id);

        CREATE TABLE IF NOT EXISTS scheduled_report_results (
          id TEXT PRIMARY KEY,
          schedule_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          file_path TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (schedule_id) REFERENCES scheduled_reports(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_scheduled_report_results_schedule ON scheduled_report_results(schedule_id);
      `);
    },
  },
  {
    version: 11,
    name: 'email-logs-and-notification-channels',
    up: async () => {
      await addColumnIfMissing('notifications', 'channel', "channel VARCHAR(20) NOT NULL DEFAULT 'in_app'");
      await db.exec(`
        CREATE TABLE IF NOT EXISTS email_logs (
          id TEXT PRIMARY KEY,
          recipient_id TEXT,
          recipient_email TEXT NOT NULL,
          subject TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'sent',
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_id);
        CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
      `);
    },
  },
  {
    version: 12,
    name: 'file-uploads',
    up: async () => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS file_uploads (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          original_name TEXT NOT NULL,
          storage_key TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          url TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS file_retention_policies (
          id TEXT PRIMARY KEY,
          mime_pattern TEXT NOT NULL,
          retention_days INTEGER NOT NULL DEFAULT 365,
          max_size_bytes INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_file_uploads_mime ON file_uploads(mime_type);
      `);
      await db.prepare(
        `REPLACE INTO file_retention_policies (id, mime_pattern, retention_days) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)`
      ).run('1', 'image/*', 365, '2', 'application/pdf', 730, '3', 'text/*', 365, '4', '*', 180);
    },
  },
  {
    version: 13,
    name: 'security-hardening',
    up: async () => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS password_policies (
          id TEXT PRIMARY KEY,
          min_length INTEGER NOT NULL DEFAULT 12,
          require_uppercase INTEGER NOT NULL DEFAULT 1,
          require_lowercase INTEGER NOT NULL DEFAULT 1,
          require_number INTEGER NOT NULL DEFAULT 1,
          require_special INTEGER NOT NULL DEFAULT 1,
          max_age_days INTEGER NOT NULL DEFAULT 90,
          history_count INTEGER NOT NULL DEFAULT 5,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS password_history (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS api_audit_log (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          status_code INTEGER,
          ip_address TEXT,
          user_agent TEXT,
          request_size INTEGER,
          response_time_ms INTEGER,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_api_audit_log_user ON api_audit_log(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_api_audit_log_path ON api_audit_log(path, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_api_audit_log_created ON api_audit_log(created_at);
      `);
      const existing = await db.prepare('SELECT id FROM password_policies LIMIT 1').get();
      if (!existing) {
        const { randomUUID } = await import('crypto');
        await db.prepare(
          "INSERT INTO password_policies (id, min_length, require_uppercase, require_lowercase, require_number, require_special, max_age_days, history_count) VALUES (?, 12, 1, 1, 1, 1, 90, 5)"
        ).run(randomUUID());
      }
    },
  },
  {
    version: 14,
    name: 'task-assignments-user-index',
    up: async () => {
      await db.exec('CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id)');
    },
  },
  {
    version: 15,
    name: 'scheduled-report-results-result-data',
    up: async () => {
      await addColumnIfMissing('scheduled_report_results', 'result_data', "result_data TEXT");
    },
  },
];

await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const appliedVersions = await getAppliedVersions();
for (const m of migrations) {
  if (appliedVersions.has(m.version)) continue;
  const trx = db.transaction(async () => {
    await m.up();
    await db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
  });
  await trx();
  console.log(`[DB] Applied migration ${m.version}: ${m.name}`);
}

export default db;
export { pool };
export function uuid(): string { return randomUUID(); }

export async function getSetting(key: string): Promise<string | null> {
  const [rows] = await pool.query('SELECT `value` FROM app_settings WHERE `key` = ?', [key]) as any;
  return (rows as any[])[0]?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await pool.query("INSERT INTO app_settings (`key`, `value`, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = NOW()", [key, value ?? '']);
}
