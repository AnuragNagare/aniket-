import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { BullmqQueue } from './bullmq.queue.js';
import { InlineQueue } from './inline.queue.js';
import { JOB_QUEUE } from './job-queue.js';
import { JobRouter } from './job-router.js';

@Global()
@Module({
  providers: [
    JobRouter,
    BullmqQueue,
    InlineQueue,
    {
      provide: JOB_QUEUE,
      useFactory: (env: Env, bullmq: BullmqQueue, inline: InlineQueue) => {
        if (env.QUEUE_DRIVER === 'bullmq') return bullmq;
        return inline;
      },
      inject: [ENV, BullmqQueue, InlineQueue],
    },
  ],
  exports: [JOB_QUEUE, JobRouter, BullmqQueue, InlineQueue],
})
export class QueueModule {}
