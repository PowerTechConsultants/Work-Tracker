import bcrypt from 'bcrypt';
import db, { uuid } from '../../db';
import { AppError } from '../../lib/app-error';
import { bcryptBreaker } from '../../lib/circuit-breaker';

const SALT_ROUNDS = 12;

function mapUser(u: any) {
  return {
    id: u.id, employeeId: u.employee_id, firstName: u.first_name, lastName: u.last_name,
    email: u.email, role: u.role, status: u.status, departmentId: u.department_id,
    designation: u.designation, phoneNumber: u.phone_number, joiningDate: u.joining_date,
    createdAt: u.created_at, updatedAt: u.updated_at,
  };
}

export function nextEmployeeId(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const maxSeq = (db.prepare("SELECT MAX(CAST(SUBSTR(employee_id, 5) AS INTEGER)) as max_seq FROM users").get() as any).max_seq ?? 0;
    const candidate = `EMP-${String(maxSeq + 1).padStart(4, '0')}`;
    const exists = db.prepare('SELECT 1 FROM users WHERE employee_id = ?').get(candidate);
    if (!exists) return candidate;
  }
  throw new AppError(500, 'Unable to allocate a unique employee ID');
}

export class UsersService {
  static list(input: any) {
    const { page = 1, limit = 20, role, status, departmentId, search } = input;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (role) { conditions.push('role = ?'); params.push(role); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (departmentId) { conditions.push('department_id = ?'); params.push(departmentId); }
    if (search) { const escaped = search.replace(/[\\%_]/g, '\\$&'); conditions.push('(first_name LIKE ? ESCAPE "\\" OR last_name LIKE ? ESCAPE "\\" OR email LIKE ? ESCAPE "\\" OR employee_id LIKE ? ESCAPE "\\")'); params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`, `%${escaped}%`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = (db.prepare(`SELECT count(*) as c FROM users ${where}`).get(...params) as any).c;
    const rows = db.prepare(`SELECT id, employee_id, first_name, last_name, email, role, designation, department_id, status, phone_number, joining_date, profile_picture_url, created_at, updated_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { users: rows.map(mapUser), total: count, page, limit };
  }

  static getById(id: string) {
    const u = db.prepare('SELECT id, employee_id, first_name, last_name, email, role, status, department_id, designation, phone_number, joining_date, profile_picture_url, two_factor_enabled, last_login_at, created_at, updated_at FROM users WHERE id = ?').get(id) as any;
    if (!u) throw new AppError(404, 'User not found');
    return mapUser(u);
  }

  static async create(input: any) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email);
    if (existing) throw new AppError(409, 'Email already exists');
    const employeeId = nextEmployeeId();
    const id = uuid();
    const passwordHash = await bcryptBreaker.call(() => bcrypt.hash(input.password, SALT_ROUNDS));
    db.prepare(`INSERT INTO users (id, employee_id, first_name, last_name, email, password_hash, role, phone_number, department_id, designation, joining_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, employeeId, input.firstName, input.lastName, input.email, passwordHash, input.role, input.phoneNumber ?? null, input.departmentId ?? null, input.designation ?? null, input.joiningDate ?? null);
    return this.getById(id);
  }

  static update(id: string, input: any) {
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(id)) throw new AppError(404, 'User not found');
    if (input.email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(input.email, id);
      if (existing) throw new AppError(409, 'Email already exists');
    }
    const allowedFields = ['firstName', 'lastName', 'email', 'phoneNumber', 'departmentId', 'designation', 'joiningDate', 'status', 'role'];
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: any[] = [];
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined || !allowedFields.includes(k)) continue;
      const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
      sets.push(`${col} = ?`);
      params.push(v);
    }
    params.push(id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  static delete(id: string, input: any) {
    if (input.confirm !== 'DELETE') throw new AppError(400, 'Deleting a user requires confirm=DELETE in the request body');
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(id)) throw new AppError(404, 'User not found');

    const tasks = (db.prepare('SELECT COUNT(*) as c FROM tasks WHERE created_by_id = ?').get(id) as any).c;
    if (tasks > 0) throw new AppError(409, `Cannot delete user: they created ${tasks} task(s). Delete or reassign those tasks first.`);
    const holidays = (db.prepare('SELECT COUNT(*) as c FROM holidays WHERE created_by = ?').get(id) as any).c;
    if (holidays > 0) throw new AppError(409, `Cannot delete user: they created ${holidays} holiday(s). Delete those holidays first.`);

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { message: 'User deleted' };
  }

  static getStats() {
    const stats = db.prepare('SELECT role, COUNT(*) as count, SUM(CASE WHEN status = \'active\' THEN 1 ELSE 0 END) as active FROM users GROUP BY role').all() as any[];
    const total = stats.reduce((sum: number, r: any) => sum + r.count, 0);
    const active = stats.reduce((sum: number, r: any) => sum + (r.active || 0), 0);
    const roleMap = Object.fromEntries(stats.map((r: any) => [r.role, r.count]));
    return { total, active, admins: roleMap.director || 0, hrs: roleMap.hr || 0, employees: roleMap.employee || 0 };
  }
}
