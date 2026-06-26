import { Worker, type Job } from 'bullmq';
import type { JobRunner, JobPayload } from '../../domain/interfaces/queue.interface.js';
import { getRedisConnectionOptions } from './connection.js';
import { QUEUE_NAME } from './client.js';
import { logger } from '../logging/logger.js';

const CONCURRENCY = Number(process.env['WORKER_CONCURRENCY'] ?? 3);

export class QueueWorker {
  private readonly worker: Worker;
  private readonly jobStartTimes = new Map<string, bigint>();

  constructor(runner: JobRunner) {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        const id = job.id ?? 'unknown';
        this.jobStartTimes.set(id, process.hrtime.bigint());

        logger.info('Job dequeued', undefined, {
          jobId: id,
          name: job.name,
          enqueuedAt: job.timestamp,
          queueWaitMs: Date.now() - job.timestamp,
        });

        await runner({
          name: job.name,
          data: job.data as JobPayload,
          id,
        });
      },
      { connection: getRedisConnectionOptions(), concurrency: CONCURRENCY },
    );

    this.worker.on('completed', (job: Job) => {
      const id = job.id ?? 'unknown';
      const start = this.jobStartTimes.get(id);
      const durationMs = start ? Math.round(Number(process.hrtime.bigint() - start) / 1e6) : -1;
      this.jobStartTimes.delete(id);

      logger.info('Job completed', undefined, { jobId: id, name: job.name, durationMs });
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      const id = job?.id ?? 'unknown';
      const start = this.jobStartTimes.get(id);
      const durationMs = start ? Math.round(Number(process.hrtime.bigint() - start) / 1e6) : -1;
      this.jobStartTimes.delete(id);

      logger.error('Job failed', err, {
        jobId: id,
        name: job?.name,
        attempts: job?.attemptsMade,
        durationMs,
      });
    });

    this.worker.on('error', (err: Error) => {
      logger.error('Worker error', err);
    });

    this.worker.on('stalled', (jobId: string) => {
      logger.warn('Job stalled', undefined, { jobId });
    });
  }

  start(): void {
    logger.info('Worker started', undefined, { queue: QUEUE_NAME, concurrency: CONCURRENCY });
  }

  async stop(): Promise<void> {
    await this.worker.close();
    logger.info('Worker stopped');
  }
}
