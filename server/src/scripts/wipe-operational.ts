import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { pool } from '../db/index.js';

// Wipe operational data but keep admin credentials & stable config
// Keep: schema_migrations, password_policies, file_retention_policies, departments(Engineering), users(director/hr), app_settings
// Wipe: attendance, tasks, leaves, notifications, etc. + uploads/ folder

const KEEP_DEPT = 'Engineering';

async function wipe() {
  console.log('[Wipe] Starting — keeping admin & stable config...');

  // 1. Verify admin exists before wipe
  const admins = (await pool.query('SELECT id, email, role FROM users WHERE role IN (?, ?)', ['director', 'hr']) as any)[0] as any[];
  if (admins.length === 0) {
    console.error('[Wipe] ABORT: No director/hr found — would lock out. Create admin first.');
    process.exit(1);
  }
  console.log(`[Wipe] Keeping ${admins.length} admin(s):`, admins.map((a) => `${a.email} (${a.role})`).join(', '));

  const queries: string[] = [
    // Level 1 children
    'TRUNCATE TABLE holiday_assignees',
    'TRUNCATE TABLE scheduled_report_results',
    'TRUNCATE TABLE task_assignments',
    'TRUNCATE TABLE task_comments',
    'TRUNCATE TABLE task_attachments',
    'TRUNCATE TABLE task_approvals',
    'TRUNCATE TABLE attendance_events',
    // Level 2 parents
    'TRUNCATE TABLE attendance',
    'TRUNCATE TABLE tasks',
    'TRUNCATE TABLE holidays',
    'TRUNCATE TABLE scheduled_reports',
    'TRUNCATE TABLE report_templates',
    // Level 3 operational
    'TRUNCATE TABLE work_plans',
    'TRUNCATE TABLE work_reports',
    'TRUNCATE TABLE leaves',
    'TRUNCATE TABLE leave_carryforwards',
    'TRUNCATE TABLE monthly_overtime',
    'TRUNCATE TABLE notifications',
    'TRUNCATE TABLE activity_logs',
    'TRUNCATE TABLE api_audit_log',
    'TRUNCATE TABLE email_logs',
    'TRUNCATE TABLE document_requests',
    'TRUNCATE TABLE file_uploads',
    'TRUNCATE TABLE team_members',
    'TRUNCATE TABLE refresh_tokens',
    'TRUNCATE TABLE password_reset_tokens',
    'TRUNCATE TABLE password_history',
  ];

  for (const sql of queries) {
    try {
      await pool.query(sql);
      console.log(`[Wipe] ${sql}`);
    } catch (e: any) {
      if (e.message?.includes("doesn't exist") || e.message?.includes('Unknown table')) {
        console.log(`[Wipe] Skip (not exists): ${sql}`);
      } else {
        console.error(`[Wipe] Failed: ${sql}`, e.message);
      }
    }
  }

  // Level 4 filtered — keep director/hr and Engineering
  const delUsers = (await pool.query("DELETE FROM users WHERE role = 'employee'") as any)[0];
  console.log(`[Wipe] Deleted ${(delUsers as any).affectedRows ?? 0} employee user(s)`);

  const delDepts = (await pool.query('DELETE FROM departments WHERE name != ?', [KEEP_DEPT]) as any)[0];
  console.log(`[Wipe] Deleted ${(delDepts as any).affectedRows ?? 0} department(s) (kept ${KEEP_DEPT})`);

  // Level 5 ephemeral
  for (const sql of ['TRUNCATE TABLE token_blacklist', 'TRUNCATE TABLE rate_limits', 'TRUNCATE TABLE api_cache']) {
    try {
      await pool.query(sql);
      console.log(`[Wipe] ${sql}`);
    } catch (e: any) {
      console.log(`[Wipe] Skip: ${sql}`, e.message);
    }
  }

  // Disk: uploads/
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const absUpload = path.resolve(uploadDir);
  try {
    if (fs.existsSync(absUpload)) {
      const before = fs.readdirSync(absUpload).length;
      fs.rmSync(absUpload, { recursive: true, force: true });
      fs.mkdirSync(absUpload, { recursive: true });
      console.log(`[Wipe] Cleared uploads/ (${before} entries) at ${absUpload}`);
    } else {
      console.log(`[Wipe] No uploads folder at ${absUpload}`);
    }
  } catch (e: any) {
    console.error('[Wipe] Uploads cleanup failed:', e.message);
  }

  // Verify
  const [migrations] = (await pool.query('SELECT COUNT(*) as c FROM schema_migrations') as any);
  const [policies] = (await pool.query('SELECT COUNT(*) as c FROM password_policies') as any);
  const [retention] = (await pool.query('SELECT COUNT(*) as c FROM file_retention_policies') as any);
  const [remainingUsers] = (await pool.query('SELECT role, COUNT(*) as c FROM users GROUP BY role') as any);
  console.log(`[Wipe] Verify — schema_migrations: ${migrations[0].c}, password_policies: ${policies[0].c}, file_retention_policies: ${retention[0].c}`);
  console.log('[Wipe] Remaining users:', remainingUsers);

  console.log('[Wipe] Done — admin login preserved, operational data cleared. 50GB Hostinger: run npm run backup before wipe for safety.');
  process.exit(0);
}

wipe().catch((e) => {
  console.error('[Wipe] Fatal:', e);
  process.exit(1);
});
