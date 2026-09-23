import db from '../db/index.js';
export class RateLimitStore {
    windowMs = 60000;
    keyPrefix;
    get prefix() {
        return this.keyPrefix;
    }
    constructor(prefix = '') {
        this.keyPrefix = prefix ? prefix + ':' : '';
    }
    init(options) {
        this.windowMs = options.windowMs;
    }
    prefixed(key) {
        return this.keyPrefix + key;
    }
    async increment(key) {
        const pk = this.prefixed(key);
        try {
            const now = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
            const resetTime = new Date(Date.now() + this.windowMs);
            const resetStr = resetTime.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
            // Atomic: insert-or-update in one statement
            await db.prepare(`INSERT INTO rate_limits (\`key\`, hits, expires_at) VALUES (?, 1, ?)
         ON DUPLICATE KEY UPDATE
           hits = IF(expires_at <= ?, 1, hits + 1),
           expires_at = IF(expires_at <= ?, ?, expires_at)`).run(pk, resetStr, now, now, resetStr);
            // Read the current state after atomic upsert
            const row = await db.prepare('SELECT hits, expires_at FROM rate_limits WHERE `key` = ?').get(pk);
            return { totalHits: row?.hits ?? 1, resetTime: new Date(row?.expires_at ?? resetStr) };
        }
        catch (err) {
            console.error('[RATE-LIMIT] Store unavailable, failing open:', err);
            return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
        }
    }
    async decrement(key) {
        try {
            await db.prepare('UPDATE rate_limits SET hits = GREATEST(0, hits - 1) WHERE `key` = ?').run(this.prefixed(key));
        }
        catch (err) {
            console.error('[RATE-LIMIT] Store unavailable during decrement:', err);
        }
    }
    async resetKey(key) {
        await db.prepare('DELETE FROM rate_limits WHERE `key` = ?').run(this.prefixed(key));
    }
    async resetAll() {
        await db.prepare('DELETE FROM rate_limits').run();
    }
    static async resetExpired() {
        const now = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
        await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').run(now);
    }
}
export class SlidingWindowRateLimiter {
    store = new Map();
    cleanupInterval;
    constructor() {
        this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            entry.attempts = entry.attempts.filter(t => now - t < 3600_000);
            if (entry.attempts.length === 0)
                this.store.delete(key);
        }
    }
    async increment(key, windowMs, maxAttempts) {
        const now = Date.now();
        const entry = this.store.get(key) || { attempts: [] };
        entry.attempts = entry.attempts.filter(t => now - t < windowMs);
        if (entry.attempts.length >= maxAttempts) {
            const oldestAttempt = entry.attempts[0];
            const retryAfterMs = windowMs - (now - oldestAttempt);
            return { allowed: false, retryAfterMs, attempts: entry.attempts.length };
        }
        entry.attempts.push(now);
        this.store.set(key, entry);
        return { allowed: true, retryAfterMs: 0, attempts: entry.attempts.length };
    }
    async getAttempts(key, windowMs) {
        const now = Date.now();
        const entry = this.store.get(key) || { attempts: [] };
        entry.attempts = entry.attempts.filter(t => now - t < windowMs);
        if (entry.attempts.length === 0) {
            this.store.delete(key);
            return 0;
        }
        return entry.attempts.length;
    }
    async reset(key) {
        this.store.delete(key);
    }
    destroy() {
        clearInterval(this.cleanupInterval);
    }
}
