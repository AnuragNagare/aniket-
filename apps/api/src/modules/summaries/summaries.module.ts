import { Module } from '@nestjs/common';
import { EmployeeActivityModule } from '../employee-activity/employee-activity.module.js';
import { SummariesController } from './controllers/summaries.controller.js';
import { PeriodSummaryService } from './services/period-summary.service.js';
import { SummarySweeperService } from './services/summary-sweeper.service.js';
import { UpdateSummaryService } from './services/update-summary.service.js';

@Module({
  imports: [EmployeeActivityModule],
  controllers: [SummariesController],
  providers: [UpdateSummaryService, PeriodSummaryService, SummarySweeperService],
  exports: [UpdateSummaryService, PeriodSummaryService, SummarySweeperService],
})
export class SummariesModule {}
