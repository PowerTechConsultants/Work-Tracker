import crypto from 'crypto';

const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export function hashToken(token: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(token, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyTokenHash(token: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verify = crypto.pbkdf2Sync(token, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const verifyBuf = Buffer.from(verify, 'hex');
  if (hashBuf.length !== verifyBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, verifyBuf);
}

export function generateEmployeeId(seq: number): string {
  return `EMP-${String(seq).padStart(4, '0')}`;
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  const masked = user[0] + '***' + (user.length > 1 ? user[user.length - 1] : '');
  return `${masked}@${domain}`;
}
