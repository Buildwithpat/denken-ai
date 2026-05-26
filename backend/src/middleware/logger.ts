import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = Math.random().toString(36).slice(2, 10);

  // Attach requestId so downstream service logs can correlate
  (req as Request & { requestId: string }).requestId = requestId;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';

    logger[level](`${req.method} ${req.originalUrl}`, {
      requestId,
      status:   res.statusCode,
      ms,
      ip:       req.ip,
      ua:       req.headers['user-agent']?.slice(0, 80),
    });
  });

  next();
}
