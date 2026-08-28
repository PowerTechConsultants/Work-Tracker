import db from '../../db';
import { AppError } from '../../lib/app-error';

function mapNotification(n: any) {
  return {
    id: n.id, recipientId: n.recipient_id, senderId: n.sender_id,
    title: n.title, message: n.message, type: n.type, link: n.link,
    isRead: n.read_at !== null, readAt: n.read_at, createdAt: n.created_at,
  };
}

export class NotificationsService {
  static list(userId: string, input: any) {
    const { page = 1, limit = 20, unreadOnly } = typeof input === 'object' && input !== null ? input : { unreadOnly: input };
    const offset = (page - 1) * limit;
    const conds: string[] = ['recipient_id = ?']; const params: any[] = [userId];
    if (unreadOnly) { conds.push('read_at IS NULL'); }
    const where = `WHERE ${conds.join(' AND ')}`;
    const rows = db.prepare(`SELECT id, recipient_id, sender_id, title, message, type, link, read_at, created_at FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const unreadCount = (db.prepare('SELECT count(*) as c FROM notifications WHERE recipient_id = ? AND read_at IS NULL').get(userId) as any).c;
    return { notifications: rows.map(mapNotification), total: rows.length, unreadCount, page, limit };
  }

  static markRead(id: string, userId: string) {
    const n = db.prepare('SELECT id FROM notifications WHERE id = ? AND recipient_id = ?').get(id, userId);
    if (!n) throw new AppError(404, 'Notification not found');
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ?").run(id);
    return { message: 'Marked as read' };
  }

  static markAllRead(userId: string) {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE recipient_id = ? AND read_at IS NULL").run(userId);
    return { message: 'All notifications marked as read' };
  }

  static delete(id: string, userId: string) {
    const n = db.prepare('SELECT id FROM notifications WHERE id = ? AND recipient_id = ?').get(id, userId);
    if (!n) throw new AppError(404, 'Notification not found');
    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return { message: 'Notification deleted' };
  }

  static getStats(userId: string) {
    const stats = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as unread FROM notifications WHERE recipient_id = ?').get(userId) as any;
    return { total: stats.total || 0, unread: stats.unread || 0 };
  }
}
