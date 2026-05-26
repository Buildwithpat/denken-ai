/**
 * BullMQ worker — processes analytics jobs off the request path.
 *
 * Jobs:
 *  update-mistake-patterns    — classify and persist mistake patterns from a result
 *  update-question-performance — update per-question bank performance stats
 *  refresh-topic-weights      — recompute and warm the topic-weights cache for a user
 */

import { Worker, Job } from 'bullmq';
import { env }         from '../config/env';
import { logger }      from '../lib/logger';
import type { AnalyticsJobData } from '../lib/queue';

export function startAnalyticsWorker(): Worker<AnalyticsJobData> | null {
  if (!env.REDIS_URL) {
    logger.warn('[Worker] Redis unavailable — analytics worker not started');
    return null;
  }

  const worker = new Worker<AnalyticsJobData>(
    'analytics',
    async (job: Job<AnalyticsJobData>) => {
      const { type, userId, resultId, bankAttempts } = job.data;

      logger.debug('[Worker] Processing analytics job', { type, userId, jobId: job.id });

      if (type === 'update-mistake-patterns' && resultId) {
        const { updateMistakePatterns } = await import('../services/mistakeAnalysisService');
        await updateMistakePatterns(userId, resultId);
        logger.info('[Worker] Mistake patterns updated', { userId, resultId });
      }

      else if (type === 'update-question-performance' && bankAttempts?.length) {
        const { updateQuestionPerformance } = await import('../services/questionBankService');
        await updateQuestionPerformance(
          bankAttempts as Parameters<typeof updateQuestionPerformance>[0],
        );
        logger.info('[Worker] Question performance updated', { userId, count: bankAttempts.length });
      }

      else if (type === 'refresh-topic-weights') {
        // Force-recompute and warm the cache
        const { computeTopicWeights } = await import('../services/topicWeightService');
        await computeTopicWeights(userId);
        logger.info('[Worker] Topic weights refreshed and cached', { userId });
      }
    },
    {
      connection:  { url: env.REDIS_URL },
      concurrency: 5,
    },
  );

  worker.on('completed', (job) =>
    logger.debug('[Worker] Analytics job completed', { jobId: job.id, type: job.data.type }),
  );

  worker.on('failed', (job, err) =>
    logger.error('[Worker] Analytics job failed', {
      jobId: job?.id,
      type:  job?.data.type,
      err:   err.message,
      attempts: job?.attemptsMade,
    }),
  );

  logger.info('[Worker] Analytics worker started');
  return worker;
}
