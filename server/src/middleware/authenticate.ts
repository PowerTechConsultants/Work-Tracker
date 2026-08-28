import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import db from '../db';
import { isTokenRevoked } from '../lib/blacklist';

const userCache = new Map<string, { status: string; role: string; expiresAt: number }>();
const USER_CACHE_TTL_MS = 30_000;

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    if (isTokenRevoked(req.user.sub, req.user.iat)) {
      res.status(401).json({ error: 'Token revoked' });
      return;
    }

    const now = Date.now();
    const cached = userCache.get(req.user.sub);
    if (cached && cached.expiresAt > now) {
      if (cached.status !== 'active') {
        res.status(401).json({ error: 'Account is inactive or suspended' });
        return;
      }
      req.user.role = cached.role;
      next();
      return;
    }

    const user = db.prepare('SELECT status, role FROM users WHERE id = ?').get(req.user.sub) as any;
    if (!user || user.status !== 'active') {
      userCache.set(req.user.sub, { status: 'inactive', role: '', expiresAt: now + USER_CACHE_TTL_MS });
      res.status(401).json({ error: 'Account is inactive or suspended' });
      return;
    }

    userCache.set(req.user.sub, { status: user.status, role: user.role, expiresAt: now + USER_CACHE_TTL_MS });
    req.user.role = user.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}
