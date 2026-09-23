import { cache } from '../lib/cache.js';
export function apiCache(options) {
    return async (req, res, next) => {
        try {
            if (req.method !== 'GET' && req.method !== 'HEAD')
                return next();
            if (options.condition && !options.condition(req))
                return next();
            if (req.headers['cache-control']?.includes('no-cache') || req.headers['cache-control']?.includes('no-store'))
                return next();
            const cacheKey = options.key?.(req) || `${req.user?.sub || req.user?.role || 'anon'}:${req.originalUrl}`;
            const cached = await cache.get(cacheKey);
            if (cached !== undefined) {
                res.setHeader('X-Cache', 'HIT');
                res.json(cached);
                return;
            }
            res.setHeader('X-Cache', 'MISS');
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                if (res.statusCode < 400) {
                    cache.set(cacheKey, body, options.ttl).catch(() => { });
                }
                return originalJson(body);
            };
            next();
        }
        catch {
            next();
        }
    };
}
