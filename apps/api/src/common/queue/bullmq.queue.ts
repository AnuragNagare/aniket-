import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../../config/env.js';
import { QUEUE_NAME, type JobData, type JobName, type JobQueue } from './job-queue.js';

@Injectable()
export class BullmqQueue implements JobQueue, OnModuleDestroy {
  private queue: Queue | null = null;
  private connection: Redis | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (this.env.REDIS_URL) {
      this.connection = new Redis(this.env.REDIS_URL, { maxRetriesPerRequest: null });
      this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    }
  }

  async add<N extends JobName>(
    name: N,
    data: JobData[N],
    opts?: { jobId?: string; delayMs?: number },
  ): Promise<void> {
    if (!this.queue) throw new Error('BullmqQueue connection not available');
    await this.queue.add(name, data, {
      jobId: opts?.jobId,
      delay: opts?.delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async schedule<N extends JobName>(name: N, everyMs: number): Promise<void> {
    if (!this.queue) throw new Error('BullmqQueue connection not available');
    await this.queue.upsertJobScheduler(name, { every: everyMs });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) await this.queue.close();
    if (this.connection) await this.connection.quit();
  }
}
