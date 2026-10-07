import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { FILE_STORAGE, type FileStorage } from '../../../common/storage/file-storage.js';
import { JOB_QUEUE, type JobQueue } from '../../../common/queue/job-queue.js';
import { ENV, type Env } from '../../../config/env.js';
import { PrismaService } from '../../../database/prisma.service.js';

@Injectable()
export class SummarySweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SummarySweeperService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    if (this.env.QUEUE_DRIVER === 'inline' && this.env.NODE_ENV !== 'test') {
      this.timer = setInterval(() => {
        void this.sweep().catch((err) => this.log.error(String(err)));
      }, 120_000);
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async sweep(): Promise<void> {
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60_000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60_000);

    // 1. Stuck work updates
    const stuckUpdates = await this.prisma.workUpdate.findMany({
      where: {
        OR: [
          { summaryStatus: 'QUEUED', submittedAt: { lt: twoMinutesAgo } },
          { summaryStatus: 'PROCESSING', summaryGeneratedAt: null, submittedAt: { lt: tenMinutesAgo } },
        ],
      },
      take: 200,
      select: { id: true },
    });

    for (const u of stuckUpdates) {
      void this.queue
        .add('update.summarise', { updateId: u.id }, { jobId: `update.summarise:${u.id}` })
        .catch((err) => this.log.warn(`Sweeper failed to queue update ${u.id}: ${String(err)}`));
    }

    // 2. Stuck generated summaries
    const stuckSummaries = await this.prisma.generatedSummary.findMany({
      where: {
        OR: [
          { status: 'QUEUED', requestedAt: { lt: twoMinutesAgo } },
          { status: 'PROCESSING', generatedAt: null, requestedAt: { lt: tenMinutesAgo } },
        ],
      },
      take: 200,
      select: { id: true },
    });

    for (const s of stuckSummaries) {
      void this.queue
        .add('period.summarise', { summaryId: s.id }, { jobId: `period.summarise:${s.id}` })
        .catch((err) => this.log.warn(`Sweeper failed to queue summary ${s.id}: ${String(err)}`));
    }

    // 3. Expired reports
    const expiredReports = await this.prisma.report.findMany({
      where: {
        expiresAt: { lt: now },
        storageKey: { not: null },
      },
      take: 200,
      select: { id: true, storageKey: true },
    });

    for (const r of expiredReports) {
      if (r.storageKey) {
        try {
          await this.storage.remove(r.storageKey);
        } catch (err) {
          this.log.warn(`Sweeper failed to remove file for report ${r.id}: ${String(err)}`);
        }
        await this.prisma.report.update({
          where: { id: r.id },
          data: { storageKey: null },
        });
      }
    }
  }
}
