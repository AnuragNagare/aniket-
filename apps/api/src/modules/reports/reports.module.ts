import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env.js';
import { EmployeeActivityModule } from '../employee-activity/employee-activity.module.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { SummariesModule } from '../summaries/summaries.module.js';
import { ReportsController } from './controllers/reports.controller.js';
import { FakePdfRenderer } from './pdf/fake-pdf-renderer.js';
import { PDF_RENDERER, PlaywrightPdfRenderer } from './pdf/pdf-renderer.js';
import { ReportDataService } from './services/report-data.service.js';
import { ReportProcessor } from './services/report.processor.js';
import { ReportsService } from './services/reports.service.js';

export const fakePdfRendererInstance = new FakePdfRenderer();

@Module({
  imports: [
    EmployeesModule,
    EmployeeActivityModule,
    SummariesModule,
  ],
  controllers: [ReportsController],
  providers: [
    ReportDataService,
    ReportsService,
    ReportProcessor,
    PlaywrightPdfRenderer,
    {
      provide: PDF_RENDERER,
      useFactory: (env: Env, playwright: PlaywrightPdfRenderer) => {
        if (env.NODE_ENV === 'test') {
          return fakePdfRendererInstance;
        }
        return playwright;
      },
      inject: [ENV, PlaywrightPdfRenderer],
    },
  ],
  exports: [ReportsService, ReportProcessor, PDF_RENDERER, ReportDataService],
})
export class ReportsModule {}
