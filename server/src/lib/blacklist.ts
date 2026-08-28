import db from '../db';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

// Marks a user as revoked from now (epoch seconds). Any access token issued
// *before* this timestamp is considered revoked until the entry expires,
// while tokens issued afterwards (e.g. from a fresh login) stay valid.
export function revokeUserTokens(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare("INSERT OR REPLACE INTO token_blacklist (user_id, revoked_at, expires_at) VALUES (?, ?, datetime('now', '+' || ? || ' seconds'))").run(userId, String(now), ACCESS_TOKEN_TTL_SECONDS);
}

export function isTokenRevoked(userId: string, issuedAt?: number): boolean {
  const row = db.prepare("SELECT revoked_at FROM token_blacklist WHERE user_id = ? AND expires_at > datetime('now')").get(userId) as any;
  if (!row) return false;
  const revokedAt = Number(row.revoked_at);
  if (isNaN(revokedAt)) return true;
  return revokedAt > (issuedAt ?? 0);
}

export function cleanupExpiredBlacklistEntries() {
  db.prepare("DELETE FROM token_blacklist WHERE expires_at <= datetime('now')").run();
}
