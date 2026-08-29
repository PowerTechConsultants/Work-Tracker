import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data.db');

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_PATH) {
  console.warn('[DB] WARNING: DATABASE_PATH not set — using ephemeral ./data.db. On Render this will be LOST on each deploy/restart! Set DATABASE_PATH=/data/data.db and mount a Persistent Disk at /data.');
}
if (DB_PATH.includes('/data/') && !fs.existsSync('/data')) {
  console.warn('[DB] WARNING: DATABASE_PATH points to /data/ but /data mount not found — Render Disk may not be attached.');
}

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');
db.pragma('temp_store = MEMORY');
db.pragma('busy_timeout = 5000');
db.pragma('mmap_size = 268435456');
db.pragma('wal_autocheckpoint = 1000');

const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

// ---------- Versioned migrations ----------
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

interface Migration {
  version: number;
  name: string;
  up: () => void;
}

function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return cols.some((c) => c.name === column);
}

function addColumnIfMissing(table: string, column: string, ddl: string): void {
  if (hasColumn(table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

// Baseline migrations cover every change that the legacy (unversioned) bootstrap
// used to apply on each boot. Each is idempotent so it is safe whether or not a
// previous run already applied it.
const migrations: Migration[] = [
  {
    version: 1,
    name: 'legacy-baseline',
    up: () => {
      addColumnIfMissing('attendance', 'pause_start_time', 'pause_start_time TEXT');
      addColumnIfMissing('attendance', 'pause_end_time', 'pause_end_time TEXT');
      addColumnIfMissing('attendance', 'pause_minutes', 'pause_minutes REAL DEFAULT 0');
      db.exec(`CREATE TABLE IF NOT EXISTS holidays (id TEXT PRIMARY KEY, date TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'public', created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (created_by) REFERENCES users(id))`);
      db.exec(`CREATE TABLE IF NOT EXISTS holiday_assignees (holiday_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (holiday_id, user_id), FOREIGN KEY (holiday_id) REFERENCES holidays(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
      db.exec(`CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
      db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_leaves_dates ON leaves(start_date, end_date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at)');
      addColumnIfMissing('task_approvals', 'request_comment', 'request_comment TEXT');
      db.exec('DROP TABLE IF EXISTS time_entries');
      db.exec('DROP TABLE IF EXISTS chat_messages');
      db.exec(`CREATE TABLE IF NOT EXISTS token_blacklist (user_id TEXT PRIMARY KEY, revoked_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL)`);
      db.exec(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
      db.exec(`CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL)`);
      db.exec('CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at)');
      addColumnIfMissing('team_members', 'role', "role TEXT NOT NULL DEFAULT 'member'");
      db.exec("UPDATE users SET role = 'director' WHERE role = 'admin'");
      db.exec("UPDATE activity_logs SET entity_type = 'director' WHERE entity_type = 'admin'");
      db.exec('CREATE INDEX IF NOT EXISTS idx_work_plans_user ON work_plans(user_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_work_plans_user_date ON work_plans(user_id, date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_work_reports_user ON work_reports(user_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_work_reports_user_date ON work_reports(user_id, date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_task_approvals_task ON task_approvals(task_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_team_members_team_name ON team_members(team_name)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash)');
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id)');
      db.exec(`CREATE TABLE IF NOT EXISTS api_cache (cache_key TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at TEXT NOT NULL)`);
      db.exec('CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at)');
      addColumnIfMissing('leaves', 'deducted_from', 'deducted_from TEXT');
      addColumnIfMissing('attendance', 'latitude', 'latitude REAL');
      addColumnIfMissing('attendance', 'longitude', 'longitude REAL');
      addColumnIfMissing('attendance', 'location_accuracy', 'location_accuracy REAL');
      addColumnIfMissing('attendance', 'location_captured_at', 'location_captured_at TEXT');
    },
  },
  {
    version: 2,
    name: 'attendance-working-hours-recompute',
    up: () => {
      db.exec(`
        UPDATE attendance SET
          working_hours = MAX(0, ROUND(
            (julianday(logout_time) - julianday(login_time)) * 24 - COALESCE(pause_minutes, 0) / 60.0, 2
          )),
          overtime_hours = MAX(0, ROUND(
            MAX(0, ROUND(
              (julianday(logout_time) - julianday(login_time)) * 24 - COALESCE(pause_minutes, 0) / 60.0, 2
            )) - 8, 2
          ))
        WHERE logout_time IS NOT NULL AND login_time IS NOT NULL
      `);
    },
  },
  {
    version: 3,
    name: 'composite-indexes',
    up: () => {
      db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_user_date_status ON attendance(user_id, date, status)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance(date, status)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_created ON activity_logs(actor_id, created_at)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_leaves_user_dates ON leaves(user_id, start_date, end_date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_holidays_date_id ON holidays(date, id)');
    },
  },
  {
    version: 4,
    name: 'performance-indexes',
    up: () => {
      db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_holidays_created_by ON holidays(created_by)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_leaves_status_dates ON leaves(status, start_date, end_date)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC)');
    },
  },
  {
    version: 5,
    name: 'holidays-updated-at',
    up: () => {
      addColumnIfMissing('holidays', 'updated_at', "updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
    },
  },
  {
    version: 6,
    name: 'leave-extra-carried-over-and-attendance-events',
    up: () => {
      addColumnIfMissing('leaves', 'extra', 'extra INTEGER NOT NULL DEFAULT 0');
      addColumnIfMissing('leaves', 'leave_year', 'leave_year INTEGER');
      db.exec(`CREATE TABLE IF NOT EXISTS attendance_events (
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
      db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_events_att ON attendance_events(attendance_id, occurred_at)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_events_user ON attendance_events(user_id, occurred_at)');
      db.exec(`UPDATE leaves SET leave_year = CAST(substr(start_date, 1, 4) AS INTEGER) WHERE leave_year IS NULL`);
    },
  },
];

const appliedVersions = new Set(
  (db.prepare('SELECT version FROM schema_migrations').all() as any[]).map((r: any) => r.version)
);

for (const m of migrations) {
  if (appliedVersions.has(m.version)) continue;
  db.transaction(() => {
    m.up();
    db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
  })();
  console.log(`[DB] Applied migration ${m.version}: ${m.name}`);
}

export default db;

export function uuid(): string {
  return randomUUID();
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
}
