import db, { uuid } from '../../db/index.js';
import { AppError } from '../../lib/app-error.js';
import { getISTDate } from '../../lib/time.js';
function mapSchedule(r) {
    let recipients = [];
    try {
        recipients = r.recipients ? JSON.parse(r.recipients) : [];
    }
    catch {
        recipients = [];
    }
    return {
        id: r.id,
        templateId: r.template_id,
        userId: r.user_id,
        recipients,
        scheduleCron: r.schedule_cron,
        format: r.format,
        isActive: !!r.is_active,
        lastRunAt: r.last_run_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}
function mapResult(r) {
    return {
        id: r.id,
        scheduleId: r.schedule_id,
        status: r.status,
        filePath: r.file_path,
        errorMessage: r.error_message,
        createdAt: r.created_at,
    };
}
export class ScheduledReportsService {
    static async create(userId, input) {
        const template = await db.prepare('SELECT id FROM report_templates WHERE id = ?').get(input.templateId);
        if (!template)
            throw new AppError(404, 'Template not found');
        const id = uuid();
        await db.prepare(`INSERT INTO scheduled_reports (id, template_id, user_id, recipients, schedule_cron, format, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, input.templateId, userId, JSON.stringify(input.recipients ?? []), input.scheduleCron, input.format, input.isActive ? 1 : 0);
        return mapSchedule(await db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(id));
    }
    static async list(input) {
        const { page = 1, limit = 20 } = input;
        const offset = (page - 1) * limit;
        const count = (await db.prepare('SELECT count(*) as c FROM scheduled_reports').get()).c;
        const schedules = await db.prepare('SELECT * FROM scheduled_reports ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
        return { schedules: schedules.map(mapSchedule), total: count, page, limit };
    }
    static async getById(id) {
        const row = await db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(id);
        if (!row)
            throw new AppError(404, 'Schedule not found');
        return mapSchedule(row);
    }
    static async update(id, userId, input, role) {
        const existing = await db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(id);
        if (!existing)
            throw new AppError(404, 'Schedule not found');
        if (role !== 'director' && role !== 'hr' && existing.user_id !== userId)
            throw new AppError(403, 'Cannot update others schedule');
        const sets = ["updated_at = datetime('now')"];
        const params = [];
        if (input.templateId !== undefined) {
            const tpl = await db.prepare('SELECT id FROM report_templates WHERE id = ?').get(input.templateId);
            if (!tpl)
                throw new AppError(404, 'Template not found');
            sets.push('template_id = ?');
            params.push(input.templateId);
        }
        if (input.recipients !== undefined) {
            sets.push('recipients = ?');
            params.push(JSON.stringify(input.recipients));
        }
        if (input.scheduleCron !== undefined) {
            sets.push('schedule_cron = ?');
            params.push(input.scheduleCron);
        }
        if (input.format !== undefined) {
            sets.push('format = ?');
            params.push(input.format);
        }
        if (input.isActive !== undefined) {
            sets.push('is_active = ?');
            params.push(input.isActive ? 1 : 0);
        }
        params.push(id);
        await db.prepare(`UPDATE scheduled_reports SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        return mapSchedule(await db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(id));
    }
    static async delete(id, userId, role) {
        const existing = await db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(id);
        if (!existing)
            throw new AppError(404, 'Schedule not found');
        if (role !== 'director' && role !== 'hr' && existing.user_id !== userId) {
            throw new AppError(403, 'Cannot delete others schedule');
        }
        await db.prepare('DELETE FROM scheduled_reports WHERE id = ?').run(id);
        return { message: 'Schedule deleted' };
    }
    static async runNow(id) {
        const schedule = await db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(id);
        if (!schedule)
            throw new AppError(404, 'Schedule not found');
        const resultId = uuid();
        await db.prepare(`INSERT INTO scheduled_report_results (id, schedule_id, status) VALUES (?, ?, 'running')`).run(resultId, id);
        try {
            const template = await db.prepare('SELECT * FROM report_templates WHERE id = ?').get(schedule.template_id);
            // Generate report data based on template type
            let reportData = {};
            const today = getISTDate();
            if (template?.type === 'daily') {
                const reports = await db.prepare('SELECT * FROM work_reports WHERE date = ?').all(today);
                reportData = { date: today, reports, count: reports.length };
            }
            else if (template?.type === 'weekly') {
                const now = new Date();
                now.setDate(now.getDate() - 7);
                const weekAgo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
                const reports = await db.prepare('SELECT * FROM work_reports WHERE date >= ? AND date <= ?').all(weekAgo, today);
                reportData = { startDate: weekAgo, reports, count: reports.length };
            }
            else {
                const allReports = await db.prepare('SELECT * FROM work_reports ORDER BY date DESC LIMIT 100').all();
                reportData = { reports: allReports, count: allReports.length };
            }
            const filePath = null;
            await db.prepare(`UPDATE scheduled_report_results SET status = 'completed', file_path = ?, result_data = ? WHERE id = ?`).run(filePath, JSON.stringify(reportData), resultId);
            await db.prepare(`UPDATE scheduled_reports SET last_run_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(id);
            return mapResult(await db.prepare('SELECT * FROM scheduled_report_results WHERE id = ?').get(resultId));
        }
        catch (err) {
            await db.prepare(`UPDATE scheduled_report_results SET status = 'failed', error_message = ? WHERE id = ?`).run(err.message ?? 'Unknown error', resultId);
            return mapResult(await db.prepare('SELECT * FROM scheduled_report_results WHERE id = ?').get(resultId));
        }
    }
    static async getResults(scheduleId) {
        const schedule = await db.prepare('SELECT id FROM scheduled_reports WHERE id = ?').get(scheduleId);
        if (!schedule)
            throw new AppError(404, 'Schedule not found');
        const results = await db.prepare('SELECT * FROM scheduled_report_results WHERE schedule_id = ? ORDER BY created_at DESC').all(scheduleId);
        return results.map(mapResult);
    }
}
