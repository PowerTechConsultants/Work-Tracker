import db, { uuid } from '../../db';
import { AppError } from '../../lib/app-error';

function mapDepartment(d: any) {
  return { id: d.id, name: d.name, description: d.description, managerId: d.manager_id, createdAt: d.created_at, updatedAt: d.updated_at };
}

export class DepartmentsService {
  static list() {
    const rows = db.prepare('SELECT * FROM departments ORDER BY name').all() as any[];
    return rows.map(mapDepartment);
  }

  static getById(id: string) {
    const d = db.prepare('SELECT * FROM departments WHERE id = ?').get(id) as any;
    if (!d) throw new AppError(404, 'Department not found');
    return mapDepartment(d);
  }

  static create(input: any) {
    if (db.prepare('SELECT id FROM departments WHERE name = ?').get(input.name)) throw new AppError(409, 'Name already exists');
    const id = uuid();
    db.prepare('INSERT INTO departments (id, name, description, manager_id) VALUES (?, ?, ?, ?)').run(id, input.name, input.description ?? null, input.managerId ?? null);
    return this.getById(id);
  }

  static update(id: string, input: any) {
    this.getById(id);
    const sets = ["updated_at = datetime('now')"]; const params: any[] = [];
    if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
    if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description); }
    if (input.managerId !== undefined) { sets.push('manager_id = ?'); params.push(input.managerId); }
    params.push(id);
    db.prepare(`UPDATE departments SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  static delete(id: string) {
    this.getById(id);
    const count = (db.prepare('SELECT count(*) as c FROM users WHERE department_id = ?').get(id) as any).c;
    if (count > 0) throw new AppError(409, 'Cannot delete department with employees');
    db.prepare('DELETE FROM departments WHERE id = ?').run(id);
    return { message: 'Department deleted' };
  }

  static getStats() { return { total: (db.prepare('SELECT count(*) as c FROM departments').get() as any).c }; }
}
