import db from '../db/index.js';
const DEFAULT_POLICY = {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
    maxAgeDays: 90,
    historyCount: 5,
};
export async function getPasswordPolicy() {
    try {
        const row = await db.prepare('SELECT * FROM password_policies LIMIT 1').get();
        if (!row)
            return DEFAULT_POLICY;
        return {
            minLength: row.min_length,
            requireUppercase: !!row.require_uppercase,
            requireLowercase: !!row.require_lowercase,
            requireNumber: !!row.require_number,
            requireSpecial: !!row.require_special,
            maxAgeDays: row.max_age_days,
            historyCount: row.history_count,
        };
    }
    catch {
        return DEFAULT_POLICY;
    }
}
export async function validatePassword(password, policy) {
    const p = policy ?? await getPasswordPolicy();
    const errors = [];
    if (password.length < p.minLength) {
        errors.push(`Password must be at least ${p.minLength} characters long`);
    }
    if (p.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (p.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (p.requireNumber && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (p.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    return { valid: errors.length === 0, errors };
}
export async function checkPasswordHistory(userId, newPassword, policy) {
    const p = policy ?? await getPasswordPolicy();
    if (p.historyCount <= 0)
        return true;
    const rows = await db.prepare('SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, p.historyCount);
    const bcrypt = (await import('bcrypt')).default;
    for (const row of rows) {
        const matches = await bcrypt.compare(newPassword, row.password_hash);
        if (matches)
            return false;
    }
    return true;
}
export async function recordPassword(userId, hash) {
    const policy = await getPasswordPolicy();
    const id = (await import('crypto')).randomUUID();
    await db.prepare('INSERT INTO password_history (id, user_id, password_hash) VALUES (?, ?, ?)').run(id, userId, hash);
    if (policy.historyCount > 0) {
        await db.prepare(`DELETE FROM password_history WHERE user_id = ? AND id NOT IN (
        SELECT id FROM (SELECT id FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?) AS tmp
      )`).run(userId, userId, policy.historyCount);
    }
}
export async function isPasswordExpired(userId) {
    try {
        const policy = await getPasswordPolicy();
        if (policy.maxAgeDays <= 0)
            return false;
        const row = await db.prepare("SELECT created_at FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId);
        if (!row) {
            const userRow = await db.prepare("SELECT created_at FROM users WHERE id = ?").get(userId);
            if (!userRow)
                return false;
            const created = new Date(userRow.created_at + 'Z');
            const diffMs = Date.now() - created.getTime();
            return diffMs > policy.maxAgeDays * 24 * 60 * 60 * 1000;
        }
        const created = new Date(row.created_at + 'Z');
        const diffMs = Date.now() - created.getTime();
        return diffMs > policy.maxAgeDays * 24 * 60 * 60 * 1000;
    }
    catch {
        return false;
    }
}
export async function updatePasswordPolicy(updates) {
    const current = await getPasswordPolicy();
    const merged = { ...current, ...updates };
    const row = await db.prepare('SELECT id FROM password_policies LIMIT 1').get();
    if (row) {
        await db.prepare(`UPDATE password_policies SET
        min_length = ?, require_uppercase = ?, require_lowercase = ?,
        require_number = ?, require_special = ?, max_age_days = ?,
        history_count = ?, updated_at = datetime('now')
      WHERE id = ?`).run(merged.minLength, merged.requireUppercase ? 1 : 0, merged.requireLowercase ? 1 : 0, merged.requireNumber ? 1 : 0, merged.requireSpecial ? 1 : 0, merged.maxAgeDays, merged.historyCount, row.id);
    }
    else {
        const { randomUUID } = await import('crypto');
        await db.prepare(`INSERT INTO password_policies (id, min_length, require_uppercase, require_lowercase, require_number, require_special, max_age_days, history_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), merged.minLength, merged.requireUppercase ? 1 : 0, merged.requireLowercase ? 1 : 0, merged.requireNumber ? 1 : 0, merged.requireSpecial ? 1 : 0, merged.maxAgeDays, merged.historyCount);
    }
    return merged;
}
