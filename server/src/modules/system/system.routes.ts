import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import db from '../../db';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { createBackup, listBackups } from '../../lib/backup';

const router = Router();

router.use(authenticate);

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data.db');

function dbFileSize(): number {
  let total = 0;
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${DB_PATH}${suffix}`;
    try { total += fs.statSync(p).size; } catch {}
  }
  return total;
}

// Read-only DB overview. Director + HR.
const ALLOWED_TABLES = new Set([
  'users', 'departments', 'attendance', 'tasks', 'task_assignments',
  'task_comments', 'task_approvals', 'leaves', 'notifications',
  'activity_logs', 'holidays', 'holiday_assignees', 'work_plans',
  'work_reports', 'team_members', 'schema_migrations', 'token_blacklist',
  'refresh_tokens', 'password_reset_tokens', 'app_settings', 'rate_limits',
  'api_cache',
]);

router.get('/db', requireRole('director', 'hr'), (_req: Request, res: Response, next) => {
  try {
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as any[]).map((r) => r.name);
    const tableCounts = tables.filter((t) => ALLOWED_TABLES.has(t)).map((t) => ({
      table: t,
      rows: (db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get() as any).c,
    }));
    const version = (db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get() as any)?.version ?? 0;
    res.json({
      fileSizeBytes: dbFileSize(),
      journalMode: (db.prepare('PRAGMA journal_mode').get() as any).journal_mode,
      migrationVersion: version,
      tables: tableCounts,
    });
  } catch (err) { next(err); }
});

// Create an on-demand, WAL-safe backup. Director only.
router.post('/backup', requireRole('director'), async (req: Request, res: Response, next) => {
  try {
    const backupPath = await createBackup();
    res.status(201).json({ message: 'Backup created', path: path.basename(backupPath) });
  } catch (err) { next(err); }
});

// List available backups. Director only.
router.get('/backups', requireRole('director'), (_req: Request, res: Response, next) => {
  try {
    res.json({ backups: listBackups() });
  } catch (err) { next(err); }
});

export default router;
