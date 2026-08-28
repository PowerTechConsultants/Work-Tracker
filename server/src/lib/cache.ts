import db from '../db';

const getStmt = db.prepare("SELECT data FROM api_cache WHERE cache_key = ? AND expires_at > datetime('now')");
const setStmt = db.prepare("INSERT OR REPLACE INTO api_cache (cache_key, data, expires_at) VALUES (?, ?, datetime('now', ?))");
const delStmt = db.prepare('DELETE FROM api_cache WHERE cache_key = ?');
const delPrefixStmt = db.prepare('DELETE FROM api_cache WHERE cache_key LIKE ?');
const flushStmt = db.prepare('DELETE FROM api_cache');
const sizeStmt = db.prepare('SELECT COUNT(*) as c FROM api_cache');

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const L1_MAX_SIZE = 500;
const l1Cache = new Map<string, CacheEntry>();

function l1Get(key: string): any | undefined {
  const entry = l1Cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    l1Cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function l1Set(key: string, data: any, ttlMs: number): void {
  if (l1Cache.size >= L1_MAX_SIZE) {
    const firstKey = l1Cache.keys().next().value;
    if (firstKey) l1Cache.delete(firstKey);
  }
  l1Cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function l1Del(key: string): void {
  l1Cache.delete(key);
}

function l1DelByPrefix(prefix: string): void {
  for (const key of l1Cache.keys()) {
    if (key.startsWith(prefix)) l1Cache.delete(key);
  }
}

export const cache = {
  get(key: string): any | undefined {
    const l1 = l1Get(key);
    if (l1 !== undefined) return l1;

    const row = getStmt.get(key) as any;
    if (!row) return undefined;
    try {
      const data = JSON.parse(row.data);
      l1Set(key, data, 10_000);
      return data;
    } catch {
      return undefined;
    }
  },

  set(key: string, data: any, ttlMs: number): void {
    l1Set(key, data, ttlMs);
    const sec = Math.ceil(ttlMs / 1000);
    setStmt.run(key, JSON.stringify(data), `+${sec} seconds`);
  },

  del(key: string): void {
    l1Del(key);
    delStmt.run(key);
  },

  delByPrefix(prefix: string): void {
    l1DelByPrefix(prefix);
    delPrefixStmt.run(`${prefix}%`);
  },

  flush(): void {
    l1Cache.clear();
    flushStmt.run();
  },

  get size(): number {
    const row = sizeStmt.get() as any;
    return row?.c ?? 0;
  },
};
