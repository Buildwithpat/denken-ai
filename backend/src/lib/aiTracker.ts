/**
 * AI usage tracking and cost observability.
 *
 * Every call to the AI service is logged with:
 *  - userId, endpoint, model, estimated tokens, latency, cache hit/miss
 *
 * Daily counters are stored in Redis for quota enforcement.
 * Structured log lines go to winston for log aggregation / dashboards.
 */

import { cacheIncr, cacheGetCount, CacheKey, TTL } from './cache';
import { logger } from './logger';

// ── Token estimation ──────────────────────────────────────────────────────────

// ~4 chars per token (rough GPT/Gemini approximation)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateRequestTokens(body: unknown): number {
  return estimateTokens(JSON.stringify(body));
}

// ── Gemini 1.5 Flash cost reference (USD per 1K tokens) ──────────────────────
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gemini-1.5-flash':  { input: 0.000075, output: 0.0003  },
  'gemini-1.5-pro':    { input: 0.00125,  output: 0.005   },
  default:             { input: 0.000075, output: 0.0003  },
};

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1K[model] ?? COST_PER_1K['default']!;
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

// ── Date string for daily buckets ─────────────────────────────────────────────

function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface AICallRecord {
  userId:       string;
  endpoint:     string;
  model?:       string;
  requestBody?: unknown;
  responseBody?: unknown;
  latencyMs:    number;
  cacheHit:     boolean;
  error?:       string;
}

/** Record one AI service call. Logs to winston and increments Redis counters. */
export async function trackAICall(rec: AICallRecord): Promise<void> {
  const model         = rec.model ?? 'gemini-1.5-flash';
  const inputTokens   = rec.requestBody  ? estimateRequestTokens(rec.requestBody)  : 0;
  const outputTokens  = rec.responseBody ? estimateTokens(JSON.stringify(rec.responseBody)) : 0;
  const estimatedCost = estimateCostUsd(model, inputTokens, outputTokens);

  // Structured log entry
  logger.info('ai_call', {
    userId:       rec.userId,
    endpoint:     rec.endpoint,
    model,
    inputTokens,
    outputTokens,
    estimatedCostUsd: parseFloat(estimatedCost.toFixed(6)),
    latencyMs:    rec.latencyMs,
    cacheHit:     rec.cacheHit,
    error:        rec.error,
  });

  // Increment daily counters (fire-and-forget — never block response)
  if (!rec.cacheHit) {
    const date = todayYYYYMMDD();
    void Promise.all([
      cacheIncr(CacheKey.aiUsage(rec.userId, date, 'total'),    TTL.AI_USAGE_COUNTER),
      cacheIncr(CacheKey.aiUsage(rec.userId, date, rec.endpoint), TTL.AI_USAGE_COUNTER),
    ]);
  }
}

// ── Quota helpers ─────────────────────────────────────────────────────────────

export interface QuotaLimits {
  totalPerDay:    number;
  mentorPerDay:   number;
  practicePerDay: number;
}

export const FREE_QUOTA:  QuotaLimits = { totalPerDay: 20,  mentorPerDay: 5,  practicePerDay: 10 };
export const PRO_QUOTA:   QuotaLimits = { totalPerDay: 200, mentorPerDay: 100, practicePerDay: 150 };

/** Returns the current daily usage counts for a user. */
export async function getDailyUsage(
  userId: string,
): Promise<{ total: number; mentor: number; practice: number }> {
  const date = todayYYYYMMDD();
  const [total, mentor, practice] = await Promise.all([
    cacheGetCount(CacheKey.aiUsage(userId, date, 'total')),
    cacheGetCount(CacheKey.aiUsage(userId, date, '/mentor/chat')),
    cacheGetCount(CacheKey.aiUsage(userId, date, '/adaptive/concept-guidance')),
  ]);
  return { total, mentor, practice };
}

/** Returns true if the user is within quota for the given endpoint. */
export async function isWithinQuota(
  userId:   string,
  endpoint: string,
  isPro:    boolean,
): Promise<boolean> {
  const quota  = isPro ? PRO_QUOTA : FREE_QUOTA;
  const date   = todayYYYYMMDD();

  const [total, ep] = await Promise.all([
    cacheGetCount(CacheKey.aiUsage(userId, date, 'total')),
    cacheGetCount(CacheKey.aiUsage(userId, date, endpoint)),
  ]);

  if (total >= quota.totalPerDay) return false;
  if (endpoint === '/mentor/chat' && ep >= quota.mentorPerDay) return false;
  if (endpoint.includes('concept-guidance') && ep >= quota.practicePerDay) return false;
  return true;
}
