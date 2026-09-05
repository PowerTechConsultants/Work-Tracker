import { Router, Request, Response } from 'express';
import path from 'path';
import db from '../../db';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { createBackup, listBackups } from '../../lib/backup';
import { getPasswordPolicy, updatePasswordPolicy } from '../../lib/password-policy';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const router = Router();

router.use(authenticate);

// Read-only DB overview. Director + HR.
const ALLOWED_TABLES = new Set([
  'users', 'departments', 'attendance', 'tasks', 'task_assignments',
  'task_comments', 'task_approvals', 'leaves', 'notifications',
  'activity_logs', 'holidays', 'holiday_assignees', 'work_plans',
  'work_reports', 'team_members', 'schema_migrations', 'token_blacklist',
  'refresh_tokens', 'password_reset_tokens', 'app_settings', 'rate_limits',
  'api_cache', 'password_policies', 'password_history', 'api_audit_log',
]);

router.get('/db', requireRole('director', 'hr'), async (_req: Request, res: Response, next) => {
  try {
    const tables = (await db.prepare("SELECT TABLE_NAME as name FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME").all() as any[]).map((r) => r.name);
    const tableCounts: any[] = [];
    for (const t of tables) {
      if (ALLOWED_TABLES.has(t)) {
        const row = await db.prepare(`SELECT COUNT(*) c FROM \`${t}\``).get() as any;
        tableCounts.push({ table: t, rows: row.c });
      }
    }
    const version = (await db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get() as any)?.version ?? 0;
    res.json({
      journalMode: 'MySQL',
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

// ── Security Admin API ──

const updatePolicySchema = z.object({
  minLength: z.number().int().min(6).max(128).optional(),
  requireUppercase: z.boolean().optional(),
  requireLowercase: z.boolean().optional(),
  requireNumber: z.boolean().optional(),
  requireSpecial: z.boolean().optional(),
  maxAgeDays: z.number().int().min(0).max(365).optional(),
  historyCount: z.number().int().min(0).max(24).optional(),
});

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().optional(),
  path: z.string().max(200).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const sessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().optional(),
});

// GET /security/policy — get current password policy (admin only)
router.get('/security/policy', requireRole('director', 'hr'), async (_req: Request, res: Response, next) => {
  try {
    const policy = await getPasswordPolicy();
    res.json(policy);
  } catch (err) { next(err); }
});

// PUT /security/policy — update password policy (admin only)
router.put('/security/policy', requireRole('director'), validate(updatePolicySchema), async (req: Request, res: Response, next) => {
  try {
    const updates: Record<string, any> = {};
    if (req.body.minLength !== undefined) updates.minLength = req.body.minLength;
    if (req.body.requireUppercase !== undefined) updates.requireUppercase = req.body.requireUppercase;
    if (req.body.requireLowercase !== undefined) updates.requireLowercase = req.body.requireLowercase;
    if (req.body.requireNumber !== undefined) updates.requireNumber = req.body.requireNumber;
    if (req.body.requireSpecial !== undefined) updates.requireSpecial = req.body.requireSpecial;
    if (req.body.maxAgeDays !== undefined) updates.maxAgeDays = req.body.maxAgeDays;
    if (req.body.historyCount !== undefined) updates.historyCount = req.body.historyCount;
    const policy = await updatePasswordPolicy(updates);
    res.json(policy);
  } catch (err) { next(err); }
});

// GET /security/audit — get audit logs (admin only)
router.get('/security/audit', requireRole('director', 'hr'), validate(auditQuerySchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const { page, limit, userId, path: reqPath, from, to } = req.query as any;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (reqPath) {
      conditions.push('path LIKE ?');
      params.push(`%${reqPath}%`);
    }
    if (from) {
      conditions.push('created_at >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('created_at <= ?');
      params.push(to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await db.prepare(`SELECT COUNT(*) as total FROM api_audit_log ${whereClause}`).get(...params) as any;
    const total = countRow?.total ?? 0;

    const logs = await db.prepare(
      `SELECT id, user_id, method, path, status_code, ip_address, user_agent, request_size, response_time_ms, error_message, created_at
       FROM api_audit_log ${whereClause}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({ logs, total, page, limit });
  } catch (err) { next(err); }
});

// GET /security/sessions — get active sessions from refresh_tokens table (admin only)
router.get('/security/sessions', requireRole('director', 'hr'), validate(sessionsQuerySchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const { page, limit, userId } = req.query as any;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['rt.revoked_at IS NULL', "rt.expires_at > NOW()"];
    const params: any[] = [];

    if (userId) {
      conditions.push('rt.user_id = ?');
      params.push(userId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRow = await db.prepare(`SELECT COUNT(*) as total FROM refresh_tokens rt ${whereClause}`).get(...params) as any;
    const total = countRow?.total ?? 0;

    const sessions = await db.prepare(
      `SELECT rt.id, rt.user_id, u.email, u.first_name, u.last_name, rt.user_agent, rt.ip_address, rt.created_at, rt.expires_at
       FROM refresh_tokens rt
       LEFT JOIN users u ON u.id = rt.user_id
       ${whereClause}
       ORDER BY rt.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({ sessions, total, page, limit });
  } catch (err) { next(err); }
});

export default router;
