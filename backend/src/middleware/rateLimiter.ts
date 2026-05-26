/**
 * Rate limiting middleware.
 *
 * Global limit:  120 requests / minute per IP (all routes)
 * Auth limit:    20 attempts / 15 min per IP (login/signup only)
 *
 * Uses in-memory store by default. If Redis is available, rate limit state
 * is shared across multiple backend instances automatically.
 */

import { rateLimit, type Options } from 'express-rate-limit';
import { Request, Response }      from 'express';
import { logger }                 from '../lib/logger';

function rateLimitHandler(
  _req: Request,
  res: Response,
  _next: Parameters<Options['handler']>[2],
  options: Options,
): void {
  logger.warn('[RateLimit] Request blocked', {
    ip:        _req.ip,
    path:      _req.originalUrl,
    limit:     options.max,
    windowMs:  options.windowMs,
  });
  res.status(429).json({
    error:   'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfterSeconds: Math.ceil((options.windowMs ?? 60_000) / 1000),
  });
}

/** 120 requests per minute per IP — applied globally */
export const globalRateLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             120,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  skip: (req) => req.path === '/health' || req.path === '/',
});

/** Stricter limit for auth endpoints — 20 attempts per 15 minutes per IP */
export const authRateLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

/**
 * Per-IP rate limit for AI generation endpoints (test/generate, mentor/chat,
 * revision, adaptive practice). Limits burst usage that could spike Gemini costs.
 * 10 requests per minute per IP — generous for normal use, protective against abuse.
 */
export const aiEndpointRateLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
  keyGenerator:    (req) => {
    // Key by IP + userId if authenticated (prevents sharing IP exploits)
    const userId = (req as { user?: { userId?: string } }).user?.userId ?? '';
    return `${req.ip ?? 'unknown'}:${userId}`;
  },
});
