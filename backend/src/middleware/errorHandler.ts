import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;

  if (env.NODE_ENV === 'production') {
    // In production: log message only, never expose internal paths or stack
    logger.error('[errorHandler]', {
      method:     req.method,
      path:       req.path,
      statusCode,
      message:    err.message,
    });
  } else {
    // In development: full stack for debugging
    logger.error(`[errorHandler] ${req.method} ${req.path} → ${statusCode}`, {
      stack: err.stack ?? String(err),
    });
  }

  const message =
    env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : (err.message || String(err));

  res.status(statusCode).json({ error: message });
}
