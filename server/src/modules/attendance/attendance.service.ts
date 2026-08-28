import db, { uuid } from '../../db';
import { getISTDate } from '../../lib/time';
import { getIO } from '../../lib/socket';
import { cache } from '../../lib/cache';
import { AppError } from '../../lib/app-error';

const STANDARD_WORKDAY_HOURS = 8;
const HALF_DAY_THRESHOLD = 4;

function invalidateAnalyticsCache() {
  try {
    cache.delByPrefix('/api/v1/analytics/');
  } catch (e) {
    console.error('[Attendance] Analytics cache invalidation failed:', e);
  }
}

function emitAttendanceUpdated(userId: string, record: any) {
  try {
    getIO().to(`user:${userId}`).emit('attendance:updated', record);
  } catch (e) {
    console.error('[Attendance] Socket emit failed:', e);
  }
}

function logEvent(attendanceId: string, userId: string, eventType: string, loc?: { latitude?: number; longitude?: number; accuracy?: number; locationCapturedAt?: string }, occurredAt?: string) {
  try {
    db.prepare(
      "INSERT INTO attendance_events (id, attendance_id, user_id, event_type, occurred_at, latitude, longitude, location_accuracy, location_captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      uuid(), attendanceId, userId, eventType,
      occurredAt ?? new Date().toISOString(),
      loc?.latitude ?? null, loc?.longitude ?? null, loc?.accuracy ?? null, loc?.locationCapturedAt ?? null
    );
  } catch (e) {
    console.error('[Attendance] Event log failed:', e);
  }
}

export function getAttendanceEvents(attendanceId: string): any[] {
  return db.prepare(
    "SELECT id, event_type, occurred_at, latitude, longitude, location_accuracy, location_captured_at FROM attendance_events WHERE attendance_id = ? ORDER BY occurred_at ASC"
  ).all(attendanceId);
}

export function getAttendanceEventsForUser(userId: string, attendanceId: string): any[] {
  return db.prepare(
    "SELECT id, event_type, occurred_at, latitude, longitude, location_accuracy, location_captured_at FROM attendance_events WHERE attendance_id = ? AND user_id = ? ORDER BY occurred_at ASC"
  ).all(attendanceId, userId);
}

export function getPauseLog(startDate?: string, endDate?: string): any[] {
  const conds: string[] = ["ae.event_type IN ('pause_start', 'pause_end')"];
  const params: any[] = [];
  if (startDate) { conds.push('a.date >= ?'); params.push(startDate); }
  if (endDate) { conds.push('a.date <= ?'); params.push(endDate); }
  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
  return db.prepare(`
    SELECT ae.event_type, ae.occurred_at, a.id as attendance_id, a.date,
           a.user_id, u.first_name, u.last_name, u.employee_id, d.name as department_name
    FROM attendance_events ae
    JOIN attendance a ON ae.attendance_id = a.id
    JOIN users u ON a.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    ${where}
    ORDER BY a.date DESC, a.user_id, ae.occurred_at ASC
  `).all(...params);
}

export class AttendanceService {
  static checkIn(userId: string, input: { status?: string; notes?: string; latitude?: number; longitude?: number; accuracy?: number; locationCapturedAt?: string }) {
    const today = getISTDate();
    const id = uuid();
    const now = new Date().toISOString();
    const hasLocation = input.latitude !== undefined && input.longitude !== undefined;

    // Check if record exists (e.g., from approved leave or holiday)
    const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, today) as any;
    if (existing) {
      if (existing.logout_time) throw new AppError(409, 'Already checked out today');
      if (existing.status === 'holiday') throw new AppError(403, 'Cannot check in on a holiday');
      if (existing.status === 'absent' || existing.status === 'leave') {
        if (hasLocation) {
          db.prepare("UPDATE attendance SET status = 'present', login_time = ?, notes = ?, latitude = ?, longitude = ?, location_accuracy = ?, location_captured_at = ?, updated_at = ? WHERE id = ?")
            .run(now, input.notes ?? null, input.latitude, input.longitude, input.accuracy ?? null, input.locationCapturedAt ?? now, now, existing.id);
        } else {
          db.prepare("UPDATE attendance SET status = 'present', login_time = ?, notes = ?, updated_at = ? WHERE id = ?")
            .run(now, input.notes ?? null, now, existing.id);
        }
        const rec = db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id);
        logEvent(existing.id, userId, 'check_in', { latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy, locationCapturedAt: input.locationCapturedAt }, now);
        invalidateAnalyticsCache();
        emitAttendanceUpdated(userId, rec);
        return rec;
      }
      if (existing.login_time) throw new AppError(409, 'Already checked in today');
    }

    try {
      if (hasLocation) {
        db.prepare("INSERT INTO attendance (id, user_id, date, status, login_time, notes, latitude, longitude, location_accuracy, location_captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(id, userId, today, input.status ?? 'present', now, input.notes ?? null, input.latitude, input.longitude, input.accuracy ?? null, input.locationCapturedAt ?? now);
      } else {
        db.prepare("INSERT INTO attendance (id, user_id, date, status, login_time, notes) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, userId, today, input.status ?? 'present', now, input.notes ?? null);
      }
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint')) throw new AppError(409, 'Already checked in today');
      throw err;
    }
    const rec = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);
    logEvent(id, userId, 'check_in', { latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy, locationCapturedAt: input.locationCapturedAt }, now);
    invalidateAnalyticsCache();
    emitAttendanceUpdated(userId, rec);
    return rec;
  }

  static startPause(userId: string, input?: { latitude?: number; longitude?: number; accuracy?: number; locationCapturedAt?: string }) {
    const today = getISTDate();
    const rec = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, today) as any;
    if (!rec) throw new AppError(404, 'No check-in found for today');
    if (rec.logout_time) throw new AppError(409, 'Already checked out today');
    if (rec.pause_start_time && !rec.pause_end_time) return rec;

    const now = new Date().toISOString();
    db.prepare("UPDATE attendance SET pause_start_time = ?, pause_end_time = NULL, status = 'on_break', updated_at = ? WHERE id = ?").run(now, now, rec.id);
    logEvent(rec.id, userId, 'pause_start', input, now);
    const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(rec.id);
    invalidateAnalyticsCache();
    emitAttendanceUpdated(userId, updated);
    return updated;
  }

  static endPause(userId: string, input?: { latitude?: number; longitude?: number; accuracy?: number; locationCapturedAt?: string }) {
    const today = getISTDate();
    const rec = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, today) as any;
    if (!rec) throw new AppError(404, 'No check-in found for today');
    if (!rec.pause_start_time || rec.pause_end_time) return rec;

    const now = new Date();
    const pauseStart = new Date(rec.pause_start_time);
    const pauseDuration = Math.round((now.getTime() - pauseStart.getTime()) / 60000);
    const totalPause = (rec.pause_minutes ?? 0) + pauseDuration;
    const nowIso = now.toISOString();

    db.prepare("UPDATE attendance SET pause_end_time = ?, pause_minutes = ?, status = 'present', updated_at = ? WHERE id = ?")
      .run(nowIso, totalPause, nowIso, rec.id);
    logEvent(rec.id, userId, 'pause_end', input, nowIso);
    const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(rec.id);
    invalidateAnalyticsCache();
    emitAttendanceUpdated(userId, updated);
    return updated;
  }

  static checkOut(userId: string, input?: { latitude?: number; longitude?: number; accuracy?: number; locationCapturedAt?: string }) {
    const today = getISTDate();
    const rec = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, today) as any;
    if (!rec) throw new AppError(404, 'No check-in found for today');
    if (rec.logout_time) throw new AppError(409, 'Already checked out today');

    const now = new Date();
    const nowIso = now.toISOString();
    const loginTime = rec.login_time ? new Date(rec.login_time) : now;

    let pauseMinutes = rec.pause_minutes ?? 0;
    if (rec.pause_start_time && !rec.pause_end_time) {
      const pauseStart = new Date(rec.pause_start_time);
      pauseMinutes += Math.round((now.getTime() - pauseStart.getTime()) / 60000);
    }

    const totalMs = now.getTime() - loginTime.getTime();
    const rawHours = Math.round((totalMs / 3600000) * 100) / 100;
    const pauseHours = Math.round((pauseMinutes / 60) * 100) / 100;
    const workingHours = Math.max(0, Math.round((rawHours - pauseHours) * 100) / 100);
    const overtimeHours = Math.max(0, Math.round((workingHours - STANDARD_WORKDAY_HOURS) * 100) / 100);
    const status = workingHours < HALF_DAY_THRESHOLD ? 'half_day' : 'work_end';

    db.prepare(`UPDATE attendance SET
      logout_time = ?, working_hours = ?, overtime_hours = ?,
      pause_minutes = ?, pause_end_time = COALESCE(pause_end_time, ?),
      status = ?, updated_at = ? WHERE id = ?`)
      .run(nowIso, workingHours, overtimeHours, pauseMinutes, rec.pause_start_time ? nowIso : null, status, nowIso, rec.id);

    const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(rec.id);
    logEvent(rec.id, userId, 'check_out', input, nowIso);
    invalidateAnalyticsCache();
    emitAttendanceUpdated(userId, updated);
    return updated;
  }

  static list(input: any) {
    const { page = 1, limit = 20, userId, userIds, startDate, endDate, status, statuses } = input;
    const offset = (page - 1) * limit;
    const conds: string[] = []; const params: any[] = [];
    if (userId) { conds.push('a.user_id = ?'); params.push(userId); }
    if (userIds && userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      conds.push(`a.user_id IN (${placeholders})`);
      params.push(...userIds);
    }
    if (status) { conds.push('a.status = ?'); params.push(status); }
    if (statuses && statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(',');
      conds.push(`a.status IN (${placeholders})`);
      params.push(...statuses);
    }
    if (startDate) { conds.push('a.date >= ?'); params.push(startDate); }
    if (endDate) { conds.push('a.date <= ?'); params.push(endDate); }
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const count = (db.prepare(`SELECT count(*) as c FROM attendance a ${where}`).get(...params) as any).c;
    const rows = db.prepare(`SELECT a.*, u.first_name, u.last_name, u.employee_id, d.name as department_name FROM attendance a JOIN users u ON a.user_id = u.id LEFT JOIN departments d ON u.department_id = d.id ${where} ORDER BY a.date DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { records: rows, total: count, page, limit };
  }

  static getTodayStatus(userId: string) {
    const today = getISTDate();
    return db.prepare('SELECT id, user_id, date, status, login_time, logout_time, working_hours, overtime_hours, pause_minutes, latitude, longitude, location_accuracy, location_captured_at, notes, created_at, updated_at FROM attendance WHERE user_id = ? AND date = ?').get(userId, today) ?? null;
  }

  static getTodayAll() {
    const today = getISTDate();
    const rows = db.prepare(`
      SELECT u.id, u.first_name, u.last_name, u.employee_id, u.role,
             a.status as today_status, a.login_time, a.logout_time, a.working_hours, a.overtime_hours, a.pause_minutes,
             a.latitude, a.longitude, a.location_accuracy, a.location_captured_at
      FROM users u
      LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ?
      WHERE u.status = 'active'
      ORDER BY u.first_name, u.last_name
    `).all(today);
    return rows;
  }

  static getUserHistory(userId: string, year: number, month: number, startDate?: string, endDate?: string) {
    const start = startDate || `${year}-${String(month).padStart(2, '0')}-01`;
    const end = endDate || (() => {
      const lastDay = new Date(year, month, 0).getDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    })();

    const records = db.prepare(`
      SELECT id, user_id, date, status, login_time, logout_time, working_hours, overtime_hours, pause_start_time, pause_end_time, pause_minutes, latitude, longitude, location_accuracy, location_captured_at, notes, created_at, updated_at FROM attendance WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC
    `).all(userId, start, end);

    const agg = db.prepare(`SELECT
      COALESCE(SUM(working_hours), 0) as total_working_hours,
      COALESCE(SUM(overtime_hours), 0) as total_overtime_hours,
      COALESCE(SUM(pause_minutes), 0) as total_pause_minutes
      FROM attendance WHERE user_id = ? AND date >= ? AND date <= ? AND logout_time IS NOT NULL`).get(userId, start, end) as any;

    return {
      year, month,
      records,
      summary: (records as any[]).reduce((acc: Record<string, number>, r: any) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>),
      totalWorkingHours: agg.total_working_hours,
      totalOvertimeHours: agg.total_overtime_hours,
      overtimeDays: Math.floor(agg.total_overtime_hours / 8),
      totalPauseMinutes: agg.total_pause_minutes,
    };
  }

  static bulkDelete(input: any) {
    const normalizedDate = input.date ? input.date : null;
    const startDate = input.startDate ?? (normalizedDate ? normalizedDate : undefined);
    const endDate = input.endDate ?? (normalizedDate ? normalizedDate : undefined);

    const conds: string[] = []; const params: any[] = [];
    if (input.userId) { conds.push('user_id = ?'); params.push(input.userId); }
    if (input.userIds && input.userIds.length > 0) {
      const placeholders = input.userIds.map(() => '?').join(',');
      conds.push(`user_id IN (${placeholders})`);
      params.push(...input.userIds);
    }
    if (input.status) { conds.push('status = ?'); params.push(input.status); }
    if (input.statuses && input.statuses.length > 0) {
      const placeholders = input.statuses.map(() => '?').join(',');
      conds.push(`status IN (${placeholders})`);
      params.push(...input.statuses);
    }
    if (startDate) { conds.push('date >= ?'); params.push(startDate); }
    if (endDate) { conds.push('date <= ?'); params.push(endDate); }

    const hasAnyFilter = !!(input.userId || (input.userIds && input.userIds.length > 0) || input.status || (input.statuses && input.statuses.length > 0) || startDate || endDate);
    if (!hasAnyFilter) {
      throw new AppError(400, 'Deleting attendance requires at least one filter dimension (dates, statuses, or users). Refusing to delete the whole table.');
    }
    if (input.confirm !== 'DELETE') {
      throw new AppError(400, 'Deleting attendance requires confirm=DELETE');
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const count = (db.prepare(`SELECT COUNT(*) as c FROM attendance ${where}`).get(...params) as any).c;

    let deleted = 0;
    if (count > 0) {
      db.transaction(() => {
        deleted = db.prepare(`DELETE FROM attendance ${where}`).run(...params).changes;
      })();
    }
    const result = { deleted, scope: { userId: input.userId ?? null, userIds: input.userIds ?? null, status: input.status ?? null, startDate: startDate ?? null, endDate: endDate ?? null, date: normalizedDate } };
    invalidateAnalyticsCache();
    try {
      getIO().emit('attendance:bulk', result);
    } catch (e) {
      console.error('[Attendance] Socket emit failed:', e);
    }
    return result;
  }

  static update(id: string, input: any) {
    if (!db.prepare('SELECT id FROM attendance WHERE id = ?').get(id)) throw new AppError(404, 'Record not found');
    const sets: string[] = ["updated_at = datetime('now')"]; const params: any[] = [];
    if (input.status) { sets.push('status = ?'); params.push(input.status); }
    if (input.loginTime) { sets.push('login_time = ?'); params.push(input.loginTime); }
    if (input.logoutTime) { sets.push('logout_time = ?'); params.push(input.logoutTime); }
    if (input.workingHours !== undefined) {
      if (input.workingHours < 0 || input.workingHours > 24) throw new AppError(400, 'Working hours must be between 0 and 24');
      sets.push('working_hours = ?'); params.push(input.workingHours);
    }
    if (input.overtimeHours !== undefined) {
      if (input.overtimeHours < 0 || input.overtimeHours > 24) throw new AppError(400, 'Overtime hours must be between 0 and 24');
      sets.push('overtime_hours = ?'); params.push(input.overtimeHours);
    }
    if (input.pauseStartTime !== undefined) { sets.push('pause_start_time = ?'); params.push(input.pauseStartTime); }
    if (input.pauseEndTime !== undefined) { sets.push('pause_end_time = ?'); params.push(input.pauseEndTime); }
    if (input.pauseMinutes !== undefined) {
      if (input.pauseMinutes < 0 || input.pauseMinutes > 480) throw new AppError(400, 'Pause minutes must be between 0 and 480');
      sets.push('pause_minutes = ?'); params.push(input.pauseMinutes);
    }
    if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }
    if (input.latitude !== undefined) { sets.push('latitude = ?'); params.push(input.latitude); }
    if (input.longitude !== undefined) { sets.push('longitude = ?'); params.push(input.longitude); }
    if (input.accuracy !== undefined) { sets.push('location_accuracy = ?'); params.push(input.accuracy); }
    if (input.locationCapturedAt !== undefined) { sets.push('location_captured_at = ?'); params.push(input.locationCapturedAt); }
    params.push(id);
    db.prepare(`UPDATE attendance SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);
  }

  static getMonthlySummary(userId: string, year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const statusRows = db.prepare('SELECT status, count(*) as count FROM attendance WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY status').all(userId, start, end) as any[];
    const summary: Record<string, number> = {};
    for (const r of statusRows) summary[r.status] = r.count;

    const agg = db.prepare(`SELECT
      COALESCE(SUM(working_hours), 0) as total_working_hours,
      COALESCE(SUM(overtime_hours), 0) as total_overtime_hours,
      COALESCE(SUM(pause_minutes), 0) as total_pause_minutes
      FROM attendance WHERE user_id = ? AND date >= ? AND date <= ? AND logout_time IS NOT NULL`).get(userId, start, end) as any;

    const totalWorkingHours = agg.total_working_hours;
    const totalOvertimeHours = agg.total_overtime_hours;
    const regularHours = Math.max(0, totalWorkingHours - totalOvertimeHours);
    const totalPauseMinutes = agg.total_pause_minutes;

    return { year, month, summary, totalWorkingHours, totalOvertimeHours, overtimeDays: Math.floor(totalOvertimeHours / 8), regularHours, totalPauseMinutes };
  }
}
