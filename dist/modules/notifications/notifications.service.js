import db from '../../db/index.js';
import { AppError } from '../../lib/app-error.js';
function mapNotification(n) {
    return {
        id: n.id, recipientId: n.recipient_id, senderId: n.sender_id,
        title: n.title, message: n.message, type: n.type, link: n.link,
        channel: n.channel ?? 'in_app',
        isRead: n.read_at !== null, readAt: n.read_at, createdAt: n.created_at,
    };
}
export class NotificationsService {
    static async list(userId, input) {
        const { page = 1, limit = 20, unreadOnly } = typeof input === 'object' && input !== null ? input : { unreadOnly: input };
        const offset = (page - 1) * limit;
        const conds = ['recipient_id = ?'];
        const params = [userId];
        if (unreadOnly) {
            conds.push('read_at IS NULL');
        }
        const where = `WHERE ${conds.join(' AND ')}`;
        const total = (await db.prepare(`SELECT count(*) as c FROM notifications ${where}`).get(...params)).c;
        const rows = await db.prepare(`SELECT id, recipient_id, sender_id, title, message, type, link, channel, read_at, created_at FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
        const unreadCount = (await db.prepare('SELECT count(*) as c FROM notifications WHERE recipient_id = ? AND read_at IS NULL').get(userId)).c;
        return { notifications: rows.map(mapNotification), total, unreadCount, page, limit };
    }
    static async create(recipientId, senderId, title, message, type, link, channel = 'in_app') {
        const id = (await import('../../db/index.js')).uuid();
        await db.prepare('INSERT INTO notifications (id, recipient_id, sender_id, title, message, type, link, channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, recipientId, senderId, title, message, type, link ?? null, channel);
        return { id, recipientId, senderId, title, message, type, link, channel };
    }
    static async markRead(id, userId) {
        const n = await db.prepare('SELECT id FROM notifications WHERE id = ? AND recipient_id = ?').get(id, userId);
        if (!n)
            throw new AppError(404, 'Notification not found');
        await db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ?").run(id);
        return { message: 'Marked as read' };
    }
    static async markAllRead(userId) {
        await db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE recipient_id = ? AND read_at IS NULL").run(userId);
        return { message: 'All notifications marked as read' };
    }
    static async delete(id, userId) {
        const n = await db.prepare('SELECT id FROM notifications WHERE id = ? AND recipient_id = ?').get(id, userId);
        if (!n)
            throw new AppError(404, 'Notification not found');
        await db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
        return { message: 'Notification deleted' };
    }
    static async deleteAll(userId) {
        const result = await db.prepare('DELETE FROM notifications WHERE recipient_id = ?').run(userId);
        return { message: 'All notifications deleted', count: result.changes };
    }
    static async getStats(userId) {
        const stats = await db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as unread FROM notifications WHERE recipient_id = ?').get(userId);
        const channelStats = await db.prepare('SELECT channel, COUNT(*) as count FROM notifications WHERE recipient_id = ? GROUP BY channel').all(userId);
        return {
            total: stats.total || 0,
            unread: stats.unread || 0,
            byChannel: Object.fromEntries(channelStats.map((r) => [r.channel, r.count])),
        };
    }
}
