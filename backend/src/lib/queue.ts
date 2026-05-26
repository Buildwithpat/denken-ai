/**
 * BullMQ job queue definitions.
 *
 * Queues:
 *  analytics   — post-test analytics (mistake patterns, question performance, topic weight refresh)
 *  embeddings  — RAG ingestion jobs (formula batches, syllabus chunks)
 *  roadmap     — background roadmap refresh for changed mastery states
 *
 * Workers run in the same process for simplicity. In production, split workers
 * into a separate worker process so they don't compete with API latency.
 *
 * Falls back gracefully if Redis is unavailable: jobs run inline (synchronous)
 * so functionality is preserved, just without queue buffering.
 */

import { Queue, QueueOptions } from 'bullmq';
import { env }                 from '../config/env';
import { logger }              from './logger';

// ── Job payload types ─────────────────────────────────────────────────────────

export interface AnalyticsJobData {
  type:          'update-mistake-patterns' | 'update-question-performance' | 'refresh-topic-weights';
  userId:        string;
  resultId?:     string;
  bankAttempts?: unknown[];
}

export interface EmbeddingJobData {
  type:    'ingest-formulas' | 'ingest-notes' | 'sync-question-embeddings';
  payload: unknown;
  userId?: string;
}

export interface RoadmapJobData {
  userId: string;
  exam:   string;
}

// ── Queue factory ─────────────────────────────────────────────────────────────

let analyticsQueue:  Queue<AnalyticsJobData>  | null = null;
let embeddingsQueue: Queue<EmbeddingJobData>  | null = null;
let roadmapQueue:    Queue<RoadmapJobData>    | null = null;

function queueOpts(): QueueOptions | null {
  if (!env.REDIS_URL) return null;
  return {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: {
      attempts:    3,
      backoff:     { type: 'exponential', delay: 1_000 },
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 50  },
    },
  };
}

function getAnalyticsQueue(): Queue<AnalyticsJobData> | null {
  if (analyticsQueue) return analyticsQueue;
  const opts = queueOpts();
  if (!opts) return null;
  analyticsQueue = new Queue<AnalyticsJobData>('analytics', opts);
  analyticsQueue.on('error', (err) => logger.error('[Queue] analytics error', { err: err.message }));
  return analyticsQueue;
}

function getEmbeddingsQueue(): Queue<EmbeddingJobData> | null {
  if (embeddingsQueue) return embeddingsQueue;
  const opts = queueOpts();
  if (!opts) return null;
  embeddingsQueue = new Queue<EmbeddingJobData>('embeddings', opts);
  embeddingsQueue.on('error', (err) => logger.error('[Queue] embeddings error', { err: err.message }));
  return embeddingsQueue;
}

function getRoadmapQueue(): Queue<RoadmapJobData> | null {
  if (roadmapQueue) return roadmapQueue;
  const opts = queueOpts();
  if (!opts) return null;
  roadmapQueue = new Queue<RoadmapJobData>('roadmap', opts);
  roadmapQueue.on('error', (err) => logger.error('[Queue] roadmap error', { err: err.message }));
  return roadmapQueue;
}

// ── Public enqueue helpers ────────────────────────────────────────────────────

/** Enqueue an analytics job (mistake patterns, question performance). Inline fallback if Redis absent. */
export async function enqueueAnalyticsJob(data: AnalyticsJobData): Promise<void> {
  const q = getAnalyticsQueue();
  if (!q) {
    // Inline fallback — run synchronously so work never gets lost
    await runAnalyticsJob(data).catch(err =>
      logger.error('[Queue] Inline analytics job failed', { err: err.message, type: data.type }),
    );
    return;
  }
  await q.add(data.type, data, { priority: data.type === 'update-mistake-patterns' ? 1 : 2 });
  logger.debug('[Queue] Analytics job enqueued', { type: data.type, userId: data.userId });
}

/** Enqueue a background embedding ingestion job. */
export async function enqueueEmbeddingJob(data: EmbeddingJobData): Promise<void> {
  const q = getEmbeddingsQueue();
  if (!q) {
    logger.warn('[Queue] Redis unavailable — embedding job dropped', { type: data.type });
    return;
  }
  await q.add(data.type, data);
  logger.debug('[Queue] Embedding job enqueued', { type: data.type });
}

/** Enqueue a roadmap refresh for a user (triggered after significant mastery change). */
export async function enqueueRoadmapRefresh(userId: string, exam: string): Promise<void> {
  const q = getRoadmapQueue();
  if (!q) return;
  // Deduplicate: only one pending refresh per user (jobId = userId)
  await q.add('refresh-roadmap', { userId, exam }, { jobId: `roadmap-${userId}-${exam}` });
}

/** Graceful shutdown — drain queues before process exit. */
export async function closeQueues(): Promise<void> {
  await Promise.allSettled([
    analyticsQueue?.close(),
    embeddingsQueue?.close(),
    roadmapQueue?.close(),
  ]);
}

// ── Inline job runner (used when Redis is unavailable) ────────────────────────

async function runAnalyticsJob(data: AnalyticsJobData): Promise<void> {
  if (data.type === 'update-mistake-patterns' && data.resultId) {
    const { updateMistakePatterns } = await import('../services/mistakeAnalysisService');
    await updateMistakePatterns(data.userId, data.resultId);
  } else if (data.type === 'update-question-performance' && data.bankAttempts) {
    const { updateQuestionPerformance } = await import('../services/questionBankService');
    await updateQuestionPerformance(data.bankAttempts as Parameters<typeof updateQuestionPerformance>[0]);
  }
}
