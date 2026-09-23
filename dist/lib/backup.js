import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { resolveDbPath } from '../db/index.js';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backup');
function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}
function timestamp() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}
export async function createBackup(prefix = 'employee-tracker') {
    ensureBackupDir();
    // SQLite: the database is a single file outside dist/ — copy it (+ WAL checkpoint first).
    const dbPath = resolveDbPath();
    if (!fs.existsSync(dbPath)) {
        throw new Error(`[Backup] Database file not found: ${dbPath}`);
    }
    const backupName = `${prefix}-${timestamp()}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    fs.copyFileSync(dbPath, backupPath);
    for (const suffix of ['-wal', '-shm', '-journal']) {
        try {
            if (fs.existsSync(dbPath + suffix))
                fs.copyFileSync(dbPath + suffix, backupPath + suffix);
        }
        catch { }
    }
    console.log(`[Backup] Created: ${backupPath}`);
    // Rotation: keep last 7 backups on 50GB Hostinger
    try {
        const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort();
        if (files.length > 7) {
            for (const f of files.slice(0, files.length - 7)) {
                fs.unlinkSync(path.join(BACKUP_DIR, f));
                console.log(`[Backup] Rotated old: ${f}`);
            }
        }
    }
    catch { }
    return backupPath;
}
export function listBackups() {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith('.db') || f.endsWith('.sql'))
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
        }
        else {
            console.log('Backups:');
            list.forEach((b) => console.log(`  ${b}`));
        }
    }
    else {
        createBackup()
            .then((p) => console.log(`Backup complete: ${p}`))
            .catch((e) => { console.error(e.message); process.exit(1); });
    }
}
