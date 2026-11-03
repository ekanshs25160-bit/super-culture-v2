import { Request, Response, NextFunction } from 'express';

export const requestDurationLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const roundedMs = Math.round(durationMs * 10) / 10;
    const path = req.originalUrl || req.url;
    const isSlow = durationMs > 1000;
    const slowTag = isSlow ? ' [SLOW > 1s]' : '';

    // Log format: method, path, status, ms (never logs headers, secrets, or request bodies)
    console.log(`[HTTP] ${req.method} ${path} ${res.statusCode} ${roundedMs}ms${slowTag}`);
  });

  next();
};
