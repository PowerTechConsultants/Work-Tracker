import { ZodError } from 'zod';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validate(schema, source = 'body') {
    return (req, res, next) => {
        try {
            req[source] = schema.parse(req[source]);
            next();
        }
        catch (err) {
            if (err instanceof ZodError) {
                console.warn(`[VALIDATION] ${req.method} ${req.path} - ${err.errors.length} error(s):`, err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '));
                res.status(400).json({
                    error: 'Validation failed',
                    details: err.errors.map((e) => ({
                        path: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(err);
        }
    };
}
export function requireUuid(...paramNames) {
    return (req, res, next) => {
        for (const name of paramNames) {
            const val = req.params[name];
            if (val !== undefined && val !== null && !UUID_RE.test(val)) {
                res.status(400).json({ error: `Invalid ${name} format` });
                return;
            }
        }
        next();
    };
}
