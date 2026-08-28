import db from '../../db';
import { AppError } from '../../lib/app-error';

export class TeamsService {
  static list() {
    const rows = db.prepare(`SELECT tm.team_name, tm.user_id, u.first_name, u.last_name, u.email, u.role, tm.role as member_role
      FROM team_members tm JOIN users u ON tm.user_id = u.id ORDER BY tm.team_name`).all() as any[];
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const arr = map.get(r.team_name) ?? [];
      arr.push({ userId: r.user_id, firstName: r.first_name, lastName: r.last_name, email: r.email, role: r.role, memberRole: r.member_role });
      map.set(r.team_name, arr);
    }
    return Array.from(map.entries()).map(([teamName, members]) => ({ teamName, members, memberCount: members.length }));
  }

  static getMyTeams(userId: string) {
    const rows = db.prepare(`SELECT tm.team_name, tm.user_id, u.first_name, u.last_name, u.email, u.role, tm.role as member_role
      FROM team_members tm JOIN users u ON tm.user_id = u.id WHERE tm.team_name IN (SELECT team_name FROM team_members WHERE user_id = ?) ORDER BY tm.team_name`).all(userId) as any[];
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const arr = map.get(r.team_name) ?? [];
      arr.push({ userId: r.user_id, firstName: r.first_name, lastName: r.last_name, email: r.email, role: r.role, memberRole: r.member_role });
      map.set(r.team_name, arr);
    }
    return Array.from(map.entries()).map(([teamName, members]) => ({ teamName, members, memberCount: members.length }));
  }

  static getByName(teamName: string) {
    const rows = db.prepare(`SELECT tm.user_id, u.first_name, u.last_name, u.email, u.role, u.employee_id, tm.role as member_role
      FROM team_members tm JOIN users u ON tm.user_id = u.id WHERE tm.team_name = ?`).all(teamName) as any[];
    if (rows.length === 0) throw new AppError(404, 'Team not found');
    return { teamName, members: rows.map((r: any) => ({ userId: r.user_id, firstName: r.first_name, lastName: r.last_name, email: r.email, role: r.role, employeeId: r.employee_id, memberRole: r.member_role })), memberCount: rows.length };
  }

  static create(input: { teamName: string; memberIds: string[]; leaderId?: string }) {
    const c = (db.prepare('SELECT count(*) as c FROM team_members WHERE team_name = ?').get(input.teamName) as any).c;
    if (c > 0) throw new AppError(409, 'Team name already exists');
    db.transaction(() => {
      const ph = input.memberIds.map(() => '(?, ?, ?)').join(', ');
      const p: any[] = [];
      for (const uid of input.memberIds) {
        p.push(uid, input.teamName, uid === input.leaderId ? 'leader' : 'member');
      }
      db.prepare(`INSERT INTO team_members (user_id, team_name, role) VALUES ${ph}`).run(...p);
    })();
    return this.getByName(input.teamName);
  }

  static update(teamName: string, input: { memberIds: string[]; leaderId?: string }) {
    const exists = (db.prepare('SELECT count(*) as c FROM team_members WHERE team_name = ?').get(teamName) as any).c;
    if (exists === 0) throw new AppError(404, 'Team not found');
    db.transaction(() => {
      db.prepare('DELETE FROM team_members WHERE team_name = ?').run(teamName);
      const ph = input.memberIds.map(() => '(?, ?, ?)').join(', ');
      const p: any[] = [];
      for (const uid of input.memberIds) {
        p.push(uid, teamName, uid === input.leaderId ? 'leader' : 'member');
      }
      db.prepare(`INSERT INTO team_members (user_id, team_name, role) VALUES ${ph}`).run(...p);
    })();
    return this.getByName(teamName);
  }

  static delete(teamName: string) {
    const c = (db.prepare('SELECT count(*) as c FROM team_members WHERE team_name = ?').get(teamName) as any).c;
    if (c === 0) throw new AppError(404, 'Team not found');
    db.prepare('DELETE FROM team_members WHERE team_name = ?').run(teamName);
    return { message: 'Team deleted' };
  }

  static addMembers(teamName: string, userIds: string[]) {
    return db.transaction(() => {
      const exists = (db.prepare('SELECT count(*) as c FROM team_members WHERE team_name = ?').get(teamName) as any).c;
      if (exists === 0) throw new AppError(404, 'Team not found');
      const ph = userIds.map(() => '(?, ?, ?)').join(', ');
      const p: any[] = [];
      for (const uid of userIds) { p.push(uid, teamName, 'member'); }
      db.prepare(`INSERT OR IGNORE INTO team_members (user_id, team_name, role) VALUES ${ph}`).run(...p);
      return this.getByName(teamName);
    })();
  }

  static removeMembers(teamName: string, userIds: string[]) {
    return db.transaction(() => {
      db.prepare(`DELETE FROM team_members WHERE team_name = ? AND user_id IN (${userIds.map(() => '?').join(',')})`).run(teamName, ...userIds);
      const remaining = (db.prepare('SELECT count(*) as c FROM team_members WHERE team_name = ?').get(teamName) as any).c;
      if (remaining === 0) {
        db.prepare('DELETE FROM team_members WHERE team_name = ?').run(teamName);
        return { message: 'Team deleted (no members remaining)' };
      }
      return this.getByName(teamName);
    })();
  }

  static getTeamsWithStats() {
    const teams = this.list();
    return teams.map((t: any) => {
      const avgCompletion = db.prepare(`
        SELECT ROUND(AVG(CASE WHEN t.status = 'completed' THEN 100.0 ELSE t.progress_percent END), 0) as avg_progress
        FROM tasks t
        JOIN task_assignments ta ON t.id = ta.task_id
        WHERE ta.user_id IN (${t.members.map(() => '?').join(',')})
      `).get(...t.members.map((m: any) => m.userId)) as any;
      return { ...t, avgTaskProgress: avgCompletion?.avg_progress ?? 0 };
    });
  }
}
