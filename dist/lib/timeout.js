const DEFAULT_TIMEOUT_MS = Math.max(1000, parseInt(process.env.REQUEST_TIMEOUT_MS ?? '30000', 10) || 30000);
export function requestTimeout(ms = DEFAULT_TIMEOUT_MS) {
    return (req, res, next) => {
        res.setTimeout(ms, () => {
            if (!res.headersSent) {
                res.status(503).json({ error: 'Request timed out' });
            }
        });
        next();
    };
}
