import db from '../db';

interface IncrementResponse {
  totalHits: number;
  resetTime: Date | undefined;
}

interface StoreOptions {
  windowMs: number;
}

export class SQLiteStore {
  private windowMs = 60000;
  private keyPrefix: string;

  get prefix(): string {
    return this.keyPrefix;
  }

  constructor(prefix = '') {
    this.keyPrefix = prefix ? prefix + ':' : '';
  }

  init(options: StoreOptions) {
    this.windowMs = options.windowMs;
  }

  private prefixed(key: string): string {
    return this.keyPrefix + key;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const pk = this.prefixed(key);
    try {
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT hits, expires_at FROM rate_limits WHERE key = ?').get(pk) as any;

      if (!existing || existing.expires_at <= now) {
        const resetTime = new Date(Date.now() + this.windowMs);
        db.prepare('INSERT OR REPLACE INTO rate_limits (key, hits, expires_at) VALUES (?, 1, ?)').run(pk, resetTime.toISOString());
        return { totalHits: 1, resetTime };
      }

      db.prepare('UPDATE rate_limits SET hits = hits + 1 WHERE key = ?').run(pk);
      return { totalHits: existing.hits + 1, resetTime: new Date(existing.expires_at) };
    } catch (err) {
      console.error('[RATE-LIMIT] Store unavailable, failing open:', err);
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      db.prepare('UPDATE rate_limits SET hits = MAX(0, hits - 1) WHERE key = ?').run(this.prefixed(key));
    } catch (err) {
      console.error('[RATE-LIMIT] Store unavailable during decrement:', err);
    }
  }

  async resetKey(key: string): Promise<void> {
    db.prepare('DELETE FROM rate_limits WHERE key = ?').run(this.prefixed(key));
  }

  async resetAll(): Promise<void> {
    db.prepare('DELETE FROM rate_limits').run();
  }

  static resetExpired(): void {
    const now = new Date().toISOString();
    db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').run(now);
  }
}
