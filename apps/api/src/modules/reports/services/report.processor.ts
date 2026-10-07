import { Inject, Injectable, Logger } from '@nestjs/common';
import { formatInTimeZone } from 'date-fns-tz';
import { FILE_STORAGE, type FileStorage } from '../../../common/storage/file-storage.js';
import { ENV, type Env } from '../../../config/env.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { PeriodSummaryService } from '../../summaries/services/period-summary.service.js';
import { PDF_RENDERER, type PdfRenderer } from '../pdf/pdf-renderer.js';
import { renderReportHtml } from '../pdf/report-html.js';
import { ReportDataService } from './report-data.service.js';

@Injectable()
export class ReportProcessor {
  private readonly log = new Logger('report');

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportDataService: ReportDataService,
    private readonly periodSummaryService: PeriodSummaryService,
    @Inject(PDF_RENDERER) private readonly pdfRenderer: PdfRenderer,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async process(reportId: string): Promise<void> {
    const claimed = await this.prisma.report.updateMany({
      where: { id: reportId, status: { in: ['QUEUED', 'GENERATING'] } },
      data: { status: 'GENERATING' },
    });
    if (claimed.count === 0) return;

    const report = await this.prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      include: { company: true, employee: true },
    });

    const tz = report.company.timezone;
    const from = formatInTimeZone(report.periodStart, tz, 'yyyy-MM-dd');
    const to = formatInTimeZone(new Date(report.periodEnd.getTime() - 1), tz, 'yyyy-MM-dd');

    let summaryId: string | null = null;
    try {
      const summaryDto = await this.periodSummaryService.ensure(report.companyId, report.employeeId, { from, to });
      summaryId = summaryDto.id;
    } catch (e) {
      this.log.warn(`Could not ensure summary for report ${reportId}: ${String(e)}`);
    }

    try {
      const tCollect0 = Date.now();
      const data = await this.reportDataService.collect(report.companyId, report.employeeId, { from, to });
      const msCollect = Date.now() - tCollect0;

      const tHtml0 = Date.now();
      const html = renderReportHtml(data);
      const msHtml = Date.now() - tHtml0;

      const tPdf0 = Date.now();
      const pdfBytes = await this.pdfRenderer.render(html);
      const msPdf = Date.now() - tPdf0;

      const storageKey = `${report.companyId}/${report.id}.pdf`;
      await this.storage.put(storageKey, pdfBytes);

      const expiresAt = new Date(Date.now() + this.env.REPORT_TTL_DAYS * 24 * 3600 * 1000);
      await this.prisma.report.update({
        where: { id: report.id },
        data: {
          status: 'READY',
          storageKey,
          byteSize: pdfBytes.byteLength,
          summaryId,
          generatedAt: new Date(),
          expiresAt,
          failureReason: null,
        },
      });

      this.log.log(
        JSON.stringify({
          reportId,
          msCollect,
          msHtml,
          msPdf,
          byteSize: pdfBytes.byteLength,
        }),
      );
    } catch (err) {
      this.log.error(`Failed to generate report ${reportId}: ${String(err)}`);
      await this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'FAILED',
          failureReason: 'RENDER_FAILED',
        },
      });
      throw err;
    }
  }
}
