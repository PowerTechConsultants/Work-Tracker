import db, { uuid, getSetting, setSetting } from '../db';
import { getISTDate, isISTPast } from './time';
import { cache } from './cache';

const CHECK_INTERVAL_MS = 300_000;
const ABSENT_MARK_HOUR = 18;
const ABSENT_MARK_MINUTE = 30;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}

function acquireLock(): boolean {
  const now = Date.now();
  const existing = getSetting('auto_absent_lock');
  if (existing) {
    const ts = Number(existing);
    if (!isNaN(ts) && now - ts < CHECK_INTERVAL_MS) return false;
  }
  setSetting('auto_absent_lock', String(now));
  return true;
}

function releaseLock(): void {
  setSetting('auto_absent_lock', '');
}

function invalidateAnalyticsCache() {
  try {
    cache.delByPrefix('/api/v1/analytics/');
  } catch (e) {
    console.error('[Auto-Absent] Analytics cache invalidation failed:', e);
  }
}

function skipUsersForHoliday(date: string): string[] {
  const holidayIds = (db.prepare('SELECT id FROM holidays WHERE date = ?').all(date) as any[]).map((r: any) => r.id);
  if (holidayIds.length === 0) return [];

  const placeholders = holidayIds.map(() => '?').join(',');
  const assignees = db.prepare(`SELECT user_id FROM holiday_assignees WHERE holiday_id IN (${placeholders})`).all(...holidayIds) as any[];
  return assignees.map((r: any) => r.user_id);
}

function isCompanyWideHoliday(date: string): boolean {
  const holidayIds = (db.prepare('SELECT id FROM holidays WHERE date = ?').all(date) as any[]).map((r: any) => r.id);
  if (holidayIds.length === 0) return false;
  const placeholders = holidayIds.map(() => '?').join(',');
  const assigned = db.prepare(`SELECT 1 FROM holiday_assignees WHERE holiday_id IN (${placeholders}) LIMIT 1`).get(...holidayIds);
  return !assigned;
}

function markAbsentForDay(date: string, skipUserIds: string[]) {
  let params: any[] = [];
  let skipClause = '';
  if (skipUserIds.length > 0) {
    skipClause = ` AND u.id NOT IN (${skipUserIds.map(() => '?').join(',')})`;
    params.push(...skipUserIds);
  }

  const existingIds = new Set(
    (db.prepare(`SELECT user_id FROM attendance WHERE date = ?`).all(date) as any[]).map((r: any) => r.user_id)
  );

  const activeUsers = db.prepare(`SELECT id, joining_date FROM users WHERE status = 'active'${skipClause}`).all(...params) as any[];
  const toInsert = activeUsers.filter((u: any) => {
    if (existingIds.has(u.id)) return false;
    if (u.joining_date && u.joining_date > date) return false;
    return true;
  });

  if (toInsert.length === 0) return;

  const now = new Date().toISOString();
  const CHUNK = 500;
  const insertBatch = db.transaction(() => {
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params: any[] = [];
      for (const user of chunk) {
        params.push(uuid(), user.id, date, 'absent', null, now, now);
      }
      db.prepare(`INSERT OR IGNORE INTO attendance (id, user_id, date, status, notes, created_at, updated_at) VALUES ${placeholders}`).run(...params);
    }
  });
  insertBatch();
  invalidateAnalyticsCache();
}

function processDay(date: string) {
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (dayOfWeek === 0) return;

  const holidayUserIds = skipUsersForHoliday(date);
  if (holidayUserIds.length === 0 && isCompanyWideHoliday(date)) return;

  markAbsentForDay(date, holidayUserIds);
}

// Backfills any missed working days since the last processed date (unlimited).
// Runs on startup and on each interval tick. Idempotent: advances
// auto_absent_last_date as it goes, and never overwrites existing rows.
// A single-instance lease lock prevents two server processes from both running.
function backfillAbsentDates() {
  if (!acquireLock()) return;
  try {
    const today = getISTDate();
    // Only mark *today* once the daily threshold has passed; all earlier dates are fair game.
    const throughToday = isISTPast(ABSENT_MARK_HOUR, ABSENT_MARK_MINUTE);
    const lastProcessed = getSetting('auto_absent_last_date');
    // Anchor to yesterday when the cursor is missing so a fresh start never
    // backfills months of history from Jan 1.
    const start = lastProcessed ? addDays(lastProcessed, 1) : addDays(today, -1);
    let cursor = start;
    const cutoff = throughToday ? today : addDays(today, -1);

    if (cursor > cutoff) return;

    const runDay = db.transaction((date: string) => {
      processDay(date);
      setSetting('auto_absent_last_date', date);
    });

    let safety = 0;
    while (cursor <= cutoff && safety < 370) {
      runDay(cursor);
      cursor = addDays(cursor, 1);
      safety += 1;
    }
  } finally {
    releaseLock();
  }
}

export function startAutoAbsentScheduler() {
  try {
    backfillAbsentDates();
    console.log(`[Auto-Absent] Scheduler started (interval: ${CHECK_INTERVAL_MS / 1000}s)`);
  } catch (err) {
    console.error('[Auto-Absent] Initial backfill error:', err);
  }
  setInterval(() => {
    try {
      backfillAbsentDates();
    } catch (err) {
      console.error('[Auto-Absent] Error:', err);
    }
  }, CHECK_INTERVAL_MS);
}
