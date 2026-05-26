import dotenv from 'dotenv';
dotenv.config();

import https from 'https';
import app from './app';
import { connectDB }       from './config/db';
import { env }             from './config/env';
import { initFormulaLoader } from './lib/formulaLoader';
import { getRedis, closeRedis } from './lib/redis';
import { logger }          from './lib/logger';
import { closeQueues }     from './lib/queue';
import { startAnalyticsWorker } from './workers/analyticsWorker';
import { startEmbeddingWorker } from './workers/embeddingWorker';

/** Fetch the machine's public IP once at startup so error messages can print it. */
function fetchPublicIp(): Promise<void> {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org', { timeout: 4_000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        process.env._PUBLIC_IP = data.trim();
        resolve();
      });
    });
    req.on('error', () => resolve());   // non-fatal — just won't appear in error hints
    req.on('timeout', () => { req.destroy(); resolve(); });
  });
}

const startServer = async () => {
  // Prefetch public IP so Atlas IP-whitelist diagnostics can show it
  await fetchPublicIp();

  await connectDB();

  // Initialize Redis connection (non-blocking — caching degrades gracefully if absent)
  getRedis();

  // Start BullMQ workers (no-ops if Redis is unavailable)
  startAnalyticsWorker();
  startEmbeddingWorker();

  // Scan and cache formula dataset (non-blocking, fails gracefully)
  initFormulaLoader();

  const server = app.listen(env.PORT, () => {
    logger.info('Backend running', { port: env.PORT, env: env.NODE_ENV, devMode: env.DEV_MODE });
    if (env.DEV_MODE) {
      logger.info('Dev routes active → /api/dev/personas  /api/dev/set-persona');
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await Promise.allSettled([closeRedis(), closeQueues()]);
      process.exit(0);
    });
    // Force-exit after 10s if graceful shutdown hangs
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
};

startServer().catch((err: unknown) => {
  logger.error('Fatal startup error', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
