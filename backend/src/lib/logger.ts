/**
 * Application-wide structured logger.
 *
 * In production: JSON lines (log aggregators / Datadog / CloudWatch).
 * In development: colorized, human-readable output via winston's simple format.
 *
 * Usage:
 *   import { logger } from '../lib/logger';
 *   logger.info('Server started', { port: 5000 });
 *   logger.error('DB error', { err: err.message, userId });
 */

import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${ts} [${level}] ${message}${metaStr}`;
  }),
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

export const logger = winston.createLogger({
  level:       env.NODE_ENV === 'production' ? 'info' : 'debug',
  format:      env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports:  [new winston.transports.Console()],
  exitOnError: false,
});

// ── Child logger factory ──────────────────────────────────────────────────────

/** Create a scoped child logger that always includes a `service` metadata field. */
export function serviceLogger(service: string) {
  return logger.child({ service });
}
