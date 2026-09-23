import dotenv from 'dotenv';
dotenv.config();
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// ---- SQLite file location (always OUTSIDE dist/ so rebuilds never wipe data) ----
// - Local dev (cwd = server/): server/data.db
// - Production single-process (cwd = project root via server.js): ./data.db
// - Override with SQLITE_PATH (absolute) or DATABASE_PATH / DATABASE_URL=file:...
export function resolveDbPath(): string {
  const raw = process.env.SQLITE_PATH || process.env.DATABASE_PATH || './data.db';
  const stripped = raw.replace(/^file:/, '');
  if (path.isAbsolute(stripped)) return stripped;
  const cwd = process.cwd();
  const base = cwd.endsWith(`${path.sep}dist`) ? path.dirname(cwd) : cwd;
  return path.resolve(base, stripped);
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('foreign_keys = ON');
console.log(`[DB] SQLite: ${dbPath}`);

export function uuid(): string { return randomUUID(); }

// ---- MySQL-dialect → SQLite translation (lets existing service code run unchanged) ----
const CONFLICT_TARGETS: Record<string, string> = {
  token_blacklist: '(user_id)',
  rate_limits: '(`key`)',
  app_settings: '(`key`)',
  leave_carryforwards: '(user_id, year)',
  monthly_overtime: '(user_id, year, month)',
  holiday_assignees: '(holiday_id, user_id)',
};

function mysqlToSqlite(sql: string): string {
  let s = sql;
  // ALTER TABLE t ADD UNIQUE KEY n (...) -> CREATE UNIQUE INDEX (SQLite has no ADD CONSTRAINT)
  s = s.replace(/ALTER TABLE\s+(\w+)\s+ADD UNIQUE KEY\s+(\w+)\s*(\([^)]+\))/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS $2 ON $1 $3');
  // UNIQUE KEY n (...) -> UNIQUE(...)
  s = s.replace(/UNIQUE KEY\s+\w+\s*(\([^)]+\))/gi, 'UNIQUE$1');
  // INSERT IGNORE -> INSERT OR IGNORE ; REPLACE -> INSERT OR REPLACE
  s = s.replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT OR IGNORE INTO');
  s = s.replace(/(?<!OR\s)REPLACE\s+INTO/gi, 'INSERT OR REPLACE INTO');
  // ON DUPLICATE KEY UPDATE -> ON CONFLICT(target) DO UPDATE (per-table target)
  s = s.replace(/INSERT\s+INTO\s+(`?)(\w+)\1[\s\S]*?ON DUPLICATE KEY UPDATE([\s\S]+?)(;|$)/gi,
    (_m, _q, table: string, setClause: string, end: string) => {
      const target = CONFLICT_TARGETS[table];
      if (!target) throw new Error(`[DB] Unsupported ON DUPLICATE KEY UPDATE for table ${table}`);
      const head = _m.slice(0, _m.toUpperCase().indexOf('ON DUPLICATE KEY UPDATE'));
      const set = setClause.replace(/VALUES\s*\(\s*`?(\w+)`?\s*\)/g, 'excluded.$1');
      return `${head}ON CONFLICT${target} DO UPDATE SET ${set}${end}`;
    });
  // IF( -> IIF( (scoped so "INDEX IF NOT EXISTS" is untouched — it has no paren after IF)
  s = s.replace(/([=,(\s])IF\(/g, '$1IIF(');
  // GREATEST( -> max(
  s = s.replace(/\bGREATEST\(/gi, 'max(');
  // TIMESTAMPDIFF(MINUTE, a, b) -> ((julianday(b) - julianday(a)) * 1440.0)
  s = s.replace(/TIMESTAMPDIFF\(\s*MINUTE\s*,\s*([^,]+?)\s*,\s*([^)]+?)\)/gi, '((julianday($2) - julianday($1)) * 1440.0)');
  // YEAR(x) -> CAST(strftime('%Y', x) AS INTEGER)
  s = s.replace(/\bYEAR\(([^)]+)\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)");
  // CONVERT_TZ(x, from, +HH:MM) -> datetime(x, '+N minutes')
  s = s.replace(/CONVERT_TZ\(\s*([^,]+?)\s*,\s*'[^']*'\s*,\s*'([+-])(\d{2}):(\d{2})'\s*\)/gi,
    (_m, col: string, sign: string, hh: string, mm: string) => {
      const mins = parseInt(hh, 10) * 60 + parseInt(mm, 10);
      return `datetime(${col}, '${sign}${mins} minutes')`;
    });
  // UNIX_TIMESTAMP(x) -> CAST(strftime('%s', x) AS INTEGER)
  s = s.replace(/UNIX_TIMESTAMP\(([^)]+)\)/gi, "CAST(strftime('%s', $1) AS INTEGER)");
  // NOW() + INTERVAL ? UNIT -> datetime('now', '+' || ? || ' unit')
  s = s.replace(/NOW\(\)\s*\+\s*INTERVAL\s*\?\s*MINUTE/gi, `datetime('now', '+' || ? || ' minutes')`);
  s = s.replace(/NOW\(\)\s*\+\s*INTERVAL\s*\?\s*DAY/gi, `datetime('now', '+' || ? || ' days')`);
  s = s.replace(/NOW\(\)\s*\+\s*INTERVAL\s*\?\s*SECOND/gi, `datetime('now', '+' || ? || ' seconds')`);
  s = s.replace(/NOW\(\)\s*\+\s*INTERVAL\s*\?\s*HOUR/gi, `datetime('now', '+' || ? || ' hours')`);
  s = s.replace(/NOW\(\)\s*\+\s*INTERVAL\s*1\s*HOUR/gi, `datetime('now', '+1 hour')`);
  s = s.replace(/NOW\(\)/g, `datetime('now')`);
  // CURDATE() / DATE_SUB / DATE_ADD
  s = s.replace(/DATE_SUB\(CURDATE\(\),\s*INTERVAL\s*(\d+)\s*DAY\)/gi, `date('now','-$1 day')`);
  s = s.replace(/DATE_ADD\(CURDATE\(\),\s*INTERVAL\s*(\d+)\s*DAY\)/gi, `date('now','+$1 day')`);
  s = s.replace(/CURDATE\(\)/g, `date('now')`);
  // SELECT ... FOR UPDATE -> plain SELECT (single-writer SQLite serializes via mutex)
  s = s.replace(/\s+FOR UPDATE\s*(;|$)/gi, '$1');
  // ESCAPE '\\' (MySQL two-char escape) -> ESCAPE '\' (SQLite requires single char)
  s = s.replace(/ESCAPE\s+'\\\\'/g, `ESCAPE '\\'`);
  // ON UPDATE CURRENT_TIMESTAMP (MySQL column option) -> drop
  s = s.replace(/\s+ON UPDATE CURRENT_TIMESTAMP/gi, '');
  return s;
}

const stmtCache = new Map<string, any>();
function getStmt(sql: string): any {
  const finalSql = mysqlToSqlite(sql);
  let stmt = stmtCache.get(finalSql);
  if (!stmt) {
    stmt = sqlite.prepare(finalSql);
    if (stmtCache.size < 500) stmtCache.set(finalSql, stmt);
  }
  return stmt;
}

const db = {
  prepare: (sql: string) => {
    return {
      get: async (...params: any[]): Promise<any> => {
        return getStmt(sql).get(...params) ?? undefined;
      },
      all: async (...params: any[]): Promise<any[]> => {
        return getStmt(sql).all(...params) as any[];
      },
      run: async (...params: any[]): Promise<any> => {
        const info = getStmt(sql).run(...params);
        return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
      },
    };
  },
  exec: async (sql: string): Promise<void> => {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) {
      if (!stmt || stmt.startsWith('--')) continue;
      const t = mysqlToSqlite(stmt);
      if (!t) continue;
      try {
        sqlite.exec(t);
      } catch (e: any) {
        const msg = e.message ?? '';
        if (/already exists|duplicate column|duplicate/i.test(msg)) continue;
        console.error('[DB] exec failed:', msg);
        throw e;
      }
    }
  },
  pragma: (_?: string) => {},
  transaction: <TArgs extends any[]>(fn: (...args: TArgs) => any) => {
    return async (...args: TArgs) => {
      if (txnDepth > 0) {
        const sp = `sp_${randomUUID().slice(0, 8).replace(/-/g, '')}`;
        sqlite.exec(`SAVEPOINT "${sp}"`);
        txnDepth++;
        try {
          const result = await fn(...args);
          sqlite.exec(`RELEASE "${sp}"`);
          return result;
        } catch (e) {
          try { sqlite.exec(`ROLLBACK TO "${sp}"`); } catch {}
          try { sqlite.exec(`RELEASE "${sp}"`); } catch {}
          throw e;
        } finally {
          txnDepth--;
        }
      }
      const prev = txnLock;
      let release!: () => void;
      txnLock = new Promise<void>((r) => (release = r));
      await prev;
      txnDepth++;
      try {
        sqlite.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(...args);
          sqlite.exec('COMMIT');
          return result;
        } catch (e) {
          try { sqlite.exec('ROLLBACK'); } catch {}
          throw e;
        }
      } finally {
        txnDepth--;
        release();
      }
    };
  },
};

let txnDepth = 0;
let txnLock: Promise<void> = Promise.resolve();

// ---- Schema load (SQLite DDL; candidates cover dev cwd=server/ and prod cwd=root/dist) ----
function findSchema(): string | null {
  const candidates = [
    path.join(process.cwd(), 'src', 'db', 'schema.sql'),
    path.join(process.cwd(), 'server', 'src', 'db', 'schema.sql'),
    path.join(process.cwd(), 'dist', 'src', 'db', 'schema.sql'),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

const schemaPath = findSchema();
if (schemaPath) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  try {
    sqlite.exec(schema);
  } catch (e: any) {
    if (!/already exists|duplicate/i.test(e.message ?? '')) console.error('[DB] Schema:', e.message);
  }
} else {
  console.warn('[DB] schema.sql not found — expecting migrations to create tables');
}

async function getAppliedVersions(): Promise<Set<number>> {
  try {
    const rows = await db.prepare('SELECT version FROM schema_migrations').all();
    return new Set(rows.map((r: any) => r.version));
  } catch {
    return new Set();
  }
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table) || !/^[a-z_][a-z0-9_]*$/i.test(column)) {
    throw new Error(`Invalid table or column name: ${table}.${column}`);
  }
  const rows = (sqlite.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as any[]);
  return rows.some((r: any) => r.name === column);
}

async function addColumnIfMissing(table: string, column: string, ddl: string): Promise<void> {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table) || !/^[a-z_][a-z0-9_]*$/i.test(column)) {
    throw new Error(`Invalid table or column name: ${table}.${column}`);
  }
  if (await hasColumn(table, column)) return;
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

const migrations: Array<{ version: number; name: string; up: () => Promise<void> }> = [
  {
    version: 1,
    name: 'legacy-baseline',
    up: async () => {
      await addColumnIfMissing('attendance', 'pause_start_time', 'pause_start_time TEXT');
      await addColumnIfMissing('attendance', 'pause_end_time', 'pause_end_time TEXT');
      await addColumnIfMissing('attendance', 'pause_minutes', 'pause_minutes REAL DEFAULT 0');
      await db.exec(`CREATE TABLE IF NOT EXISTS holidays (id VARCHAR(36) PRIMARY KEY, date DATE NOT NULL, name VARCHAR(255) NOT NULL, type VARCHAR(20) NOT NULL DEFAULT 'public', created_by VARCHAR(36), created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL)`);
      await db.exec(`CREATE TABLE IF NOT EXISTS holiday_assignees (holiday_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, PRIMARY KEY (holiday_id, user_id), FOREIGN KEY (holiday_id) REFERENCES holidays(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
      await db.exec(`CREATE TABLE IF NOT EXISTS password_reset_tokens (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, token_hash VARCHAR(255) NOT NULL, expires_at DATETIME NOT NULL, used_at DATETIME, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
      await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_leaves_dates ON leaves(start_date, end_date)');
      await db.exec('CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at)');
      await addColumnIfMissing('task_approvals', 'request_comment', 'request_comment TEXT');
      await db.exec('DROP TABLE IF EXISTS time_entries');
      await db.exec('DROP TABLE IF EXISTS chat_messages');
      await db.exec(`CREATE TABLE IF NOT EXISTS token_blacklist (user_id TEXT PRIMARY KEY, revoked_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL)`);
      await db.exec("CREATE TABLE IF NOT EXISTS app_settings (`key` TEXT PRIMARY KEY, `value` TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))");
      await db.exec("CREATE TABLE IF NOT EXISTS rate_limits (`key` TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL)");
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
      await db.exec(`CREATE TABLE IF NOT EXISTS api_cache (cache_key VARCHAR(255) PRIMARY KEY, data TEXT NOT NULL, expires_at DATETIME NOT NULL)`);
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
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          type VARCHAR(20) NOT NULL DEFAULT 'daily',
          fields TEXT,
          is_default TINYINT NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_report_templates_user ON report_templates(user_id);

        CREATE TABLE IF NOT EXISTS scheduled_reports (
          id VARCHAR(36) PRIMARY KEY,
          template_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          recipients TEXT,
          schedule_cron VARCHAR(100) NOT NULL,
          format VARCHAR(10) NOT NULL DEFAULT 'pdf',
          is_active TINYINT NOT NULL DEFAULT 1,
          last_run_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES report_templates(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user ON scheduled_reports(user_id);
        CREATE INDEX IF NOT EXISTS idx_scheduled_reports_template ON scheduled_reports(template_id);

        CREATE TABLE IF NOT EXISTS scheduled_report_results (
          id VARCHAR(36) PRIMARY KEY,
          schedule_id VARCHAR(36) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          file_path VARCHAR(255),
          error_message TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
          id VARCHAR(36) PRIMARY KEY,
          recipient_id VARCHAR(36),
          recipient_email VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'sent',
          error_message TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          storage_key VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          size_bytes INT NOT NULL,
          url VARCHAR(512) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
          id VARCHAR(36) PRIMARY KEY,
          min_length INT NOT NULL DEFAULT 12,
          require_uppercase TINYINT NOT NULL DEFAULT 1,
          require_lowercase TINYINT NOT NULL DEFAULT 1,
          require_number TINYINT NOT NULL DEFAULT 1,
          require_special TINYINT NOT NULL DEFAULT 1,
          max_age_days INT NOT NULL DEFAULT 90,
          history_count INT NOT NULL DEFAULT 5,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS password_history (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS api_audit_log (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36),
          method VARCHAR(10) NOT NULL,
          path VARCHAR(255) NOT NULL,
          status_code INT,
          ip_address VARCHAR(45),
          user_agent VARCHAR(255),
          request_size INT,
          response_time_ms INT,
          error_message TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  {
    version: 16,
    name: 'leave-carryforwards-table',
    up: async () => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS leave_carryforwards (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          year INT NOT NULL,
          prev_year INT NOT NULL,
          proposal_carryforward INT NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_year (user_id, year)
        );
        CREATE INDEX IF NOT EXISTS idx_leave_carryforwards_user ON leave_carryforwards(user_id, year);
      `);
    },
  },
  {
    version: 17,
    name: 'monthly-overtime-table',
    up: async () => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS monthly_overtime (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          year INT NOT NULL,
          month INT NOT NULL,
          standard_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
          actual_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
          overtime_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_month (user_id, year, month)
        );
        CREATE INDEX IF NOT EXISTS idx_monthly_overtime_user ON monthly_overtime(user_id, year, month);
      `);
    },
  },
  {
    version: 18,
    name: 'holidays-unique-date-constraint',
    up: async () => {
      await db.exec(`ALTER TABLE holidays ADD UNIQUE KEY uk_holidays_date (date)`);
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
  // schema.sql already contains the final schema — migrations are idempotent
  // backfills, so a single failing statement must not block boot.
  try {
    const trx = db.transaction(async () => {
      await m.up();
      await db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
    });
    await trx();
    console.log(`[DB] Applied migration ${m.version}: ${m.name}`);
  } catch (e: any) {
    console.warn(`[DB] Migration ${m.version} (${m.name}) skipped:`, e.message);
    try {
      await db.prepare('INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
    } catch {}
  }
}

export default db;
// Mock pool for callers that only need pool.end() on shutdown (setup.ts, e2e-seed.ts, server.ts).
// All queries must go through db.prepare — pool.query is unavailable in SQLite mode.
export const pool = {
  end: async (): Promise<void> => {},
  query: async (): Promise<never> => {
    throw new Error('pool.query is not available in SQLite mode; use db.prepare');
  },
} as any;

export async function getSetting(key: string): Promise<string | null> {
  const row = (await db.prepare('SELECT `value` FROM app_settings WHERE `key` = ?').get(key)) as any;
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await db.prepare("INSERT INTO app_settings (`key`, `value`, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(`key`) DO UPDATE SET `value` = excluded.`value`, updated_at = datetime('now')").run(key, value ?? '');
}
