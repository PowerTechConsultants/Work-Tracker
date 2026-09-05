import db, { uuid } from '../../db';
import { AppError } from '../../lib/app-error';
import type { CreateTemplateInput, UpdateTemplateInput, ListTemplatesInput } from './report-templates.schema';

function mapTemplate(r: any) {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description,
    type: r.type,
    fields: r.fields ? JSON.parse(r.fields) : [],
    isDefault: !!r.is_default,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class ReportTemplatesService {
  static async create(userId: string, input: CreateTemplateInput) {
    const id = uuid();
    await db.prepare(
      `INSERT INTO report_templates (id, user_id, name, description, type, fields, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      input.name,
      input.description ?? null,
      input.type,
      JSON.stringify(input.fields ?? []),
      input.isDefault ? 1 : 0,
    );
    return mapTemplate(await db.prepare('SELECT * FROM report_templates WHERE id = ?').get(id));
  }

  static async list(input: ListTemplatesInput) {
    const { page = 1, limit = 20 } = input;
    const offset = (page - 1) * limit;
    const count = (await db.prepare('SELECT count(*) as c FROM report_templates').get() as any).c;
    const templates = await db.prepare(
      'SELECT * FROM report_templates ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);
    return { templates: templates.map(mapTemplate), total: count, page, limit };
  }

  static async getById(id: string) {
    const row = await db.prepare('SELECT * FROM report_templates WHERE id = ?').get(id) as any;
    if (!row) throw new AppError(404, 'Template not found');
    return mapTemplate(row);
  }

  static async update(id: string, userId: string, input: UpdateTemplateInput) {
    const existing = await db.prepare('SELECT * FROM report_templates WHERE id = ?').get(id) as any;
    if (!existing) throw new AppError(404, 'Template not found');
    if (existing.user_id !== userId) throw new AppError(403, 'Cannot update others template');

    const sets = ["updated_at = datetime('now')"];
    const params: any[] = [];

    if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
    if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description); }
    if (input.type !== undefined) { sets.push('type = ?'); params.push(input.type); }
    if (input.fields !== undefined) { sets.push('fields = ?'); params.push(JSON.stringify(input.fields)); }
    if (input.isDefault !== undefined) { sets.push('is_default = ?'); params.push(input.isDefault ? 1 : 0); }

    params.push(id);
    await db.prepare(`UPDATE report_templates SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return mapTemplate(await db.prepare('SELECT * FROM report_templates WHERE id = ?').get(id));
  }

  static async delete(id: string, userId: string, role?: string) {
    const existing = await db.prepare('SELECT * FROM report_templates WHERE id = ?').get(id) as any;
    if (!existing) throw new AppError(404, 'Template not found');
    if (role !== 'director' && role !== 'hr' && existing.user_id !== userId) {
      throw new AppError(403, 'Cannot delete others template');
    }
    await db.prepare('DELETE FROM report_templates WHERE id = ?').run(id);
    return { message: 'Template deleted' };
  }
}
