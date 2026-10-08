import './instrument.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Worker, UnrecoverableError } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV, type Env } from './config/env.js';
import { JobRouter } from './common/queue/job-router.js';
import { QUEUE_NAME } from './common/queue/job-queue.js';
import { RetryableJobError } from './common/queue/job-errors.js';
import { BullmqQueue } from './common/queue/bullmq.queue.js';
import { WorkerModule } from './worker.module.js';

const ctx = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: false });
const env = ctx.get<Env>(ENV);
const router = ctx.get(JobRouter);
const log = new Logger('worker');
const connection = new Redis(env.REDIS_URL!, { maxRetriesPerRequest: null });

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    try {
      await router.run(job.name as any, job.data as any, {
        finalAttempt: (job.attemptsMade + 1) >= (job.opts.attempts ?? 3),
      });
    } catch (e) {
      // Only network/rate-limit/5xx failures are worth BullMQ retrying; everything else is final.
      if (e instanceof RetryableJobError) throw e;
      throw new UnrecoverableError(e instanceof Error ? e.message : String(e));
    }
  },
  { connection, concurrency: 4 },
);
worker.on('failed', (job, err) =>
  log.warn(JSON.stringify({ job: job?.name, id: job?.id, attemptsMade: job?.attemptsMade, error: err.message })),
);

// Sweep every 2 minutes
const bQueue = ctx.get(BullmqQueue);
await bQueue.schedule('maintenance.sweep', 120_000);
await bQueue.scheduleCron('maintenance.retention', '0 2 * * *', 'Asia/Kolkata');
log.log('Worker ready');

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await worker.close();
    await connection.quit();
    await ctx.close();
    process.exit(0);
  });
}
