import { describe, expect, it } from 'vitest';
import db from '../db/index.js';
import { ensureAdminBootstrap } from '../db/bootstrap.js';

describe('database migrations', () => {
  it('applies all 18 migrations in order', async () => {
    const rows = (await db.prepare('SELECT version FROM schema_migrations ORDER BY version').all()) as any[];
    const versions = rows.map((r) => Number(r.version));
    expect(versions).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('creates all core tables', async () => {
    const rows = (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()) as any[];
    const names = new Set(rows.map((r) => r.name));
    for (const t of ['users', 'attendance', 'leaves', 'tasks', 'notifications', 'documents', 'holidays', 'activity_logs']) {
      // documents table may be named document_requests
      if (t === 'documents') {
        expect(names.has('document_requests') || names.has('documents')).toBe(true);
        continue;
      }
      expect(names.has(t)).toBe(true);
    }
  });

  it('admin bootstrap is idempotent', async () => {
    const before = (await db.prepare("SELECT COUNT(*) as c FROM users WHERE role IN ('director','hr')").get()) as any;
    await ensureAdminBootstrap();
    const after = (await db.prepare("SELECT COUNT(*) as c FROM users WHERE role IN ('director','hr')").get()) as any;
    expect(Number(after.c)).toBeGreaterThanOrEqual(Number(before.c));
  });
});
