import db from '../../db';
import { getISTDate } from '../../lib/time';

export class AnalyticsService {
  static attendanceTrends(year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const rows = db.prepare(`SELECT date, status, count(*) as count FROM attendance
      WHERE date >= ? AND date <= ? GROUP BY date, status ORDER BY date`).all(start, end) as any[];

    const daily: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!daily[r.date]) daily[r.date] = {};
      const day = daily[r.date]!;
      day[r.status] = r.count;
    }

    const result = [];
    for (let d = 1; d <= lastDay; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayStats = daily[date] ?? {};
      result.push({
        date,
        present: dayStats.present ?? 0,
        absent: dayStats.absent ?? 0,
        leave: dayStats.leave ?? 0,
        holiday: dayStats.holiday ?? 0,
        half_day: dayStats.half_day ?? 0,
        on_break: dayStats.on_break ?? 0,
        work_end: dayStats.work_end ?? 0,
        total: Object.values(dayStats).reduce((a: number, b: any) => a + b, 0),
      });
    }
    return result;
  }

  static departmentStats() {
    const totalUsers = (db.prepare("SELECT count(*) as c FROM users WHERE status = 'active'").get() as any).c;

    const deptRows = db.prepare(`SELECT d.id, d.name, count(u.id) as user_count FROM departments d
      LEFT JOIN users u ON u.department_id = d.id AND u.status = 'active' GROUP BY d.id ORDER BY d.name`).all() as any[];

    const today = getISTDate();
    const attendanceRows = db.prepare(`SELECT u.department_id, a.status, count(*) as count FROM attendance a
      JOIN users u ON a.user_id = u.id WHERE a.date = ? AND u.department_id IS NOT NULL GROUP BY u.department_id, a.status`).all(today) as any[];

    const deptMap = new Map<string, { present: number; absent: number; leave: number; holiday: number; total: number }>();
    for (const d of deptRows) {
      deptMap.set(d.id, { present: 0, absent: 0, leave: 0, holiday: 0, total: d.user_count });
    }
    for (const r of attendanceRows) {
      const stat = deptMap.get(r.department_id);
      if (stat) {
        if (r.status === 'present' || r.status === 'work_end' || r.status === 'on_break' || r.status === 'half_day') stat.present += r.count;
        else if (r.status === 'absent') stat.absent += r.count;
        else if (r.status === 'leave') stat.leave += r.count;
        else if (r.status === 'holiday') stat.holiday += r.count;
      }
    }

    return {
      totalUsers,
      departments: Array.from(deptMap.entries()).map(([id, s]) => {
        const expected = s.total - s.leave - s.holiday;
        return {
          id, name: deptRows.find((d: any) => d.id === id)?.name ?? 'Unknown',
          total: s.total, present: s.present, absent: s.absent,
          attendanceRate: expected > 0 ? Math.round((s.present / expected) * 100) : 0,
        };
      }),
    };
  }

  static leaveUsage(year: number) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const leaves = db.prepare(`SELECT l.type, l.start_date, l.end_date FROM leaves l
      WHERE l.status = 'approved' AND l.start_date <= ? AND l.end_date >= ?`).all(end, start) as any[];

    const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const monthLabels = months.map((m) => ({
      month: m, label: new Date(2000, parseInt(m) - 1, 1).toLocaleString('en-US', { month: 'short' }),
    }));
    const types = [...new Set(leaves.map((r: any) => r.type))] as string[];

    const monthlyMap = new Map<string, Record<string, number>>();
    for (const m of months) {
      const entry: Record<string, number> = {};
      for (const t of types) entry[t] = 0;
      monthlyMap.set(m, entry);
    }

    const totalByType: Record<string, number> = {};
    for (const t of types) totalByType[t] = 0;

    for (const l of leaves) {
      const parseDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
      const clipStart = parseDate(l.start_date) < parseDate(start) ? parseDate(start) : parseDate(l.start_date);
      const clipEnd = parseDate(l.end_date) > parseDate(end) ? parseDate(end) : parseDate(l.end_date);

      let cursor = new Date(clipStart);
      while (cursor <= clipEnd) {
        const dayOfWeek = cursor.getUTCDay();
        if (dayOfWeek !== 0) {
          const monthKey = String(cursor.getUTCMonth() + 1).padStart(2, '0');
          const entry = monthlyMap.get(monthKey);
          if (entry) entry[l.type] = (entry[l.type] ?? 0) + 1;
          totalByType[l.type] = (totalByType[l.type] ?? 0) + 1;
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    const result = monthLabels.map(({ month, label }) => ({
      month, label, ...monthlyMap.get(month),
    }));

    return { monthly: result, totals: totalByType };
  }

  static taskSummary() {
    const total = (db.prepare('SELECT count(*) as c FROM tasks').get() as any).c;
    const byStatus = db.prepare('SELECT status, count(*) as count FROM tasks GROUP BY status').all() as any[];
    const today = getISTDate();
    const overdue = (db.prepare("SELECT count(*) as c FROM tasks WHERE status NOT IN ('completed','cancelled') AND date(due_date) < ?").get(today) as any).c;
    const completionRate = total > 0 ? Math.round(((byStatus.find((s: any) => s.status === 'completed')?.count ?? 0) / total) * 100) : 0;

    return { total, byStatus, overdue, completionRate };
  }

  static overtimeAnalytics(year: number) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const rows = db.prepare(`
      SELECT u.department_id, d.name as dept_name,
        strftime('%m', a.date) as month,
        COALESCE(SUM(a.overtime_hours), 0) as total_overtime,
        COUNT(DISTINCT a.user_id) as user_count
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE a.date >= ? AND a.date <= ? AND a.overtime_hours > 0
      GROUP BY u.department_id, month
      ORDER BY month
    `).all(start, end) as any[];

    const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const monthlyMap = new Map<string, Record<string, number>>();
    for (const m of months) monthlyMap.set(m, {});

    for (const r of rows) {
      const entry = monthlyMap.get(r.month);
      if (entry) entry[r.dept_name ?? 'Unassigned'] = (entry[r.dept_name ?? 'Unassigned'] ?? 0) + r.total_overtime;
    }

    const departments = [...new Set(rows.map((r: any) => r.dept_name ?? 'Unassigned'))];
    const monthly = months.map((m) => {
      const entry = monthlyMap.get(m)!;
      const label = new Date(2000, parseInt(m) - 1, 1).toLocaleString('en-US', { month: 'short' });
      return { month: m, label, ...entry };
    });

    const totals = departments.reduce((acc: Record<string, number>, dept) => {
      acc[dept] = rows.filter((r: any) => (r.dept_name ?? 'Unassigned') === dept).reduce((s: number, r: any) => s + r.total_overtime, 0);
      return acc;
    }, {} as Record<string, number>);

    return { monthly, departments, totals };
  }
}
