import db, { uuid } from '../../db';
import { getIO } from '../../lib/socket';
import { getISTDate } from '../../lib/time';
import { cache } from '../../lib/cache';
import { AppError } from '../../lib/app-error';

const LEAVE_BALANCES: Record<'casual' | 'sick' | 'paid', number> = { casual: 8, sick: 8, paid: 12 };

function invalidateAnalyticsCache() {
  try {
    cache.delByPrefix('/api/v1/analytics/');
  } catch (e) {
    console.error('[Leaves] Analytics cache invalidation failed:', e);
  }
}

const PROTECTED_STATUSES = "('present','work_end','on_break','half_day','holiday')";

function mapLeave(l: any) {
  return {
    id: l.id, userId: l.user_id, type: l.type, startDate: l.start_date, endDate: l.end_date,
    reason: l.reason, status: l.status, reviewComment: l.review_comment,
    reviewedById: l.reviewed_by_id, reviewedAt: l.reviewed_at,
    createdAt: l.created_at, updatedAt: l.updated_at,
    firstName: l.first_name, lastName: l.last_name, employeeId: l.employee_id,
    deductedFrom: l.deducted_from, extra: l.extra ?? 0, leaveYear: l.leave_year,
  };
}

function iterDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  while (cur <= endD) {
    dates.push(cur.toISOString().split('T')[0]!);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function getExcludedDates(userId: string, start: string, end: string, holidayCache?: Map<string, any[]>): Set<string> {
  const excluded = new Set<string>();
  const cur = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  while (cur <= endD) {
    if (cur.getUTCDay() === 0) excluded.add(cur.toISOString().split('T')[0]!);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const holidays = holidayCache?.get(`${start}:${end}`) ?? db.prepare('SELECT id, date FROM holidays WHERE date BETWEEN ? AND ?').all(start, end) as any[];
  if (holidayCache) holidayCache.set(`${start}:${end}`, holidays);

  const holidayIds = holidays.map((h: any) => h.id);
  const userAssignees = new Set<string>();
  const allAssigneeHolidays = new Set<string>();
  if (holidayIds.length > 0) {
    const ph = holidayIds.map(() => '?').join(',');
    const assignees = db.prepare(`SELECT holiday_id, user_id FROM holiday_assignees WHERE holiday_id IN (${ph})`).all(...holidayIds) as any[];
    for (const a of assignees) {
      allAssigneeHolidays.add(a.holiday_id);
      if (a.user_id === userId) userAssignees.add(a.holiday_id);
    }
  }

  for (const h of holidays) {
    if (userAssignees.has(h.id)) { excluded.add(h.date); continue; }
    if (!allAssigneeHolidays.has(h.id)) excluded.add(h.date);
  }
  return excluded;
}

function countWorkingDays(userId: string, start: string, end: string, holidayCache?: Map<string, any[]>): number {
  const excluded = getExcludedDates(userId, start, end, holidayCache);
  const cur = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  let count = 0;
  while (cur <= endD) {
    if (!excluded.has(cur.toISOString().split('T')[0]!)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function workingDates(userId: string, start: string, end: string): string[] {
  const excluded = getExcludedDates(userId, start, end);
  const dates: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  while (cur <= endD) {
    const iso = cur.toISOString().split('T')[0]!;
    if (!excluded.has(iso)) dates.push(iso);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function yearOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCFullYear();
}

function daysWithinYear(userId: string, start: string, end: string, year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const clampStart = start < yearStart ? yearStart : start;
  const clampEnd = end > yearEnd ? yearEnd : end;
  if (clampStart > clampEnd) return 0;
  const excluded = getExcludedDates(userId, clampStart, clampEnd);
  const cur = new Date(`${clampStart}T00:00:00Z`);
  const endD = new Date(`${clampEnd}T00:00:00Z`);
  let count = 0;
  while (cur <= endD) {
    if (!excluded.has(cur.toISOString().split('T')[0]!)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

interface LeaveUsage {
  used: number;      // days drawn from this year's available balance (28 + carryover)
  extraUsed: number; // days drawn beyond the available balance (extra leave, not carried)
  carryover: number; // cumulative unused balance carried into this year from all previous years
}

function computeUsage(userId: string, year: number): LeaveUsage {
  const requests = db.prepare(
    "SELECT id, start_date, end_date, status, leave_year FROM leaves WHERE user_id = ? AND status IN ('approved', 'pending')"
  ).all(userId) as any[];

  const byYear = new Map<number, number>();
  for (const r of requests) {
    const ry = r.leave_year ?? yearOf(r.start_date);
    byYear.set(ry, (byYear.get(ry) ?? 0) + daysWithinYear(userId, r.start_date, r.end_date, ry));
  }

  // Cumulative carryover: walk every year from the earliest year with leave up to targetYear-1.
  // available_Y = 28 + carryover_Y ; carryover_{Y+1} = max(0, available_Y - usedNonExtra_Y)
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const floorYear = years.length > 0 ? (years[0] as number) : year;
  let carryover = 0;
  for (let y = floorYear; y < year; y++) {
    const available = 28 + carryover;
    const totalUsed = byYear.get(y) ?? 0;
    carryover = available - Math.min(available, totalUsed);
  }

  const available = 28 + carryover;
  const totalUsed = byYear.get(year) ?? 0;
  const nonExtraUsed = Math.min(available, totalUsed);
  const extraUsed = totalUsed - nonExtraUsed;

  return { used: nonExtraUsed, extraUsed, carryover };
}

function computeRequestExtra(userId: string, year: number, requestedDays: number): number {
  const usage = computeUsage(userId, year);
  const usedSoFar = usage.used + usage.extraUsed; // days already attributed across all requests this year
  const available = Math.max(0, 28 + usage.carryover - usedSoFar);
  return Math.max(0, requestedDays - available);
}

export class LeavesService {
  static create(userId: string, input: any, role?: string) {
    const startDate = input.startDate.split('T')[0]!;
    const endDate = input.endDate.split('T')[0]!;
    const today = getISTDate();
    if (startDate < today) throw new AppError(400, 'Cannot apply for leave in the past');
    if (endDate < startDate) throw new AppError(400, 'End date must be on or after start date');
    const overlap = db.prepare("SELECT id FROM leaves WHERE user_id = ? AND status IN ('pending', 'approved') AND NOT (end_date < ? OR start_date > ?)").get(userId, startDate, endDate);
    if (overlap) throw new AppError(409, 'Leave request overlaps with existing leave');

    const deductedFrom = this.pickDeductionType(input.type);

    const isAutoApprove = role === 'director';
    const status = isAutoApprove ? 'approved' : 'pending';
    const leaveYear = yearOf(startDate);

    const leaveRecord = db.transaction(() => {
      const id = uuid();

      let extra = 0;
      if (isAutoApprove) {
        const dates = workingDates(userId, startDate, endDate);
        extra = computeRequestExtra(userId, leaveYear, dates.length);
      }

      db.prepare('INSERT INTO leaves (id, user_id, type, start_date, end_date, reason, status, deducted_from, leave_year, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, userId, input.type, startDate, endDate, input.reason ?? null, status, deductedFrom, leaveYear, extra);

      if (isAutoApprove) {
        const dates = workingDates(userId, startDate, endDate);
        const notes = `${input.type} leave - ${input.reason ?? ''}`;
        const CHUNK = 500;
        for (let i = 0; i < dates.length; i += CHUNK) {
          const chunk = dates.slice(i, i + CHUNK);
          const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
          const params: any[] = [];
          for (const d of chunk) { params.push(uuid(), userId, d, 'leave', notes); }
          params.push(notes);
          db.prepare(`INSERT INTO attendance (id, user_id, date, status, notes)
            VALUES ${placeholders}
            ON CONFLICT(user_id, date) DO UPDATE SET status = CASE WHEN attendance.status IN ${PROTECTED_STATUSES} THEN attendance.status ELSE 'leave' END, notes = CASE WHEN attendance.status IN ${PROTECTED_STATUSES} THEN attendance.notes ELSE ? END, updated_at = datetime('now')`).run(...params);
        }
        invalidateAnalyticsCache();

        const hrUsers = db.prepare("SELECT id FROM users WHERE role = 'hr'").all() as any[];
        const insertNotif = db.prepare('INSERT INTO notifications (id, recipient_id, sender_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const a of hrUsers) {
          insertNotif.run(uuid(), a.id, userId, 'Leave Auto-Approved', `${input.type} leave taken by director`, 'info', `/leaves/${id}`);
        }
        insertNotif.run(uuid(), userId, userId, 'Leave Auto-Approved', `Your ${input.type} leave has been auto-approved`, 'success', `/leaves/${id}`);
      } else {
        const admins = db.prepare("SELECT id FROM users WHERE role IN ('director', 'hr')").all() as any[];
        const insertNotif = db.prepare('INSERT INTO notifications (id, recipient_id, sender_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const a of admins) {
          insertNotif.run(uuid(), a.id, userId, 'Leave Requested', `${input.type} leave request pending review`, 'approval', `/leaves/${id}`);
        }
      }
      return mapLeave(db.prepare('SELECT l.*, u.first_name, u.last_name, u.employee_id FROM leaves l JOIN users u ON l.user_id = u.id WHERE l.id = ?').get(id));
    })();

    try {
      if (isAutoApprove) {
        getIO().to(`user:${userId}`).emit('leave:reviewed', leaveRecord);
        const hrUsers = db.prepare("SELECT id FROM users WHERE role = 'hr'").all() as any[];
        for (const a of hrUsers) getIO().to(`user:${a.id}`).emit('leave:applied', leaveRecord);
      } else {
        const admins = db.prepare("SELECT id FROM users WHERE role IN ('director', 'hr')").all() as any[];
        for (const a of admins) getIO().to(`user:${a.id}`).emit('leave:applied', leaveRecord);
      }
    } catch (e) { console.error('[Leaves] Socket emit failed:', e); }
    return leaveRecord;
  }

  static list(input: any, userId: string, role: string) {
    const { page = 1, limit = 20, status, statuses, type, startDate, endDate, userId: filterUserId } = input;
    const offset = (page - 1) * limit;
    const conds: string[] = []; const params: any[] = [];

    if (role === 'employee') { conds.push('l.user_id = ?'); params.push(userId); }
    else if (filterUserId) { conds.push('l.user_id = ?'); params.push(filterUserId); }
    if (status) { conds.push('l.status = ?'); params.push(status); }
    if (statuses && statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(',');
      conds.push(`l.status IN (${placeholders})`);
      params.push(...statuses);
    }
    if (type) { conds.push('l.type = ?'); params.push(type); }
    if (startDate) { conds.push('l.end_date >= ?'); params.push(startDate); }
    if (endDate) { conds.push('l.start_date <= ?'); params.push(endDate); }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const count = (db.prepare(`SELECT count(*) as c FROM leaves l ${where}`).get(...params) as any).c;
    const leaves = db.prepare(`SELECT l.*, u.first_name, u.last_name, u.employee_id FROM leaves l JOIN users u ON l.user_id = u.id ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { leaves: leaves.map(mapLeave), total: count, page, limit };
  }

  static getById(id: string, userId: string, role: string) {
    const l = db.prepare('SELECT id, user_id, type, start_date, end_date, reason, status, review_comment, reviewed_by_id, reviewed_at, deducted_from, created_at, updated_at FROM leaves WHERE id = ?').get(id) as any;
    if (!l) throw new AppError(404, 'Leave not found');
    if (role === 'employee' && l.user_id !== userId) throw new AppError(403, 'Forbidden');
    return mapLeave(l);
  }

  static getBalance(userId: string, year?: number) {
    const currentYear = year ?? new Date().getFullYear();
    const prevYear = currentYear - 1;
    const start = `${currentYear}-01-01`;
    const end = `${currentYear}-12-31`;

    const usage = computeUsage(userId, currentYear);
    const prevUsage = computeUsage(userId, prevYear);

    const rows = db.prepare(`SELECT type, start_date, end_date FROM leaves WHERE user_id = ? AND status IN ('approved', 'pending') AND start_date <= ? AND end_date >= ? ORDER BY created_at ASC`).all(userId, end, start) as any[];

    const pools: Record<string, number> = { casual: LEAVE_BALANCES.casual, sick: LEAVE_BALANCES.sick, paid: LEAVE_BALANCES.paid };
    const spillOrder = ['casual', 'sick', 'paid'] as const;
    const allHolidays = db.prepare('SELECT id, date FROM holidays WHERE date BETWEEN ? AND ?').all(start, end) as any[];
    const holidayCache = new Map<string, any[]>();
    holidayCache.set(`${start}:${end}`, allHolidays);

    for (const r of rows) {
      const clampStart = r.start_date > start ? r.start_date : start;
      const clampEnd = r.end_date < end ? r.end_date : end;
      const days = countWorkingDays(userId, clampStart, clampEnd, holidayCache);
      if (days <= 0) continue;

      let spill = days;
      const own = r.type as string;
      if (own in pools) {
        const take = Math.min(pools[own] ?? 0, spill);
        pools[own] = (pools[own] ?? 0) - take;
        spill -= take;
      }
      for (const o of spillOrder) {
        if (spill <= 0) break;
        if (o === own) continue;
        const take = Math.min(pools[o] ?? 0, spill);
        pools[o] = (pools[o] ?? 0) - take;
        spill -= take;
      }
    }

    const remainingOf = (t: 'casual' | 'sick' | 'paid') => Math.max(0, pools[t] ?? 0);
    const balances: Record<string, { total: number; used: number; remaining: number }> = {
      casual: { total: LEAVE_BALANCES.casual, used: LEAVE_BALANCES.casual - remainingOf('casual'), remaining: remainingOf('casual') },
      sick: { total: LEAVE_BALANCES.sick, used: LEAVE_BALANCES.sick - remainingOf('sick'), remaining: remainingOf('sick') },
      paid: { total: LEAVE_BALANCES.paid, used: LEAVE_BALANCES.paid - remainingOf('paid'), remaining: remainingOf('paid') },
    };

    const totalBalance = LEAVE_BALANCES.casual + LEAVE_BALANCES.sick + LEAVE_BALANCES.paid + usage.carryover;
    const totalRemaining = Math.max(0, totalBalance - usage.used);

    return {
      balances,
      totalUsed: usage.used,
      totalBalance: totalBalance,
      totalAvailable: totalBalance,
      totalRemaining,
      carryover: usage.carryover,
      extraUsed: usage.extraUsed,
      totalBreakdown: {
        used: usage.used,
        extraUsed: usage.extraUsed,
        carryover: usage.carryover,
        priorYearExtra: prevUsage.extraUsed,
      },
      year: currentYear,
    };
  }

  private static pickDeductionType(requestedType: string): string {
    return requestedType;
  }

  static review(id: string, reviewedById: string, status: string, comments?: string, role?: string) {
    const leave = db.prepare('SELECT id, user_id, type, start_date, end_date, reason, status FROM leaves WHERE id = ?').get(id) as any;
    if (!leave) throw new AppError(404, 'Leave not found');
    if (leave.status !== 'pending') throw new AppError(409, 'Leave not in reviewable state');
    if (role === 'hr' && leave.user_id === reviewedById) throw new AppError(403, 'HR cannot review their own leave request');

    db.transaction(() => {
      let extra = 0;
      let leaveYear: number | null = null;
      if (status === 'approved') {
        const dates = workingDates(leave.user_id, leave.start_date, leave.end_date);
        leaveYear = yearOf(leave.start_date);
        extra = computeRequestExtra(leave.user_id, leaveYear, dates.length);
      }
      db.prepare("UPDATE leaves SET status = ?, review_comment = ?, reviewed_by_id = ?, reviewed_at = datetime('now'), leave_year = COALESCE(?, leave_year), extra = CASE WHEN ? = 'approved' THEN ? ELSE extra END, updated_at = datetime('now') WHERE id = ?")
        .run(status, comments ?? null, reviewedById, leaveYear, status, extra, id);

      // When approved, create attendance records for each working date
      if (status === 'approved') {
        const dates = workingDates(leave.user_id, leave.start_date, leave.end_date);
        const notes = `${leave.type} leave - ${leave.reason ?? ''}`;
        const CHUNK = 500;
        for (let i = 0; i < dates.length; i += CHUNK) {
          const chunk = dates.slice(i, i + CHUNK);
          const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
          const params: any[] = [];
          for (const d of chunk) { params.push(uuid(), leave.user_id, d, 'leave', notes); }
          params.push(notes);
          db.prepare(`INSERT INTO attendance (id, user_id, date, status, notes)
            VALUES ${placeholders}
            ON CONFLICT(user_id, date) DO UPDATE SET status = CASE WHEN attendance.status IN ${PROTECTED_STATUSES} THEN attendance.status ELSE 'leave' END, notes = CASE WHEN attendance.status IN ${PROTECTED_STATUSES} THEN attendance.notes ELSE ? END, updated_at = datetime('now')`).run(...params);
        }
        invalidateAnalyticsCache();
      }

      db.prepare('INSERT INTO notifications (id, recipient_id, sender_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uuid(), leave.user_id, reviewedById, `Leave ${status}`, `Your ${leave.type} leave has been ${status}`, status === 'approved' ? 'success' : 'warning', `/leaves/${id}`);
    })();
    const updated = mapLeave(db.prepare('SELECT l.*, u.first_name, u.last_name, u.employee_id FROM leaves l JOIN users u ON l.user_id = u.id WHERE l.id = ?').get(id));
    try { getIO().to(`user:${leave.user_id}`).emit('leave:reviewed', updated); } catch (e) { console.error('[Leaves] Socket emit failed:', e); }
    return updated;
  }

  static cancel(id: string, userId: string, role: string) {
    if (role !== 'director' && role !== 'hr') throw new AppError(403, 'Only directors and HR can cancel leaves');
    const leave = db.prepare('SELECT id, user_id, type, start_date, end_date, status FROM leaves WHERE id = ?').get(id) as any;
    if (!leave) throw new AppError(404, 'Leave not found');
    if (role === 'hr' && leave.user_id === userId) throw new AppError(403, 'HR cannot cancel their own leave');
    if (leave.status !== 'approved') throw new AppError(409, 'Only approved leaves can be cancelled');

    const today = getISTDate();
    if (today >= leave.start_date && today <= leave.end_date) {
      const workedToday = db.prepare("SELECT 1 FROM attendance WHERE user_id = ? AND date = ? AND status IN ('present','work_end','on_break','half_day')").get(leave.user_id, today);
      if (workedToday) throw new AppError(409, 'Cannot cancel leave: the user has already worked today');
    }

    return db.transaction(() => {
      db.prepare("UPDATE leaves SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);
      const dates = iterDates(leave.start_date, leave.end_date);
      const placeholders = dates.map(() => '?').join(',');
      db.prepare(`UPDATE attendance SET status = 'absent', notes = NULL, updated_at = datetime('now') WHERE user_id = ? AND status = 'leave' AND date IN (${placeholders})`).run(leave.user_id, ...dates);
      invalidateAnalyticsCache();
      db.prepare("INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, old_values, new_values, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(uuid(), userId, 'cancel_leave', 'leave', id, JSON.stringify({ status: 'approved' }), JSON.stringify({ status: 'cancelled' }), null);
      return mapLeave(db.prepare('SELECT id, user_id, type, start_date, end_date, reason, status, review_comment, reviewed_by_id, reviewed_at, deducted_from, created_at, updated_at FROM leaves WHERE id = ?').get(id));
    })();
  }
}
