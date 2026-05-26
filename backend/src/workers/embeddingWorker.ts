/**
 * BullMQ worker — processes background embedding / RAG ingestion jobs.
 *
 * Jobs:
 *  ingest-formulas         — send formula batch to ai-service for ChromaDB ingestion
 *  sync-question-embeddings — embed new/updated bank questions into the questions collection
 */

import { Worker, Job } from 'bullmq';
import { env }         from '../config/env';
import { logger }      from '../lib/logger';
import type { EmbeddingJobData } from '../lib/queue';

export function startEmbeddingWorker(): Worker<EmbeddingJobData> | null {
  if (!env.REDIS_URL) {
    logger.warn('[Worker] Redis unavailable — embedding worker not started');
    return null;
  }

  const worker = new Worker<EmbeddingJobData>(
    'embeddings',
    async (job: Job<EmbeddingJobData>) => {
      const { type, payload } = job.data;
      logger.debug('[Worker] Processing embedding job', { type, jobId: job.id });

      const { aiServiceClient } = await import('../lib/aiServiceClient');

      if (type === 'ingest-formulas') {
        const result = await aiServiceClient.ingestFormulas(
          payload as Parameters<typeof aiServiceClient.ingestFormulas>[0],
          job.data.userId ?? 'worker',
        );
        if (!result) throw new Error('ai-service ingest-formulas returned null');
        logger.info('[Worker] Formula ingestion complete', { ingested: result.ingested, skipped: result.skipped });
      }
    },
    {
      connection:  { url: env.REDIS_URL },
      concurrency: 2, // embedding is CPU-intensive on the ai-service side
    },
  );

  worker.on('failed', (job, err) =>
    logger.error('[Worker] Embedding job failed', {
      jobId: job?.id,
      type:  job?.data.type,
      err:   err.message,
    }),
  );

  logger.info('[Worker] Embedding worker started');
  return worker;
}
