import { Injectable, Logger } from '@nestjs/common';
import { JobRouter } from './job-router.js';
import type { JobData, JobName, JobQueue } from './job-queue.js';

@Injectable()
export class InlineQueue implements JobQueue {
  private readonly log = new Logger(InlineQueue.name);

  constructor(private readonly router: JobRouter) {}

  async add<N extends JobName>(
    name: N,
    data: JobData[N],
    _opts?: { jobId?: string; delayMs?: number },
  ): Promise<void> {
    setImmediate(() => {
      this.router.run(name, data).catch((err) => {
        this.log.error(
          `Inline job ${name} failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      });
    });
  }
}
