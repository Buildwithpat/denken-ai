import mongoose from 'mongoose';

const MAX_RETRIES        = 5;
const RETRY_DELAY_MS     = 3_000;
const BG_RECONNECT_MS    = 30_000; // dev-mode background reconnect interval

const MONGOOSE_OPTS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 10_000,  // give Atlas 10 s to respond before timing out
  connectTimeoutMS:         15_000,
  heartbeatFrequencyMS:     10_000,
  retryWrites:              true,
};

// ── Connection event logging ──────────────────────────────────────────────────
mongoose.connection.on('connected',    () => console.log('[DB] state → connected'));
mongoose.connection.on('disconnected', () => console.log('[DB] state → disconnected'));
mongoose.connection.on('reconnected',  () => console.log('[DB] state → reconnected ✓'));
mongoose.connection.on('error',        (err: Error) => console.error('[DB] error:', err.message));

function diagnose(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (/ReplicaSetNoPrimary|server selection timed out/i.test(msg)) {
    return (
      'Atlas could not be reached (ReplicaSetNoPrimary / server-selection timeout).\n' +
      '  Most likely cause: this IP is not whitelisted in Atlas Network Access.\n' +
      `  Current public IP : ${process.env._PUBLIC_IP ?? '(run: curl https://api.ipify.org)'}\n` +
      '  Fix: Atlas → Network Access → Add IP Address → add your IP or 0.0.0.0/0 for dev.'
    );
  }

  if (/authentication failed|bad auth|AuthenticationFailed/i.test(msg)) {
    return (
      'Atlas authentication failed.\n' +
      '  Check MONGO_URI credentials (username / password) in .env.\n' +
      '  Also ensure the DB user has readWrite access to the target database.'
    );
  }

  if (/querySrv|ENOTFOUND|DNS/i.test(msg)) {
    return (
      'DNS resolution for the Atlas cluster failed.\n' +
      '  Verify the cluster hostname in MONGO_URI is correct and you have internet access.'
    );
  }

  return msg;
}

async function attemptConnect(uri: string, attempt: number): Promise<void> {
  console.log(`[DB] connecting to Atlas… (attempt ${attempt}/${MAX_RETRIES})`);
  await mongoose.connect(uri, MONGOOSE_OPTS);
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI;
  const isDev = (process.env.NODE_ENV ?? 'development') === 'development';

  if (!uri) {
    console.error('[DB] MONGO_URI is not set in environment. Add it to .env and restart.');
    process.exit(1);
  }

  // Mask credentials in log output
  const safeUri = uri.replace(/:\/\/[^@]+@/, '://<credentials>@');
  console.log(`[DB] target → ${safeUri}`);

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await attemptConnect(uri, attempt);
      console.log('[DB] MongoDB Atlas connected ✓');
      return;
    } catch (err) {
      lastError = err;
      const detail = diagnose(err);
      console.error(`[DB] attempt ${attempt} failed:\n  ${detail.replace(/\n/g, '\n  ')}`);

      if (attempt < MAX_RETRIES) {
        console.log(`[DB] retrying in ${RETRY_DELAY_MS / 1000} s…`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  // All retries exhausted
  console.error('[DB] ──────────────────────────────────────────────────────');
  console.error('[DB] All connection attempts failed. Final diagnosis:');
  console.error(`[DB] ${diagnose(lastError).replace(/\n/g, '\n[DB] ')}`);
  console.error('[DB] ──────────────────────────────────────────────────────');

  if (isDev) {
    // Keep the server running so nodemon doesn't thrash.
    // Start a background reconnect loop — recovers automatically once the IP
    // is whitelisted in Atlas without needing a server restart.
    console.warn('[DB] Running WITHOUT a database connection (dev mode).');
    console.warn(`[DB] Background reconnect will retry every ${BG_RECONNECT_MS / 1000} s.`);
    scheduleBackgroundReconnect(uri);
  } else {
    process.exit(1);
  }
}

function scheduleBackgroundReconnect(uri: string): void {
  const timer = setInterval(async () => {
    // Skip if already connected or connecting
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      clearInterval(timer);
      return;
    }

    console.log('[DB] Background reconnect attempt…');
    try {
      await mongoose.connect(uri, MONGOOSE_OPTS);
      console.log('[DB] Background reconnect succeeded ✓');
      clearInterval(timer);
    } catch {
      // Silent — next tick will retry; diagnose() output already shown at startup
    }
  }, BG_RECONNECT_MS);

  // Don't let this timer prevent the process from exiting cleanly on SIGINT/SIGTERM
  timer.unref();
}
