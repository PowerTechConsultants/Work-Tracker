import db from '../db/index.js';
const L1_MAX_SIZE = 500;
const l1Cache = new Map();
function l1Get(key) {
    const entry = l1Cache.get(key);
    if (!entry)
        return undefined;
    if (entry.expiresAt <= Date.now()) {
        l1Cache.delete(key);
        return undefined;
    }
    return entry.data;
}
function l1Set(key, data, ttlMs) {
    if (l1Cache.size >= L1_MAX_SIZE) {
        const firstKey = l1Cache.keys().next().value;
        if (firstKey)
            l1Cache.delete(firstKey);
    }
    l1Cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
function l1Del(key) {
    l1Cache.delete(key);
}
function l1DelByPrefix(prefix) {
    for (const key of l1Cache.keys()) {
        if (key.startsWith(prefix))
            l1Cache.delete(key);
    }
}
function l1DelContaining(needle) {
    for (const key of l1Cache.keys()) {
        if (key.includes(needle))
            l1Cache.delete(key);
    }
}
export const cache = {
    async get(key) {
        const l1 = l1Get(key);
        if (l1 !== undefined)
            return l1;
        const row = await db.prepare("SELECT data FROM api_cache WHERE cache_key = ? AND expires_at > NOW()").get(key);
        if (!row)
            return undefined;
        try {
            const data = JSON.parse(row.data);
            l1Set(key, data, 10_000);
            return data;
        }
        catch {
            return undefined;
        }
    },
    async set(key, data, ttlMs) {
        l1Set(key, data, ttlMs);
        const sec = Math.ceil(ttlMs / 1000);
        await db.prepare("REPLACE INTO api_cache (cache_key, data, expires_at) VALUES (?, ?, NOW() + INTERVAL ? SECOND)").run(key, JSON.stringify(data), sec);
    },
    async del(key) {
        l1Del(key);
        await db.prepare('DELETE FROM api_cache WHERE cache_key = ?').run(key);
    },
    async delByPrefix(prefix) {
        l1DelByPrefix(prefix);
        const escaped = prefix.replace(/[%_]/g, '\\$&');
        await db.prepare("DELETE FROM api_cache WHERE cache_key LIKE ? ESCAPE '\\\\'").run(`${escaped}%`);
    },
    async delContaining(needle) {
        l1DelContaining(needle);
        const escaped = needle.replace(/[%_]/g, '\\$&');
        await db.prepare("DELETE FROM api_cache WHERE cache_key LIKE ? ESCAPE '\\\\'").run(`%${escaped}%`);
    },
    async flush() {
        l1Cache.clear();
        await db.prepare('DELETE FROM api_cache').run();
    },
    async size() {
        const row = await db.prepare('SELECT COUNT(*) as c FROM api_cache').get();
        return row?.c ?? 0;
    },
};
