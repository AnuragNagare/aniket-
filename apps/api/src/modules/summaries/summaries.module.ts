import { Module } from '@nestjs/common';
import { UpdateSummaryService } from './services/update-summary.service.js';

@Module({
  providers: [UpdateSummaryService],
  exports: [UpdateSummaryService],
})
export class SummariesModule {}
