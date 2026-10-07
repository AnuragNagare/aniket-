import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Readable } from 'node:stream';
import type { CreateReportInput, ReportDto, ReportsQuery, ReportsResponse } from '@worktrail/types';
import { formatInTimeZone } from 'date-fns-tz';
import { AuditService } from '../../../common/audit/audit.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import { JOB_QUEUE, type JobQueue } from '../../../common/queue/job-queue.js';
import { FILE_STORAGE, type FileStorage } from '../../../common/storage/file-storage.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { periodBounds } from '../../employee-activity/services/activity.service.js';
import { EmployeeAccessService } from '../../employee-activity/services/employee-access.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toReportDto(r: any, tz: string): ReportDto {
  const from = formatInTimeZone(r.periodStart, tz, 'yyyy-MM-dd');
  const to = formatInTimeZone(new Date(r.periodEnd.getTime() - 1), tz, 'yyyy-MM-dd');
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    from,
    to,
    status: r.status,
    requestedBy: r.requestedBy?.name ?? '',
    createdAt: r.createdAt.toISOString(),
    generatedAt: r.generatedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    byteSize: r.byteSize,
    failureReason: r.failureReason,
  };
}

@Injectable()
export class ReportsService {
  private readonly log = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeAccess: EmployeeAccessService,
    private readonly audit: AuditService,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async create(auth: AuthContext, input: CreateReportInput): Promise<ReportDto> {
    const employee = await this.employeeAccess.find(auth.companyId, input.employeeId);
    const tz = employee.company.timezone;
    const { start, end } = periodBounds({ from: input.from, to: input.to }, tz);

    const report = await this.prisma.report.create({
      data: {
        companyId: auth.companyId,
        employeeId: input.employeeId,
        requestedByUserId: auth.userId,
        periodStart: start,
        periodEnd: end,
        includeMap: input.includeMap ?? false,
        status: 'QUEUED',
      },
      include: { employee: true, requestedBy: true },
    });

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'report.requested',
      entityType: 'report',
      entityId: report.id,
      metadata: { employeeId: input.employeeId, from: input.from, to: input.to },
    });

    void this.queue
      .add('report.generate', { reportId: report.id }, { jobId: `report.generate:${report.id}` })
      .catch((err) => this.log.warn(`Could not queue report ${report.id}: ${String(err)}`));

    return toReportDto(report, tz);
  }

  async list(companyId: string, query: ReportsQuery): Promise<ReportsResponse> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const where = {
      companyId,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: { employee: true, requestedBy: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items: rows.map((r) => toReportDto(r, company.timezone)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(companyId: string, id: string): Promise<ReportDto> {
    if (!UUID.test(id)) {
      throw new AppError(404, 'NOT_FOUND', 'Report not found.');
    }

    const report = await this.prisma.report.findFirst({
      where: { id, companyId },
      include: { employee: true, requestedBy: true, company: true },
    });

    if (!report) {
      throw new AppError(404, 'NOT_FOUND', 'Report not found.');
    }

    return toReportDto(report, report.company.timezone);
  }

  async download(
    auth: AuthContext,
    id: string,
  ): Promise<{ stream: Readable; filename: string; size: number }> {
    if (!UUID.test(id)) {
      throw new AppError(404, 'NOT_FOUND', 'Report not found.');
    }

    const report = await this.prisma.report.findFirst({
      where: { id, companyId: auth.companyId },
      include: { employee: true, company: true },
    });

    if (!report) {
      throw new AppError(404, 'NOT_FOUND', 'Report not found.');
    }

    if (report.status === 'QUEUED' || report.status === 'GENERATING') {
      throw new AppError(409, 'REPORT_NOT_READY', 'This report is still being prepared.');
    }

    if (report.status === 'FAILED') {
      throw new AppError(409, 'REPORT_FAILED', report.failureReason ?? 'Report generation failed.');
    }

    if ((report.expiresAt && report.expiresAt < new Date()) || !report.storageKey) {
      throw new AppError(410, 'REPORT_EXPIRED', 'This report has expired. Create a new one.');
    }

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'report.downloaded',
      entityType: 'report',
      entityId: report.id,
      metadata: { employeeId: report.employeeId },
    });

    const stream = await this.storage.stream(report.storageKey);
    const employeeSlug = report.employee.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const tz = report.company.timezone;
    const fromStr = formatInTimeZone(report.periodStart, tz, 'yyyy-MM-dd');
    const toStr = formatInTimeZone(new Date(report.periodEnd.getTime() - 1), tz, 'yyyy-MM-dd');
    const filename = `work-report-${employeeSlug}-${fromStr}-to-${toStr}.pdf`;

    return {
      stream,
      filename,
      size: report.byteSize ?? 0,
    };
  }
}
