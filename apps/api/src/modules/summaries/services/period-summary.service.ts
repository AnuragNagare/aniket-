import { Inject, Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  type DateRange,
  type PeriodReport,
  type PeriodSummaryDto,
  PeriodReportSchema,
  periodTypeFor,
  type SummaryQuery,
} from '@worktrail/types';
import { formatInTimeZone } from 'date-fns-tz';
import { AI_CLIENT, type AiClient } from '../../../common/ai/ai-client.js';
import { structuredCall } from '../../../common/ai/structured-call.js';
import { AuditService } from '../../../common/audit/audit.service.js';
import { RetryableJobError } from '../../../common/queue/job-errors.js';
import { JOB_QUEUE, type JobQueue } from '../../../common/queue/job-queue.js';
import { ENV, type Env } from '../../../config/env.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { ActivityService, periodBounds } from '../../employee-activity/services/activity.service.js';
import { EmployeeAccessService } from '../../employee-activity/services/employee-access.service.js';
import { TrailService } from '../../employee-activity/services/trail.service.js';
import { PERIOD_SYSTEM_PROMPT, periodPayload } from '../prompts.js';

const TRANSIENT = [Anthropic.RateLimitError, Anthropic.InternalServerError, Anthropic.APIConnectionError];

function toDto(s: any, tz: string): PeriodSummaryDto {
  const from = formatInTimeZone(s.periodStart, tz, 'yyyy-MM-dd');
  const to = formatInTimeZone(new Date(s.periodEnd.getTime() - 1), tz, 'yyyy-MM-dd');
  return {
    id: s.id,
    periodType: s.periodType,
    from,
    to,
    status: s.status,
    report: s.status === 'COMPLETE' && s.structuredData ? (s.structuredData as PeriodReport) : null,
    sourceUpdateCount: s.sourceUpdateCount,
    sourceSessionMinutes: s.sourceSessionMinutes,
    modelName: s.modelName,
    generatedAt: s.generatedAt?.toISOString() ?? null,
    requestedAt: s.requestedAt?.toISOString() ?? new Date().toISOString(),
  };
}

@Injectable()
export class PeriodSummaryService {
  private readonly log = new Logger('ai');

  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeAccess: EmployeeAccessService,
    private readonly activityService: ActivityService,
    private readonly trailService: TrailService,
    private readonly audit: AuditService,
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async get(companyId: string, employeeId: string, q: SummaryQuery): Promise<PeriodSummaryDto | null> {
    const emp = await this.employeeAccess.find(companyId, employeeId);
    const tz = emp.company.timezone;
    const bounds = periodBounds(q, tz);
    const periodType = q.period ?? periodTypeFor(q.from, q.to);

    const existing = await this.prisma.generatedSummary.findUnique({
      where: {
        employeeId_periodType_periodStart_periodEnd: {
          employeeId: emp.id,
          periodType,
          periodStart: bounds.start,
          periodEnd: bounds.end,
        },
      },
    });

    return existing ? toDto(existing, tz) : null;
  }

  async request(
    auth: AuthContext,
    employeeId: string,
    range: DateRange,
    opts: { refresh?: boolean } = {},
  ): Promise<PeriodSummaryDto> {
    const emp = await this.employeeAccess.find(auth.companyId, employeeId);
    const tz = emp.company.timezone;
    const periodType = periodTypeFor(range.from, range.to);
    const bounds = periodBounds(range, tz);

    const existing = await this.prisma.generatedSummary.findUnique({
      where: {
        employeeId_periodType_periodStart_periodEnd: {
          employeeId: emp.id,
          periodType,
          periodStart: bounds.start,
          periodEnd: bounds.end,
        },
      },
    });

    if (existing && existing.status === 'COMPLETE' && !opts.refresh) {
      return toDto(existing, tz);
    }

    const sourceUpdateCount = await this.prisma.workUpdate.count({
      where: {
        employeeId: emp.id,
        submittedAt: { gte: bounds.start, lt: bounds.end },
      },
    });

    const summary = await this.prisma.generatedSummary.upsert({
      where: {
        employeeId_periodType_periodStart_periodEnd: {
          employeeId: emp.id,
          periodType,
          periodStart: bounds.start,
          periodEnd: bounds.end,
        },
      },
      create: {
        companyId: auth.companyId,
        employeeId: emp.id,
        periodType,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        sourceUpdateCount,
        sourceSessionMinutes: 0,
        status: 'QUEUED',
        requestedAt: new Date(),
      },
      update: {
        sourceUpdateCount,
        status: 'QUEUED',
        requestedAt: new Date(),
      },
    });

    void this.queue
      .add('period.summarise', { summaryId: summary.id }, { jobId: `period.summarise:${summary.id}` })
      .catch((err) => this.log.warn(`Could not queue period summary for ${summary.id}: ${String(err)}`));

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'summary.requested',
      entityType: 'summary',
      entityId: summary.id,
      metadata: { from: range.from, to: range.to, periodType },
    });

    return toDto(summary, tz);
  }

  async ensure(companyId: string, employeeId: string, range: DateRange): Promise<PeriodSummaryDto> {
    const emp = await this.employeeAccess.find(companyId, employeeId);
    const tz = emp.company.timezone;
    const periodType = periodTypeFor(range.from, range.to);
    const bounds = periodBounds(range, tz);

    let summary = await this.prisma.generatedSummary.findUnique({
      where: {
        employeeId_periodType_periodStart_periodEnd: {
          employeeId: emp.id,
          periodType,
          periodStart: bounds.start,
          periodEnd: bounds.end,
        },
      },
    });

    if (!summary || summary.status === 'FAILED') {
      summary = await this.prisma.generatedSummary.upsert({
        where: {
          employeeId_periodType_periodStart_periodEnd: {
            employeeId: emp.id,
            periodType,
            periodStart: bounds.start,
            periodEnd: bounds.end,
          },
        },
        create: {
          companyId,
          employeeId: emp.id,
          periodType,
          periodStart: bounds.start,
          periodEnd: bounds.end,
          sourceUpdateCount: 0,
          sourceSessionMinutes: 0,
          status: 'QUEUED',
          requestedAt: new Date(),
        },
        update: {
          status: 'QUEUED',
          requestedAt: new Date(),
        },
      });
    }

    if (summary.status === 'QUEUED' || summary.status === 'PROCESSING') {
      await this.process(summary.id);
      summary = await this.prisma.generatedSummary.findUniqueOrThrow({ where: { id: summary.id } });
    }

    return toDto(summary, tz);
  }

  async process(summaryId: string, opts: { finalAttempt?: boolean } = {}): Promise<void> {
    const claimed = await this.prisma.generatedSummary.updateMany({
      where: { id: summaryId, status: { in: ['QUEUED', 'PROCESSING'] } },
      data: { status: 'PROCESSING' },
    });
    if (claimed.count === 0) return;

    const summary = await this.prisma.generatedSummary.findUniqueOrThrow({
      where: { id: summaryId },
      include: { company: true, employee: true },
    });

    const tz = summary.company.timezone;
    const start = summary.periodStart;
    const end = summary.periodEnd;
    const fromStr = formatInTimeZone(start, tz, 'yyyy-MM-dd');
    const toStr = formatInTimeZone(new Date(end.getTime() - 1), tz, 'yyyy-MM-dd');
    const range = { from: fromStr, to: toStr };

    try {
      const [sessionsRes, trailRes, updates] = await Promise.all([
        this.activityService.sessions(summary.companyId, summary.employeeId, range),
        this.trailService.trail(summary.companyId, summary.employeeId, range),
        this.prisma.workUpdate.findMany({
          where: { employeeId: summary.employeeId, submittedAt: { gte: start, lt: end } },
          orderBy: { submittedAt: 'asc' },
        }),
      ]);

      const sessionCount = sessionsRes.sessions.length;
      const totalWorkMinutes = sessionsRes.totalMinutes;
      const locationPointCount = trailRes.pointCount;
      const dataGapCount = trailRes.gapCount;
      const leftRunning = sessionsRes.sessions.some((s) => s.leftRunning);

      const periodLabel =
        summary.periodType === 'DAILY'
          ? formatInTimeZone(start, tz, 'd MMM yyyy')
          : summary.periodType === 'MONTHLY'
            ? formatInTimeZone(start, tz, 'MMMM yyyy')
            : `${formatInTimeZone(start, tz, 'd MMM yyyy')} – ${formatInTimeZone(new Date(end.getTime() - 1), tz, 'd MMM yyyy')}`;

      const shortenedNote = 'Some update text was shortened to fit; per-update summaries were used.';
      const leftRunningNote = 'A work session was still open at the time of the report.';
      let droppedText = updates.length > 150;

      let updateItems = updates.map((u) => ({
        submittedAt: u.submittedAt.toISOString(),
        text: droppedText ? undefined : u.text.slice(0, 600),
        summary: u.aiSummary ?? undefined,
      }));

      let payloadStr = periodPayload({
        employeeName: summary.employee.name,
        periodLabel,
        metrics: { sessionCount, totalWorkMinutes, locationPointCount, dataGapCount },
        updates: updateItems,
      });

      if (payloadStr.length > 60_000) {
        droppedText = true;
        updateItems = updates.map((u) => ({
          submittedAt: u.submittedAt.toISOString(),
          summary: u.aiSummary ?? u.text.slice(0, 600),
        }));
        payloadStr = periodPayload({
          employeeName: summary.employee.name,
          periodLabel,
          metrics: { sessionCount, totalWorkMinutes, locationPointCount, dataGapCount },
          updates: updateItems,
        });
      }

      const r = await structuredCall(
        this.ai,
        {
          model: this.env.AI_REPORT_MODEL,
          system: PERIOD_SYSTEM_PROMPT,
          user: payloadStr,
          schema: PeriodReportSchema,
          maxTokens: 3000,
        },
        (e) => this.log.log(JSON.stringify({ job: 'period.summarise', sourceIds: [summaryId], ...e })),
      );

      if (r.ok) {
        const dataNotes = [...r.data.dataNotes];
        if (droppedText && !dataNotes.includes(shortenedNote)) {
          dataNotes.push(shortenedNote);
        }
        if (leftRunning && !dataNotes.includes(leftRunningNote)) {
          dataNotes.push(leftRunningNote);
        }
        const finalReport: PeriodReport = { ...r.data, dataNotes };

        await this.prisma.generatedSummary.update({
          where: { id: summaryId },
          data: {
            status: 'COMPLETE',
            content: r.data.overview,
            structuredData: finalReport as any,
            modelName: r.model,
            generatedAt: new Date(),
            sourceUpdateCount: updates.length,
            sourceSessionMinutes: totalWorkMinutes,
            failureReason: null,
          },
        });
      } else {
        await this.prisma.generatedSummary.update({
          where: { id: summaryId },
          data: {
            status: 'FAILED',
            failureReason: r.reason,
          },
        });
      }
    } catch (e) {
      if (TRANSIENT.some((T) => e instanceof T)) {
        if (opts.finalAttempt) {
          await this.prisma.generatedSummary.update({
            where: { id: summaryId },
            data: { status: 'FAILED', failureReason: 'AI_UNAVAILABLE' },
          });
          return;
        }
        throw new RetryableJobError('AI temporarily unavailable');
      }
      await this.prisma.generatedSummary.update({
        where: { id: summaryId },
        data: { status: 'FAILED', failureReason: 'UNEXPECTED' },
      });
      throw e;
    }
  }
}
