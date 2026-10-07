import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { JobData, JobName } from './job-queue.js';
import { PeriodSummaryService } from '../../modules/summaries/services/period-summary.service.js';
import { SummarySweeperService } from '../../modules/summaries/services/summary-sweeper.service.js';
import { UpdateSummaryService } from '../../modules/summaries/services/update-summary.service.js';

@Injectable()
export class JobRouter {
  private readonly log = new Logger(JobRouter.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  async run<N extends JobName>(
    name: N,
    data: JobData[N],
    opts: { finalAttempt?: boolean } = {},
  ): Promise<void> {
    switch (name) {
      case 'update.summarise': {
        const d = data as JobData['update.summarise'];
        const svc = this.moduleRef.get(UpdateSummaryService, { strict: false });
        await svc.process(d.updateId, opts);
        break;
      }
      case 'period.summarise': {
        const d = data as JobData['period.summarise'];
        const svc = this.moduleRef.get(PeriodSummaryService, { strict: false });
        await svc.process(d.summaryId, opts);
        break;
      }
      case 'report.generate': {
        const d = data as JobData['report.generate'];
        const svc = this.moduleRef.get<{ process: (id: string, opts?: { finalAttempt?: boolean }) => Promise<void> }>('ReportProcessor', { strict: false });
        if (svc) await svc.process(d.reportId, opts);
        break;
      }
      case 'maintenance.sweep': {
        const svc = this.moduleRef.get(SummarySweeperService, { strict: false });
        await svc.sweep();
        break;
      }
      default:
        this.log.warn(`Unknown job name: ${name}`);
    }
  }
}
