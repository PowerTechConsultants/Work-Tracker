import dotenv from 'dotenv';
dotenv.config();
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backup');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

export async function createBackup(prefix = 'employee-tracker'): Promise<string> {
  ensureBackupDir();

  const url = process.env.DATABASE_URL;
  let host = process.env.MYSQL_HOST || 'localhost';
  let port = process.env.MYSQL_PORT || '3306';
  let user = process.env.MYSQL_USER || 'root';
  let password = process.env.MYSQL_PASSWORD || '0000';
  let database = process.env.MYSQL_DATABASE || 'hr';
  if (url) {
    try {
      const u = new URL(url);
      host = u.hostname || host;
      port = u.port || port;
      user = decodeURIComponent(u.username) || user;
      password = decodeURIComponent(u.password) || password;
      database = u.pathname.replace(/^\//, '') || database;
    } catch (e) { console.error('[Backup] URL parse error:', e); }
  }

  const backupName = `${prefix}-${timestamp()}.sql`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  const env = { ...process.env, MYSQL_PWD: password };
  const sanitize = (v: string) => v.replace(/[^a-zA-Z0-9._@:/-]/g, '');
  const cmd = `mysqldump -h ${sanitize(host)} -P ${sanitize(port)} -u ${sanitize(user)} --single-transaction --routines --triggers ${sanitize(database)}`;
  const dump = execSync(cmd, { maxBuffer: 1024 * 1024 * 50, env });
  fs.writeFileSync(backupPath, dump);

  console.log(`[Backup] Created: ${backupPath}`);
  return backupPath;
}

export function listBackups(): string[] {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse();
  return files.map((f) => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    return `${f}  (${(stat.size / 1024).toFixed(1)} KB, ${stat.mtime.toISOString()})`;
  });
}

if (process.argv[1] === import.meta.url || process.argv[1]?.endsWith('backup.ts')) {
  const cmd = process.argv[2];
  if (cmd === 'list') {
    const list = listBackups();
    if (list.length === 0) {
      console.log('No backups found.');
    } else {
      console.log('Backups:');
      list.forEach((b) => console.log(`  ${b}`));
    }
  } else {
    createBackup()
      .then((p) => console.log(`Backup complete: ${p}`))
      .catch((e) => { console.error(e.message); process.exit(1); });
  }
}
