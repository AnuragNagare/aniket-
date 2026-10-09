import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface CompanyPilotMetrics {
  companyId: string;
  companyName: string;
  activeEmployees: number;
  firstPointWithin2MinPct: number | 'n/a';
  workdaysWithUpdatePct: number | 'n/a';
  summariesWithin60sPct: number | 'n/a';
  reportP95Seconds: number | 'n/a';
  activeWeeks: number[];
}

export interface MetricOptions {
  from: Date;
  to: Date;
  companyId?: string;
}

export async function pilotMetrics(
  prisma: PrismaClient,
  opts: MetricOptions,
): Promise<CompanyPilotMetrics[]> {
  const { from, to, companyId } = opts;

  const companies = await prisma.company.findMany({
    where: companyId ? { id: companyId } : undefined,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const results: CompanyPilotMetrics[] = [];

  for (const comp of companies) {
    // 1. Active employees (not deleted)
    const activeEmployeesCount = await prisma.employee.count({
      where: {
        companyId: comp.id,
        deletedAt: null,
      },
    });

    // 2. Sessions in date range
    const sessions = await prisma.workSession.findMany({
      where: {
        companyId: comp.id,
        startedAtServer: { gte: from, lte: to },
      },
      include: {
        points: {
          orderBy: { capturedAt: 'asc' },
          take: 1,
        },
      },
    });

    // Metric 1: firstPointWithin2MinPct (>= 80% target)
    let firstPointWithin2MinPct: number | 'n/a' = 'n/a';
    if (sessions.length > 0) {
      let within2Min = 0;
      for (const s of sessions) {
        if (s.points.length > 0) {
          const firstPt = s.points[0];
          const diffMs = firstPt.capturedAt.getTime() - s.startedAtServer.getTime();
          if (diffMs <= 120_000) {
            within2Min++;
          }
        }
      }
      firstPointWithin2MinPct = Number(((within2Min / sessions.length) * 100).toFixed(1));
    }

    // Metric 2: workdaysWithUpdatePct (>= 70% target)
    // Find unique employee workdays (employeeId + YYYY-MM-DD)
    const employeeWorkdays = new Map<string, { employeeId: string; dateStr: string }>();
    for (const s of sessions) {
      const dateStr = s.startedAtServer.toISOString().slice(0, 10);
      const key = `${s.employeeId}:${dateStr}`;
      employeeWorkdays.set(key, { employeeId: s.employeeId, dateStr });
    }

    let workdaysWithUpdatePct: number | 'n/a' = 'n/a';
    if (employeeWorkdays.size > 0) {
      const updates = await prisma.workUpdate.findMany({
        where: {
          companyId: comp.id,
          submittedAt: { gte: from, lte: to },
        },
        select: { employeeId: true, submittedAt: true },
      });

      const updateDays = new Set<string>();
      for (const u of updates) {
        const dateStr = u.submittedAt.toISOString().slice(0, 10);
        updateDays.add(`${u.employeeId}:${dateStr}`);
      }

      let daysWithUpdate = 0;
      for (const key of employeeWorkdays.keys()) {
        if (updateDays.has(key)) {
          daysWithUpdate++;
        }
      }
      workdaysWithUpdatePct = Number(
        ((daysWithUpdate / employeeWorkdays.size) * 100).toFixed(1),
      );
    }

    // Metric 3: summariesWithin60sPct (>= 90% target: summaryGeneratedAt - submittedAt <= 60s)
    const completedUpdates = await prisma.workUpdate.findMany({
      where: {
        companyId: comp.id,
        submittedAt: { gte: from, lte: to },
        summaryStatus: 'COMPLETE',
      },
      select: {
        submittedAt: true,
        summaryGeneratedAt: true,
      },
    });

    let summariesWithin60sPct: number | 'n/a' = 'n/a';
    if (completedUpdates.length > 0) {
      let within60s = 0;
      for (const u of completedUpdates) {
        if (u.summaryGeneratedAt) {
          const diffSec = (u.summaryGeneratedAt.getTime() - u.submittedAt.getTime()) / 1000;
          if (diffSec <= 60) {
            within60s++;
          }
        }
      }
      summariesWithin60sPct = Number(((within60s / completedUpdates.length) * 100).toFixed(1));
    }

    // Metric 4: reportP95Seconds (< 30s target)
    const reports = await prisma.report.findMany({
      where: {
        companyId: comp.id,
        createdAt: { gte: from, lte: to },
        status: 'READY',
      },
      select: {
        createdAt: true,
        generatedAt: true,
      },
    });

    let reportP95Seconds: number | 'n/a' = 'n/a';
    if (reports.length > 0) {
      const durations: number[] = [];
      for (const r of reports) {
        if (r.generatedAt) {
          const diffSec = (r.generatedAt.getTime() - r.createdAt.getTime()) / 1000;
          durations.push(diffSec);
        }
      }
      if (durations.length > 0) {
        durations.sort((a, b) => a - b);
        const p95Idx = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
        reportP95Seconds = Number(durations[p95Idx].toFixed(1));
      }
    }

    // Metric 5: activeWeeks (admin login + >= 3 employee sessions in the 7-day bucket)
    const totalDays = Math.ceil((to.getTime() - from.getTime()) / (7 * 86_400_000));
    const numWeeks = Math.max(1, totalDays);
    const activeWeeks: number[] = [];

    for (let w = 0; w < numWeeks; w++) {
      const weekStart = new Date(from.getTime() + w * 7 * 86_400_000);
      const weekEnd = new Date(Math.min(to.getTime(), weekStart.getTime() + 7 * 86_400_000));

      const adminLogins = await prisma.auditLog.count({
        where: {
          companyId: comp.id,
          action: 'admin.signed_in',
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      });

      const weekSessions = await prisma.workSession.count({
        where: {
          companyId: comp.id,
          startedAtServer: { gte: weekStart, lte: weekEnd },
        },
      });

      if (adminLogins >= 1 && weekSessions >= 3) {
        activeWeeks.push(w + 1);
      }
    }

    results.push({
      companyId: comp.id,
      companyName: comp.name,
      activeEmployees: activeEmployeesCount,
      firstPointWithin2MinPct,
      workdaysWithUpdatePct,
      summariesWithin60sPct,
      reportP95Seconds,
      activeWeeks,
    });
  }

  return results;
}

// CLI execution helper
async function main() {
  const args = process.argv.slice(2);
  let fromStr = '';
  let toStr = '';
  let compId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) fromStr = args[++i];
    if (args[i] === '--to' && args[i + 1]) toStr = args[++i];
    if (args[i] === '--company' && args[i + 1]) compId = args[++i];
  }

  const to = toStr ? new Date(`${toStr}T23:59:59.999Z`) : new Date();
  const from = fromStr
    ? new Date(`${fromStr}T00:00:00.000Z`)
    : new Date(to.getTime() - 28 * 86_400_000);

  const prisma = new PrismaClient();
  try {
    const results = await pilotMetrics(prisma, { from, to, companyId: compId });

    console.log('\n================ WORK TRAIL PILOT SUCCESS METRICS ================');
    console.log(`Period: ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`);
    console.table(
      results.map((r) => ({
        Company: r.companyName,
        Staff: r.activeEmployees,
        '1st Point <2m (%)': r.firstPointWithin2MinPct,
        'Workdays w/ Update (%)': r.workdaysWithUpdatePct,
        'Summaries <60s (%)': r.summariesWithin60sPct,
        'Report P95 (s)': r.reportP95Seconds,
        'Active Weeks': r.activeWeeks.join(', ') || 'none',
      })),
    );

    const dateToday = new Date().toISOString().slice(0, 10);
    const csvFile = path.resolve(`pilot-metrics-${dateToday}.csv`);
    const csvHeader =
      'CompanyId,Company,ActiveStaff,FirstPointWithin2MinPct,WorkdaysWithUpdatePct,SummariesWithin60sPct,ReportP95Seconds,ActiveWeeks\n';
    const csvRows = results
      .map(
        (r) =>
          `"${r.companyId}","${r.companyName}",${r.activeEmployees},${r.firstPointWithin2MinPct},${r.workdaysWithUpdatePct},${r.summariesWithin60sPct},${r.reportP95Seconds},"${r.activeWeeks.join(';')}"`,
      )
      .join('\n');

    await fs.writeFile(csvFile, csvHeader + csvRows, 'utf8');
    console.log(`Exported report to: ${csvFile}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('pilot-metrics.ts') || process.argv[1]?.endsWith('pilot-metrics.js')) {
  main().catch((err) => {
    console.error('Fatal error running pilot metrics:', err);
    process.exit(1);
  });
}
