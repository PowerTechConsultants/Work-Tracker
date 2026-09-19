import { Request, Response, NextFunction } from 'express';
import { cache } from '../lib/cache.js';

interface ApiCacheOptions {
  ttl: number;
  key?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

export function apiCache(options: ApiCacheOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (options.condition && !options.condition(req)) return next();
      if (req.headers['cache-control']?.includes('no-cache') || req.headers['cache-control']?.includes('no-store')) return next();

      const cacheKey = options.key?.(req) || `${(req as any).user?.sub || (req as any).user?.role || 'anon'}:${req.originalUrl}`;
      const cached = await cache.get(cacheKey);

      if (cached !== undefined) {
        res.setHeader('X-Cache', 'HIT');
        res.json(cached);
        return;
      }

      res.setHeader('X-Cache', 'MISS');
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode < 400) {
          cache.set(cacheKey, body, options.ttl).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch {
      next();
    }
  };
}
