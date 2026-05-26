import express, { Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import routes from './routes/index';
import { requestLogger } from './middleware/logger';
import { globalRateLimiter, authRateLimiter } from './middleware/rateLimiter';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { razorpayWebhookHandler } from './controllers/webhookController';

const app = express();

// Tell Express to trust the first proxy hop (Render's load balancer).
// Without this, req.ip is the proxy's IP / an IPv6-mapped address on every
// request — breaking rate limiting and triggering ERR_ERL_KEY_GEN_IPV6.
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req: Request, res: Response, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://denken-ai.vercel.app',
    ];

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no Origin header (server-to-server, health checks)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  methods:         ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders:  ['Content-Type', 'Authorization'],
  credentials:     true,
  maxAge:          86400, // Pre-flight cache: 24h
};

// Respond to all OPTIONS preflight requests before any other middleware
// (rate limiter, auth, etc.) so browsers never get a non-CORS preflight response.
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(globalRateLimiter);

// ── Webhook — must receive raw body for HMAC, mounted before express.json() ──
app.post(
  '/api/webhook/razorpay',
  express.raw({ type: 'application/json' }),
  razorpayWebhookHandler as express.RequestHandler,
);

// ── Lightweight info + health routes ─────────────────────────────────────────
// Mounted BEFORE requestLogger so health pings don't fill the log.
// Mounted BEFORE app.use('/api', routes) and BEFORE notFound — always reachable.

const MONGO_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'] as const;

/** GET / — server liveness probe (no DB check) */
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    service:     'denken-ai-backend',
    status:      'running',
    environment: process.env.NODE_ENV ?? 'development',
    uptime_s:    Math.floor(process.uptime()),
    endpoints: {
      health: 'GET /health',
      api:    'GET /api',
    },
    timestamp: new Date().toISOString(),
  });
});

/** GET /health — full readiness probe including live DB state */
app.get('/health', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const healthy  = dbState === 1;
  const dbHost   = mongoose.connection.host ?? null;

  res.status(healthy ? 200 : 503).json({
    status:      healthy ? 'ok' : 'degraded',
    service:     'denken-ai-backend',
    environment: process.env.NODE_ENV ?? 'development',
    uptime_s:    Math.floor(process.uptime()),
    db: {
      state:   MONGO_STATES[dbState as 0 | 1 | 2 | 3] ?? 'unknown',
      ready:   healthy,
      host:    healthy ? dbHost : null,
    },
    timestamp: new Date().toISOString(),
  });
});

/** GET /api — API namespace directory */
app.get('/api', (_req: Request, res: Response) => {
  res.status(200).json({
    service:  'denken-ai-api',
    version:  '1.0.0',
    base:     '/api',
    namespaces: [
      '/api/auth',
      '/api/test',
      '/api/analytics',
      '/api/revision',
      '/api/notes',
      '/api/formula',
      '/api/planner',
      '/api/readiness',
      '/api/subscription',
      '/api/access',
      '/api/ocr',
      '/api/webhook/razorpay',
    ],
    docs: 'GET /health for readiness, GET / for liveness',
  });
});

// ── General middleware ────────────────────────────────────────────────────────
// 2 MB body limit — prevents DoS via oversized payloads
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', routes);


// ── Fallbacks ─────────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
