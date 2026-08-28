import { Request, Response, NextFunction } from 'express';

const DEFAULT_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS ?? '30000', 10);

export function requestTimeout(ms: number = DEFAULT_TIMEOUT_MS) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setTimeout(ms, () => {
      if (!res.headersSent) {
        res.status(503).json({ error: 'Request timed out' });
      }
    });
    next();
  };
}
