import db from '../db';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

// Marks a user as revoked from now. Any access token issued
// *before* this timestamp is considered revoked until the entry expires,
// while tokens issued afterwards (e.g. from a fresh login) stay valid.
export async function revokeUserTokens(userId: string) {
  await db.prepare("INSERT INTO token_blacklist (user_id, revoked_at, expires_at) VALUES (?, NOW(), NOW() + INTERVAL ? SECOND) ON DUPLICATE KEY UPDATE revoked_at = NOW(), expires_at = NOW() + INTERVAL ? SECOND").run(userId, ACCESS_TOKEN_TTL_SECONDS, ACCESS_TOKEN_TTL_SECONDS);
}

export async function isTokenRevoked(userId: string, issuedAt?: number): Promise<boolean> {
  const row = await db.prepare("SELECT revoked_at FROM token_blacklist WHERE user_id = ? AND expires_at > NOW()").get(userId) as any;
  if (!row) return false;
  // revoked_at is a DATETIME string like '2024-01-15 10:30:00' — parse to timestamp
  const revokedTs = new Date(row.revoked_at).getTime() / 1000;
  if (isNaN(revokedTs)) return true;
  return revokedTs > (issuedAt ?? 0);
}

export async function cleanupExpiredBlacklistEntries() {
  await db.prepare("DELETE FROM token_blacklist WHERE expires_at <= NOW()").run();
}