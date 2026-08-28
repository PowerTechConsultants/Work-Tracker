import { Request, Response, NextFunction } from 'express';

const DEFAULT_MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY ?? '100', 10);

export function concurrencyLimiter(maxConcurrent: number = DEFAULT_MAX_CONCURRENCY) {
  let active = 0;

  return (req: Request, res: Response, next: NextFunction) => {
    if (active >= maxConcurrent) {
      return res.status(429).json({ error: 'Too many concurrent requests. Try again.' });
    }

    active++;

    let released = false;
    const onDone = () => {
      if (released) return;
      released = true;
      active--;
    };

    res.on('finish', onDone);
    res.on('close', onDone);

    next();
  };
}
