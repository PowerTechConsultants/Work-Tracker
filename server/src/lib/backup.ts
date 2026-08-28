import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data.db');
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

// Uses SQLite's online backup API so the snapshot includes data still in the
// WAL — unlike a raw file copy, this never silently drops recent writes.
export async function createBackup(prefix = 'employee-tracker'): Promise<string> {
  ensureBackupDir();
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found at ${DB_PATH}`);
  }
  const backupName = `${prefix}-${timestamp()}.db`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  const db = new Database(DB_PATH, { readonly: true });
  try {
    await db.backup(backupPath);
  } finally {
    db.close();
  }
  console.log(`[Backup] Created: ${backupPath}`);
  return backupPath;
}

export function listBackups(): string[] {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse();
  return files.map((f) => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    return `${f}  (${(stat.size / 1024).toFixed(1)} KB, ${stat.mtime.toISOString()})`;
  });
}

// Run directly: npx tsx src/lib/backup.ts [list]
if (require.main === module) {
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
